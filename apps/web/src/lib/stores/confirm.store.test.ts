import { beforeEach, describe, expect, it } from "bun:test"
import { useConfirmStore } from "./confirm.store"

describe("confirm store", () => {
  beforeEach(() => {
    useConfirmStore.getState().reset()
  })

  it("initializes with closed state and default values", () => {
    const state = useConfirmStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(state.confirmText).toBe("Confirm")
    expect(state.cancelText).toBe("Cancel")
    expect(state.variant).toBe("default")
  })

  it("opens with custom options and resolves true on confirm", async () => {
    const store = useConfirmStore.getState()

    const promise = store.openConfirm({
      title: "Delete resource?",
      description: "This cannot be reversed.",
      confirmText: "Yes, delete",
      cancelText: "No, keep",
      variant: "destructive",
    })

    const openedState = useConfirmStore.getState()
    expect(openedState.isOpen).toBe(true)
    expect(openedState.title).toBe("Delete resource?")
    expect(openedState.description).toBe("This cannot be reversed.")
    expect(openedState.confirmText).toBe("Yes, delete")
    expect(openedState.cancelText).toBe("No, keep")
    expect(openedState.variant).toBe("destructive")

    await useConfirmStore.getState().handleConfirm()
    const resolvedValue = await promise

    expect(resolvedValue).toBe(true)
    const closedState = useConfirmStore.getState()
    expect(closedState.isOpen).toBe(false)
    expect(closedState.isLoading).toBe(false)
  })

  it("resolves false when canceled", async () => {
    let cancelCalled = false

    const promise = useConfirmStore.getState().openConfirm({
      title: "Sign out?",
      onCancel: () => {
        cancelCalled = true
      },
    })

    useConfirmStore.getState().handleCancel()
    const resolvedValue = await promise

    expect(cancelCalled).toBe(true)
    expect(resolvedValue).toBe(false)
    expect(useConfirmStore.getState().isOpen).toBe(false)
  })

  it("executes async onConfirm callback with loading state", async () => {
    let callbackExecuted = false

    const promise = useConfirmStore.getState().openConfirm({
      title: "Async action",
      onConfirm: async () => {
        callbackExecuted = true
      },
    })

    await useConfirmStore.getState().handleConfirm()
    const result = await promise

    expect(callbackExecuted).toBe(true)
    expect(result).toBe(true)
    expect(useConfirmStore.getState().isOpen).toBe(false)
  })

  it("cancels previous pending confirmation when a new one opens", async () => {
    const firstPromise = useConfirmStore.getState().openConfirm({
      title: "First action",
    })

    useConfirmStore.getState().openConfirm({
      title: "Second action",
    })

    const firstResult = await firstPromise

    expect(firstResult).toBe(false)
    expect(useConfirmStore.getState().title).toBe("Second action")
    expect(useConfirmStore.getState().isOpen).toBe(true)

    useConfirmStore.getState().reset()
    expect(useConfirmStore.getState().isOpen).toBe(false)
  })
})
