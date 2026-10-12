import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import {
  type Attachment,
  createAttachments,
  createEntityId,
  revokeAttachments,
} from "../catalog/attachments"
import {
  type Catalog,
  type Connection,
  catalogModels,
  type EffortLevel,
  type Entitlements,
  isUsable,
  type ModelSpec,
  type ProviderId,
  type ProviderSpec,
  type ResolvedCaps,
} from "../catalog/capabilities"
import {
  type Blocker,
  type ComposerState,
  type Mention,
  type Notice,
  reconcile,
  type Selection,
  toolKindOf,
} from "../catalog/reconcile"
import { resolveCapabilities } from "../catalog/resolve"
import type { ContextUsage } from "../catalog/usage"

/** A tool the agent runtime manages itself; shown, not toggled. */
export type RuntimeTool = {
  id: string
  label: string
  hint?: string
}

import {
  type CredentialStore,
  LocalCredentialStore,
} from "../catalog/credentials"
import {
  getProvider,
  PROVIDERS,
  validateConnection,
} from "../catalog/providers"

export type ProviderRuntime = {
  connection: Connection
  catalog: Catalog
  entitlements: Entitlements
}

export type PromptStore = ComposerState & {
  providers: ProviderSpec[]
  runtime: Record<ProviderId, ProviderRuntime>
  caps: ResolvedCaps
  blockers: Blocker[]
  /** `ready` until a send is attempted; the transport owns the rest. */
  status: ComposerStatus
  notices: Notice[]
  usage: ContextUsage | null
  hydrated: boolean
  /**
   * Why the provider list could not be read, when it could not. Distinguishing
   * "this workspace has none" from "we could not ask" is the difference
   * between pointing at settings and pointing at a retry: a silent empty list
   * hides the failure and, with it, the context meter and every control that
   * needs a model.
   */
  providersError: string | null
  transport: ComposerTransport | null
  /**
   * Starred models, keyed `"providerId/modelId"`. This is a durable
   * preference rather than composer state, so it lives outside the reconciled
   * slice — reconciling it would be meaningless and every keystroke would
   * have to consider it.
   */
  starredModels: string[]
  /**
   * Tools the agent runtime manages itself. Host-provided like `providers`,
   * and rendered as informational rows: the runtime authorizes its own tools
   * per turn, so a toggle here would promise something the wire never does.
   */
  runtimeTools: RuntimeTool[]

  /** Recomputes caps from the selection, then reconciles. The only exit. */
  apply: (patch: Partial<ComposerState>) => void
  select: (providerId: ProviderId, modelId: string) => void
  setEffort: (effort: EffortLevel) => void
  toggleTool: (toolId: string) => void
  toggleSearch: () => void
  setText: (text: string) => void
  addMentions: (mentions: Mention[]) => void
  removeMention: (id: string) => void
  addAttachments: (files: File[]) => void
  removeAttachment: (id: string) => void
  clearAttachments: () => void
  setUsage: (usage: ContextUsage) => void
  /** Drops the measurement, e.g. when the transcript is cleared. */
  clearUsage: () => void
  dismissNotice: () => void
  toggleStar: (key: string) => void
  submit: () => void
  stop: () => void
  /**
   * The transport opened the stream. Separated from `submit` so the status
   * tracks what the connection is actually doing rather than what was hoped.
   */
  markStreaming: () => void
  /**
   * Injected rather than imported so the store holds no reference to the
   * server function — which is what makes this testable, and what keeps the
   * playground's dummy backend swappable for a real one without touching the
   * composer's state machine.
   */
  setTransport: (bridge: ComposerTransport) => void
  /** Called by the transport when a reply lands or fails. */
  settle: (status: ComposerStatus) => void
  connect: (providerId: ProviderId, credential: string) => Promise<void>
  disconnect: (providerId: ProviderId) => Promise<void>
  hydrate: () => Promise<void>
  /** Host-provided context: the tools the runtime runs on its own. */
  setRuntimeTools: (tools: RuntimeTool[]) => void
}

const EMPTY_CAPS: ResolvedCaps = resolveCapabilities({
  provider: PROVIDERS[0],
  model: null,
  connection: { state: "absent" },
  entitlements: {},
})

const IDLE: ProviderRuntime = {
  connection: { state: "absent" },
  catalog: { state: "idle" },
  entitlements: {},
}

function runtimeOf(
  runtime: Record<ProviderId, ProviderRuntime>,
  providerId: ProviderId,
): ProviderRuntime {
  return runtime[providerId] ?? IDLE
}

