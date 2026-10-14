/**
 * The seam between the composer and the real app.
 *
 * The composer is deliberately unaware of the query cache, the server
 * functions, and the router — that is what made it liftable in the first
 * place. Everything app-specific lives here:
 *
 *   - the provider catalog is the workspace's saved model providers, read
 *     through `getTenantProvidersFn` (one saved configuration is one vendor
 *     and one model; the API key never enters the browser);
 *   - credentials are workspace state, so the credential store is a no-op —
 *     there is nothing for the user to paste into the composer;
 *   - the transport is the agent stream: text attachments are flattened into
 *     the prompt body (the runtime's turn API is text-only, capped at 64 KB)
 *     and the saved-config id rides along as `provider_config_id`;
 *   - the context meter is seeded from the turn's real provider-reported
 *     input tokens once a turn has completed, per the model-usage analytics
 *     report's estimate-versus-actual principle: estimates for pre-flight,
 *     provider numbers as soon as they exist.
 *
 * The pure mapping logic lives in `composer-catalog.ts`; this module owns the
 * effects, the queries, and the two state machines' status plumbing.
 */

import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"
import type {
  ComposerBridge,
  CredentialStore,
  SendPayload,
} from "@/components/composer"
import {
  revokeAttachments,
  setCredentialStore,
  setProvidersSource,
  usePromptStore,
} from "@/components/composer"
import { getNabuCapabilitiesFn } from "@/features/nabu/nabu.functions"
import { tenantProvidersQueryOptions } from "@/features/nabu/queries"
import {
  getTenantProvidersFn,
  savedProviderModelsFn,
} from "@/features/nabu/tenant-provider.functions"
import { moduleLogger } from "@/lib/logger"
import type { UsageReport } from "@/lib/schemas/agent-stream"
import type { TenantProviderSummary } from "@/lib/schemas/nabu"
import {
  flattenPrompt,
  orderProviders,
  toRuntimeTools,
} from "./composer-catalog"
import type { ChatMessage } from "./types"

const log = moduleLogger("chat:composer-host")

/** A no-op credential store: keys are workspace state, never browser state. */
const WORKSPACE_CREDENTIAL_STORE: CredentialStore = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
  clear: () => Promise.resolve(),
  list: () => Promise.resolve([]),
}

// --- module registration ----------------------------------------------------
// Runs once at import, before the first mount can hydrate.

setCredentialStore(WORKSPACE_CREDENTIAL_STORE)

setProvidersSource(async () => {
  const list = await getTenantProvidersFn()
  // The saved configuration's catalogue, fetched with its stored credential —
  // the same dial the settings form's key test uses, so a declined credential
  // is the vendor's own sentence in the picker's failed state.
  return orderProviders(list, (configId) =>
    savedProviderModelsFn({ data: { id: configId } }),
  )
})

/**
 * What a message contributes to the meter. Real per-message token counts do
 * not exist (the runtime reports a turn aggregate), so messages after the
 * seeding boundary are estimated and everything before it rides in the seed.
 */
function toMetered(messages: readonly ChatMessage[]): { content: string }[] {
  return messages.map((message) => ({ content: message.content }))
}

function lastUserId(messages: readonly ChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return messages[index]?.id ?? null
  }
  return null
}

export interface ComposerBridgeOptions {
  readonly threadId?: string
  /** Transcript from the query cache. */
  readonly messages: readonly ChatMessage[]
  /** The conversation's persisted provider choice, when a thread exists. */
  readonly threadProviderId: string | null
  /** The workspace's saved providers, for resolving the persisted choice. */
  readonly savedProviders: TenantProviderSummary[]
  /** What the last completed turn really cost, from the stream. */
  readonly turnUsage: UsageReport | null
  /** The stream projection's status, for settling the composer. */
  readonly turnStatus: string
  readonly isStreaming: boolean
  readonly send: (
    prompt: string,
    threadId?: string | null,
    options?: {
      readonly providerConfigId?: string | null
      readonly modelId?: string | null
      readonly onTurnStarted?: (threadId: string) => void | Promise<void>
      readonly onModelCallRecorded?: (call: {
        savedConfigId: string | null
        modelId: string
        errorCode: string | null
      }) => void
    },
  ) => Promise<void>
  readonly stop: () => void
  /** Navigation seam, so the bridge never imports the router. */
  readonly onTurnStarted: (threadId: string) => void | Promise<void>
}

/**
 * Builds the composer bridge and keeps both state machines honest about
 * what the network is doing.
 */
