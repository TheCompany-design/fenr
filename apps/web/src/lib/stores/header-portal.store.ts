import { create } from "zustand"

/**
 * Header portal — the address book the app shell publishes its header with.
 *
 * The shell owns the header bar; a feature owns what goes *in* it. Rather than
 * the shell knowing about every page, a page renders its own chrome through
 * `createPortal` into whichever region it targets (see
 * `@/components/shell/header-portal`), and this store is only the mapping from
 * region name to the DOM node that region's content is rendered into.
 *
 * Why a store and not React context: this is app-level state, not a value that
 * flows down a subtree — anything under the guard layout may claim a region,
 * including components several levels below the page — and AGENTS.md keeps
 * global state in Zustand.
 *
 * Rendering rules that follow from a portal being client-resolved:
 *
 * - Refs never run on the server, so every region is `null` there and the shell
 *   renders an empty header. The client hydrates against that same `null` and
 *   publishes its node on mount, so hydration matches and content arrives one
 *   commit later. A portalled node cannot be part of the server-rendered HTML.
 * - `null` also means "this region does not exist yet" while the header itself
 *   is being torn down. Callers must render nothing for a `null` target rather
 *   than assuming their content landed.
 */
export const HEADER_PORTAL_REGIONS = ["start", "center", "end"] as const

/** The three places in the header a page may claim. */
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
  /**
   * Publish the node a region renders into, or retract it with `null`.
   *
   * Publishing the node that is already published is a no-op: ref callbacks can
   * fire more than once for an unchanged node, and a store write on each one
   * would re-render every portalled page for nothing.
   */
  readonly publish: (
    region: HeaderPortalRegion,
    element: HTMLElement | null,
  ) => void
  /**
   * Retract every region at once.
   *
   * Between tests, and for anything that needs a known-empty address book. The
   * app never calls it: regions retract themselves as their refs detach.
   */
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
