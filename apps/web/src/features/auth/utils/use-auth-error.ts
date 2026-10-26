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
