import { beforeEach, describe, expect, it } from "bun:test"
import { useChatStore } from "./chat.store"

describe("useChatStore (Ephemeral Chat UI State)", () => {
  beforeEach(() => {
    useChatStore.getState().resetAll()
  })

  it("initializes with default state", () => {
    const state = useChatStore.getState()
    expect(state.activeThreadId).toBeNull()
    expect(state.draftPrompt).toBe("")
    expect(state.isThinkingOpen).toBe(true)
  })

  it("updates draft prompt and resets draft cleanly", () => {
    useChatStore.getState().setDraftPrompt("Compare peach to apricot")
    expect(useChatStore.getState().draftPrompt).toBe("Compare peach to apricot")

    useChatStore.getState().resetDraft()
    expect(useChatStore.getState().draftPrompt).toBe("")
  })

  it("updates active thread id", () => {
    useChatStore.getState().setActiveThreadId("thread-abc-123")
    expect(useChatStore.getState().activeThreadId).toBe("thread-abc-123")

    useChatStore.getState().setActiveThreadId(null)
    expect(useChatStore.getState().activeThreadId).toBeNull()
  })

  it("toggles and sets thinking panel visibility", () => {
    useChatStore.getState().setIsThinkingOpen(false)
    expect(useChatStore.getState().isThinkingOpen).toBe(false)

    useChatStore.getState().toggleThinking()
    expect(useChatStore.getState().isThinkingOpen).toBe(true)
  })

  it("resets all state back to defaults", () => {
    useChatStore.getState().setActiveThreadId("thread-1")
    useChatStore.getState().setDraftPrompt("Draft")
    useChatStore.getState().setIsThinkingOpen(false)

    useChatStore.getState().resetAll()
    const state = useChatStore.getState()
    expect(state.activeThreadId).toBeNull()
    expect(state.draftPrompt).toBe("")
    expect(state.isThinkingOpen).toBe(true)
  })
})
