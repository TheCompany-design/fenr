import { beforeEach, describe, expect, it } from "bun:test"
import { useConfirmStore } from "./confirm.store"
import { useConfirm } from "./use-confirm"

describe("useConfirm hook", () => {
  beforeEach(() => {
    useConfirmStore.getState().reset()
  })

  it("provides callable confirm function interacting with the store", async () => {
    const store = useConfirmStore.getState()

    const confirmPromise = store.openConfirm({
      title: "Confirm delete",
      description: "Delete this permanently?",
      variant: "destructive",
    })

    expect(useConfirmStore.getState().isOpen).toBe(true)
    expect(useConfirmStore.getState().title).toBe("Confirm delete")
    expect(useConfirmStore.getState().variant).toBe("destructive")

    await useConfirmStore.getState().handleConfirm()
    const result = await confirmPromise

    expect(result).toBe(true)
    expect(useConfirmStore.getState().isOpen).toBe(false)
  })

  it("exports useConfirm hook function", () => {
    expect(typeof useConfirm).toBe("function")
  })
})
