import {
  bigint,
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { organization } from "../organizations/organization"
import { user } from "../auth/user"
import { agentItems } from "./agent-items"
import { agentThreads } from "./agent-threads"
import { agentTurns } from "./agent-turns"

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea"
  },
})

export interface IntegrationPreviewMediaItem {
  title: string
  caption?: string
  imageUrl: string
  aspectRatio?: "16:10" | "4:3"
  accentGradient?: string
}

export interface ConnectedAssetSummaryItem {
  id: string
  name: string
  kind: string
}

/** Mirrors Nabu migration 0014, table `integration_catalog_toolkits`. */
export const integrationCatalogToolkits = pgTable(
  "integration_catalog_toolkits",
  {
    slug: text("slug").primaryKey(),
    displayName: text("display_name").notNull(),
    vendorName: text("vendor_name").notNull(),
    vendorUrl: text("vendor_url"),
    logoSlug: text("logo_slug").notNull(),
    logoMonochrome: boolean("logo_monochrome").default(false).notNull(),
    brandAccentHex: text("brand_accent_hex"),
    tagline: text("tagline").notNull(),
    composerActionHint: text("composer_action_hint").notNull(),
    shortDescription: text("short_description").notNull(),
    overviewMarkdown: text("overview_markdown").default("").notNull(),
    howItWorksMarkdown: text("how_it_works_markdown").default("").notNull(),
    documentationUrl: text("documentation_url"),
    primaryCategory: text("primary_category").notNull(),
    categoryTags: text("category_tags").array().default([]).notNull(),
    integrationKind: text("integration_kind").default("both").notNull(),
    setupStepsCount: smallint("setup_steps_count").default(3).notNull(),
    supportedAuthSchemes: text("supported_auth_schemes")
      .array()
      .default(["OAUTH2"])
      .notNull(),
    defaultAuthScheme: text("default_auth_scheme").default("OAUTH2").notNull(),
    composioManagedOauth: boolean("composio_managed_oauth")
      .default(true)
      .notNull(),
    complianceTier: text("compliance_tier").default("tier_1_permissive").notNull(),
    defaultOauthScopes: text("default_oauth_scopes").array().default([]).notNull(),
    setupParametersSchema: jsonb("setup_parameters_schema")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    previewMedia: jsonb("preview_media")
      .$type<IntegrationPreviewMediaItem[]>()
      .default([])
      .notNull(),
    platformAuthConfigId: text("platform_auth_config_id"),
    pinnedToolkitVersion: text("pinned_toolkit_version").default("latest").notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    isNew: boolean("is_new").default(false).notNull(),
    isBeta: boolean("is_beta").default(false).notNull(),
    requiredPlanTier: text("required_plan_tier").default("free").notNull(),
    defaultOwnerScope: text("default_owner_scope").default("user").notNull(),
    activeToolsCount: integer("active_tools_count").default(0).notNull(),
    activeTriggersCount: integer("active_triggers_count").default(0).notNull(),
    sortOrder: integer("sort_order").default(100).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    catalogSyncedAt: timestamp("catalog_synced_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_catalog_toolkits_category_sort_idx")
      .on(table.primaryCategory, table.sortOrder, table.displayName),
  ],
)

/** Mirrors Nabu migration 0014, table `integration_catalog_tools`. */
export const integrationCatalogTools = pgTable(
  "integration_catalog_tools",
  {
    slug: text("slug").primaryKey(),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    toolkitVersion: text("toolkit_version").notNull(),
    inputSchema: jsonb("input_schema")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    outputSchema: jsonb("output_schema")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    capabilityClass: text("capability_class").default("standard_write").notNull(),
    defaultApprovalMode: text("default_approval_mode")
      .default("require_approval")
      .notNull(),
    isIdempotent: boolean("is_idempotent").default(false).notNull(),
    isCuratedPrimary: boolean("is_curated_primary").default(false).notNull(),
    requiredScopes: text("required_scopes").array().default([]).notNull(),
    tags: text("tags").array().default([]).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    catalogSyncedAt: timestamp("catalog_synced_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_catalog_tools_toolkit_curated_idx")
      .on(table.toolkitSlug, table.isCuratedPrimary, table.slug),
  ],
)

