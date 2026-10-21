import { create } from "zustand"

export const HEADER_PORTAL_REGIONS = ["start", "center", "end"] as const

export type HeaderPortalRegion = (typeof HEADER_PORTAL_REGIONS)[number]

export type HeaderPortalTargets = Readonly<
  Record<HeaderPortalRegion, HTMLElement | null>
>

const NO_TARGETS: HeaderPortalTargets = {
  start: null,
  center: null,
  end: null,
}

export interface HeaderPortalState {
  readonly targets: HeaderPortalTargets

  readonly publish: (
    region: HeaderPortalRegion,
    element: HTMLElement | null,
  ) => void

  readonly retractAll: () => void
}

export const useHeaderPortalStore = create<HeaderPortalState>()((set, get) => ({
  targets: NO_TARGETS,
  publish: (region, element) => {
    if (get().targets[region] === element) {
      return
    }
    set((state) => ({
      targets: { ...state.targets, [region]: element },
    }))
  },
  retractAll: () => set({ targets: NO_TARGETS }),
}))
