/**
 * Global confirmation modal store.
 *
 * Provides in-memory state and actions for the reusable confirmation modal.
 * Supports both imperative Promise-based awaiting and callback-based workflows.
 */

import type { ReactNode } from "react"
import { create } from "zustand"

export type ConfirmVariant = "default" | "destructive"

export interface ConfirmOptions {
  /** Title of the confirmation dialog */
  title: ReactNode
  /** Descriptive explanation of the consequences of the action */
  description?: ReactNode
  /** Label for the confirmation action button. Defaults to "Confirm" (or "Delete" for destructive). */
  confirmText?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelText?: string
  /** Visual variant determining action button style and alert badge coloring */
  variant?: ConfirmVariant
  /** Optional callback invoked when the user confirms. Can return a Promise. */
  onConfirm?: () => Promise<void> | void
  /** Optional callback invoked when the user cancels or dismisses the modal. */
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

  /** Open the confirmation modal with custom options */
  openConfirm: (options: ConfirmOptions) => Promise<boolean>
  /** User clicked confirm action */
  handleConfirm: () => Promise<void>
  /** User clicked cancel action or dismissed modal */
  handleCancel: () => void
  /** Set loading indicator on confirmation action */
  setLoading: (loading: boolean) => void
  /** Close and reset the modal */
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
    // If a previous confirmation was still pending, cancel it first
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
      try {
        set({ isLoading: true })
        await onConfirm()
        _resolve?.(true)
        set({ isOpen: false, isLoading: false, _resolve: undefined })
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    } else {
      _resolve?.(true)
      set({ isOpen: false, isLoading: false, _resolve: undefined })
    }
  },

  handleCancel: () => {
    const { onCancel, _resolve, isLoading } = get()
    if (isLoading) return // Prevent dismissing while async mutation is in-flight

    try {
      onCancel?.()
    } finally {
      _resolve?.(false)
      set({ isOpen: false, isLoading: false, _resolve: undefined })
    }
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },

  reset: () => {
    const { _resolve } = get()
    if (_resolve) {
      _resolve(false)
    }
    set(INITIAL_STATE)
  },
}))
