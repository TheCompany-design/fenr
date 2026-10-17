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
import { modelFacts, modelName } from "@/features/nabu/model-catalogue"
import type {
  ListedModel,
  ProviderModelsResponse,
  TenantProviderList,
  TenantProviderSummary,
} from "@/lib/schemas/nabu"

/**
 * The longest prompt the runtime accepts, in bytes (`MAX_PROMPT_BYTES` in
 * thebookofnabu's `StartTurnRequest`). Flattening enforces it as a backstop;
 * the composer's reconcile rules keep ordinary attachments clear of it.
 */
export const MAX_PROMPT_BYTES = 64 * 1024

/**
 * One catalogue entry, as the picker renders it.
 *
 * The vendor's own name where it published one, its facts as a muted line
 * (context window, price, image input — the same formatters the settings
 * screen used, so a model reads identically in both places), and capability
 * claims taken from what the vendor actually said: an image cap only when the
 * vendor admitted images, and a context window the vendor published rather
 * than the runtime's fallback.
 */
export function toCatalogModel(
  model: ListedModel,
  providerId: string,
): ModelSpec {
  return {
    id: model.id,
    providerId,
    name: modelName(model),
    tagline: modelFacts(model) || providerId,
    keyAccessConfirmed:
      model.access_evidence === "available_for_key" ? true : undefined,
    caps: {
      vision: model.accepts_images
        ? { supported: true, maxImages: 8 }
        : { supported: false },
      files: {
        supported: true,
        kinds: ["text"],
        maxFiles: 8,
        // Per-file ceiling; files are flattened into the prompt, so the
        // 64 KB wire cap is the real budget and is enforced again at send.
        maxSizeMb: 0.05,
      },
      pdf: { supported: false },
      reasoning: model.reasoning
        ? {
            supported: true,
            // Verbatim from the listing: the backend declared these levels in
            // its declared order (lowest first), and the ids are exactly what
            // a turn request sends back.
            levels: model.reasoning.levels,
            default: model.reasoning.default,
          }
        : { supported: false },
      // Tools are chosen by the runtime's own policy per turn, not per
      // message; they are shown as runtime-managed rows instead of toggles.
      tools: { supported: false },
      native: { supported: false },
      search: { supported: false },
      cache: { supported: false },
    },
    limits: {
      // The vendor's published window when it stated one; the runtime's
      // 32,000-token windowing budget otherwise, which is the honest number
      // to meter against until calibration says otherwise.
      contextWindow: model.context_window ?? 32_000,
      maxOutput: model.max_output_tokens ?? 4_096,
    },
    cost: {
      inputPerMTok: model.pricing?.input_usd ?? 0,
      outputPerMTok: model.pricing?.output_usd ?? 0,
    },
  }
}

/**
 * The saved configuration's catalogue, through a refusal that says itself.
 *
 * The catalogue fetch and the settings form's key test are the same dial with
 * the stored credential, so a declined credential is a failed catalogue whose
 * message is the vendor's own sentence — not a generic error this service
 * reworded.
 */
export async function loadSavedCatalogue(
  fetchCatalogue: (configId: string) => Promise<ProviderModelsResponse>,
  configId: string,
): Promise<readonly ModelSpec[]> {
  const result = await fetchCatalogue(configId)
  if (!result.ok) {
    throw new Error(
      result.message ?? "The provider did not accept that credential.",
    )
  }
  return (result.models ?? []).map((model) => toCatalogModel(model, configId))
}

export function toComposerProvider(
  config: TenantProviderSummary,
  fetchCatalogue: (configId: string) => Promise<ProviderModelsResponse>,
): ProviderSpec {
  return {
    id: config.id,
    label: config.label ?? providerDisplayName(config.provider),
    // updated_at is a full-resolution configuration revision. The short
    // display fingerprint is intentionally not used as an identity hash.
    credentialRevision: config.updated_at,
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
      // The vendor's own catalogue, fetched with the stored credential at
      // hydrate time. A refusal or an unreachable runtime lands the tab in
      // the catalog's failed state, which names the finding and offers a
      // retry — a single saved model stood in for this catalogue before,
      // and that was why the picker showed one model per provider.
      load: () => loadSavedCatalogue(fetchCatalogue, config.id),
    },
  }
}

/**
 * The workspace's saved providers, default first, so the composer's
 * auto-selection lands on the configuration new conversations actually use.
 *
 * `fetchCatalogue` is injected rather than imported so this module stays free
 * of server-function imports, and unit tests can drive the catalogue with
 * fakes instead of the TanStack runtime.
 */
export function orderProviders(
  list: TenantProviderList,
  fetchCatalogue: (configId: string) => Promise<ProviderModelsResponse>,
): ProviderSpec[] {
  const providers = [...list.providers]
  providers.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return a.updated_at.localeCompare(b.updated_at)
  })
  return providers.map((config) => toComposerProvider(config, fetchCatalogue))
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
