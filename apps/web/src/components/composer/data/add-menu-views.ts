import {
  Attachment01Icon,
  CommandIcon,
  DatabaseIcon,
  EarthIcon,
  Folder01Icon,
  GlobeIcon,
  Mortarboard01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import {
  type FileKind,
  isUsable,
  type NativeToolKind,
  type ResolvedCaps,
  type ToolKind,
} from "../catalog/capabilities"
import { formatMb } from "../catalog/reconcile"

/**
 * A tool the agent runtime manages itself.
 *
 * Declared here rather than imported from `state/` because `data/` sits below
 * the store in this folder's dependency direction; the shape is all this view
 * model needs, and the store's own `RuntimeTool` satisfies it.
 */
type RuntimeToolView = {
  id: string
  label: string
  hint?: string
}

/**
 * What the add selector offers, and what each row means.
 *
 * The rows are computed here rather than in the menu so the rules that decide
 * what appears — which the model supports, which key can run, which tools the
 * runtime owns — can be read and tested without rendering anything. That
 * matters because most of those rules are *negative*: a section that is missing
 * is as much a decision as one that is present, and a decision buried in JSX is
 * a decision nobody can check.
 */

type ToolDef = {
  id: string
  label: string
  hint: string
  icon: IconSvgElement
}

/**
 * Tool ids are `"<kind>:<name>"`. Encoding the kind in the id is what lets the
 * store answer "can this model run that" as a set intersection instead of a
 * registry lookup — see `toolKindOf`.
 */
const LOCAL_TOOLS: ToolDef[] = [
  {
    id: "shell:Bash",
    label: "Run commands",
    hint: "Execute shell commands",
    icon: CommandIcon,
  },
  {
    id: "fs_read:Read",
    label: "Read files",
    hint: "Read from the workspace",
    icon: Folder01Icon,
  },
  {
    id: "fs_write:Write",
    label: "Write files",
    hint: "Create and edit files",
    icon: Wrench01Icon,
  },
  {
    id: "http:Fetch",
    label: "Fetch URL",
    hint: "Make HTTP requests",
    icon: GlobeIcon,
  },
  {
    id: "db:Query",
    label: "Query database",
    hint: "Run SQL against connected sources",
    icon: DatabaseIcon,
  },
]

const NATIVE_LABELS: Record<
  NativeToolKind,
  { label: string; hint: string; icon: IconSvgElement }
> = {
  web_search: {
    label: "Web search",
    hint: "Run by the provider",
    icon: EarthIcon,
  },
  code_interpreter: {
    label: "Code interpreter",
    hint: "Run by the provider",
    icon: Mortarboard01Icon,
  },
  computer_use: {
    label: "Computer use",
    hint: "Run by the provider",
    icon: CommandIcon,
  },
  file_search: {
    label: "File search",
    hint: "Run by the provider",
    icon: Folder01Icon,
  },
}

const FILE_KIND_LABELS: Record<FileKind, string> = {
  image: "Images",
  pdf: "PDFs",
  text: "Text",
  audio: "Audio",
  video: "Video",
  archive: "Archives",
}

/** The id of the one row that acts rather than reports. */
export const ATTACH_FILES_ID = "files"

export type AddMenuItem = {
  id: string
  label: string
  hint?: string
  icon: IconSvgElement
} & (
  | { kind: "action" }
  /**
   * A switch the user owns: it stays true or false, and it can be turned back
   * off. Checkbox rows keep the menu open so a turn can be given several tools
   * in one visit.
   */
  | { kind: "toggle"; checked: boolean }
  /**
   * A fact about the deployment or the vendor. The user cannot change it, and a
   * control that looks changeable when it is not is a lie about what happens on
   * send.
   */
  | { kind: "fact" }
)

export type AddMenuSection = {
  id: string
  /** The group heading. `null` for a section that reads better without one. */
  label: string | null
  items: AddMenuItem[]
}

export type AddMenuView = {
  sections: AddMenuSection[]
  /** What the trigger's count reports: the switches that are currently on. */
  enabledCount: number
  /**
   * True when a provider has native tools this key cannot run yet. Their rows
   * are still listed — a hidden capability is an invisible problem — but they
   * need a sentence saying why they cannot be used.
   */
  nativeLocked: boolean
}

export function buildAddMenuView(input: {
  caps: ResolvedCaps
  toolIds: readonly string[]
  search: boolean
  runtimeTools: readonly RuntimeToolView[]
}): AddMenuView {
  const { caps } = input
  const sections: AddMenuSection[] = []

  sections.push({
    id: "files",
    label: "Add",
    items: [
      {
        id: ATTACH_FILES_ID,
        kind: "action",
        label: "Files",
        hint: fileHint(caps),
        icon: Attachment01Icon,
      },
    ],
  })

  if (caps.search.capability !== null) {
    sections.push({
      id: "search",
      label: null,
      items: [
        {
          id: "search",
          kind: "toggle",
          label: "Web search",
          hint:
            caps.search.access.kind === "gated"
              ? "Needs a connected key"
              : "Let the model search the web",
          icon: EarthIcon,
          checked: input.search,
        },
      ],
    })
  }

  const nativeKinds = caps.native.capability?.kinds ?? []
  if (nativeKinds.length > 0) {
    sections.push({
      id: "provider-tools",
      label: "Run by the provider",
      items: nativeKinds.map((kind) => ({
        id: `native:${kind}`,
        kind: "fact" as const,
        ...NATIVE_LABELS[kind],
      })),
    })
  }

  if (input.runtimeTools.length > 0) {
    sections.push({
      id: "runtime-tools",
      label: "Managed by the agent runtime",
      items: input.runtimeTools.map((tool) => ({
        id: `runtime:${tool.id}`,
        kind: "fact" as const,
        label: tool.label,
        hint: tool.hint,
        icon: Wrench01Icon,
      })),
    })
  }

  const supportedKinds = isUsable(caps.tools)
    ? (caps.tools.capability.kinds as readonly ToolKind[])
    : []
  const available = LOCAL_TOOLS.filter((tool) =>
    supportedKinds.includes(toolIdKind(tool.id)),
  )
  if (available.length > 0) {
    sections.push({
      id: "tools",
      label: "Your tools",
      items: available.map((tool) => ({
        id: tool.id,
        kind: "toggle" as const,
        label: tool.label,
        hint: tool.hint,
        icon: tool.icon,
        checked: input.toolIds.includes(tool.id),
      })),
    })
  }

  // The ceiling, but only when there is one. A model that supports no tools at
  // all is not better served by five rows announcing exactly that; it is better
  // served by the section being absent.
  const unavailable = LOCAL_TOOLS.filter(
    (tool) => !supportedKinds.includes(toolIdKind(tool.id)),
  )
  if (available.length > 0 && unavailable.length > 0) {
    sections.push({
      id: "unsupported",
      label: "Not supported by this model",
      items: unavailable.map((tool) => ({
        id: `unsupported:${tool.id}`,
        kind: "fact" as const,
        label: tool.label,
        icon: tool.icon,
      })),
    })
  }

  return {
    sections,
    enabledCount: input.toolIds.length + (input.search ? 1 : 0),
    nativeLocked: caps.native.access.kind === "gated",
  }
}

function toolIdKind(toolId: string): ToolKind {
  return toolId.split(":")[0] as ToolKind
}

/**
 * What this model will accept, in the words its own capability record uses.
 *
 * Nothing is said when the model takes no files at all: a hint is only honest
 * when there is something true to hint at.
 */
function fileHint(caps: ResolvedCaps): string | undefined {
  if (!isUsable(caps.files)) return undefined
  const { kinds, maxFiles, maxSizeMb } = caps.files.capability
  const named = kinds.map((kind) => FILE_KIND_LABELS[kind] ?? kind).join(", ")
  if (!named) return undefined
  return `${named} up to ${formatMb(maxSizeMb)} · ${maxFiles} per message`
}
