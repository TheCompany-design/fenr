import { z } from "zod"
import {
  approvalDecisionSchema,
  itemKindSchema,
  itemPayloadSchema,
} from "./agent-stream"

/**
 * System Status Schema (GET /api/v1/system/status)
 */
/**
 * `GET /api/v1/system/status`
 *
 * `timestamp` is unix seconds as a string, which is what the runtime sends.
 */
export const nabuSystemStatusSchema = z.object({
  status: z.string(),
  version: z.string(),
  database: z.string(),
  timestamp: z.string(),
})

export type NabuSystemStatus = z.infer<typeof nabuSystemStatusSchema>

/**
 * What a turn is allowed to do in this deployment.
 *
 * `GET /api/v1/capabilities`
 *
 * Fetched so the interface can tell the truth about what a turn may do — which
 * tools it may reach, how many attempts it has — rather than discovering it as a
 * tool failure halfway through a conversation.
 */
export const nabuCapabilitiesSchema = z.object({
  /** Tool names a model may request. */
  tools: z.array(z.string()),
  /** Model calls allowed within one attempt. */
  max_model_steps: z.number().int().nonnegative(),
  /** Attempts allowed for one turn. */
  max_attempts: z.number().int().positive(),
  /**
   * Whether a client that disconnects ends the turn or merely loses the stream.
   * When true, the turn keeps running and can be read back from its items.
   */
  detach_on_disconnect: z.boolean(),
})
export type NabuCapabilities = z.infer<typeof nabuCapabilitiesSchema>

/**
 * A decision on a pending approval.
 *
 * `POST /api/v1/threads/{turn_id}/approvals`
 *
 * The runtime answers a second decision with a conflict rather than overwriting
 * the first, so this is not a last-write-wins field.
 */
export const approvalDecisionInputSchema = z.object({
  /** The approval-request item being answered. */
  item_id: z.string().uuid(),
  decision: approvalDecisionSchema,
})
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionInputSchema>

/**
 * A page of a turn's transcript.
 *
 * `GET /api/v1/threads/{turn_id}/items`
 *
 * Items are returned oldest first and only once complete, so a message still
 * being written never appears half-finished.
 */
export const turnItemsQuerySchema = z.object({
  /** Return items after this one, for paging forward. */
  after: z.string().uuid().optional(),
  limit: z.number().int().positive().max(200).default(50),
})
export type TurnItemsQuery = z.input<typeof turnItemsQuerySchema>

/**
 * One stored transcript item, as the runtime serialises it.
 *
 * The payload is the same union the stream sends, so an item read back and an
 * item received live are the same shape — which is what lets a reconnecting
 * client render from either source.
 */
export const transcriptItemSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  turn_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  kind: itemKindSchema,
  payload: itemPayloadSchema,
  created_at: z.string(),
})
export type TranscriptItem = z.infer<typeof transcriptItemSchema>

export const turnItemsResponseSchema = z.object({
  turn_id: z.string().uuid(),
  items: z.array(transcriptItemSchema),
  /** Whether more items exist after this page. */
  has_more: z.boolean(),
})
export type TurnItemsResponse = z.infer<typeof turnItemsResponseSchema>

/**
 * One saved model provider in a workspace.
 *
 * `GET /api/v1/providers`
 *
 * A workspace may hold several — two OpenAI keys, or one per vendor — and each
 * conversation picks which one it runs on. There is deliberately no field here
 * that could carry a credential: the runtime answers with a fingerprint — six
 * hex digits that identify which key is stored without being able to produce
 * it — so a mistake upstream cannot smuggle a key into the browser.
 */
export const tenantProviderSummarySchema = z.object({
  /** Which saved configuration this is — what the chat picker sends back. */
  id: z.string().uuid(),
  /**
   * Which vendor this configuration dials.
   *
   * A string rather than the picker's enum on purpose: a runtime that learns a
   * fifth vendor before this screen does must still render, naming the vendor
   * it knows and this build does not.
   */
  provider: z.string(),
  /** The model identifier as the workspace configured it. */
  model: z.string(),
  /** The name the workspace gave it, so two OpenAI keys can be told apart. */
  label: z.string().max(64).nullable(),
  /** Whether new conversations start on this configuration. */
  is_default: z.boolean(),
  /**
   * A non-reversible marker for the stored credential, e.g. `a1b2c3`.
   *
   * Present so a settings screen can say "the key ending a1b2c3 is the one you
   * pasted" — which is the only way to confirm a save without showing the key.
   */
  fingerprint: z.string().max(64),
  max_output_tokens: z.number().int().positive().nullable(),
  temperature: z.number().nonnegative().nullable(),
  /** RFC 3339. */
  updated_at: z.string(),
})
export type TenantProviderSummary = z.infer<typeof tenantProviderSummarySchema>