/** Mirrors Nabu migration 0014, table `integration_catalog_triggers`. */
export const integrationCatalogTriggers = pgTable(
  "integration_catalog_triggers",
  {
    slug: text("slug").primaryKey(),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    deliveryMode: text("delivery_mode").default("webhook").notNull(),
    configSchema: jsonb("config_schema")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    payloadSchema: jsonb("payload_schema")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    catalogSyncedAt: timestamp("catalog_synced_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_catalog_triggers_toolkit_idx")
      .on(table.toolkitSlug),
  ],
)

/** Mirrors Nabu migration 0014, table `tenant_integration_configs`. */
export const tenantIntegrationConfigs = pgTable(
  "tenant_integration_configs",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    composioAuthConfigId: text("composio_auth_config_id").notNull(),
    authScheme: text("auth_scheme").default("OAUTH2").notNull(),
    connectionSharingMode: text("connection_sharing_mode")
      .default("hybrid")
      .notNull(),
    enabledForAgents: boolean("enabled_for_agents").default(true).notNull(),
    workspaceApprovalPosture: text("workspace_approval_posture")
      .default("auto_approve_reads_ask_writes")
      .notNull(),
    allowedConnectRoles: text("allowed_connect_roles")
      .array()
      .default(["owner", "admin", "member"])
      .notNull(),
    allowedExecuteRoles: text("allowed_execute_roles")
      .array()
      .default(["owner", "admin", "member"])
      .notNull(),
    isCustomOauth: boolean("is_custom_oauth").default(false).notNull(),
    customOauthClientId: text("custom_oauth_client_id"),
    sealedCustomOauthSecret: bytea("sealed_custom_oauth_secret"),
    customOauthSecretFp: text("custom_oauth_secret_fp"),
    configuredScopes: text("configured_scopes").array().default([]).notNull(),
    status: text("status").default("active").notNull(),
    installedByUserId: uuid("installed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    version: bigint("version", { mode: "number" }).default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_tenant_integration_configs_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    uniqueIndex("uidx_tenant_integration_configs_tenant_toolkit").on(
      table.tenantId,
      table.toolkitSlug,
    ),
    index("tenant_integration_configs_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.enabledForAgents,
    ),
  ],
)

