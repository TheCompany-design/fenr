import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const SECONDARY_SIDEBAR_STORAGE_KEY = "fenr.secondary-sidebar"

export interface SecondarySidebarState {
  readonly isOpen: boolean
  readonly isOpenMobile: boolean
  readonly hasContent: boolean
  readonly target: HTMLElement | null

  readonly open: () => void
  readonly close: () => void
  readonly toggle: () => void
  readonly setOpen: (open: boolean) => void

  readonly openMobile: () => void
  readonly closeMobile: () => void
  readonly toggleMobile: () => void
  readonly setOpenMobile: (open: boolean) => void

  readonly setHasContent: (hasContent: boolean) => void
  readonly publishTarget: (target: HTMLElement | null) => void
  readonly reset: () => void
}

export const useSecondarySidebarStore = create<SecondarySidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      isOpenMobile: false,
      hasContent: false,
      target: null,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (isOpen) => set({ isOpen }),

      openMobile: () => set({ isOpenMobile: true }),
      closeMobile: () => set({ isOpenMobile: false }),
      toggleMobile: () =>
        set((state) => ({ isOpenMobile: !state.isOpenMobile })),
      setOpenMobile: (isOpenMobile) => set({ isOpenMobile }),

      setHasContent: (hasContent) => set({ hasContent }),
      publishTarget: (target) => {
        set((state) => {
          if (state.target === target) {
            return state
          }
          return { target }
        })
      },
      reset: () =>
        set({
          isOpen: true,
          isOpenMobile: false,
          hasContent: false,
          target: null,
        }),
    }),
    {
      name: SECONDARY_SIDEBAR_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        isOpen: state.isOpen,
      }),
      merge: (persisted, current) => {
        const isOpen = (persisted as { isOpen?: unknown })?.isOpen
        return {
          ...current,
          isOpen: typeof isOpen === "boolean" ? isOpen : current.isOpen,
        }
      },
      ...(typeof window === "undefined"
        ? {}
        : { storage: createJSONStorage(() => window.localStorage) }),
    },
  ),
)