/**
 * Tool eligibility is a join over two sets — the model's supported kinds and
 * the key's allowance — so it lives here rather than in a component. Picking a
 * model is a statement about what you are about to run, and it must not leave
 * a tool enabled that the model cannot call.
 */
function eligibleToolIds(
  caps: ResolvedCaps,
  available: readonly string[],
): string[] {
  if (!isUsable(caps.tools)) return []
  const { kinds, max } = caps.tools.capability
  const eligible = available.filter((toolId) => {
    const kind = toolKindOf(toolId)
    return kind !== null && kinds.includes(kind)
  })
  return eligible.slice(0, max)
}

/**
 * The credential store is a module-level singleton rather than a store
 * member: it is infrastructure, it never changes for the lifetime of the
 * page, and putting it in state would mean it participates in every
 * re-render and cannot be swapped per-test without a reset.
 */
let credentialStore: CredentialStore = new LocalCredentialStore()

export function setCredentialStore(store: CredentialStore): void {
  credentialStore = store
}

/**
 * Where the provider list comes from.
 *
 * The playground ships the static catalog in `catalog/providers`; a host app
 * whose providers are server-side state — saved configurations, workspace
 * entitlements — injects its own source here, exactly as it injects a
 * credential store. `hydrate` awaits it before loading catalogs, because a
 * provider that is not in the list has no catalog to load.
 */
type ProvidersSource = () => Promise<readonly ProviderSpec[]>

let providersSource: ProvidersSource = () => Promise.resolve(PROVIDERS)

export function setProvidersSource(source: ProvidersSource): void {
  providersSource = source
}

function loadProviders(): Promise<readonly ProviderSpec[]> {
  return providersSource()
}

