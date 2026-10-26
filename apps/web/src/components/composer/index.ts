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

export {
  levelAt,
  levelIndex,
  levelPosition,
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
export {
  type ContextBreakdown,
  type ContextUsage,
  measureContext,
} from "./catalog/usage"
export { Composer } from "./composer"
export { type ComposerBridge, ComposerMount } from "./composer-mount"
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
export {
  type ComposerDensity,
  DENSITY_OVERFLOW_TOLERANCE_PX,
  isOverflowing,
  resolveDensity,
} from "./state/composer-density"
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
export { AddMenu } from "./surfaces/add-menu"
export { ContextMeter } from "./surfaces/context-meter"
export { ContextRail, type ContextRailMode } from "./surfaces/context-rail"
export { EffortControl } from "./surfaces/effort-control"
export { ComposerFeedback, formatTokens } from "./surfaces/feedback"
export { ModelPicker, ProviderGate } from "./surfaces/model-picker"
