import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { integrationsKeys } from "../api/integrations-queries"
import {
  initiateConnectionFn,
  reconnectConnectionFn,
} from "../api/integrations.functions"

const POPUP_FEATURES =
  "popup=yes,width=520,height=680,left=200,top=120,noopener,noreferrer"

const STORAGE_KEY = "fenr.oauth.pending-session"

export interface ConnectFlowOptions {
  toolkitSlug: string
  displayName: string
  ownerScope?: "organization" | "user"
  surface?: "integrations_page" | "sheet_configure" | "composer_mention"
  returnToPath?: string
  /** Set to repair an existing broken connection instead of connecting new. */
  reconnectAccountId?: string
}

interface PendingSession {
  sessionId: string
  stateNonce: string
  toolkitSlug: string
  displayName: string
  createdAt: number
}

function stashPendingSession(session: PendingSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // The callback page degrades to "close this window" without the stash.
  }
}

/**
 * Drives the hosted OAuth flow: opens the Composio connect link in a popup,
 * stashes the one-time nonce for the callback page, and waits for completion
 * via a `postMessage` handshake before refreshing the catalog.
 */
export function useOauthConnectFlow() {
  const queryClient = useQueryClient()
  const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null)

  const connect = useCallback(
    async (options: ConnectFlowOptions) => {
      const { toolkitSlug, displayName } = options
      setConnectingToolkit(toolkitSlug)

      try {
        const initiation = options.reconnectAccountId
          ? await reconnectConnectionFn({
              data: { accountId: options.reconnectAccountId },
            })
          : await initiateConnectionFn({
              data: {
                toolkitSlug,
                ownerScope: options.ownerScope,
                returnToPath: options.returnToPath,
                initiateSurface: options.surface ?? "integrations_page",
              },
            })

        stashPendingSession({
          sessionId: initiation.session_id,
          stateNonce: initiation.state_nonce,
          toolkitSlug,
          displayName,
          createdAt: Date.now(),
        })

        const popup = window.open(initiation.redirect_url, "fenr-oauth", POPUP_FEATURES)
        if (!popup) {
          toast.error(`Couldn't connect ${displayName}`, {
            description:
              "Your browser blocked the authorization window. Allow popups and try again.",
          })
          return
        }

        const completed = await awaitPopupCompletion(popup)

        if (!completed) {
          toast.error(`Couldn't connect ${displayName}`, {
            description:
              "The authorization window was closed before completion. Click Connect to try again.",
          })
          return
        }

        toast.success(`${displayName} connected`, {
          description: "Agents can now work across this app with your approvals.",
        })
        await queryClient.invalidateQueries({ queryKey: integrationsKeys.all })
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "Something went wrong."
        toast.error(`Couldn't connect ${displayName}`, { description })
      } finally {
        setConnectingToolkit(null)
      }
    },
    [queryClient],
  )

  return { connect, connectingToolkit }
}

function awaitPopupCompletion(
  popup: Window,
): Promise<{ status: string } | null> {
  return new Promise((resolve) => {
    let settled = false

    const cleanup = () => {
      window.removeEventListener("message", onMessage)
      window.clearInterval(poll)
    }

    const finish = (value: { status: string } | null) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return
      }
      const data = event.data as { type?: string; status?: string } | null
      if (data?.type === "fenr-oauth-done") {
        popup.close()
        finish({ status: data.status ?? "unknown" })
      }
    }

    const poll = window.setInterval(() => {
      if (popup.closed) {
        finish(null)
      }
    }, 500)

    window.addEventListener("message", onMessage)
  })
}
