import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface DemoState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
      decrement: () => set((s) => ({ count: s.count - 1 })),
      reset: () => set({ count: 0 }),
    }),
    {
      name: "fenr.demo-counter",
      ...(typeof window === "undefined"
        ? {}
        : { storage: createJSONStorage(() => window.localStorage) }),
    },
  ),
)
