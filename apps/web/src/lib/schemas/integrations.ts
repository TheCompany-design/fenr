import { z } from "zod"

/**
 * Wire shapes for Nabu's `/api/v1/integrations/*` surface. Field names stay
 * in the runtime's snake_case so the BFF passes responses through without a
 * translation layer that can drift.
 */

export const tenantConfigViewSchema = z.object({
  enabled_for_agents: z.boolean(),
  status: z.string(),
  connection_sharing_mode: z.string(),
  workspace_approval_posture: z.string(),
  allowed_connect_roles: z.array(z.string()),
  allowed_execute_roles: z.array(z.string()),
  is_custom_oauth: z.boolean(),
  configured_scopes: z.array(z.string()),
  has_auth_config: z.boolean(),
})

export type TenantConfigView = z.infer<typeof tenantConfigViewSchema>

export const connectionViewSchema = z.object({
  id: z.string().uuid(),
  toolkit_slug: z.string(),
  status: z.string(),
  owner_scope: z.string(),
  owner_user_id: z.string().uuid().nullable(),
  account_alias: z.string(),
  external_account_email: z.string().nullable(),
  external_account_display_name: z.string().nullable(),
  connected_by_user_id: z.string().uuid(),
  connected_assets_label: z.string().nullable(),
  status_error_code: z.string().nullable(),
  status_error_message: z.string().nullable(),
  is_default: z.boolean(),
  created_at: z.string(),
})

export type ConnectionView = z.infer<typeof connectionViewSchema>

export const toolkitCardSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  vendor_name: z.string(),
  vendor_url: z.string().nullable(),
  logo_slug: z.string(),
  logo_monochrome: z.boolean(),
  brand_accent_hex: z.string().nullable(),
  tagline: z.string(),
  composer_action_hint: z.string(),
  short_description: z.string(),
  primary_category: z.string(),
  category_tags: z.array(z.string()),
  integration_kind: z.string(),
  setup_steps_count: z.number(),
  supported_auth_schemes: z.array(z.string()),
  default_auth_scheme: z.string(),
  composio_managed_oauth: z.boolean(),
  compliance_tier: z.string(),
  setup_parameters_schema: z.any(),
  preview_media: z.array(z.record(z.string(), z.any())),
  is_featured: z.boolean(),
  is_new: z.boolean(),
  is_beta: z.boolean(),
  required_plan_tier: z.string(),
  default_owner_scope: z.string(),
  active_tools_count: z.number(),
  active_triggers_count: z.number(),
  config: tenantConfigViewSchema.nullable(),
  connections: z.array(connectionViewSchema),
})

export type ToolkitCard = z.infer<typeof toolkitCardSchema>

export const catalogResponseSchema = z.object({
  toolkits: z.array(toolkitCardSchema),
  needs_action: z.array(connectionViewSchema),
})

export type CatalogResponse = z.infer<typeof catalogResponseSchema>

/**
 * What reading the catalog yields. A deployment without the Composio gateway
 * answers 501 and an unreachable runtime answers 503; both are normal
 * operating states for the page, not crashes, so the BFF reports them as data.
 */
export type IntegrationsCatalogResult =
  | CatalogResponse
  | {
      readonly unavailable: true
      readonly reason: "not_configured" | "unreachable"
    }

export const catalogToolViewSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  description: z.string(),
  capability_class: z.string(),
  default_approval_mode: z.string(),
  input_schema: z.any(),
  is_curated_primary: z.boolean(),
})

export const catalogTriggerViewSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  description: z.string(),
  delivery_mode: z.string(),
})

export const toolPolicyViewSchema = z.object({
  tool_slug: z.string(),
  approval_mode: z.string(),
  max_auto_calls_per_turn: z.number(),
  policy_scope: z.string(),
})

export const toolkitDetailResponseSchema = toolkitCardSchema.extend({
  overview_markdown: z.string(),
  how_it_works_markdown: z.string(),
  documentation_url: z.string().nullable(),
  tools: z.array(catalogToolViewSchema),
  triggers: z.array(catalogTriggerViewSchema),
  policies: z.array(toolPolicyViewSchema),
})

export type ToolkitDetailResponse = z.infer<typeof toolkitDetailResponseSchema>

export const initiateConnectionResponseSchema = z.object({
  session_id: z.string().uuid(),
  redirect_url: z.string().url(),
  state_nonce: z.string(),
  expires_at: z.string(),
})

export type InitiateConnectionResponse = z.infer<
  typeof initiateConnectionResponseSchema
>

export const connectionCallbackResponseSchema = z.object({
  status: z.string(),
  return_to_path: z.string(),
})

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export const toolkitSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/)

export const updateToolkitConfigInputSchema = z.object({
  toolkitSlug: toolkitSlugSchema,
  enabledForAgents: z.boolean(),
  connectionSharingMode: z
    .enum(["organization_shared", "per_member", "hybrid"])
    .optional(),
  workspaceApprovalPosture: z
    .enum(["inherit_catalog", "auto_approve_reads_ask_writes", "always_ask"])
    .optional(),
})

export type UpdateToolkitConfigInput = z.infer<
  typeof updateToolkitConfigInputSchema
>

export const initiateConnectionInputSchema = z.object({
  toolkitSlug: toolkitSlugSchema,
  ownerScope: z.enum(["organization", "user"]).optional(),
  accountAlias: z.string().trim().min(1).max(120).optional(),
  returnToPath: z
    .string()
    .startsWith("/")
    .regex(/^[a-zA-Z0-9/_?=&%.-]*$/)
    .optional(),
  initiateSurface: z
    .enum([
      "integrations_page",
      "sheet_configure",
      "composer_mention",
      "turn_connection_gate",
    ])
    .optional(),
  threadId: z.string().uuid().optional(),
  turnId: z.string().uuid().optional(),
})

export type InitiateConnectionInput = z.infer<
  typeof initiateConnectionInputSchema
>

export const connectionCallbackInputSchema = z.object({
  sessionId: z.string().uuid(),
  stateNonce: z.string().min(32).max(128),
})

export const reconnectConnectionInputSchema = z.object({
  accountId: z.string().uuid(),
})

export const patchConnectionInputSchema = z.object({
  accountId: z.string().uuid(),
  accountAlias: z.string().trim().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(["active", "disabled"]).optional(),
})

export type PatchConnectionInput = z.infer<typeof patchConnectionInputSchema>

export const putToolPolicyInputSchema = z.object({
  toolSlug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Z0-9][A-Z0-9_]*$/),
  approvalMode: z.enum(["auto_approve", "require_approval", "deny"]),
  maxAutoCallsPerTurn: z.number().int().min(1).max(50).optional(),
})

export type PutToolPolicyInput = z.infer<typeof putToolPolicyInputSchema>

export const requestIntegrationInputSchema = z.object({
  requestedAppName: z.string().trim().min(1).max(120),
  requestedAppUrl: z.string().url().startsWith("https://").optional(),
  useCaseDescription: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
})

export type RequestIntegrationInput = z.infer<
  typeof requestIntegrationInputSchema
>

/**
 * What the client declares about a turn's cross-app scope, sent to Nabu as
 * `integrations` on the start-turn payload.
 */
export const turnIntegrationContextSchema = z.object({
  pinned_toolkits: z.array(toolkitSlugSchema).max(8),
  allow_workspace_discovery: z.boolean(),
})

export type TurnIntegrationContext = z.infer<
  typeof turnIntegrationContextSchema
>