export const usePromptStore = create<PromptStore>()((set, get) => {
  /**
   * Every mutation funnels through here. The order matters: capabilities are
   * recomputed from the *patched* selection first, because whether a tool
   * survives depends on what was just selected, and reconciling against stale
   * caps would leave a tool enabled that the new model cannot call.
   */
  /**
   * Text cannot change a capability, a blocker, or a notice. The only
   * text-dependent rule is the context meter, and that arrives separately
   * through `setUsage` with a fresh measurement.
   *
   * Routing edits through here instead of `apply` is what keeps a keystroke
   * off the model picker, the effort control, and the tool menu: `apply`
   * rebuilds `caps`, `blockers`, and `notices` as new references every call,
   * so anything subscribed to them would re-render on every character.
   */
  function applyLocal(patch: Partial<ComposerState>) {
    set(patch as Partial<PromptStore>)
  }

  function apply(patch: Partial<ComposerState>) {
    set((state) => {
      const next: ComposerState = { ...state, ...patch }
      const caps = computeCaps(next, state.runtime)
      const result = reconcile(
        { ...next, toolIds: eligibleToolIds(caps, next.toolIds) },
        caps,
        state.usage ?? undefined,
      )
      return {
        ...result.state,
        caps,
        // Identity is preserved when the outcome is unchanged, so a reconcile
        // that concludes "nothing to report" does not wake every subscriber.
        blockers: sameBlockers(result.blockers, state.blockers)
          ? state.blockers
          : result.blockers,
        notices: sameNotices(result.notices, state.notices)
          ? state.notices
          : result.notices,
      }
    })
  }

  return {
    text: "",
    mentions: [],
    attachments: [],
    selection: null,
    effort: null,
    toolIds: [],
    search: false,
    providers: PROVIDERS,
    runtime: {},
    caps: EMPTY_CAPS,
    blockers: [{ kind: "no-model" }],
    notices: [],
    usage: null,
    hydrated: false,
    providersError: null,
    status: "ready",
    transport: null,
    starredModels: [],
    runtimeTools: [],

    apply,

    select: (providerId, modelId) => {
      const runtime = runtimeOf(get().runtime, providerId)
      const available = catalogModels(runtime.catalog)

      // Selecting a model from a provider that has not finished loading has
      // to resolve against *something*, or the composer flashes every
      // capability as denied while the network catches up.
      const model = available.find((candidate) => candidate.id === modelId)
      const next: Selection | null = model ? { providerId, modelId } : null

      // Reusing the previous object when the selection is unchanged keeps
      // `computeCaps`' identity memo valid, so a redundant reselect costs
      // nothing downstream.
      const current = get().selection
      apply({ selection: sameSelection(current, next) ? current : next })
    },

    setEffort: (effort) => apply({ effort }),
    toggleSearch: () => apply({ search: !get().search }),

    setText: (text) => {
      const state = get()
      // A mention whose span no longer matches what the user typed is dead.
      // Validating on write keeps the list derived rather than reconciled
      // later, so no reader can observe a stale mention.
      const mentions = state.mentions.filter(
        (mention) =>
          text.slice(mention.start, mention.end) === mention.insertText,
      )
      applyLocal({ text, mentions })
    },

    addMentions: (incoming) => {
      const state = get()
      const mentions = [
        ...state.mentions,
        ...incoming.map((mention) => ({
          ...mention,
          id: mention.id || createEntityId("m"),
        })),
      ]
      applyLocal({ mentions })
    },

    removeMention: (id) =>
      applyLocal({
        mentions: get().mentions.filter((mention) => mention.id !== id),
      }),

    toggleTool: (toolId) => {
      const state = get()
      const next = state.toolIds.includes(toolId)
        ? state.toolIds.filter((id) => id !== toolId)
        : [...state.toolIds, toolId]
      apply({ toolIds: next })
    },

    addAttachments: (files) => {
      const state = get()
      const keys = new Set(
        state.attachments.map((a) => `${a.name}:${a.size}:${a.mimeType}`),
      )
      const fresh = files.filter(
        (file) => !keys.has(`${file.name}:${file.size}:${file.type}`),
      )
      if (!fresh.length) return

      // Anything the selected model cannot accept is surfaced as a blocker
      // by reconcile; it is not dropped here, because the user's file is
      // still their file and the resolution is theirs to pick.
      apply({
        attachments: [...state.attachments, ...createAttachments(fresh)],
      })
    },

    removeAttachment: (id) => {
      const state = get()
      const target = state.attachments.find((a) => a.id === id)
      revokeAttachments(target ? [target] : undefined)
      apply({ attachments: state.attachments.filter((a) => a.id !== id) })
    },

    clearAttachments: () => {
      revokeAttachments(get().attachments)
      apply({ attachments: [] })
    },

    setUsage: (usage) => {
      // The meter recomputes on every keystroke and can land on the same
      // rounded value repeatedly; comparing first stops a slider-free store
      // from waking every subscriber for a no-op.
      const previous = get().usage
      if (
        previous &&
        previous.used === usage.used &&
        previous.window === usage.window
      ) {
        return
      }
      set((state) => {
        // Only the derived channels move. Caps and the composer's own settings
        // are untouched by a re-measure, so re-running the setting rules here
        // would churn them for nothing.
        const result = reconcile(state, state.caps, usage)
        return {
          usage,
          blockers: result.blockers,
          notices: result.notices,
        }
      })
    },

    dismissNotice: () => set({ notices: [] }),

    clearUsage: () => set({ usage: null }),

    submit: () => {
      const state = get()
      // Every gate re-checked here rather than trusted from the button's
      // disabled state: this is the only path that hands work to the network,
      // and it must hold even when called from a keyboard shortcut.
      if (state.status === "streaming" || state.status === "submitted") return
      if (state.blockers.length > 0) return
      if (!state.selection || !state.caps.model) return
      if (!/[^\s]/.test(state.text)) return

      if (!state.transport) return

      const attachments = takeAttachments()

      state.transport.send({
        text: state.text.trim(),
        providerId: state.selection.providerId,
        modelId: state.selection.modelId,
        effort: state.effort,
        toolIds: state.toolIds,
        search: state.search,
        attachments,
      })
      set({ text: "", mentions: [], status: "submitted" })
    },

    stop: () => {
      // Resetting the status alone would leave the network running: the
      // transport is asked first, and the composer only then stands down.
      get().transport?.stop?.()
      set({ status: "ready" })
    },

    markStreaming: () =>
      set((state) =>
        state.status === "submitted" || state.status === "streaming"
          ? { status: "streaming" }
          : {},
      ),

    setTransport: (bridge) => set({ transport: bridge }),

    setRuntimeTools: (tools) => set({ runtimeTools: tools }),

    /** Called by the transport when a reply lands or fails. */
    settle: (status) => set({ status }),

    toggleStar: (key) =>
      set((state) => ({
        starredModels: state.starredModels.includes(key)
          ? state.starredModels.filter((entry) => entry !== key)
          : [...state.starredModels, key],
      })),

    connect: async (providerId, credential) => {
      const provider = getProvider(providerId)
      if (!provider) return

      await credentialStore.set(providerId, credential)
      patchRuntime(set, providerId, { connection: { state: "validating" } })

      const connection = await validateConnection(provider, credential)
      patchRuntime(set, providerId, { connection })

      if (connection.state === "invalid") return
      await loadCatalog(provider, credential, set, get)
    },

    disconnect: async (providerId) => {
      await credentialStore.clear(providerId)
      patchRuntime(set, providerId, {
        connection: { state: "absent" },
        catalog: { state: "idle" },
      })
      const selection = get().selection
      if (selection?.providerId === providerId) {
        apply({ selection: null, toolIds: [] })
      }
    },

    hydrate: async () => {
      // The provider list itself may be fetched (saved workspace
      // configurations). A failed fetch degrades to an empty catalog with
      // hydration still completing — an unreachable server must not hang the
      // composer in "loading providers" forever — but it is *recorded*, so the
      // interface can say "we could not ask" instead of "you have none".
      let providers: ProviderSpec[] = []
      let providersError: string | null = null
      try {
        providers = [...(await loadProviders())]
      } catch (error) {
        providers = []
        providersError =
          error instanceof Error
            ? error.message
            : "the provider list could not be read"
      }
      set({ providers, providersError })

      await Promise.all(
        providers.map(async (provider) => {
          const credential = await credentialStore.get(provider.id)
          const connection = await validateConnection(provider, credential)
          patchRuntime(set, provider.id, { connection })
          if (connection.state === "ready") {
            await loadCatalog(provider, credential, set, get)
          }
        }),
      )

      // Selection picks the first provider that actually resolved, in
      // declared order, rather than whichever finished loading first.
      const selection = firstAvailableSelection(get())
      set({ hydrated: true })

      if (selection) apply({ selection })
    },
  }
})

