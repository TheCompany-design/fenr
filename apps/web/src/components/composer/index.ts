/**
 * The composer, in one import.
 *
 * Everything a host app needs is re-exported here so the folder can be copied
 * into another project and wired up through a single specifier, rather than by
 * discovering the internal layout. Nothing below this file should be imported
 * directly by a consumer — the internal paths are free to change.
 *
 * ## Layout
 *
 *   catalog/    capability model, provider catalog, reconciliation, token
 *               accounting. No React, no DOM. Independently testable.
 *   state/      the zustand store every surface reads from.
 *   primitives/ headless input shell, autocomplete, trigger detection, caret
 *               measurement. No knowledge of providers or models.
 *   surfaces/   the visible affordances: add menu, model picker, effort,
 *               context rail, meter, feedback.
 *   data/       derived view models and the `/` and `@` sources.
 *   hooks/      the seams between the store and a host app.
 *
 * The dependency direction is strictly downward: catalog has no imports from
 * any other folder, state depends on catalog, primitives depend on nothing,
 * and surfaces depend on all of them. Nothing imports a surface.
 */

// --- host surface ---------------------------------------------------------

export {
  type ContextBreakdown,
  type ContextUsage,
  measureContext,
} from "./catalog/usage"
export { Composer } from "./composer"
export { type ComposerBridge, ComposerMount } from "./composer-mount"
export {
  type ComposerStatus,
  type ComposerTransport,
  findModel,
  type PromptStore,
  type RuntimeTool,
  type SendPayload,
  setCredentialStore,
  setProvidersSource,
  takeAttachments,
  useCanSend,
  usePromptAttachments,
  usePromptBlockers,
  usePromptCaps,
  usePromptEffort,
  usePromptHydrated,
  usePromptNotices,
  usePromptSelection,
  usePromptStore,
  usePromptText,
  usePromptTools,
  usePromptUsage,
} from "./state/prompt-store"

// --- capability model -----------------------------------------------------

export {
  type Attachment as ComposerAttachment,
  createAttachments,
  revokeAttachments,
} from "./catalog/attachments"
export {
  type Access,
  type Cap,
  type Catalog,
  type CatalogSource,
  type Connection,
  catalogModels,
  type EffortEncoding,
  type EffortLevelId,
  type Entitlements,
  type FileKind,
  type Gate,
  isUsable,
  type ModelCaps,
  type ModelId,
  type ModelSpec,
  type NativeToolKind,
  type PlanId,
  type ProviderId,
  type ProviderSpec,
  type ReasoningLevel,
  type Region,
  type Resolved,
  type ResolvedCaps,
  type ToolId,
  type ToolKind,
} from "./catalog/capabilities"
export {
  type CredentialStore,
  LocalCredentialStore,
} from "./catalog/credentials"
// The only sanctioned way to ask a question about a model's reasoning scale.
// Exported because a host that renders its own effort affordance has to reach the
// same answers the composer does — and must not be tempted to rank level names
// itself, which is the one thing that cannot be done correctly.
export {
  levelAt,
  levelIndex,
  levelPosition,
  levelRatio,
  narrowedDefault,
  narrowScale,
  settleLevel,
} from "./catalog/effort"
export {
  type Blocker,
  type ComposerState,
  type Mention,
  type Notice,
  type ReconcileResult,
  reconcile,
  type Selection,
  toolKindOf,
} from "./catalog/reconcile"
export { resolveCapabilities } from "./catalog/resolve"

// --- density ---------------------------------------------------------------

export {
  type ComposerDensity,
  DENSITY_OVERFLOW_TOLERANCE_PX,
  isOverflowing,
  resolveDensity,
} from "./state/composer-density"

// --- building blocks ------------------------------------------------------

export { type CaretRect, measureCaret } from "./primitives/caret"
export { PromptAutocomplete } from "./primitives/prompt-autocomplete"
export {
  PromptInput,
  PromptInputAction,
  PromptInputActionsRow,
  PromptInputLead,
  PromptInputTextarea,
  PromptInputTrail,
} from "./primitives/prompt-input"
export {
  commitSuggestion,
  createSuggestionStore,
  moveActive,
  recompute,
  type SuggestionItem,
  type SuggestionState,
  type SuggestionStore,
  type TriggerSource,
  useSuggestionState,
  useSuggestionStore,
} from "./primitives/suggestion"
export {
  applySelection,
  detectTrigger,
  filterItems,
  scoreMatch,
  type Trigger,
  type TriggerKind,
} from "./primitives/trigger"

// --- surfaces -------------------------------------------------------------

export { AddMenu } from "./surfaces/add-menu"
export { ContextMeter } from "./surfaces/context-meter"
export { ContextRail, type ContextRailMode } from "./surfaces/context-rail"
export { EffortControl, encodeEffort } from "./surfaces/effort-control"
export { ComposerFeedback, formatTokens } from "./surfaces/feedback"
export { ModelPicker, ProviderGate } from "./surfaces/model-picker"

// --- data -----------------------------------------------------------------

export {
  buildModelViews,
  type CapabilityStatus,
  formatContextWindow,
  type ModelView,
  rankModels,
} from "./data/model-views"
export {
  actionForCommandId,
  type CommandAction,
  commandItems,
  commandSource,
  formatBytes,
  type ReferenceableItem,
  referenceItems,
  referenceSource,
  setReferenceableItems,
} from "./data/sources"
export { useComposerEvent } from "./hooks/use-composer-event"
export { useComposerShortcuts } from "./hooks/use-composer-shortcuts"
export {
  type ConversationSnapshot,
  useContextMeter,
} from "./hooks/use-context-meter"
