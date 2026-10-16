import type { Attachment } from "./attachments"
import {
  type EffortLevelId,
  isUsable,
  type ResolvedCaps,
  type ToolKind,
} from "./capabilities"
import { settleLevel } from "./effort"
import type { ContextUsage } from "./usage"

const TOOL_KINDS: readonly ToolKind[] = [
  "shell",
  "fs_read",
  "fs_write",
  "browser",
  "db",
  "http",
] as const

/**
 * Reconcile is a pure function of (composer state, capabilities). Everything
 * that can invalidate the composer — a model switch, a credential expiring, a
 * plan downgrade — routes through it, so there is one rule set rather than one
 * per trigger.
 *
 * Two output channels, and the split is the whole design:
 *
 *   notices  — settings we adjusted silently (effort clamped). The user's
 *              intent is still satisfiable, so we satisfy a close version of
 *              it and move on.
 *   blockers — content we refuse to drop (images on a model with no vision).
 *              Losing someone's attached work without asking is the one
 *              unforgivable failure, so send is gated until they decide.
 *
 * The invariant: settings are never preserved past the point they are valid,
 * and content is never discarded without a blocker.
 */

export type Mention = {
  id: string
  kind: "file" | "folder" | "url" | "agent"
  label: string
  /** Inserted text, used to validate the span against the current value. */
  insertText: string
  start: number
  end: number
}

export type Selection = {
  providerId: string
  modelId: string
}

export type ComposerState = {
  text: string
  mentions: Mention[]
  attachments: Attachment[]
  selection: Selection | null
  effort: EffortLevelId | null
  toolIds: string[]
  search: boolean
}

export type Blocker =
  | {
      kind: "vision"
      count: number
      attachments: Attachment[]
    }
  | { kind: "files"; rejected: { name: string; reason: string }[] }
  | {
      kind: "context-overflow"
      overflow: number
      window: number
      usage: ContextUsage
    }
  | { kind: "provider-unready" }
  | { kind: "no-model" }

export type Notice =
  | { kind: "effort-clamped"; from: EffortLevelId; to: EffortLevelId }
  | { kind: "effort-dropped" }
  | { kind: "tools-pruned"; removed: string[] }
  | { kind: "search-disabled" }

export type ReconcileResult = {
  state: ComposerState
  blockers: Blocker[]
  notices: Notice[]
}

