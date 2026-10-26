import type { ReactNode } from "react"
import { create } from "zustand"

export type ConfirmVariant = "default" | "destructive"

export interface ConfirmOptions {
  title: ReactNode

  description?: ReactNode

  confirmText?: string

  cancelText?: string

  variant?: ConfirmVariant

  onConfirm?: () => Promise<void> | void

  onCancel?: () => void
}

interface ConfirmState {
  isOpen: boolean
  isLoading: boolean
  title: ReactNode
  description?: ReactNode
  confirmText: string
  cancelText: string
  variant: ConfirmVariant
  onConfirm?: () => Promise<void> | void
  onCancel?: () => void
  _resolve?: (confirmed: boolean) => void

  openConfirm: (options: ConfirmOptions) => Promise<boolean>

  handleConfirm: () => Promise<void>

  handleCancel: () => void

  setLoading: (loading: boolean) => void

  reset: () => void
}

const DEFAULT_CONFIRM_TEXT: Record<ConfirmVariant, string> = {
  default: "Confirm",
  destructive: "Delete",
}

const INITIAL_STATE = {
  isOpen: false,
  isLoading: false,
  title: "",
  description: undefined,
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "default" as ConfirmVariant,
  onConfirm: undefined,
  onCancel: undefined,
  _resolve: undefined,
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  ...INITIAL_STATE,

  openConfirm: (options: ConfirmOptions) => {
    const prevResolve = get()._resolve
    if (prevResolve) {
      prevResolve(false)
    }

    const variant = options.variant ?? "default"
    const confirmText =
      options.confirmText ?? DEFAULT_CONFIRM_TEXT[variant] ?? "Confirm"
    const cancelText = options.cancelText ?? "Cancel"

    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        isLoading: false,
        title: options.title,
        description: options.description,
        confirmText,
        cancelText,
        variant,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
        _resolve: resolve,
      })
    })
  },

  handleConfirm: async () => {
    const { onConfirm, _resolve, isLoading } = get()
    if (isLoading) return

    if (onConfirm) {
      set({ isLoading: true })
      try {
        await onConfirm()
        set({ isLoading: false, isOpen: false })
        if (_resolve) {
          _resolve(true)
        }
      } catch (err) {
        set({ isLoading: false })
        throw err
      }
    } else {
      set({ isOpen: false })
      if (_resolve) {
        _resolve(true)
      }
    }
  },

  handleCancel: () => {
    const { onCancel, _resolve, isLoading } = get()
    if (isLoading) return

    try {
      if (onCancel) {
        onCancel()
      }
    } finally {
      set({ isOpen: false, isLoading: false })
      if (_resolve) {
        _resolve(false)
      }
    }
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading })
  },

  reset: () => {
    const { _resolve } = get()
    if (_resolve) {
      _resolve(false)
    }
    set(INITIAL_STATE)
  },
}))
