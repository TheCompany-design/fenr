import { beforeEach, describe, expect, it } from "bun:test"
import {
  HEADER_PORTAL_REGIONS,
  type HeaderPortalRegion,
  useHeaderPortalStore,
} from "./header-portal.store"

function fakeElement(): HTMLElement {
  // Only identity matters here — nothing in the store inspects the node.
  return { nodeName: "DIV" } as unknown as HTMLElement
}

describe("header portal store", () => {
  beforeEach(() => {
    useHeaderPortalStore.getState().retractAll()
  })

  it("starts with no target in any region", () => {
    const { targets } = useHeaderPortalStore.getState()
    for (const region of HEADER_PORTAL_REGIONS) {
      expect(targets[region]).toBeNull()
    }
  })

  it("publishes a region without disturbing the others", () => {
    const start = fakeElement()

    useHeaderPortalStore.getState().publish("start", start)

    const { targets } = useHeaderPortalStore.getState()
    expect(targets.start).toBe(start)
    expect(targets.center).toBeNull()
    expect(targets.end).toBeNull()
  })

  it("addresses every declared region", () => {
    const nodes = new Map<HeaderPortalRegion, HTMLElement>(
      HEADER_PORTAL_REGIONS.map((region) => [region, fakeElement()]),
    )

    for (const [region, node] of nodes) {
      useHeaderPortalStore.getState().publish(region, node)
    }

    const { targets } = useHeaderPortalStore.getState()
    for (const [region, node] of nodes) {
      expect(targets[region]).toBe(node)
    }
  })

  it("ignores a republish of the node already in place", () => {
    const start = fakeElement()
    const notifications: number[] = []

    useHeaderPortalStore.getState().publish("start", start)
    const unsubscribe = useHeaderPortalStore.subscribe((state) => {
      notifications.push(state.targets.start ? 1 : 0)
    })

    // A ref callback fires again for an unchanged node. Each of those writes
    // would re-render every page that has portalled content into the header.
    useHeaderPortalStore.getState().publish("start", start)
    useHeaderPortalStore.getState().publish("start", start)

    unsubscribe()
    expect(notifications).toEqual([])
    expect(useHeaderPortalStore.getState().targets.start).toBe(start)
  })

  it("retracts a region when it is handed back a null node", () => {
    const start = fakeElement()

    useHeaderPortalStore.getState().publish("start", start)
    useHeaderPortalStore.getState().publish("start", null)

    expect(useHeaderPortalStore.getState().targets.start).toBeNull()
  })

  it("replaces a region's node when a different one arrives", () => {
    const first = fakeElement()
    const second = fakeElement()

    useHeaderPortalStore.getState().publish("start", first)
    useHeaderPortalStore.getState().publish("start", second)

    expect(useHeaderPortalStore.getState().targets.start).toBe(second)
  })

  it("retracts every region at once", () => {
    useHeaderPortalStore.getState().publish("start", fakeElement())
    useHeaderPortalStore.getState().publish("center", fakeElement())
    useHeaderPortalStore.getState().publish("end", fakeElement())

    useHeaderPortalStore.getState().retractAll()

    const { targets } = useHeaderPortalStore.getState()
    for (const region of HEADER_PORTAL_REGIONS) {
      expect(targets[region]).toBeNull()
    }
  })
})