export function reconcile(
  state: ComposerState,
  caps: ResolvedCaps,
  usage?: ContextUsage,
): ReconcileResult {
  const next: ComposerState = { ...state }
  const blockers: Blocker[] = []
  const notices: Notice[] = []

  if (!caps.model) {
    blockers.push({ kind: "no-model" })
    return { state: next, blockers, notices }
  }

  // --- effort: a setting, so it is adjusted rather than surfaced -----------
  if (isUsable(caps.reasoning)) {
    const scale = caps.reasoning.capability
    const clamped = settleLevel(scale.levels, state.effort, scale.default)
    if (state.effort !== null && clamped !== null && clamped !== state.effort) {
      notices.push({
        kind: "effort-clamped",
        from: state.effort,
        to: clamped,
      })
    }
    next.effort = clamped
  } else {
    // Reasoning disappearing is a notice, never a blocker. The user downgraded
    // deliberately; dropping the level and telling them is the whole response.
    // Blocking the send would punish them for changing models.
    if (state.effort !== null) notices.push({ kind: "effort-dropped" })
    next.effort = null
  }

  // --- attachments: content, so they block rather than vanish -------------
  // Everything a file rule rejects is listed by name, because the resolution
  // is the user's to make: drop the file, or pick a model that accepts it.
  // None of these are silently dropped at send — that is the one unforgivable
  // failure this channel exists to prevent.
  const files = isUsable(caps.files) ? caps.files.capability : null
  const rejected: { name: string; reason: string }[] = []
  if (files) {
    if (next.attachments.length > files.maxFiles) {
      for (const attachment of next.attachments.slice(files.maxFiles)) {
        rejected.push({
          name: attachment.name,
          reason: `more than ${files.maxFiles} files attached`,
        })
      }
    }
    for (const attachment of next.attachments) {
      const kinds = fileKindOf(attachment.mimeType)
      const accepted = kinds.some((kind) =>
        (files.kinds as readonly string[]).includes(kind),
      )
      if (!accepted) {
        rejected.push({
          name: attachment.name,
          reason: `${attachment.mimeType || "this file type"} can't be sent`,
        })
      } else if (attachment.size > files.maxSizeMb * 1024 * 1024) {
        rejected.push({
          name: attachment.name,
          reason: `larger than ${formatMb(files.maxSizeMb)}`,
        })
      }
    }
  }
  if (rejected.length > 0) {
    blockers.push({ kind: "files", rejected })
  }

  const images = next.attachments.filter((a) => a.mimeType.startsWith("image/"))
  if (images.length > 0) {
    if (!isUsable(caps.vision)) {
      blockers.push({
        kind: "vision",
        count: images.length,
        attachments: images,
      })
    } else if (images.length > caps.vision.capability.maxImages) {
      blockers.push({
        kind: "vision",
        count: images.length,
        attachments: images,
      })
    }
  }

  // --- tools: a setting, so extras are pruned and reported -----------------
  // Dropping a tool is reported as a notice, never a blocker. The user did not
  // hand the composer a file to protect here; they toggled a switch, and being
  // told what was switched off is the complete response.
  if (isUsable(caps.tools)) {
    const { kinds } = caps.tools.capability
    const kept = next.toolIds.filter((id) => {
      const kind = toolKindOf(id)
      return kind !== null && kinds.includes(kind)
    })
    const removed = next.toolIds.filter((id) => !kept.includes(id))
    if (removed.length) notices.push({ kind: "tools-pruned", removed })
    next.toolIds = kept
  } else {
    next.toolIds = []
  }

  // --- web search: a setting, force off ------------------------------------
  if (next.search && !isUsable(caps.search)) {
    next.search = false
    notices.push({ kind: "search-disabled" })
  }

  // --- context window: content, so it blocks --------------------------------
  // Measured against the *selected* model, which is why this lives here and
  // not in the meter: picking a model with a smaller window can push an
  // existing conversation over the limit, and that is the user's content at
  // risk, not a setting we can quietly adjust.
  if (usage && usage.overflow > 0) {
    blockers.push({
      kind: "context-overflow",
      overflow: usage.overflow,
      window: usage.window,
      usage,
    })
  }

  return { state: next, blockers, notices }
}

/**
 * Tool ids are `"<kind>:<name>"`. Keeping the kind in the id is what lets
 * reconcile answer "does this model support this tool" without a registry
 * lookup — the capability check stays a pure data operation.
 */
export function toolKindOf(toolId: string): ToolKind | null {
  const [kind] = toolId.split(":")
  return TOOL_KINDS.find((candidate) => candidate === kind) ?? null
}

/**
 * The composer's coarse file kinds for a mime type. A mime that maps to no
 * kind is rejected by every allow-list, which is the right default for a
 * file nobody can say is text.
 */
function fileKindOf(mimeType: string): readonly string[] {
  if (mimeType.startsWith("image/")) return ["image"]
  if (mimeType === "application/pdf") return ["pdf"]
  if (mimeType.startsWith("text/")) return ["text"]
  if (
    /^(application\/json|application\/xml|application\/yaml|application\/x-yaml|application\/toml|application\/javascript)$/.test(
      mimeType,
    ) ||
    /\+(json|xml)$/.test(mimeType)
  ) {
    return ["text"]
  }
  if (mimeType.startsWith("audio/")) return ["audio"]
  if (mimeType.startsWith("video/")) return ["video"]
  if (
    /^(application\/zip|application\/x-tar|application\/gzip|application\/x-7z-compressed|application\/x-rar-compressed)$/.test(
      mimeType,
    )
  ) {
    return ["archive"]
  }
  return []
}

/**
 * A size in megabytes, said the way the reader thinks about it. Exported because
 * the rule that enforces the ceiling and the hint that warns about it have to
 * say the same number: two formatters would drift into "50 KB" and "0.05 MB".
 */
export function formatMb(sizeMb: number): string {
  if (sizeMb < 1) return `${Math.round(sizeMb * 1024)} KB`
  return `${sizeMb} MB`
}
