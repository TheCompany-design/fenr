import type {
  Connection,
  ModelCaps,
  ModelSpec,
  ProviderSpec,
  ReasoningLevel,
} from "./capabilities"

/**
 * Deliberately heterogeneous. If every provider looked the same, the parts of
 * the design that matter — entitlement-narrowed effort, providers needing no
 * credential, models with no reasoning at all — would never be exercised.
 */

const caps = (overrides: Partial<ModelCaps>): ModelCaps => ({
  vision: { supported: false },
  files: {
    supported: true,
    kinds: ["text", "pdf"],
    maxFiles: 20,
    maxSizeMb: 32,
  },
  pdf: { supported: true, maxPages: 100 },
  reasoning: { supported: false },
  tools: { supported: true, max: 8, kinds: ["fs_read", "http", "db"] },
  native: { supported: false },
  search: { supported: false },
  cache: { supported: false },
  ...overrides,
})

/**
 * Declares a provider's reasoning scale, lowest first.
 *
 * This is the *only* place in the composer that states what a provider's levels
 * are, and the array order is the scale — position is what every consumer ranks
 * by, so `("low", "medium", "high")` is a claim about that provider, not a
 * lookup in a shared table. Nothing downstream compares level names to each
 * other, which is what lets two providers here disagree: OpenAI stops at `high`
 * and Anthropic has no `none`, so the two lists are not subsets of one another
 * and the composer's controls still light the right one on either.
 *
 * Labels are derived here, at the point of declaration, rather than in the UI.
 * That is the whole extent of the convenience: a provider whose names need more
 * than a capital letter passes `{ id, label }` pairs directly, and the rest of
 * the composer cannot tell the difference.
 */
const levels = (
  ...names: readonly (string | ReasoningLevel)[]
): readonly ReasoningLevel[] =>
  names.map((name) =>
    typeof name === "string"
      ? { id: name, label: name.charAt(0).toUpperCase() + name.slice(1) }
      : name,
  )

function openai(overrides: Partial<ModelCaps> = {}): ModelCaps {
  return caps({
    vision: { supported: true, maxImages: 20 },
    reasoning: {
      supported: true,
      levels: levels("none", "low", "medium", "high"),
      default: "medium",
    },
    native: { supported: true, kinds: ["web_search"] },
    search: { supported: true },
    cache: { supported: true, ttls: ["ephemeral"] },
    tools: {
      supported: true,
      max: 16,
      kinds: ["fs_read", "fs_write", "http", "db", "shell"],
    },
    ...overrides,
  })
}

const gpt = (
  id: string,
  name: string,
  tagline: string,
  c: ModelCaps,
  window: number,
  cost: number,
  badges?: readonly string[],
): ModelSpec => ({
  id,
  providerId: "openai",
  name,
  tagline,
  badges,
  releasedAt: "2026-08-14",
  caps: c,
  limits: { contextWindow: window, maxOutput: 128_000 },
  cost: { inputPerMTok: cost, outputPerMTok: cost * 4 },
})

export const OPENAI_MODELS: ModelSpec[] = [
  gpt(
    "gpt-6-astra",
    "GPT-6 Astra",
    "Frontier reasoning",
    openai(),
    400_000,
    5,
    ["New"],
  ),
  gpt(
    "gpt-6.1-sol",
    "GPT-6.1 Sol",
    "Balanced, very fast",
    openai(),
    400_000,
    1.25,
    ["Fast"],
  ),
  gpt(
    "gpt-5.2",
    "GPT-5.2",
    "Cheapest that still reasons",
    openai(),
    200_000,
    0.4,
  ),
]

