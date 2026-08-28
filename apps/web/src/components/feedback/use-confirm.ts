import { useCallback } from "react"
import { toast } from "sonner"
import { type ConfirmOptions, useConfirmStore } from "./confirm.store"

/**
 * Reusable hook for triggering user confirmation dialogs across the application.
 *
 * @example
 * ```tsx
 * const confirm = useConfirm()
 *
 * // Pattern 1: With callback
 * confirm({
 *   title: "Sign out?",
 *   description: "Are you sure you want to sign out of your account?",
 *   confirmText: "Sign out",
 *   variant: "destructive",
 *   onConfirm: async () => {
 *     await authClient.signOut()
 *   },
 * })
 *
 * // Pattern 2: Promise-based
 * const ok = await confirm({
 *   title: "Delete item?",
 *   description: "This action cannot be undone.",
 *   variant: "destructive",
 * })
 * if (ok) {
 *   await deleteItem(id)
 * }
 * ```
 */
export function useConfirm() {
  const openConfirm = useConfirmStore((state) => state.openConfirm)

  const confirm = useCallback(
    async (options: ConfirmOptions): Promise<boolean> => {
      // If an onConfirm callback is provided, wrap it defensively to catch unhandled errors
      const wrappedOptions: ConfirmOptions = {
        ...options,
        onConfirm: options.onConfirm
          ? async () => {
              try {
                await options.onConfirm?.()
              } catch (error) {
                // If the callback didn't handle its own error, ensure feedback surfaces
                const message =
                  error instanceof Error
                    ? error.message
                    : "An unexpected error occurred. Please try again."
                toast.error("Action failed", { description: message })
                throw error
              }
            }
          : undefined,
      }

      return openConfirm(wrappedOptions)
    },
    [openConfirm],
  )

  return confirm
}

export type { ConfirmOptions, ConfirmVariant } from "./confirm.store"