/** Mirrors Nabu migration 0014, table `integration_connected_accounts`. */
export const integrationConnectedAccounts = pgTable(
  "integration_connected_accounts",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    integrationConfigId: uuid("integration_config_id").notNull(),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    composioConnectedAccountId: text("composio_connected_account_id")
      .notNull()
      .unique(),
    composioUserId: text("composio_user_id").notNull(),
    ownerScope: text("owner_scope").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    connectedByUserId: uuid("connected_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    accountAlias: text("account_alias").default("Primary").notNull(),
    externalAccountId: text("external_account_id"),
    externalAccountEmail: text("external_account_email"),
    externalAccountDisplayName: text("external_account_display_name"),
    externalWorkspaceName: text("external_workspace_name"),
    status: text("status").default("initiating").notNull(),
    statusErrorCode: text("status_error_code"),
    statusErrorMessage: text("status_error_message"),
    grantedScopes: text("granted_scopes").array().default([]).notNull(),
    connectedAssetsCount: integer("connected_assets_count").default(0).notNull(),
    connectedAssetsLabel: text("connected_assets_label"),
    connectedAssetsSummary: jsonb("connected_assets_summary")
      .$type<ConnectedAssetSummaryItem[]>()
      .default([])
      .notNull(),
    isDefault: boolean("is_default").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    lastVerifiedAt: timestamp("last_verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    statusChangedAt: timestamp("status_changed_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_integration_connected_accounts_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    foreignKey({
        name: "integration_connected_accounts_config_tenant_fkey",
        columns: [table.integrationConfigId, table.tenantId],
        foreignColumns: [tenantIntegrationConfigs.id, tenantIntegrationConfigs.tenantId],
      }).onDelete("cascade"),
    index("integration_connected_accounts_tenant_toolkit_status_idx")
      .on(table.tenantId, table.toolkitSlug, table.status),
    index("integration_connected_accounts_needs_action_idx")
      .on(table.tenantId, table.statusChangedAt.desc()),
  ],
)

/** Mirrors Nabu migration 0014, table `integration_oauth_sessions`. */
export const integrationOauthSessions = pgTable(
  "integration_oauth_sessions",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    integrationConfigId: uuid("integration_config_id").notNull(),
    connectedAccountId: uuid("connected_account_id"),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    composioConnectedAccountId: text("composio_connected_account_id").notNull(),
    stateNonceSha256: bytea("state_nonce_sha256").notNull().unique(),
    ownerScope: text("owner_scope").notNull(),
    initiateSurface: text("initiate_surface").notNull(),
    returnToPath: text("return_to_path").default("/integrations").notNull(),
    threadId: uuid("thread_id"),
    turnId: uuid("turn_id"),
    composioRedirectUrl: text("composio_redirect_url").notNull(),
    status: text("status").default("pending").notNull(),
    failureReason: text("failure_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_integration_oauth_sessions_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    foreignKey({
        name: "integration_oauth_sessions_config_tenant_fkey",
        columns: [table.integrationConfigId, table.tenantId],
        foreignColumns: [tenantIntegrationConfigs.id, tenantIntegrationConfigs.tenantId],
      }).onDelete("cascade"),
    foreignKey({
        name: "integration_oauth_sessions_account_tenant_fkey",
        columns: [table.connectedAccountId, table.tenantId],
        foreignColumns: [integrationConnectedAccounts.id, integrationConnectedAccounts.tenantId],
      }).onDelete("set null"),
    index("integration_oauth_sessions_pending_expiry_idx")
      .on(table.expiresAt),
  ],
)

/** Mirrors Nabu migration 0014, table `tenant_tool_approval_policies`. */
export const tenantToolApprovalPolicies = pgTable(
  "tenant_tool_approval_policies",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "cascade" }),
    toolSlug: text("tool_slug")
      .notNull()
      .references(() => integrationCatalogTools.slug, { onDelete: "cascade" }),
    policyScope: text("policy_scope").default("organization").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    approvalMode: text("approval_mode").notNull(),
    maxAutoCallsPerTurn: smallint("max_auto_calls_per_turn").default(5).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_tenant_tool_approval_policies_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    uniqueIndex("tenant_tool_approval_policies_org_unique_idx")
      .on(table.tenantId, table.toolSlug),
    uniqueIndex("tenant_tool_approval_policies_user_unique_idx")
      .on(table.tenantId, table.userId, table.toolSlug),
  ],
)

