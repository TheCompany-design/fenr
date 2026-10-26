import { z } from "zod"
import {
  approvalDecisionSchema,
  itemKindSchema,
  itemPayloadSchema,
} from "./agent-stream"

export const nabuSystemStatusSchema = z.object({
  status: z.string(),
  version: z.string(),
  database: z.string(),
  timestamp: z.string(),
})

export type NabuSystemStatus = z.infer<typeof nabuSystemStatusSchema>

export const nabuCapabilitiesSchema = z.object({
  tools: z.array(z.string()),

  max_model_steps: z.number().int().nonnegative(),

  max_attempts: z.number().int().positive(),

  detach_on_disconnect: z.boolean(),
})
export type NabuCapabilities = z.infer<typeof nabuCapabilitiesSchema>

export const approvalDecisionInputSchema = z.object({
  item_id: z.string().uuid(),
  decision: approvalDecisionSchema,
})
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionInputSchema>

export const turnItemsQuerySchema = z.object({
  after: z.string().uuid().optional(),
  limit: z.number().int().positive().max(200).default(50),
})
export type TurnItemsQuery = z.input<typeof turnItemsQuerySchema>

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

  has_more: z.boolean(),
})
export type TurnItemsResponse = z.infer<typeof turnItemsResponseSchema>

export const tenantProviderSummarySchema = z.object({
  id: z.string().uuid(),

  provider: z.string(),

  model: z.string(),

  label: z.string().max(64).nullable(),

  is_default: z.boolean(),

  fingerprint: z.string().max(64),
  max_output_tokens: z.number().int().positive().nullable(),
  temperature: z.number().nonnegative().nullable(),

  updated_at: z.string(),
})
export type TenantProviderSummary = z.infer<typeof tenantProviderSummarySchema>

export const tenantProviderListSchema = z.object({
  providers: z.array(tenantProviderSummarySchema),

  can_administer: z.boolean(),
})
export type TenantProviderList = z.infer<typeof tenantProviderListSchema>

const trimmed = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max)

export const createTenantProviderInputSchema = z.object({
  provider: trimmed(64, "Choose a provider"),

  model: z.string().trim().max(256, "That model id is implausibly long"),
  api_key: trimmed(4096, "An API key is required"),

  label: z.string().trim().max(64, "That name is too long").optional(),
  max_output_tokens: z.number().int().positive().nullable().optional(),
  temperature: z.number().nonnegative().nullable().optional(),
})
export type CreateTenantProviderInput = z.input<
  typeof createTenantProviderInputSchema
>

export const verifyTenantProviderResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
})
export type VerifyTenantProviderResponse = z.infer<
  typeof verifyTenantProviderResponseSchema
>

export const listedModelSchema = z.object({
  id: z.string().min(1),

  access_evidence: z.literal("available_for_key").optional(),

  display_name: z.string().min(1).optional(),

  context_window: z.number().int().nonnegative().optional(),

  max_output_tokens: z.number().int().nonnegative().optional(),

  accepts_images: z.boolean().optional(),

  storefront: z
    .object({
      published: z.boolean(),

      serving: z.boolean().optional(),

      ends_on: z.string().min(4).optional(),
    })
    .optional(),

  released_at: z.string().min(4).optional(),

  reasoning: z
    .object({
      levels: z
        .array(
          z.object({
            id: z.string().min(1),

            label: z.string().min(1),
          }),
        )
        .min(1),

      default: z.string().min(1),
    })

    .refine(
      (scale) => scale.levels.some((level) => level.id === scale.default),
      { message: "the declared default is not one of the offered levels" },
    )
    .optional(),

  pricing: z
    .object({
      input_usd: z.number().nonnegative(),
      output_usd: z.number().nonnegative(),
    })
    .optional(),
})
export type ListedModel = z.infer<typeof listedModelSchema>

export const providerModelsResponseSchema = z.object({
  ok: z.boolean(),

  message: z.string().optional(),

  models: z.array(listedModelSchema).optional(),
})
export type ProviderModelsResponse = z.infer<
  typeof providerModelsResponseSchema
>
