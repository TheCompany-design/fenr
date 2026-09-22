import { z } from "zod"

/**
 * System Status Schema (GET /api/v1/system/status)
 */
export const nabuSystemStatusSchema = z.object({
  status: z.string(),
  version: z.string(),
  database: z.string(),
  timestamp: z.string(),
})

export type NabuSystemStatus = z.infer<typeof nabuSystemStatusSchema>

/**
 * Inflow Reconciliation Match Input Schema (POST /api/v1/reconciliation/match)
 */
export const reconciliationMatchInputSchema = z.object({
  transaction_id: z.string().min(1, "Transaction ID is required"),
  amount: z.number().positive("Amount must be greater than zero"),
  currency: z.string().min(1).default("KES"),
  reference: z.string().min(1, "Reference is required"),
  sender_name: z.string().min(1, "Sender name is required"),
  sender_phone: z.string().optional(),
})

export type ReconciliationMatchInput = z.input<
  typeof reconciliationMatchInputSchema
>

/**
 * Inflow Reconciliation Match Result Schema
 */
export const reconciliationMatchResultSchema = z.object({
  match_status: z.string(),
  confidence_score: z.number().min(0).max(1),
  matched_invoice_id: z.string(),
  invoice_number: z.string(),
  variance: z.number(),
  reasons: z.array(z.string()),
  suggested_action: z.string(),
})

export type ReconciliationMatchResult = z.infer<
  typeof reconciliationMatchResultSchema
>

/**
 * Create Agent Task Input Schema (POST /api/v1/agent/tasks)
 */
export const createAgentTaskInputSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  task_type: z.string().min(1).default("receivables_audit"),
  dry_run: z.boolean().default(true),
})

export type CreateAgentTaskInput = z.input<typeof createAgentTaskInputSchema>

/**
 * Agent Task Result Schema
 */
export const agentTaskResultSchema = z.object({
  task_id: z.string(),
  status: z.string(),
  summary: z.string(),
  items_analyzed: z.number().int(),
  hitl_required: z.boolean(),
  execution_time_ms: z.number(),
})

export type AgentTaskResult = z.infer<typeof agentTaskResultSchema>
