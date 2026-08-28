import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * Fenr convention: ALL global state — in-memory, session or local — lives in
 * Zustand stores. This demo shows the persisted (localStorage) variant.
 *
 * - localStorage:  `createJSONStorage(() => localStorage)`
 * - sessionStorage: `createJSONStorage(() => sessionStorage)`
 * - memory only:    omit the `persist` middleware entirely.
 */
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
      name: "fenr.demo-counter", // storage key
      ...(typeof window === "undefined"
        ? {}
        : { storage: createJSONStorage(() => window.localStorage) }),
    },
  ),
)
