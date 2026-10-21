import { useCallback } from "react"
import { toast } from "sonner"
import {
  type ConfirmOptions,
  useConfirmStore,
} from "@/lib/stores/confirm.store"

export function useConfirm() {
  const openConfirm = useConfirmStore((state) => state.openConfirm)

  const confirm = useCallback(
    async (options: ConfirmOptions): Promise<boolean> => {
      const wrappedOptions: ConfirmOptions = {
        ...options,
        onConfirm: options.onConfirm
          ? async () => {
              try {
                await options.onConfirm?.()
              } catch (error) {
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

export type { ConfirmOptions, ConfirmVariant } from "@/lib/stores/confirm.store"
