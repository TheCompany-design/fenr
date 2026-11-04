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
  setReferenceableItems,
  usePromptStore,
} from "@/components/composer"
import {
  integrationsCatalogQueryOptions,
  toolkitConnectionState,
} from "@/features/integrations/api/integrations-queries"
import { IntegrationBrandLogo } from "@/features/integrations/components/integration-brand-logo"
import { getNabuCapabilitiesFn } from "@/features/nabu/nabu.functions"
import { tenantProvidersQueryOptions } from "@/features/nabu/queries"
import {
  getTenantProvidersFn,
  savedProviderModelsFn,
} from "@/features/nabu/tenant-provider.functions"
import { logoUrl as brandLogoUrl } from "@/lib/brand/logos"
import { moduleLogger } from "@/lib/logger"
import type { UsageReport } from "@/lib/schemas/agent-stream"
import type { TenantProviderSummary } from "@/lib/schemas/nabu"
import {
  flattenPrompt,
  orderProviders,
  toRuntimeTools,
} from "./composer-catalog"
import { contextMeterSeedTokens } from "./context-meter-seed"
import type { LiveTurnTelemetry } from "./state/stream-reducer"
import type { ChatMessage } from "./types"

const log = moduleLogger("chat:composer-host")

const WORKSPACE_CREDENTIAL_STORE: CredentialStore = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
  clear: () => Promise.resolve(),
  list: () => Promise.resolve([]),
}

setCredentialStore(WORKSPACE_CREDENTIAL_STORE)

setProvidersSource(async () => {
  const list = await getTenantProvidersFn()

  return orderProviders(list, (configId) =>
    savedProviderModelsFn({ data: { id: configId } }),
  )
})

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

  readonly messages: readonly ChatMessage[]

  readonly threadChoice: {
    readonly providerConfigId: string | null
    readonly model: string | null
    readonly effort: string | null
  } | null

  readonly savedProviders: TenantProviderSummary[]

  readonly turnUsage: UsageReport | null

  readonly liveTelemetry: LiveTurnTelemetry | null

  readonly turnStatus: string
  readonly isStreaming: boolean
  readonly send: (
    prompt: string,
    threadId?: string | null,
    options?: {
      readonly pinnedToolkits?: string[]
      readonly providerConfigId?: string | null
      readonly modelId?: string | null

      readonly effort?: string | null
      readonly onTurnStarted?: (threadId: string) => void | Promise<void>
      readonly onModelCallRecorded?: (call: {
        savedConfigId: string | null
        modelId: string
        errorCode: string | null
      }) => void
    },
  ) => Promise<void>
  readonly stop: () => void

  readonly onTurnStarted: (threadId: string) => void | Promise<void>
}

export function useComposerBridge(
  options: ComposerBridgeOptions,
): ComposerBridge {
  const {
    threadId,
    messages,
    threadChoice,
    savedProviders,
    turnUsage,
    liveTelemetry,
    turnStatus,
    isStreaming,
    send: sendTurn,
    stop: stopTurn,
    onTurnStarted,
  } = options

  const integrationsCatalog = useQuery(integrationsCatalogQueryOptions())
  useEffect(() => {
    const catalogData =
      integrationsCatalog.data && !("unavailable" in integrationsCatalog.data)
        ? integrationsCatalog.data
        : null
    const toolkits = catalogData?.toolkits ?? []
    setReferenceableItems(
      toolkits.slice(0, 12).map((toolkit) => ({
        id: `integration:${toolkit.slug}`,
        label: toolkit.display_name,
        hint: toolkit.composer_action_hint,
        insertText: `@${toolkit.display_name}`,
        toolkitSlug: toolkit.slug,
        connectionBadge:
          toolkitConnectionState(toolkit) === "available"
            ? ("not connected" as const)
            : ("connected" as const),
        icon: (
          <IntegrationBrandLogo
            slug={toolkit.logo_slug}
            monochrome={toolkit.logo_monochrome}
            size={22}
          />
        ),
        // The draft draws the mention pill itself from this data; the mark
        // comes resolved from the one logo service the repo names.
        logoUrl: brandLogoUrl(toolkit.logo_slug),
        logoMonochrome: toolkit.logo_monochrome,
        accentHex: toolkit.brand_accent_hex,
      })),
    )
  }, [integrationsCatalog.data])

  const seedRef = useRef<{
    promptTokens: number
    boundaryId: string | null
  } | null>(null)

  useEffect(() => {
    const promptTokens = liveTelemetry
      ? liveTelemetry.lastStepPromptTokens +
        liveTelemetry.lastStepCompletionTokens
      : turnUsage
        ? contextMeterSeedTokens(turnUsage)
        : null
    if (promptTokens === null) return
    seedRef.current = {
      promptTokens,
      boundaryId: lastUserId(messages),
    }
  }, [liveTelemetry, turnUsage, messages])

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
      return { systemPrompt: "", messages: toMetered(messages) }
    }
    return {
      systemPrompt: "",
      messages: toMetered(messages.slice(boundaryIndex + 1)),
      historySeed: seed.promptTokens,
    }
  }, [messages])

  const threadIdRef = useRef<string | null | undefined>(threadId)
  threadIdRef.current = threadId

  const send = useCallback(
    (payload: SendPayload) => {
      void (async () => {
        try {
          const prompt = await flattenPrompt(payload.text, payload.attachments)
          revokeAttachments(payload.attachments)
          await sendTurn(prompt, threadIdRef.current, {
            pinnedToolkits: payload.pinnedToolkits,
            providerConfigId: payload.providerId,
            modelId: payload.modelId,
            effort: payload.effort,
            onTurnStarted,
            onModelCallRecorded: ({ savedConfigId, modelId, errorCode }) => {
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

  const hydrated = usePromptStore((state) => state.hydrated)
  const runtime = usePromptStore((state) => state.runtime)
  const syncedThreadRef = useRef<string | null>(null)
  useEffect(() => {
    const configId = threadChoice?.providerConfigId
    if (!threadId || !configId) return
    if (!hydrated) return
    if (syncedThreadRef.current === threadId) return

    const config = savedProviders.find((candidate) => candidate.id === configId)
    if (!config) return
    const catalog = runtime[config.id]?.catalog
    if (catalog?.state !== "ready") return

    const requestedModel = threadChoice.model?.trim() || config.model?.trim()
    const requestedExists = requestedModel
      ? catalog.models.some((model) => model.id === requestedModel)
      : false
    const modelId = requestedExists
      ? requestedModel
      : catalog.models.find(
          (model) =>
            !runtime[config.id]?.entitlements.deniedModels?.includes(model.id),
        )?.id
    if (modelId) usePromptStore.getState().select(config.id, modelId)
    if (threadChoice.effort) {
      usePromptStore.getState().setEffort(threadChoice.effort)
    }
    syncedThreadRef.current = threadId
  }, [threadId, threadChoice, savedProviders, hydrated, runtime])

  return useMemo(
    () => ({ conversation, send, onSettled, stop }),
    [conversation, send, onSettled, stop],
  )
}

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
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [setRuntimeTools])

  return useMemo(() => ({ savedProviders: data?.providers ?? [] }), [data])
}
