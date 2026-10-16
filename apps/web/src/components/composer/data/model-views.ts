import {
  type Catalog,
  type Connection,
  catalogModels,
  isUsable,
  type ModelSpec,
  type ProviderId,
  type ReasoningLevel,
  type ResolvedCaps,
} from "../catalog/capabilities"

export type CapabilityStatus =
  | "available"
  | "unverified"
  | "gated-connect"
  | "gated-upgrade"
  | "gated-region"
  | "gated-capacity"
  | "unsupported"
  | "no-model"

export type ModelView = {
  model: ModelSpec
  providerId: ProviderId
  /** Whether the model itself is selectable; unrelated to its capabilities. */
  status: CapabilityStatus
  /**
   * Present even when gated, so a locked row can show what it would grant.
   *
   * Records, not names: the list is the model's own scale in its own order, and
   * the only thing that should ever stand between a level and the user is the
   * label the provider chose for it.
   */
  effortLevels: readonly ReasoningLevel[]
  availableEffortLevels: readonly ReasoningLevel[]
  supportsVision: boolean
  supportsTools: boolean
  supportsSearch: boolean
  /** Per-model capability badges, rendered as trailing metadata. */
  badges: readonly string[]
  isSelected: boolean
}

function statusFor(caps: ResolvedCaps): CapabilityStatus {
  if (!caps.model) return "no-model"
  const access = caps.modelAccess
  if (access.kind === "available") return "available"
  if (access.kind === "denied") return "unsupported"
  if (access.kind === "unknown") return "unverified"
  switch (access.gate.kind) {
    case "connect":
      return "gated-connect"
    case "upgrade":
      return "gated-upgrade"
    case "region":
      return "gated-region"
    case "capacity":
      return "gated-capacity"
  }
}

/**
 * Derives everything the model list renders from the catalog and the store.
 *
 * Kept out of the component so the expensive part — resolving capabilities for
 * every model across every provider, which is O(models × providers) — can be
 * memoized once per catalog change rather than once per render of a popover
 * that may be closed.
 */
export function buildModelViews(input: {
  catalogs: Record<ProviderId, Catalog>
  connections: Record<ProviderId, Connection>
  entitlements: Record<
    ProviderId,
    import("../catalog/capabilities").Entitlements
  >
  /** Returns null when the provider is unknown to the caller's own list. */
  resolve: (providerId: ProviderId, model: ModelSpec) => ResolvedCaps | null
  selected: { providerId: ProviderId; modelId: string } | null
  starred: readonly string[]
}): ModelView[] {
  const views: ModelView[] = []

  for (const [providerId, catalog] of Object.entries(input.catalogs)) {
    for (const model of catalogModels(catalog)) {
      const caps = input.resolve(providerId, model)
      if (!caps) continue
      const status = statusFor(caps)

      const effortLevels = caps.reasoning.capability?.levels ?? []
      const entitlement = input.entitlements[providerId]
      const narrowed = entitlement?.effort
        ? effortLevels.filter((level) => entitlement.effort?.includes(level.id))
        : effortLevels

      views.push({
        model,
        providerId,
        status,
        effortLevels,
        availableEffortLevels: narrowed,
        supportsVision:
          isUsable(caps.vision) || caps.vision.access.kind === "gated",
        supportsTools: caps.tools.capability !== null,
        supportsSearch: caps.search.capability !== null,
        badges: model.badges ?? [],
        isSelected:
          input.selected?.providerId === providerId &&
          input.selected.modelId === model.id,
      })
    }
  }

  return views
}

/** Ranks by a cheap heuristic so the list is not alphabet-only. */
export function rankModels(views: readonly ModelView[]): ModelView[] {
  const statusRank: Record<CapabilityStatus, number> = {
    available: 0,
    unverified: 1,
    "gated-connect": 2,
    "gated-upgrade": 3,
    "gated-region": 3,
    "gated-capacity": 4,
    unsupported: 5,
    "no-model": 5,
  }
  return [...views].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status]
    if (byStatus !== 0) return byStatus
    // Within a status, newest first — `releasedAt` is the only ordering signal
    // available across heterogeneous providers.
    const aDate = a.model.releasedAt ?? ""
    const bDate = b.model.releasedAt ?? ""
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    return a.model.name.localeCompare(b.model.name)
  })
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`
  return `${Math.round(tokens / 1000)}k`
}
