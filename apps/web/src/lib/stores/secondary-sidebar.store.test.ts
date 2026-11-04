import { beforeEach, describe, expect, it } from "bun:test"
import { useSecondarySidebarStore } from "./secondary-sidebar.store"

function fakeElement(): HTMLElement {
  return { nodeName: "DIV" } as unknown as HTMLElement
}

describe("secondary sidebar store", () => {
  beforeEach(() => {
    useSecondarySidebarStore.getState().reset()
  })

  it("initializes with default state", () => {
    const state = useSecondarySidebarStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.isOpenMobile).toBe(false)
    expect(state.hasContent).toBe(false)
    expect(state.target).toBeNull()
  })

  it("toggles open and closed state", () => {
    const store = useSecondarySidebarStore.getState()
    store.close()
    expect(useSecondarySidebarStore.getState().isOpen).toBe(false)

    store.open()
    expect(useSecondarySidebarStore.getState().isOpen).toBe(true)

    store.toggle()
    expect(useSecondarySidebarStore.getState().isOpen).toBe(false)

    store.setOpen(true)
    expect(useSecondarySidebarStore.getState().isOpen).toBe(true)
  })

  it("handles mobile open and closed state", () => {
    const store = useSecondarySidebarStore.getState()
    expect(store.isOpenMobile).toBe(false)

    store.openMobile()
    expect(useSecondarySidebarStore.getState().isOpenMobile).toBe(true)

    store.closeMobile()
    expect(useSecondarySidebarStore.getState().isOpenMobile).toBe(false)

    store.toggleMobile()
    expect(useSecondarySidebarStore.getState().isOpenMobile).toBe(true)

    store.setOpenMobile(false)
    expect(useSecondarySidebarStore.getState().isOpenMobile).toBe(false)
  })

  it("updates hasContent state", () => {
    const store = useSecondarySidebarStore.getState()
    expect(store.hasContent).toBe(false)

    store.setHasContent(true)
    expect(useSecondarySidebarStore.getState().hasContent).toBe(true)

    store.setHasContent(false)
    expect(useSecondarySidebarStore.getState().hasContent).toBe(false)
  })

  it("publishes and retracts target DOM element", () => {
    const element = fakeElement()
    const store = useSecondarySidebarStore.getState()

    store.publishTarget(element)
    expect(useSecondarySidebarStore.getState().target).toBe(element)

    // Ignores republishing identical element
    const notifications: number[] = []
    const unsubscribe = useSecondarySidebarStore.subscribe((state) => {
      notifications.push(state.target ? 1 : 0)
    })
    store.publishTarget(element)
    unsubscribe()
    expect(notifications).toEqual([])

    store.publishTarget(null)
    expect(useSecondarySidebarStore.getState().target).toBeNull()
  })

  it("resets all state cleanly", () => {
    const store = useSecondarySidebarStore.getState()
    store.setOpen(false)
    store.setOpenMobile(true)
    store.setHasContent(true)
    store.publishTarget(fakeElement())

    store.reset()

    const state = useSecondarySidebarStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.isOpenMobile).toBe(false)
    expect(state.hasContent).toBe(false)
    expect(state.target).toBeNull()
  })
})
