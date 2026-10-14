import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/** A successful inference is useful evidence for one day; failures are transient. */
export const MODEL_AVAILABILITY_TTL_MS = 24 * 60 * 60 * 1000

type ProviderEvidence = {
  revision: string
  availableAt: Record<string, number>
}

type ModelAvailabilityState = {
  providers: Record<string, ProviderEvidence>
  recordAvailable: (
    providerId: string,
    revision: string,
    modelId: string,
    checkedAt?: number,
  ) => void
  availableObservations: (
    providerId: string,
    revision: string,
    now?: number,
  ) => Array<[string, number]>
  expireAvailable: (
    providerId: string,
    revision: string,
    modelId: string,
    checkedAt: number,
  ) => boolean
  clearProvider: (providerId: string) => void
  retainProviders: (providerIds: readonly string[]) => void
  retainModels: (
    providerId: string,
    revision: string,
    modelIds: readonly string[],
  ) => void
}

function validProviders(value: unknown): Record<string, ProviderEvidence> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  const providers: Record<string, ProviderEvidence> = {}
  for (const [providerId, raw] of Object.entries(value)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue
    const evidence = raw as { revision?: unknown; availableAt?: unknown }
    if (
      typeof evidence.revision !== "string" ||
      typeof evidence.availableAt !== "object" ||
      evidence.availableAt === null ||
      Array.isArray(evidence.availableAt)
    ) {
      continue
    }
    const availableAt: Record<string, number> = {}
    for (const [modelId, checkedAt] of Object.entries(evidence.availableAt)) {
      if (typeof checkedAt === "number" && Number.isFinite(checkedAt)) {
        availableAt[modelId] = checkedAt
      }
    }
    providers[providerId] = { revision: evidence.revision, availableAt }
  }
  return providers
}

export const useModelAvailabilityStore = create<ModelAvailabilityState>()(
  persist(
    (set, get) => ({
      providers: {},
      recordAvailable: (
        providerId,
        revision,
        modelId,
        checkedAt = Date.now(),
      ) =>
        set((state) => {
          const current = state.providers[providerId]
          const availableAt =
            current?.revision === revision ? { ...current.availableAt } : {}
          availableAt[modelId] = checkedAt
          return {
            providers: {
              ...state.providers,
              [providerId]: { revision, availableAt },
            },
          }
        }),
      availableObservations: (providerId, revision, now = Date.now()) => {
        const evidence = get().providers[providerId]
        if (evidence?.revision !== revision) return []
        const entries = Object.entries(evidence.availableAt)
        const fresh = entries.filter(
          ([, checkedAt]) =>
            checkedAt <= now && now - checkedAt <= MODEL_AVAILABILITY_TTL_MS,
        )
        if (fresh.length !== entries.length) {
          try {
            set({
              providers: {
                ...get().providers,
                [providerId]: {
                  revision,
                  availableAt: Object.fromEntries(fresh),
                },
              },
            })
          } catch {
            // Persistence is best effort; stale records are still excluded here.
          }
        }
        return fresh.map(([modelId, checkedAt]) => [modelId, checkedAt])
      },
      expireAvailable: (providerId, revision, modelId, checkedAt) => {
        const evidence = get().providers[providerId]
        if (
          evidence?.revision !== revision ||
          evidence.availableAt[modelId] !== checkedAt
        ) {
          return false
        }
        const availableAt = { ...evidence.availableAt }
        delete availableAt[modelId]
        set({
          providers: {
            ...get().providers,
            [providerId]: { revision, availableAt },
          },
        })
        return true
      },
      clearProvider: (providerId) =>
        set((state) => {
          const providers = { ...state.providers }
          delete providers[providerId]
          return { providers }
        }),
      retainProviders: (providerIds) =>
        set((state) => {
          const keep = new Set(providerIds)
          const providers = Object.fromEntries(
            Object.entries(state.providers).filter(([providerId]) =>
              keep.has(providerId),
            ),
          )
          return { providers }
        }),
      retainModels: (providerId, revision, modelIds) =>
        set((state) => {
          const evidence = state.providers[providerId]
          if (evidence?.revision !== revision) return state
          const keep = new Set(modelIds)
          const availableAt = Object.fromEntries(
            Object.entries(evidence.availableAt).filter(([modelId]) =>
              keep.has(modelId),
            ),
          )
          return {
            providers: {
              ...state.providers,
              [providerId]: { revision, availableAt },
            },
          }
        }),
    }),
    {
      name: "fenr.model-availability",
      version: 1,
      partialize: ({ providers }) => ({ providers }),
      migrate: (persisted) => ({
        providers: validProviders(
          (persisted as { providers?: unknown } | undefined)?.providers,
        ),
      }),
      merge: (persisted, current) => ({
        ...current,
        providers: validProviders(
          (persisted as { providers?: unknown } | undefined)?.providers,
        ),
      }),
      ...(typeof window === "undefined"
        ? {}
        : { storage: createJSONStorage(() => window.localStorage) }),
    },
  ),
)
