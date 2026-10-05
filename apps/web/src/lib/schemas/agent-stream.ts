import { z } from "zod"

/**
 * The agent wire contract.
 *
 * These schemas are a hand-written mirror of the Rust definitions in
 * `thebookofnabu`:
 *
 *   - envelope and events: crates/nabu-agent-core/src/domain/events.rs
 *   - approval decisions: crates/nabu-agent-core/src/ports/store.rs
 *
 * The Rust side asserts its own serialization, and the fixtures in
 * `agent-stream.fixtures.ts` are captured from that implementation rather than
 * written by hand, so a change on either side shows up as a failing test
 * rather than a silently dropped event.
 *
 * Envelope rules, which the whole design rests on:
 *
 *   - every event is `{ "type": ..., "data": ... }`;
 *   - capability is added as a new `type`, never by reshaping an existing one,
 *     so a client that predates a variant keeps working;
 *   - therefore unknown types must be *tolerated* at runtime. The union below is
 *     exhaustive for the current server, and consumers additionally treat an
 *     unrecognised event as non-fatal (see `useAgentStream`).
 */

/** Where a turn stands. `suspended` is not terminal: it is waiting on a human. */
export const turnStatusSchema = z.enum([
  "in_progress",
  "completed",
  "failed",
  "suspended",
  "cancelled",
])
export type TurnStatus = z.infer<typeof turnStatusSchema>

/** Terminal states settle a turn; `suspended` is deliberately excluded. */
export const TERMINAL_TURN_STATUSES: readonly TurnStatus[] = [
  "completed",
  "failed",
  "cancelled",
]

/**
 * What an item represents.
 *
 * Approval bookkeeping is deliberately excluded from replay to the model, so
 * these kinds are not interchangeable from a transcript point of view.
 */
export const itemKindSchema = z.enum([
  "user_message",
  "agent_message",
  "tool_call",
  "tool_result",
  "approval_request",
  "approval_decision",
])
export type ItemKind = z.infer<typeof itemKindSchema>

/** Kinds a client renders as a chat bubble. */
export const MESSAGE_ITEM_KINDS = ["user_message", "agent_message"] as const

export type MessageItemKind = (typeof MESSAGE_ITEM_KINDS)[number]

/**
 * Whether an item is a chat bubble rather than a transcript record.
 *
 * Tool calls, tool results and approval bookkeeping are real transcript items
 * but they are not messages, and treating them as such corrupts the timeline.
 */
export function isMessageItemKind(kind: ItemKind): kind is MessageItemKind {
  return (MESSAGE_ITEM_KINDS as readonly string[]).includes(kind)
}

/** `approved` or `denied`. */
export const approvalDecisionSchema = z.enum(["approved", "denied"])
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>

/**
 * How a tool call ended.
 *
 * `unknown` is never retried automatically: an unobserved effect is a question
 * for a human, not a retry.
 */
export const toolOutcomeSchema = z.enum([
  "succeeded",
  "denied",
  "failed",
  "unknown",
])
export type ToolOutcome = z.infer<typeof toolOutcomeSchema>

export const itemDeltaPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("thinking_delta"),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("text_delta"),
    text: z.string(),
  }),
  /**
   * A fragment of a tool call's arguments, before they parse as JSON.
   * Streamed so a client can show the call being assembled; the runtime
   * accumulates these into the complete arguments on the item.
   */
  z.object({
    kind: z.literal("tool_arguments_delta"),
    text: z.string(),
  }),
])
export type ItemDeltaPayload = z.infer<typeof itemDeltaPayloadSchema>

const toolNameSchema = z.string().min(1)

export const itemPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user_message"),
    content: z.string(),
  }),
  z.object({
    kind: z.literal("agent_message"),
    text: z.string(),
    /** Aggregated reasoning, present only if the model produced any. */
    thinking: z.string().optional(),
  }),
  z.object({
    kind: z.literal("tool_call"),
    /** Provider-assigned call identifier, echoed with the result. */
    call_id: z.string(),
    name: toolNameSchema,
    /** Already parsed: the runtime buffers argument deltas until they do. */
    arguments: z.unknown(),
  }),
  z.object({
    kind: z.literal("tool_result"),
    call_id: z.string(),
    name: toolNameSchema,
    /** Retained for the model; may be truncated, and says so. */
    output: z.string(),
    truncated: z.boolean(),
    outcome: toolOutcomeSchema,
  }),
  z.object({
    kind: z.literal("approval_request"),
    call_id: z.string(),
    tool: toolNameSchema,
    arguments: z.unknown(),
  }),
  z.object({
    kind: z.literal("approval_decision"),
    call_id: z.string(),
    decision: approvalDecisionSchema,
    decided_by: z.string().uuid(),
  }),
])
export type ItemPayload = z.infer<typeof itemPayloadSchema>

export const usageReportSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
})
export type UsageReport = z.infer<typeof usageReportSchema>

export const agentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("turn_started"),
    data: z.object({
      thread_id: z.string().uuid(),
      turn_id: z.string().uuid(),
    }),
  }),
  z.object({
    /**
     * The turn stopped because it needs a human decision. Not terminal: the
     * turn resumes when the decision is recorded.
     */
    type: z.literal("turn_suspended"),
    data: z.object({
      thread_id: z.string().uuid(),
      turn_id: z.string().uuid(),
      /** The approval item the client must decide on. */
      item_id: z.string().uuid(),
      /** Which attempt suspended. Attempts are counted from one. */
      attempt: z.number().int().positive(),
    }),
  }),
  z.object({
    /** A suspended turn was picked up again by a decision. */
    type: z.literal("turn_resumed"),
    data: z.object({
      thread_id: z.string().uuid(),
      turn_id: z.string().uuid(),
      attempt: z.number().int().positive(),
      decision: approvalDecisionSchema,
    }),
  }),
  z.object({
    type: z.literal("item_started"),
    data: z.object({
      thread_id: z.string().uuid(),
      turn_id: z.string().uuid(),
      item_id: z.string().uuid(),
      kind: itemKindSchema,
    }),
  }),
  z.object({
    type: z.literal("item_delta"),
    data: z.object({
      item_id: z.string().uuid(),
      delta: itemDeltaPayloadSchema,
    }),
  }),
  z.object({
    type: z.literal("item_completed"),
    data: z.object({
      item_id: z.string().uuid(),
      payload: itemPayloadSchema,
    }),
  }),
  z.object({
    type: z.literal("turn_completed"),
    data: z.object({
      thread_id: z.string().uuid(),
      turn_id: z.string().uuid(),
      status: turnStatusSchema,
      usage: usageReportSchema,
    }),
  }),
  z.object({
    type: z.literal("stream_error"),
    data: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
])
export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>

/** Event names the current server emits, for logging and diagnostics. */
export const AGENT_STREAM_EVENT_TYPES = [
  "turn_started",
  "turn_suspended",
  "turn_resumed",
  "item_started",
  "item_delta",
  "item_completed",
  "turn_completed",
  "stream_error",
] as const

/**
 * Parse without throwing.
 *
 * A failure here is not a crash: an event the client cannot model is recorded
 * and skipped, because one unrecognised frame must not end a live turn.
 */
export function parseAgentStreamEvent(
  raw: unknown,
): { ok: true; event: AgentStreamEvent } | { ok: false; error: string } {
  const parsed = agentStreamEventSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, event: parsed.data }
  }
  return { ok: false, error: parsed.error.message }
}

export const chatComposerSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(10_000, "Message is too long"),
})
export type ChatComposerInput = z.infer<typeof chatComposerSchema>
