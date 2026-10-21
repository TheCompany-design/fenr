import type {
  Access,
  Cap,
  Connection,
  Entitlements,
  Gate,
  ModelSpec,
  NativeToolKind,
  ProviderSpec,
  ReasoningScale,
  Resolved,
  ResolvedCaps,
  ToolKind,
} from "./capabilities"
import { levelIndex, narrowedDefault, narrowScale } from "./effort"

function unavailable<T>(reason: string): Resolved<T> {
  return { access: { kind: "denied", reason }, capability: null }
}

function offered<T>(
  capability: T,
  access: Access = { kind: "available" },
): Resolved<T> {
  return { access, capability }
}

function gated<T>(capability: T, gate: Gate): Resolved<T> {
  return { access: { kind: "gated", gate }, capability }
}

export function scopeModelAccessToCredentialRevision(
  model: ModelSpec | null,
  catalogRevision: string | undefined,
  credentialRevision: string | undefined,
): ModelSpec | null {
  if (
    model?.keyAccessConfirmed !== true ||
    (catalogRevision !== undefined &&
      credentialRevision !== undefined &&
      catalogRevision === credentialRevision)
  ) {
    return model
  }
  return { ...model, keyAccessConfirmed: undefined }
}

function connectionGate(
  provider: ProviderSpec,
  connection: Connection,
): Gate | null {
  switch (connection.state) {
    case "absent":
      return {
        kind: "connect",
        providerId: provider.id,
        providerLabel: provider.label,
      }
    case "invalid":
      return {
        kind: "connect",
        providerId: provider.id,
        providerLabel: provider.label,
      }
    case "validating":
    case "unreachable":
    case "ready":
      return null
  }
}

export function resolveCapabilities(input: {
  provider: ProviderSpec
  model: ModelSpec | null
  connection: Connection
  entitlements: Entitlements
}): ResolvedCaps {
  const { provider, model, connection, entitlements } = input

  if (!model) {
    const reason = "No model selected"
    return {
      model: null,
      modelAccess: { kind: "unknown" },
      vision: unavailable(reason),
      files: unavailable(reason),
      reasoning: unavailable(reason),
      tools: unavailable(reason),
      native: unavailable(reason),
      search: unavailable(reason),
    }
  }

  if (entitlements.deniedModels?.includes(model.id)) {
    const reason = "Not available on this key"
    return {
      model,
      modelAccess: { kind: "denied", reason },
      vision: unavailable(reason),
      files: unavailable(reason),
      reasoning: unavailable(reason),
      tools: unavailable(reason),
      native: unavailable(reason),
      search: unavailable(reason),
    }
  }

  const pending = connectionGate(provider, connection)

  const modelAccess = pending
    ? { kind: "gated" as const, gate: pending }
    : model.keyAccessConfirmed ||
        entitlements.availableModels?.includes(model.id)
      ? { kind: "available" as const }
      : { kind: "unknown" as const }

  const resolveOne = <P, T>(
    cap: Cap<P>,
    payload: (supported: P) => T,
  ): Resolved<T> => {
    if (!cap.supported) return unavailable("Not supported by this model")
    const value = payload(cap)
    return pending ? gated(value, pending) : offered(value)
  }

  const caps = model.caps

  const reasoningCap = caps.reasoning
  let reasoning: Resolved<ReasoningScale>
  if (!reasoningCap.supported) {
    reasoning = unavailable("Not supported by this model")
  } else {
    const scale = narrowScale(reasoningCap, entitlements.effort)
    if (scale.levels.length === 0) {
      reasoning = offered(scale, {
        kind: "gated",
        gate: {
          kind: "upgrade",
          plan: "reasoning",
          label: "Your key's tier has no reasoning levels",
        },
      })
    } else {
      const preferred =
        levelIndex(scale.levels, scale.default) >= 0
          ? scale.default
          : narrowedDefault(scale.levels)
      reasoning = pending
        ? gated({ ...scale, default: preferred }, pending)
        : offered({ ...scale, default: preferred })
    }
  }

  const nativeCap = caps.native
  let native: Resolved<{ kinds: readonly NativeToolKind[] }>
  if (!nativeCap.supported) {
    native = unavailable("Not supported by this model")
  } else {
    const kinds = entitlements.deniedNativeTools
      ? nativeCap.kinds.filter(
          (kind) => !entitlements.deniedNativeTools?.includes(kind),
        )
      : nativeCap.kinds
    native = resolveOne(nativeCap, () => ({ kinds }))
  }

  const toolsCap = caps.tools
  let tools: Resolved<{ max: number; kinds: readonly ToolKind[] }>
  if (!toolsCap.supported) {
    tools = unavailable("Not supported by this model")
  } else {
    const max = entitlements.maxTools
      ? Math.min(toolsCap.max, entitlements.maxTools)
      : toolsCap.max
    tools = resolveOne(toolsCap, () => ({ max, kinds: toolsCap.kinds }))
  }

  return {
    model,
    modelAccess,
    vision: resolveOne(caps.vision, (c) => ({ maxImages: c.maxImages })),
    files: resolveOne(caps.files, (c) => ({
      kinds: c.kinds,
      maxFiles: c.maxFiles,
      maxSizeMb: c.maxSizeMb,
    })),
    reasoning,
    tools,
    native,
    search: resolveOne(caps.search, () => true),
  }
}
