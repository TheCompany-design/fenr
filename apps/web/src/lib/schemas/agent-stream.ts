import { z } from "zod"

export const turnStatusSchema = z.enum(["completed", "failed"])
export type TurnStatus = z.infer<typeof turnStatusSchema>

export const itemKindSchema = z.enum(["user_message", "agent_message"])
export type ItemKind = z.infer<typeof itemKindSchema>

export const itemDeltaPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("thinking_delta"),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("text_delta"),
    text: z.string(),
  }),
])
export type ItemDeltaPayload = z.infer<typeof itemDeltaPayloadSchema>

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

export const chatComposerSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(10_000, "Message is too long"),
})
export type ChatComposerInput = z.infer<typeof chatComposerSchema>
