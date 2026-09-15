import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export function AppErrorComponent({ reset }: ErrorComponentProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)

    try {
      await router.invalidate()
      reset()
    } catch {
      toast.error("Retry failed", {
        description: "Could not reload the workspace. Please try again.",
      })
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false)
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} size={24} />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Unable to load organization
        </h1>
        <p className="text-sm text-muted-foreground">
          We encountered a problem resolving your workspace access. Please try
          again.
        </p>
        <Button onClick={handleRetry} disabled={isRetrying} variant="outline">
          {isRetrying ? "Retrying..." : "Try again"}
        </Button>
      </div>
    </div>
  )
}
