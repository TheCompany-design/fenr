import type { IconSvgElement } from "@hugeicons/react"

export type ProviderId = string
export type ModelId = string
export type PlanId = string
export type ToolId = string
export type Region = string

export type EffortLevelId = string

export type ReasoningLevel = {
  id: EffortLevelId
  label: string
}

export type ReasoningScale = {
  levels: readonly ReasoningLevel[]

  default: EffortLevelId
}

export type Gate =
  | { kind: "connect"; providerId: ProviderId; providerLabel: string }
  | { kind: "upgrade"; plan: PlanId; label: string }
  | { kind: "region"; available: readonly Region[] }
  | { kind: "capacity"; retryAfter?: number }

export type Cap<P = object> = { supported: false } | ({ supported: true } & P)

export type FileKind = "image" | "pdf" | "text" | "audio" | "video" | "archive"

export type NativeToolKind =
  | "web_search"
  | "code_interpreter"
  | "computer_use"
  | "file_search"

export type ToolKind =
  | "shell"
  | "fs_read"
  | "fs_write"
  | "browser"
  | "db"
  | "http"

export type ModelCaps = {
  vision: Cap<{ maxImages: number }>
  files: Cap<{
    kinds: readonly FileKind[]
    maxFiles: number
    maxSizeMb: number
  }>
  pdf: Cap<{ maxPages: number }>
  reasoning: Cap<ReasoningScale>
  tools: Cap<{ max: number; kinds: readonly ToolKind[] }>
  native: Cap<{ kinds: readonly NativeToolKind[] }>
  search: Cap
  cache: Cap<{ ttls: readonly ("ephemeral" | "5m" | "1h")[] }>
}

export type ModelSpec = {
  id: ModelId
  providerId: ProviderId
  name: string
  tagline: string

  keyAccessConfirmed?: true
  icon?: IconSvgElement
  badges?: readonly string[]
  releasedAt?: string
  caps: ModelCaps
  limits: { contextWindow: number; maxOutput: number }
  cost: { inputPerMTok: number; outputPerMTok: number }
}

export type CatalogSource = {
  id: ProviderId
  label: string

  vendor: string

  requiresCredential: boolean
  icon?: IconSvgElement
  load: (credential: string | null) => Promise<readonly ModelSpec[]>
}

export type ProviderSpec = {
  id: ProviderId
  label: string
  icon?: IconSvgElement

  credentialRevision?: string

  plan: PlanId
  source: CatalogSource
}

export type Connection =
  | { state: "absent" }
  | { state: "validating" }
  | { state: "ready"; validatedAt: number }
  | { state: "invalid"; reason: "bad-key" | "expired" | "region" }
  | { state: "unreachable" }

export type CatalogErrorKind =
  | "network"
  | "auth"
  | "rate-limit"
  | "malformed"
  | "unknown"

export type Catalog =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ready"
      models: readonly ModelSpec[]
      fetchedAt: number

      degraded: boolean
    }
  | {
      state: "failed"
      error: { kind: CatalogErrorKind; message: string }
      retryable: boolean
      lastGood?: readonly ModelSpec[]
    }

export type Entitlements = {
  effort?: readonly EffortLevelId[]
  deniedModels?: readonly ModelId[]

  availableModels?: readonly ModelId[]
  maxTools?: number
  deniedNativeTools?: readonly NativeToolKind[]
}

export type Access =
  | { kind: "available" }
  | { kind: "gated"; gate: Gate }
  | { kind: "denied"; reason: string }

export type ModelAccess =
  | { kind: "unknown" }
  | { kind: "available" }
  | { kind: "gated"; gate: Gate }
  | { kind: "denied"; reason: string }

export type Resolved<T> = {
  access: Access
  capability: T | null
}

export type ResolvedCaps = {
  model: ModelSpec | null

  modelAccess: ModelAccess
  vision: Resolved<{ maxImages: number }>
  files: Resolved<{
    kinds: readonly FileKind[]
    maxFiles: number
    maxSizeMb: number
  }>
  reasoning: Resolved<ReasoningScale>
  tools: Resolved<{ max: number; kinds: readonly ToolKind[] }>
  native: Resolved<{ kinds: readonly NativeToolKind[] }>

  search: Resolved<boolean>
}

export function isUsable<T>(resolved: Resolved<T>): resolved is Resolved<T> & {
  access: { kind: "available" }
  capability: T
} {
  return resolved.access.kind === "available" && resolved.capability !== null
}

export function catalogModels(
  catalog: Catalog | undefined,
): readonly ModelSpec[] {
  if (!catalog) return []
  if (catalog.state === "ready") return catalog.models
  if (catalog.state === "failed") return catalog.lastGood ?? []
  return []
}
