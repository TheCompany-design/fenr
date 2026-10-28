import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { completeConnectionCallbackFn } from "@/features/integrations/api/integrations.functions"

const STORAGE_KEY = "fenr.oauth.pending-session"

export const Route = createFileRoute("/_app/integrations/oauth/callback")({
  component: OAuthCallbackPage,
})

/**
 * Landing page for the hosted OAuth redirect. The pending session (id +
 * one-time nonce) is stashed in localStorage by the opener before the popup
 * opens, so completion works for both popups and full-page redirects.
 */
function OAuthCallbackPage() {
  useEffect(() => {
    let cancelled = false

    async function complete() {
      let stashed: {
        sessionId: string
        stateNonce: string
      } | null = null
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as {
            sessionId: string
            stateNonce: string
            createdAt: number
          }
          // Sessions older than 15 minutes match the runtime's expiry.
          if (Date.now() - parsed.createdAt < 15 * 60 * 1000) {
            stashed = parsed
          }
        }
      } catch {
        stashed = null
      }

      if (!stashed) {
        reportDone(false)
        return
      }

      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // best effort
      }

      try {
        const result = await completeConnectionCallbackFn({
          data: {
            sessionId: stashed.sessionId,
            stateNonce: stashed.stateNonce,
          },
        })
        if (cancelled) {
          return
        }
        reportDone(result.status === "active")
      } catch {
        if (!cancelled) {
          reportDone(false)
        }
      }
    }

    void complete()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <div className="grid gap-2 text-center">
        <p className="text-sm font-medium">Finishing the connection…</p>
        <p className="text-xs text-muted-foreground">
          This window closes on its own once the app is connected.
        </p>
      </div>
    </div>
  )
}

function reportDone(successful: boolean) {
  if (window.opener) {
    window.opener.postMessage(
      { type: "fenr-oauth-done", status: successful ? "active" : "failed" },
      window.location.origin,
    )
    window.close()
  }
}