export const ANTHROPIC_MODELS: ModelSpec[] = [
  {
    id: "claude-opus-5",
    providerId: "anthropic",
    name: "Claude Opus 5",
    tagline: "Deepest reasoning",
    badges: ["Frontier"],
    releasedAt: "2026-09-02",
    caps: caps({
      vision: { supported: true, maxImages: 20 },
      reasoning: {
        supported: true,
        levels: levels("low", "medium", "high", "max"),
        default: "high",
      },
      tools: {
        supported: true,
        max: 12,
        kinds: ["fs_read", "fs_write", "http", "db", "shell"],
      },
      native: { supported: true, kinds: ["web_search", "computer_use"] },
      search: { supported: true },
      cache: { supported: true, ttls: ["ephemeral", "1h"] },
    }),
    limits: { contextWindow: 200_000, maxOutput: 64_000 },
    cost: { inputPerMTok: 5, outputPerMTok: 25 },
  },
  {
    id: "claude-sonnet-5",
    providerId: "anthropic",
    name: "Claude Sonnet 5",
    tagline: "Balanced quality and speed",
    caps: caps({
      vision: { supported: true, maxImages: 20 },
      reasoning: {
        supported: true,
        levels: levels("low", "medium", "high"),
        default: "medium",
      },
      tools: {
        supported: true,
        max: 8,
        kinds: ["fs_read", "fs_write", "http"],
      },
      native: { supported: true, kinds: ["web_search"] },
      search: { supported: true },
      cache: { supported: true, ttls: ["ephemeral", "5m"] },
    }),
    limits: { contextWindow: 200_000, maxOutput: 64_000 },
    cost: { inputPerMTok: 3, outputPerMTok: 15 },
  },
  {
    id: "claude-fable-5",
    providerId: "anthropic",
    name: "Claude Fable 5",
    tagline: "Fast, cheap, no reasoning",
    caps: caps({
      vision: { supported: true, maxImages: 10 },
      tools: { supported: true, max: 4, kinds: ["fs_read", "http"] },
    }),
    limits: { contextWindow: 200_000, maxOutput: 32_000 },
    cost: { inputPerMTok: 0.8, outputPerMTok: 4 },
  },
]

export const LOCAL_MODELS: ModelSpec[] = [
  {
    id: "llama-4-70b",
    providerId: "local",
    name: "Llama 4 70B",
    tagline: "Running locally",
    caps: caps({
      tools: { supported: true, max: 2, kinds: ["fs_read"] },
      pdf: { supported: false },
    }),
    limits: { contextWindow: 32_000, maxOutput: 8_000 },
    cost: { inputPerMTok: 0, outputPerMTok: 0 },
  },
]

/** A provider whose models are unavailable until a key is supplied. */
const OPENAI_SOURCE = {
  id: "openai",
  label: "OpenAI",
  vendor: "openai",
  requiresCredential: true,
  load: async () => OPENAI_MODELS,
} as const

const ANTHROPIC_SOURCE = {
  id: "anthropic",
  label: "Anthropic",
  vendor: "anthropic",
  requiresCredential: true,
  load: async () => ANTHROPIC_MODELS,
} as const

/**
 * The case that proves the model: no credential, no gate, no `connect` CTA.
 * A self-hosted endpoint is `available` the moment it answers.
 */
const LOCAL_SOURCE = {
  id: "local",
  label: "Ollama (local)",
  vendor: "local",
  requiresCredential: false,
  load: async () => LOCAL_MODELS,
} as const

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "openai",
    label: "OpenAI",
    plan: "payg",
    source: { ...OPENAI_SOURCE },
  },
  {
    id: "anthropic",
    label: "Anthropic",
    plan: "max",
    source: { ...ANTHROPIC_SOURCE },
  },
  {
    id: "local",
    label: "Ollama (local)",
    plan: "none",
    source: { ...LOCAL_SOURCE },
  },
]

export function getProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((provider) => provider.id === id)
}

/** Simulates validation latency so the `validating` state is reachable. */
export function validateConnection(
  provider: ProviderSpec,
  credential: string | null,
): Promise<Connection> {
  if (!provider.source.requiresCredential) {
    return Promise.resolve({ state: "ready", validatedAt: Date.now() })
  }
  if (!credential) return Promise.resolve({ state: "absent" })
  if (credential.startsWith("sk-bad")) {
    return Promise.resolve({ state: "invalid", reason: "bad-key" })
  }
  return Promise.resolve({ state: "ready", validatedAt: Date.now() })
}
