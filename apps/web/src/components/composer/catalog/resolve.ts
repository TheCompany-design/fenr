import type {
  Access,
  Cap,
  Connection,
  EffortEncoding,
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
import { levelIndex, narrowScale } from "./effort"

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

/**
 * An authenticated listing proves access only for the saved credential revision
 * that produced it. Preserve all other model metadata when that evidence ages
 * across a key rotation, but downgrade the access claim to unknown. The
 * provider contract is positive-only: an absent claim does not mean denied.
 */
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

  // The credential gate applies to every capability, so it is resolved once
  // and applied below rather than repeated in six branches.
  const pending = connectionGate(provider, connection)
  // Catalog presence and provider-level key verification do not establish
  // model access. A model-specific authenticated listing may confirm access;
  // otherwise only a successful call with this key does.
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
  // The wire form of an effort level is a property of the provider, not the
  // model, so it is attached here rather than declared per model.
  const encoding = provider.source.effortEncoding

  const reasoningCap = caps.reasoning
  let reasoning: Resolved<ReasoningScale & { encoding: EffortEncoding }>
  if (!reasoningCap.supported) {
    reasoning = unavailable("Not supported by this model")
  } else {
    // Entitlement narrows the model's levels; the model still decides the
    // ordering, so the intersection keeps the declared order — see `narrowScale`.
    const scale = narrowScale(reasoningCap, entitlements.effort)
    if (scale.levels.length === 0) {
      reasoning = offered(
        { ...scale, encoding },
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
      // The model's own default survives the narrowing when it is still on
      // offer. The fallback used to be the *last* level, which quietly promoted
      // every key that could not reach the lowest one to run at maximum — and,
      // because nothing read this field, the promotion was invisible on top of
      // that: the effective default was whatever came first in the list.
      const preferred =
        levelIndex(scale.levels, scale.default) >= 0
          ? scale.default
          : scale.levels[scale.levels.length - 1].id
      const value = { ...scale, default: preferred, encoding }
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