function patchRuntime(
  set: (fn: (state: PromptStore) => Partial<PromptStore>) => void,
  providerId: ProviderId,
  patch: Partial<ProviderRuntime>,
): void {
  set((state) => ({
    runtime: {
      ...state.runtime,
      [providerId]: { ...runtimeOf(state.runtime, providerId), ...patch },
    },
  }))
}

/**
 * Loading is only entered when there is nothing to show. Refreshing a catalog
 * that already has models leaves it in place, so a background refresh never
 * collapses the model list into a skeleton.
 */
async function loadCatalog(
  provider: ProviderSpec,
  credential: string | null,
  set: (fn: (state: PromptStore) => Partial<PromptStore>) => void,
  get: () => PromptStore,
): Promise<void> {
  const existing = runtimeOf(get().runtime, provider.id).catalog
  if (catalogModels(existing).length === 0) {
    patchRuntime(set, provider.id, { catalog: { state: "loading" } })
  }

  try {
    const models = await provider.source.load(credential)
    patchRuntime(set, provider.id, {
      catalog: {
        state: "ready",
        models,
        fetchedAt: Date.now(),
        degraded: false,
      },
    })
    // A refresh that changes the catalog can invalidate the current selection
    // (the model may be gone), so the composer is reconciled either way.
    const selection = get().selection
    if (selection?.providerId === provider.id) {
      const stillThere = models.some((m) => m.id === selection.modelId)
      if (!stillThere) get().select(provider.id, models[0]?.id ?? "")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    patchRuntime(set, provider.id, {
      catalog: {
        state: "failed",
        error: { kind: "unknown", message },
        retryable: true,
        lastGood: catalogModels(existing),
      },
    })
  }
}

/**
 * Capabilities are memoized on the identity of their *inputs*, not on a deep
 * comparison of their outputs.
 *
 * `runtime` is replaced wholesale by `patchRuntime` whenever any provider's
 * connection, catalog, or entitlements change, and `selection` is kept
 * referentially stable (see `sameSelection`). So an identity check is
 * sufficient to prove the result would be identical — no walking the
 * capability tree per keystroke, and no comparator that can disagree with the
 * resolver about what counts as equal.
 */
let capsMemo: {
  runtime: Record<ProviderId, ProviderRuntime>
  selection: Selection | null
  caps: ResolvedCaps
} | null = null

function computeCaps(
  state: ComposerState,
  runtime: Record<ProviderId, ProviderRuntime>,
): ResolvedCaps {
  if (
    capsMemo &&
    capsMemo.runtime === runtime &&
    capsMemo.selection === state.selection
  ) {
    return capsMemo.caps
  }

  const caps = resolveFor(state.selection, runtime)
  capsMemo = { runtime, selection: state.selection, caps }
  return caps
}

function resolveFor(
  selection: Selection | null,
  runtime: Record<ProviderId, ProviderRuntime>,
): ResolvedCaps {
  if (!selection) return EMPTY_CAPS
  const provider = getProvider(selection.providerId)
  if (!provider) return EMPTY_CAPS

  const entry = runtimeOf(runtime, provider.id)
  const model =
    catalogModels(entry.catalog).find((m) => m.id === selection.modelId) ?? null

  return resolveCapabilities({
    provider,
    model,
    connection: entry.connection,
    entitlements: entry.entitlements,
  })
}

/** Keeps the selection stable across a no-op reselect, so the memo still hits. */
function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.providerId === b.providerId && a.modelId === b.modelId
}

