/**
 * Custom hook to surface URL-derived auth errors as user-facing Sonner toasts.
 */
import { useEffect } from "react"
import { toast } from "sonner"

import { getAuthErrorMessage } from "./error-messages"

export function useAuthError(error?: string) {
  useEffect(() => {
    if (error) {
      const errInfo = getAuthErrorMessage(error)
      toast.error(errInfo.title, {
        description: errInfo.description,
      })
    }
  }, [error])
}