export function useComposerBridge(
  options: ComposerBridgeOptions,
): ComposerBridge {
  const {
    threadId,
    messages,
    threadProviderId,
    savedProviders,
    turnUsage,
    turnStatus,
    isStreaming,
    send: sendTurn,
    stop: stopTurn,
    onTurnStarted,
  } = options

  /**
   * The seeding boundary: the turn's real input tokens, and the user message
   * that started the turn they cover. Everything up to and including that
   * message is inside the seed; everything after it — the reply, the next
   * turn's items — is estimated. A page reload has no seed (usage is not
   * persisted server-side yet), so the meter estimates the whole transcript.
   */
  const seedRef = useRef<{
    promptTokens: number
    boundaryId: string | null
  } | null>(null)

  useEffect(() => {
    if (!turnUsage) return
    seedRef.current = {
      promptTokens: turnUsage.prompt_tokens,
      boundaryId: lastUserId(messages),
    }
  }, [turnUsage, messages])

  // Settling: the store leaves `submitted` only when the transport says so —
  // otherwise a failed send pins the composer busy forever.
  useEffect(() => {
    if (isStreaming) {
      usePromptStore.getState().markStreaming()
      return
    }
    const store = usePromptStore.getState()
    if (store.status === "submitted" || store.status === "streaming") {
      store.settle(turnStatus === "error" ? "error" : "ready")
    }
  }, [isStreaming, turnStatus])

  const conversation = useCallback((): {
    systemPrompt: string
    messages: { content: string }[]
    historySeed?: number
  } => {
    const seed = seedRef.current
    if (!seed) {
      return { systemPrompt: "", messages: toMetered(messages) }
    }
    const boundaryIndex = messages.findIndex(
      (message) => message.id === seed.boundaryId,
    )
    if (boundaryIndex === -1) {
      // The boundary message is gone: estimate everything rather than seed
      // from a transcript the numbers no longer describe.
      return { systemPrompt: "", messages: toMetered(messages) }
    }
    return {
      systemPrompt: "",
      messages: toMetered(messages.slice(boundaryIndex + 1)),
      historySeed: seed.promptTokens,
    }
  }, [messages])

  // The thread id is read at send time rather than closed over: the first
  // message of a new conversation starts with none, and the send that mints
  // it is the same one that navigates to the thread's URL.
  const threadIdRef = useRef<string | null | undefined>(threadId)
  threadIdRef.current = threadId

  const send = useCallback(
    (payload: SendPayload) => {
      void (async () => {
        try {
          const prompt = await flattenPrompt(payload.text, payload.attachments)
          revokeAttachments(payload.attachments)
          await sendTurn(prompt, threadIdRef.current, {
            providerConfigId: payload.providerId,
            modelId: payload.modelId,
            onTurnStarted,
            onModelCallRecorded: ({ savedConfigId, modelId, errorCode }) => {
              // Only a successful call proves availability; every failure code
              // stays unknown.
              if (!savedConfigId || errorCode !== null) return
              usePromptStore
                .getState()
                .recordModelAvailability(
                  savedConfigId,
                  modelId,
                  payload.availabilityEpoch,
                )
            },
          })
        } catch (error) {
          // Nothing was sent. Hand the files back and say why — the composer
          // stays usable and the user keeps their work.
          usePromptStore
            .getState()
            .addAttachments(
              payload.attachments
                .map((attachment) => attachment.file)
                .filter((file): file is File => Boolean(file)),
            )
          usePromptStore.getState().settle("error")
          toast.error("Message not sent", {
            description:
              error instanceof Error
                ? error.message
                : "The message could not be prepared.",
          })
          log.warn(
            { error: error instanceof Error ? error.message : String(error) },
            "composer send was not prepared",
          )
        }
      })()
    },
    [sendTurn, onTurnStarted],
  )

  const stop = useCallback(() => {
    stopTurn()
  }, [stopTurn])

  const onSettled = useCallback((status: "ready" | "error") => {
    usePromptStore.getState().settle(status)
  }, [])

  // A conversation that already exists runs on its persisted choice, not on
  // whatever the composer auto-selected for a fresh chat. The choice wins
  // once, when it first arrives; after that the picker owns the selection,
  // because a switch the person just made must not be fought by an effect.
  const syncedThreadRef = useRef<string | null>(null)
  useEffect(() => {
    if (!threadProviderId) return
    const state = usePromptStore.getState()
    if (!state.hydrated) return
    if (syncedThreadRef.current === threadProviderId) return
    syncedThreadRef.current = threadProviderId
    if (state.selection?.providerId === threadProviderId) return
    const config = savedProviders.find(
      (candidate) => candidate.id === threadProviderId,
    )
    if (!config) return
    state.select(config.id, config.model)
  }, [threadProviderId, savedProviders])

  return useMemo(
    () => ({ conversation, send, onSettled, stop }),
    [conversation, send, onSettled, stop],
  )
}

/**
 * The workspace's saved providers and the runtime's granted tools, both
 * host-owned context the composer renders rather than fetches.
 */
export function useComposerHostData(): {
  savedProviders: TenantProviderSummary[]
} {
  const setRuntimeTools = usePromptStore((s) => s.setRuntimeTools)
  const { data } = useQuery(tenantProvidersQueryOptions())

  useEffect(() => {
    let cancelled = false
    void getNabuCapabilitiesFn()
      .then((capabilities) => {
        if (cancelled) return
        setRuntimeTools(toRuntimeTools(capabilities.tools))
      })
      .catch(() => {
        // Capabilities are informational; an unreachable runtime still chats.
      })
    return () => {
      cancelled = true
    }
  }, [setRuntimeTools])

  return useMemo(() => ({ savedProviders: data?.providers ?? [] }), [data])
}
