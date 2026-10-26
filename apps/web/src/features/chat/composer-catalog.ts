import type {
  ComposerAttachment,
  ModelSpec,
  ProviderSpec,
} from "@/components/composer"
import { providerDisplayName } from "@/components/providers/provider-identity"
import {
  modelFacts,
  modelName,
  storefrontWarning,
} from "@/features/nabu/model-catalogue"
import type {
  ListedModel,
  ProviderModelsResponse,
  TenantProviderList,
  TenantProviderSummary,
} from "@/lib/schemas/nabu"

export const MAX_PROMPT_BYTES = 64 * 1024

export function toCatalogModel(
  model: ListedModel,
  providerId: string,
): ModelSpec {
  const badges: string[] = []
  if (model.storefront?.published === false) badges.push("Deprecated")
  else if (model.storefront?.serving === false) badges.push("Unavailable")
  else if (model.storefront?.ends_on) badges.push("Retiring")

  return {
    id: model.id,
    providerId,
    name: modelName(model),

    tagline:
      [storefrontWarning(model), modelFacts(model)]
        .filter((part) => part.length > 0)
        .join(" · ") || providerId,
    badges,
    releasedAt: model.released_at,
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

        maxSizeMb: 0.05,
      },
      pdf: { supported: false },
      reasoning: model.reasoning
        ? {
            supported: true,

            levels: model.reasoning.levels,
            default: model.reasoning.default,
          }
        : { supported: false },

      tools: { supported: false },
      native: { supported: false },
      search: { supported: false },
      cache: { supported: false },
    },
    limits: {
      contextWindow: model.context_window ?? 32_000,
      maxOutput: model.max_output_tokens ?? 4_096,
    },
    cost: {
      inputPerMTok: model.pricing?.input_usd ?? 0,
      outputPerMTok: model.pricing?.output_usd ?? 0,
    },
  }
}

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
  return (result.models ?? [])
    .filter(
      (model) =>
        model.storefront?.published !== false &&
        model.storefront?.serving !== false,
    )
    .map((model) => toCatalogModel(model, configId))
}

export function toComposerProvider(
  config: TenantProviderSummary,
  fetchCatalogue: (configId: string) => Promise<ProviderModelsResponse>,
): ProviderSpec {
  return {
    id: config.id,
    label: config.label ?? providerDisplayName(config.provider),

    credentialRevision: config.updated_at,
    plan: "workspace",
    source: {
      id: config.id,
      label: config.label ?? providerDisplayName(config.provider),

      vendor: config.provider,

      requiresCredential: false,

      load: () => loadSavedCatalogue(fetchCatalogue, config.id),
    },
  }
}

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