/** The workspace's saved list, as `GET /api/v1/providers` answers it. */
export const tenantProviderListSchema = z.object({
  providers: z.array(tenantProviderSummarySchema),
  /** Whether the caller may change any of this. */
  can_administer: z.boolean(),
})
export type TenantProviderList = z.infer<typeof tenantProviderListSchema>

/**
 * A request to save one of a workspace's model providers.
 *
 * `POST /api/v1/providers`
 *
 * The API key is accepted here and nowhere else in the read path. It is never
 * returned by any endpoint, which is what makes the field safe to send from a
 * form.
 */
// Trimmed before the length check, because `min(1)` alone accepts `"   "` — and a
// whitespace-only credential is not a credential. It would save "successfully"
// and then fail every turn, which is the worst place to discover it.
const trimmed = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max)

export const createTenantProviderInputSchema = z.object({
  /** Which vendor to dial. The runtime refuses one it cannot speak, by name. */
  provider: trimmed(64, "Choose a provider"),
  model: trimmed(256, "A model id is required"),
  api_key: trimmed(4096, "An API key is required"),
  /** An optional name; absent renders as the vendor and model. */
  label: z.string().trim().max(64, "That name is too long").optional(),
  max_output_tokens: z.number().int().positive().nullable().optional(),
  temperature: z.number().nonnegative().nullable().optional(),
})
export type CreateTenantProviderInput = z.input<
  typeof createTenantProviderInputSchema
>

/**
 * The result of testing one of a workspace's saved providers.
 *
 * `POST /api/v1/providers/{id}/verify`
 *
 * `ok: false` means the provider *answered* and refused — a wrong key is a
 * result, not a malfunction. A provider that could not be reached comes back as
 * an error status instead, so the two are never confused by a client that only
 * checks `ok`.
 */
export const verifyTenantProviderResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
})
export type VerifyTenantProviderResponse = z.infer<
  typeof verifyTenantProviderResponseSchema
>

/**
 * One model as a vendor's catalogue describes it.
 *
 * Every field past the id is optional, and that is the contract rather than an
 * accident of the four vendor payloads: a fact the vendor did not publish is
 * absent here, so a picker can say "unknown" instead of implying a limit nobody
 * verified. OpenAI publishes no metadata at all, so its entries carry an id and
 * nothing else — which is exactly why that field is the only required one.
 */
export const listedModelSchema = z.object({
  /** The id a completion request carries, exactly as the save form sends it. */
  id: z.string().min(1),
  /** The vendor's own name for the model. */
  display_name: z.string().min(1).optional(),
  /**
   * The most input tokens the model will accept.
   *
   * `nonnegative`, not `positive`: this schema guards its own output, not the
   * vendor's claims. A zero here would be one odd model — and rejecting the
   * whole response over it would leave the caller with an error naming neither
   * the vendor nor the field, and no catalogue at all.
   */
  context_window: z.number().int().nonnegative().optional(),
  /** The most output tokens the model will return. */
  max_output_tokens: z.number().int().nonnegative().optional(),
  /**
   * Whether the model accepts images as well as text. Absent is different from
   * `false`: absent means the vendor published no modalities at all.
   */
  accepts_images: z.boolean().optional(),
  /** What the vendor advertises, in US dollars per million tokens. */
  pricing: z
    .object({
      input_usd: z.number().nonnegative(),
      output_usd: z.number().nonnegative(),
    })
    .optional(),
})
export type ListedModel = z.infer<typeof listedModelSchema>

/**
 * A vendor's model catalogue, as the two listing endpoints answer it.
 *
 * `POST /api/v1/providers/models` (a vendor name and the key about to be
 * saved) and `GET /api/v1/providers/{id}/models` (a saved configuration)
 * share the shape, and the same honesty `verify` established: `ok: false`
 * means the vendor answered and declined the credential — a result, not a
 * malfunction. An unreachable vendor is an error status, so the caller's
 * catch path never has to distinguish the two.
 */
export const providerModelsResponseSchema = z.object({
  ok: z.boolean(),
  /** A sentence naming the outcome when the catalogue was not read. */
  message: z.string().optional(),
  /**
   * The models the vendor offers, sorted by id, each filtered to the ones a
   * turn can actually run. Present only with `ok: true`.
   */
  models: z.array(listedModelSchema).optional(),
})
export type ProviderModelsResponse = z.infer<
  typeof providerModelsResponseSchema
>
