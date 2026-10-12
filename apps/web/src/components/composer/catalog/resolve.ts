import type {
  Access,
  Cap,
  Connection,
  EffortEncoding,
  EffortLevel,
  Entitlements,
  Gate,
  ModelSpec,
  NativeToolKind,
  ProviderSpec,
  Resolved,
  ResolvedCaps,
  ToolKind,
} from "./capabilities"

/**
 * The only reason this is a plain function and not a hook: resolution has to
 * be callable from a reducer, from the submit path, and from a test, without a
 * React tree. Async lives one layer up, in the catalog loader.
 */

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

/** A provider with no working credential gates everything behind `connect`. */
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
      vision: unavailable(reason),
      files: unavailable(reason),
      reasoning: unavailable(reason),
      tools: unavailable(reason),
      native: unavailable(reason),
      search: unavailable(reason),
    }
  }

  // The credential gate applies to every capability, so it is resolved once
  // and applied below rather than repeated in six branches.
  const pending = connectionGate(provider, connection)

  const resolveOne = <P, T>(
    cap: Cap<P>,
    payload: (supported: P) => T,
  ): Resolved<T> => {
    if (!cap.supported) return unavailable("Not supported by this model")
    const value = payload(cap)
    return pending ? gated(value, pending) : offered(value)
  }

  const caps = model.caps
  // The wire form of an effort level is a property of the provider, not the
  // model, so it is attached here rather than declared per model.
  const encoding = provider.source.effortEncoding

  const reasoningCap = caps.reasoning
  let reasoning: Resolved<{
    levels: readonly EffortLevel[]
    default: EffortLevel
    encoding: EffortEncoding
  }>
  if (!reasoningCap.supported) {
    reasoning = unavailable("Not supported by this model")
  } else {
    // Entitlement narrows the model's levels; the model still decides the
    // ordering and the default, so the intersection keeps the declared order.
    const levels = entitlements.effort
      ? reasoningCap.levels.filter((level) =>
          entitlements.effort?.includes(level),
        )
      : reasoningCap.levels
    if (levels.length === 0) {
      reasoning = offered(
        { levels: [], default: reasoningCap.default, encoding },
        {
          kind: "gated",
          gate: {
            kind: "upgrade",
            plan: "reasoning",
            label: "Your key's tier has no reasoning levels",
          },
        },
      )
    } else {
      const value = {
        levels,
        default: levels.includes(reasoningCap.default)
          ? reasoningCap.default
          : levels[levels.length - 1],
        encoding,
      }
      reasoning = pending ? gated(value, pending) : offered(value)
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
