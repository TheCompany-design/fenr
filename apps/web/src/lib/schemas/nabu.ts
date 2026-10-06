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
 * A workspace's own model provider.
 *
 * `GET /api/v1/provider`
 *
 * There is deliberately no field here that could carry a credential. The runtime
 * answers with a fingerprint — six hex digits that identify which key is stored
 * without being able to produce it — and this schema has no way to accept a
 * plaintext key, so a mistake upstream cannot smuggle one into the browser.
 */
export const tenantProviderSchema = z.object({
  /** Whether a provider has been configured at all. */
  configured: z.boolean(),
  /** The endpoint as the workspace configured it. */
  base_url: z.string(),
  /** The model identifier as the workspace configured it. */
  model: z.string(),
  /**
   * A non-reversible marker for the stored credential, e.g. `a1b2c3`.
   *
   * Present so a settings screen can say "the key ending a1b2c3 is the one you
   * pasted" — which is the only way to confirm a save without showing the key.
   */
  fingerprint: z.string().max(64),
  max_output_tokens: z.number().int().positive().nullable(),
  temperature: z.number().nonnegative().nullable(),
  /** Whether the caller may change any of this. */
  can_administer: z.boolean(),
  /** RFC 3339, or empty when nothing is configured. */
  updated_at: z.string(),
})
export type TenantProvider = z.infer<typeof tenantProviderSchema>

/**
 * A request to configure a workspace's model provider.
 *
 * `PUT /api/v1/provider`
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

export const putTenantProviderInputSchema = z.object({
  base_url: trimmed(2048, "An endpoint is required"),
  model: trimmed(256, "A model id is required"),
  api_key: trimmed(4096, "An API key is required"),
  max_output_tokens: z.number().int().positive().nullable().optional(),
  temperature: z.number().nonnegative().nullable().optional(),
})
export type PutTenantProviderInput = z.input<
  typeof putTenantProviderInputSchema
>

/**
 * The result of testing a workspace's endpoint.
 *
 * `POST /api/v1/provider/verify`
 *
 * `ok: false` means the endpoint *answered* and refused — a wrong key is a
 * result, not a malfunction. An endpoint that could not be reached comes back as
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
