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