function sameBlockers(a: Blocker[], b: Blocker[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((blocker, index) => blocker.kind === b[index].kind)
}

function sameNotices(a: Notice[], b: Notice[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((notice, index) => notice.kind === b[index].kind)
}

function firstAvailableSelection(state: PromptStore): Selection | null {
  for (const provider of state.providers) {
    const entry = runtimeOf(state.runtime, provider.id)
    if (entry.connection.state !== "ready") continue
    const model = catalogModels(entry.catalog).find(
      (candidate) => !entry.entitlements.deniedModels?.includes(candidate.id),
    )
    if (model) return { providerId: provider.id, modelId: model.id }
  }
  return null
}

export type ComposerStatus = "ready" | "submitted" | "streaming" | "error"

export type ComposerTransport = {
  send: (payload: SendPayload) => void
  onSettled: (status: "ready" | "error") => void
  /**
   * Stops the in-flight work. Optional for hosts whose transport cannot be
   * interrupted, but a streaming transport that ignores it strands the
   * composer's status on a send the network has already abandoned.
   */
  stop?: () => void
}

export type SendPayload = {
  text: string
  providerId: string
  modelId: string
  effort: EffortLevel | null
  toolIds: string[]
  search: boolean
  /**
   * The staged files, whole. Reading, flattening, and uploading them are
   * host decisions — the composer only guarantees it never hands over a
   * name that points at nothing.
   */
  attachments: Attachment[]
}

/** Drops attachments when the composer is handed off to a message. */
export function takeAttachments(): Attachment[] {
  const attachments = usePromptStore.getState().attachments
  usePromptStore.getState().apply({ attachments: [] })
  return attachments
}

export function findModel(
  providerId: ProviderId,
  modelId: string,
): ModelSpec | undefined {
  const state = usePromptStore.getState()
  const entry = runtimeOf(state.runtime, providerId)
  return catalogModels(entry.catalog).find((m) => m.id === modelId)
}

// --- selectors ------------------------------------------------------------
// Narrow reads only. The text field is the sole subscriber to `text`; every
// other component reads a derived boolean so a keystroke re-renders the
// textarea and nothing else.

export const usePromptText = () => usePromptStore((s) => s.text)
export const usePromptSelection = () => usePromptStore((s) => s.selection)
export const usePromptCaps = () => usePromptStore((s) => s.caps)
export const usePromptBlockers = () => usePromptStore((s) => s.blockers)
export const usePromptNotices = () => usePromptStore((s) => s.notices)
export const usePromptUsage = () => usePromptStore((s) => s.usage)
export const usePromptHydrated = () => usePromptStore((s) => s.hydrated)

export const usePromptAttachments = () => usePromptStore((s) => s.attachments)

export const usePromptEffort = () =>
  usePromptStore(
    useShallow((s) => ({ effort: s.effort, levels: effortLevels(s) })),
  )

export const usePromptTools = () =>
  usePromptStore(
    useShallow((s) => ({
      toolIds: s.toolIds,
      search: s.search,
      supported: supportedToolKinds(s),
    })),
  )

/**
 * The single definition of "can this be sent". A blocker counts as
 * unsendable: the user has a decision to make, not a spinner to wait through,
 * so it disables exactly like a missing model does.
 */
export const useCanSend = () =>
  usePromptStore(
    useShallow((s) => {
      const ready = s.status === "ready" || s.status === "error"
      return {
        canSend:
          ready &&
          /[^\s]/.test(s.text) &&
          s.blockers.length === 0 &&
          s.caps.model !== null,
        busy: s.status === "streaming" || s.status === "submitted",
      }
    }),
  )

function effortLevels(state: PromptStore): readonly EffortLevel[] {
  return isUsable(state.caps.reasoning)
    ? state.caps.reasoning.capability.levels
    : []
}

function supportedToolKinds(state: PromptStore): readonly string[] {
  if (!isUsable(state.caps.tools)) return []
  return state.caps.tools.capability.kinds
}