/** Mirrors Nabu migration 0014, table `agent_integration_tool_executions`. */
export const agentIntegrationToolExecutions = pgTable(
  "agent_integration_tool_executions",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull(),
    turnId: uuid("turn_id").notNull(),
    toolCallItemId: uuid("tool_call_item_id").notNull(),
    approvalItemId: uuid("approval_item_id"),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    callId: text("call_id").notNull(),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    toolSlug: text("tool_slug")
      .notNull()
      .references(() => integrationCatalogTools.slug, { onDelete: "restrict" }),
    toolkitVersion: text("toolkit_version").notNull(),
    connectedAccountId: uuid("connected_account_id").notNull(),
    composioConnectedAccountId: text("composio_connected_account_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    approvalResolution: text("approval_resolution").notNull(),
    status: text("status").notNull(),
    composioLogId: text("composio_log_id"),
    httpStatus: smallint("http_status"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    sanitizedErrorMessage: text("sanitized_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("uidx_agent_integration_tool_executions_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    foreignKey({
        name: "agent_integration_tool_executions_thread_tenant_fkey",
        columns: [table.threadId, table.tenantId],
        foreignColumns: [agentThreads.id, agentThreads.tenantId],
      }).onDelete("cascade"),
    foreignKey({
        name: "agent_integration_tool_executions_turn_tenant_fkey",
        columns: [table.turnId, table.tenantId],
        foreignColumns: [agentTurns.id, agentTurns.tenantId],
      }).onDelete("cascade"),
    foreignKey({
        name: "agent_integration_tool_executions_item_tenant_fkey",
        columns: [table.toolCallItemId, table.tenantId],
        foreignColumns: [agentItems.id, agentItems.tenantId],
      }).onDelete("cascade"),
    foreignKey({
        name: "agent_integration_tool_executions_approval_item_tenant_fkey",
        columns: [table.approvalItemId, table.tenantId],
        foreignColumns: [agentItems.id, agentItems.tenantId],
      }).onDelete("set null"),
    foreignKey({
        name: "agent_integration_tool_executions_account_tenant_fkey",
        columns: [table.connectedAccountId, table.tenantId],
        foreignColumns: [integrationConnectedAccounts.id, integrationConnectedAccounts.tenantId],
      }).onDelete("restrict"),
    index("agent_integration_tool_executions_tenant_turn_idx").on(
      table.tenantId,
      table.turnId,
      table.startedAt,
    ),
    index("agent_integration_tool_executions_account_idx").on(
      table.tenantId,
      table.connectedAccountId,
      table.startedAt.desc(),
    ),
  ],
)

/** Mirrors Nabu migration 0014, table `integration_trigger_subscriptions`. */
export const integrationTriggerSubscriptions = pgTable(
  "integration_trigger_subscriptions",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id").notNull(),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    triggerSlug: text("trigger_slug")
      .notNull()
      .references(() => integrationCatalogTriggers.slug, { onDelete: "restrict" }),
    composioTriggerId: text("composio_trigger_id").notNull().unique(),
    triggerConfig: jsonb("trigger_config")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    status: text("status").default("active").notNull(),
    disabledReason: text("disabled_reason"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_integration_trigger_subscriptions_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    foreignKey({
        name: "integration_trigger_subscriptions_account_tenant_fkey",
        columns: [table.connectedAccountId, table.tenantId],
        foreignColumns: [integrationConnectedAccounts.id, integrationConnectedAccounts.tenantId],
      }).onDelete("cascade"),
    index("integration_trigger_subscriptions_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
  ],
)

/** Mirrors Nabu migration 0014, table `integration_webhook_events`. */
export const integrationWebhookEvents = pgTable("integration_webhook_events", {
  id: idColumn(),
  webhookMessageId: text("webhook_message_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  tenantId: uuid("tenant_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  connectedAccountId: uuid("connected_account_id"),
  triggerSubscriptionId: uuid("trigger_subscription_id"),
  signatureVerified: boolean("signature_verified").default(true).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  processingStatus: text("processing_status").default("processed").notNull(),
  processingError: text("processing_error"),
  webhookTimestamp: timestamp("webhook_timestamp", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
})

/** Mirrors Nabu migration 0014, table `integration_requests`. */
export const integrationRequests = pgTable(
  "integration_requests",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestedAppName: text("requested_app_name").notNull(),
    requestedAppUrl: text("requested_app_url"),
    useCaseDescription: text("use_case_description").notNull(),
    priority: text("priority").default("normal").notNull(),
    status: text("status").default("submitted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_integration_requests_id_tenant").on(
      table.id,
      table.tenantId,
    ),
    index("integration_requests_tenant_created_idx").on(
      table.tenantId,
      table.createdAt.desc(),
    ),
  ],
)
