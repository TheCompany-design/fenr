import { z } from "zod"

export const turnStatusSchema = z.enum([
  "in_progress",
  "completed",
  "failed",
  "suspended",
  "cancelled",
])
export type TurnStatus = z.infer<typeof turnStatusSchema>

export const TERMINAL_TURN_STATUSES: readonly TurnStatus[] = [
  "completed",
  "failed",
  "cancelled",
]

export const itemKindSchema = z.enum([
  "user_message",
  "agent_message",
  "tool_call",
  "tool_result",
  "approval_request",
  "approval_decision",
])
export type ItemKind = z.infer<typeof itemKindSchema>

export const MESSAGE_ITEM_KINDS = ["user_message", "agent_message"] as const

export type MessageItemKind = (typeof MESSAGE_ITEM_KINDS)[number]

export function isMessageItemKind(kind: ItemKind): kind is MessageItemKind {
  return (MESSAGE_ITEM_KINDS as readonly string[]).includes(kind)
}

export const approvalDecisionSchema = z.enum(["approved", "denied"])
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>

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

    block_id: z.string().min(1),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("text_delta"),
    text: z.string(),
  }),

  z.object({
    kind: z.literal("tool_arguments_delta"),
    text: z.string(),
  }),
])
export type ItemDeltaPayload = z.infer<typeof itemDeltaPayloadSchema>

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const jsonValueSchema: z.ZodType<JsonValue, unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

const toolNameSchema = z.string().min(1)

export const itemPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user_message"),
    content: z.string(),
  }),
  z.object({
    kind: z.literal("agent_message"),
    text: z.string(),

    thinking: z.string().optional(),
  }),
  z.object({
    kind: z.literal("tool_call"),

    call_id: z.string(),
    name: toolNameSchema,

    arguments: jsonValueSchema,
  }),
  z.object({
    kind: z.literal("tool_result"),
    call_id: z.string(),
    name: toolNameSchema,

    output: z.string(),
    truncated: z.boolean(),
    outcome: toolOutcomeSchema,
  }),
  z.object({
    kind: z.literal("approval_request"),
    call_id: z.string(),
    tool: toolNameSchema,
    arguments: jsonValueSchema,
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
    type: z.literal("model_call_recorded"),
    data: z.object({
      saved_config_id: z.string().uuid().nullable(),
      provider: z.string(),
      model: z.string(),
      step: z.number().int().positive(),
      usage: z.object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
        cached_input_tokens: z.number().int().nonnegative(),
        cache_creation_input_tokens: z.number().int().nonnegative(),
        tool_use_input_tokens: z.number().int().nonnegative(),
        reasoning_tokens: z.number().int().nonnegative(),
      }),
      duration_ms: z.number().nonnegative(),
      ttft_ms: z.number().nonnegative().nullable(),
      finish_reason: z.string().nullable(),
      error_code: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal("turn_suspended"),
    data: z.object({
      thread_id: z.string().uuid(),
      turn_id: z.string().uuid(),

      item_id: z.string().uuid(),

      attempt: z.number().int().positive(),
    }),
  }),
  z.object({
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

export const AGENT_STREAM_EVENT_TYPES = [
  "turn_started",
  "model_call_recorded",
  "turn_suspended",
  "turn_resumed",
  "item_started",
  "item_delta",
  "item_completed",
  "turn_completed",
  "stream_error",
] as const

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
