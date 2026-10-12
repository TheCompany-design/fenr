import type { IconSvgElement } from "@hugeicons/react"

export type ProviderId = string
export type ModelId = string
export type PlanId = string
export type ToolId = string
export type Region = string

export type EffortLevel = "none" | "low" | "medium" | "high" | "max"

export const EFFORT_ORDER: readonly EffortLevel[] = [
  "none",
  "low",
  "medium",
  "high",
  "max",
] as const

/**
 * A gate carries the action that unblocks it, not just the reason. "Needs
 * auth" and "needs a key for *this* provider" are different CTAs, so they are
 * different values and the switch below stays exhaustive.
 */
export type Gate =
  | { kind: "connect"; providerId: ProviderId; providerLabel: string }
  | { kind: "upgrade"; plan: PlanId; label: string }
  | { kind: "region"; available: readonly Region[] }
  | { kind: "capacity"; retryAfter?: number }

/**
 * `supported: false` has no payload by construction, so reading `.maxImages`
 * off an unsupported capability is a type error rather than `undefined` at
 * runtime.
 */
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

/**
 * The same effort level reaches the wire differently per provider. This lives
 * on the provider, not the model, and is applied only in the submit path —
 * the store never holds an encoded effort.
 */
export type EffortEncoding =
  | { style: "enum"; field: string }
  | { style: "budget"; field: string; max: number; unit: "tokens" }
  | { style: "level"; field: string }
  | { style: "none" }

export type ModelCaps = {
  vision: Cap<{ maxImages: number }>
  files: Cap<{
    kinds: readonly FileKind[]
    maxFiles: number
    maxSizeMb: number
  }>
  pdf: Cap<{ maxPages: number }>
  reasoning: Cap<{
    levels: readonly EffortLevel[]
    default: EffortLevel
  }>
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
  /** A self-hosted endpoint may need no credential at all. */
  requiresCredential: boolean
  /** Defaults applied to every model this provider returns. */
  effortEncoding: EffortEncoding
  icon?: IconSvgElement
  load: (credential: string | null) => Promise<readonly ModelSpec[]>
}

export type ProviderSpec = {
  id: ProviderId
  label: string
  icon?: IconSvgElement
  /** Plan the provider itself requires; surfaced by `upgrade` gates. */
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
      /** A refresh failed; `models` is still the last good payload. */
      degraded: boolean
    }
  | {
      state: "failed"
      error: { kind: CatalogErrorKind; message: string }
      retryable: boolean
      lastGood?: readonly ModelSpec[]
    }

/**
 * What a key may actually do. This is what separates "the catalog lists it"
 * from "you can use it" — the distinction `requiresAuth` used to flatten.
 */
export type Entitlements = {
  effort?: readonly EffortLevel[]
  deniedModels?: readonly ModelId[]
  maxTools?: number
  deniedNativeTools?: readonly NativeToolKind[]
}

export type Access =
  | { kind: "available" }
  | { kind: "gated"; gate: Gate }
  | { kind: "denied"; reason: string }

/**
 * `capability` is populated even when gated, so a locked row can still show
 * what the user would get. `null` means it cannot be shown at all.
 */
export type Resolved<T> = {
  access: Access
  capability: T | null
}

export type ResolvedCaps = {
  model: ModelSpec | null
  vision: Resolved<{ maxImages: number }>
  files: Resolved<{
    kinds: readonly FileKind[]
    maxFiles: number
    maxSizeMb: number
  }>
  reasoning: Resolved<{
    levels: readonly EffortLevel[]
    default: EffortLevel
    encoding: EffortEncoding
  }>
  tools: Resolved<{ max: number; kinds: readonly ToolKind[] }>
  native: Resolved<{ kinds: readonly NativeToolKind[] }>
  /**
   * Resolved to `true`, never `null`. `isUsable` treats a null capability as
   * unavailable, so a payload-less cap that resolves to null would read as
   * unsupported even when it is offered.
   */
  search: Resolved<boolean>
}

export function isUsable<T>(resolved: Resolved<T>): resolved is Resolved<T> & {
  access: { kind: "available" }
  capability: T
} {
  return resolved.access.kind === "available" && resolved.capability !== null
}

/**
 * The models a catalog can still render, whatever its status. A failed refresh
 * keeps `lastGood` so the model picker never blanks out over a network blip.
 */
export function catalogModels(
  catalog: Catalog | undefined,
): readonly ModelSpec[] {
  if (!catalog) return []
  if (catalog.state === "ready") return catalog.models
  if (catalog.state === "failed") return catalog.lastGood ?? []
  return []
}
