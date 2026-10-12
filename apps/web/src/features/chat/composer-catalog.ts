/**
 * Pure mapping logic for the composer's host seam.
 *
 * Kept free of server-function imports so it can be unit-tested without
 * dragging the TanStack Start runtime (and the database driver its server
 * modules pull in) into a test environment.
 */

import type {
  ComposerAttachment,
  ModelSpec,
  ProviderSpec,
} from "@/components/composer"
import { providerDisplayName } from "@/components/providers/provider-identity"
import type {
  TenantProviderList,
  TenantProviderSummary,
} from "@/lib/schemas/nabu"

/**
 * The longest prompt the runtime accepts, in bytes (`MAX_PROMPT_BYTES` in
 * thebookofnabu's `StartTurnRequest`). Flattening enforces it as a backstop;
 * the composer's reconcile rules keep ordinary attachments clear of it.
 */
export const MAX_PROMPT_BYTES = 64 * 1024

export function toModelSpec(config: TenantProviderSummary): ModelSpec {
  return {
    id: config.model,
    providerId: config.id,
    name: config.model,
    tagline: config.label ?? providerDisplayName(config.provider),
    caps: {
      // The turn API is text-only today: no image inputs, no PDF parts, and
      // no reasoning-effort field. Saying so in the capability model is what
      // keeps the composer's controls honest — effort hides itself, images
      // block with a reason instead of vanishing at send.
      vision: { supported: false },
      files: {
        supported: true,
        kinds: ["text"],
        maxFiles: 8,
        // Per-file ceiling; files are flattened into the prompt, so the
        // 64 KB wire cap is the real budget and is enforced again at send.
        maxSizeMb: 0.05,
      },
      pdf: { supported: false },
      reasoning: { supported: false },
      // Tools are chosen by the runtime's own policy per turn, not per
      // message; they are shown as runtime-managed rows instead of toggles.
      tools: { supported: false },
      native: { supported: false },
      search: { supported: false },
      cache: { supported: false },
    },
    // The runtime windows context against a constant 32,000-token budget
    // (report §8 decision 4: keep it until calibration data says otherwise),
    // so that is the honest number to meter against.
    limits: {
      contextWindow: 32_000,
      maxOutput: config.max_output_tokens ?? 4_096,
    },
    // Cost is computed at read time from the pricing snapshot on the server;
    // the picker has no per-token price to show until that surfaces.
    cost: { inputPerMTok: 0, outputPerMTok: 0 },
  }
}

export function toComposerProvider(
  config: TenantProviderSummary,
): ProviderSpec {
  const model = toModelSpec(config)
  return {
    id: config.id,
    label: config.label ?? providerDisplayName(config.provider),
    plan: "workspace",
    source: {
      id: config.id,
      label: config.label ?? providerDisplayName(config.provider),
      // The vendor the mark is drawn for; the label above is the workspace's
      // own name for the entry and may be anything.
      vendor: config.provider,
      // The credential is server-side; there is nothing to validate here.
      requiresCredential: false,
      effortEncoding: { style: "none" },
      load: async () => [model],
    },
  }
}

/**
 * The workspace's saved providers, default first, so the composer's
 * auto-selection lands on the configuration new conversations actually use.
 */
export function orderProviders(list: TenantProviderList): ProviderSpec[] {
  const providers = [...list.providers]
  providers.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return a.updated_at.localeCompare(b.updated_at)
  })
  return providers.map(toComposerProvider)
}

/**
 * The runtime's tools, named for people rather than registry ids. Rendered as
 * runtime-managed rows: the deployment's tool policy — not a per-message
 * checkbox — decides what a turn may reach.
 */
export function toRuntimeTools(
  tools: readonly string[],
): { id: string; label: string; hint: string }[] {
  const known: Record<string, { label: string; hint: string }> = {
    web_search: { label: "Web search", hint: "Runs on the provider" },
    echo: { label: "Echo", hint: "Diagnostic tool" },
  }
  return tools.map((id) => ({
    id,
    label: known[id]?.label ?? id,
    hint: known[id]?.hint ?? "Granted by this deployment",
  }))
}

/**
 * Mime types that can ride inside a text prompt. Everything else is already
 * rejected by reconcile — this is the same allow-list, restated at the
 * boundary where the file is actually read.
 */
export function isTextLike(mimeType: string): boolean {
  if (mimeType.startsWith("text/")) return true
  if (
    /^(application\/(json|xml|yaml|x-yaml|toml|javascript|x-sh|sql))$/.test(
      mimeType,
    )
  ) {
    return true
  }
  return /\+(json|xml)$/.test(mimeType)
}

/**
 * Flattens text attachments into the prompt body.
 *
 * The runtime's turn API carries exactly one string; an attached file that
 * never reaches the model is the failure the composer exists to prevent, so
 * the file's content is appended under a named fence rather than dropped.
 * The byte cap is enforced here as the authoritative backstop — reconcile
 * keeps ordinary files well clear of it, and exceeding it fails loudly
 * (nothing is sent, nothing is silently trimmed).
 */
export async function flattenPrompt(
  text: string,
  attachments: readonly ComposerAttachment[],
): Promise<string> {
  let prompt = text
  for (const attachment of attachments) {
    if (!attachment.file || !isTextLike(attachment.mimeType)) continue
    const content = await attachment.file.text()
    prompt += `\n\n--- attached file: ${attachment.name} ---\n${content}`
  }

  const bytes = new TextEncoder().encode(prompt).length
  if (bytes > MAX_PROMPT_BYTES) {
    throw new Error(
      `The message and its attachments are about ${Math.round(bytes / 1024)} KB; this runtime accepts 64 KB. Remove a file and try again.`,
    )
  }
  return prompt
}
