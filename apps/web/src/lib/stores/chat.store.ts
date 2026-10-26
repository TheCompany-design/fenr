import { create } from "zustand"

export interface ChatUIState {
  readonly activeThreadId: string | null
  readonly draftPrompt: string
  readonly isThinkingOpen: boolean
  readonly setActiveThreadId: (threadId: string | null) => void
  readonly setDraftPrompt: (prompt: string) => void
  readonly setIsThinkingOpen: (isOpen: boolean) => void
  readonly toggleThinking: () => void
  readonly resetDraft: () => void
  readonly resetAll: () => void
}

export const useChatStore = create<ChatUIState>()((set) => ({
  activeThreadId: null,
  draftPrompt: "",
  isThinkingOpen: true,
  setActiveThreadId: (threadId) => set({ activeThreadId: threadId }),
  setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),
  setIsThinkingOpen: (isOpen) => set({ isThinkingOpen: isOpen }),
  toggleThinking: () =>
    set((state) => ({ isThinkingOpen: !state.isThinkingOpen })),
  resetDraft: () => set({ draftPrompt: "" }),
  resetAll: () =>
    set({
      activeThreadId: null,
      draftPrompt: "",
      isThinkingOpen: true,
    }),
}))
