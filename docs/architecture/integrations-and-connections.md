# Tools, Connections & Integrations Architecture (`fenr`)

> **Status:** Research & Architecture Specification (Pre-Implementation Plan)
> **Scope:** `@workspace/database`, `apps/web` (`/integrations`, `/settings/integrations`, App Detail `<Sheet />`, Prompt Composer `@`/`+` App Mentions, Chat Turn HITL Approvals)
> **Companion Backend Specification:** `thebookofnabu/docs/tools/composio-integrations/README.md`

---

## 1. Product Vision & Visual Reference Mapping

This specification defines the complete frontend, BFF, and Drizzle database architecture in **Fenr** for discovering, connecting, configuring, and dispatching AI agents across third-party applications via **Composio v3 / v3.1**.

Our UI and interaction architecture synthesizes all five product reference surfaces into a unified, cohesive design system:

| Reference Surface | Key UX & Visual Elements | Fenr Route / Component Target |
| :--- | :--- | :--- |
| **1. Dedicated Integrations Directory (`Integrations` / `Apps`)** | Top-level left sidebar nav item (`Integrations`), page header with subtitle *"Connect the tools your team already uses and work with them right in the chat"*, search bar (`Search integrations`), **`+ Request`** CTA button, filter tabs (**`All`**, **`Connected`**, **`Available`**) + **`Apps \| Source`** segmented control, and categorized 2-column grid cards (**`Popular`**, **`Google`**, **`Ad platforms`**, **`Developer Tools`**) with verified checkmarks, connected account counts/emails (`1 account · ashmit@marketer.com`, `6 assets connected`), and quick `+` connect buttons. | `/_app/integrations/index.tsx` (`IntegrationsDirectoryPage`) |
| **2. Proactive `"Needs action"` Alert Banner** | Prominent top alert section with red warning triangle icon (`Needs action`) surfacing any connected account in `expired`, `needs_reauth`, or `error` state (e.g., `Google Drive · 3 saved sources · Connected by ashmit@marketer.com`) with 1-click reconnect. | `IntegrationsNeedsActionSection` (rendered at the top of `/integrations` whenever broken connections exist) |
| **3. Settings Management View (`Your Integrations`)** | Located under `/settings/integrations` with `NEW` badge on tab, showing installed/available workspace integrations as detailed cards with top-right **enable/disable `<Switch />`**, vendor attribution (`By Linear`, `By GitHub.com`), 2-line summary, metadata badges (`NEW`, `DEVELOPER TOOLS`, `4 STEPS`, red `CONNECTION ERROR`, amber `UPGRADE TO PRO`), and `View instruction` footer trigger. | `/_app/settings/integrations.tsx` (`SettingsIntegrationsPage`) |
| **4. Right-Side App Detail `<Sheet />` (`Integrations / Gmail`)** | Triggered by clicking any integration card, row, or `View instruction`. Features breadcrumb header (`Integrations / Gmail`), top-right icon actions (`...` menu, external vendor link, `X` close), hero section with brand logo (`https://logos.lndev.me/logos/<brand>.svg`), title, `By Google.com`, primary **`Configure` / `Connect`** button, metadata pills (`DEVELOPER TOOLS`, `4 STEPS`), summary paragraph, horizontal preview screenshot gallery (`<ScrollArea orientation="horizontal" />`), **`Overview`** with `Documentation.` link, **`How it works`** guide, **`Connected Accounts`** manager, and **`Actions & Approval Policies`** list. | `IntegrationDetailSheet` (`@workspace/ui/components/sheet` + `@workspace/ui/components/scroll-area`) |
| **5. Prompt Composer `@` / `+` App Mentions & Inline Execution** | Typing `@` or clicking `+` in the chat composer surfaces a floating popover listing apps with live status pills (`Slack [connected] — Send a message to a channel`, `ClickUp [not connected] — Create a task for each lead`, `Notion [not connected] — Save leads to a database`, `Airtable [connected] — Sync records to a base`). Selecting an app inserts a brand-tinted inline pill (`[ChatGPT]`, `[Slack]`) and updates the bottom connected-apps logo stack (`Gmail, Slack, ClickUp Connected`). | `apps/web/src/components/composer/` + `apps/web/src/features/chat/` |

---

## 2. Database Schema & Drizzle Mirror (`@workspace/database`)

As established in [`packages/database/src/schema/agent/agent-mirror.test.ts`](file:///home/muchiri/dev/bag/atelier/fenr/packages/database/src/schema/agent/agent-mirror.test.ts), **Nabu's SQL migrations (`0014_composio_integrations_and_connections.sql`) are the single source of truth** for agent/integration tables, and Fenr's `@workspace/database` declares matching `.existing()` Drizzle table mirrors so server functions can perform type-safe relational queries and joins.

### 2.1 File Layout in `packages/database/src/schema/`

```text
packages/database/src/schema/
├── agent/
│   ├── index.ts
│   ├── runtime.ts                  # existing (0001, 0002, 0007, 0013)
│   ├── tenant-providers.ts         # existing (0003)
│   ├── integrations.ts             # NEW: mirrors all 10 tables from Nabu 0014
│   └── agent-mirror.test.ts        # UPDATED: asserts 1:1 parity including 0014
└── relations.ts                    # UPDATED: adds Drizzle relations for integrations
```

### 2.2 Drizzle Table Definitions (`packages/database/src/schema/agent/integrations.ts`)

```typescript
import {
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "../auth/user"
import { uuidv7Column } from "../id"
import { organization } from "../organizations/organization"
import { agentItems, agentThreads, agentTurns } from "./runtime"

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

// 1. integration_catalog_toolkits
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
    supportedAuthSchemes: text("supported_auth_schemes").array().default(["OAUTH2"]).notNull(),
    defaultAuthScheme: text("default_auth_scheme").default("OAUTH2").notNull(),
    composioManagedOauth: boolean("composio_managed_oauth").default(true).notNull(),
    complianceTier: text("compliance_tier").default("tier_1_permissive").notNull(),
    defaultOauthScopes: text("default_oauth_scopes").array().default([]).notNull(),
    setupParametersSchema: jsonb("setup_parameters_schema").$type<Record<string, unknown>>().default({}).notNull(),
    previewMedia: jsonb("preview_media").$type<IntegrationPreviewMediaItem[]>().default([]).notNull(),
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
    catalogSyncedAt: timestamp("catalog_synced_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
).existing()

// 2. integration_catalog_tools
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
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>().default({}).notNull(),
    outputSchema: jsonb("output_schema").$type<Record<string, unknown>>().default({}).notNull(),
    capabilityClass: text("capability_class").default("standard_write").notNull(),
    defaultApprovalMode: text("default_approval_mode").default("require_approval").notNull(),
    isIdempotent: boolean("is_idempotent").default(false).notNull(),
    isCuratedPrimary: boolean("is_curated_primary").default(false).notNull(),
    requiredScopes: text("required_scopes").array().default([]).notNull(),
    tags: text("tags").array().default([]).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    catalogSyncedAt: timestamp("catalog_synced_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
).existing()

// 3. integration_catalog_triggers
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
    configSchema: jsonb("config_schema").$type<Record<string, unknown>>().default({}).notNull(),
    payloadSchema: jsonb("payload_schema").$type<Record<string, unknown>>().default({}).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    catalogSyncedAt: timestamp("catalog_synced_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
).existing()

// 4. tenant_integration_configs
export const tenantIntegrationConfigs = pgTable(
  "tenant_integration_configs",
  {
    id: uuidv7Column(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    composioAuthConfigId: text("composio_auth_config_id").notNull(),
    authScheme: text("auth_scheme").default("OAUTH2").notNull(),
    connectionSharingMode: text("connection_sharing_mode").default("hybrid").notNull(),
    enabledForAgents: boolean("enabled_for_agents").default(true).notNull(),
    workspaceApprovalPosture: text("workspace_approval_posture")
      .default("auto_approve_reads_ask_writes")
      .notNull(),
    allowedConnectRoles: text("allowed_connect_roles").array().default(["owner", "admin", "member"]).notNull(),
    allowedExecuteRoles: text("allowed_execute_roles").array().default(["owner", "admin", "member"]).notNull(),
    isCustomOauth: boolean("is_custom_oauth").default(false).notNull(),
    customOauthClientId: text("custom_oauth_client_id"),
    sealedCustomOauthSecret: bytea("sealed_custom_oauth_secret"),
    customOauthSecretFp: text("custom_oauth_secret_fp"),
    configuredScopes: text("configured_scopes").array().default([]).notNull(),
    status: text("status").default("active").notNull(),
    installedByUserId: uuid("installed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    version: bigint("version", { mode: "number" }).default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
).existing()

// 5. integration_connected_accounts
export const integrationConnectedAccounts = pgTable(
  "integration_connected_accounts",
  {
    id: uuidv7Column(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    integrationConfigId: uuid("integration_config_id").notNull(),
    toolkitSlug: text("toolkit_slug")
      .notNull()
      .references(() => integrationCatalogToolkits.slug, { onDelete: "restrict" }),
    composioConnectedAccountId: text("composio_connected_account_id").notNull().unique(),
    composioUserId: text("composio_user_id").notNull(),
    ownerScope: text("owner_scope").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
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
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
).existing()

// 6. integration_oauth_sessions, 7. tenant_tool_approval_policies,
// 8. agent_integration_tool_executions, 9. integration_trigger_subscriptions,
// 10. integration_webhook_events & integration_requests follow the exact same 1:1 mirror pattern.
```

---

## 3. Navigation, Routing & URL State Architecture

### 3.1 Sidebar & Settings Navigation
1. **Primary App Sidebar ([`apps/web/src/components/shell/nav-config.ts`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/components/shell/nav-config.ts))**:
   - Add a top-level **`Integrations`** item (`id: "integrations"`, `label: "Integrations"`, `icon: GridViewIcon` from `@hugeicons/core-free-icons`, `to: "/integrations"`) directly below `Files` in `NAV_ITEMS` (matching Image 1 & Image 4).
   - If the active workspace has any connection in `status IN ('expired', 'needs_reauth', 'error')`, render a subtle destructive indicator dot (`needsActionCount`) next to the `Integrations` sidebar item.
2. **Settings Sub-Navigation ([`apps/web/src/routes/_app/settings/route.tsx`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/routes/_app/settings/route.tsx))**:
   - Add **`Integrations`** (`to: "/settings/integrations"`, with optional `NEW` badge pill matching Image 5) to the Workspace settings group so workspace admins can manage installed apps, toggle `enabled_for_agents`, and configure workspace approval postures.

### 3.2 Route Tree & `nuqs` URL Search Parameters

```text
apps/web/src/routes/_app/
├── integrations/
│   ├── index.tsx                 # /integrations — Primary Integrations Directory + Detail Sheet
│   └── oauth.callback.tsx        # /integrations/oauth/callback — OAuth popup/redirect landing handler
└── settings/
    └── integrations.tsx          # /settings/integrations — Workspace integration governance cards
```

URL search state on `/integrations` and `/settings/integrations` is managed via **`nuqs`** so every filter and open sheet is deep-linkable and browser-back friendly:

- `?tab=all | connected | available` (default: `all`, matching Image 4)
- `?kind=all | apps | sources` (segmented toggle `Apps | Source`, matching Image 1)
- `?q=<search_string>` (debounced client/server filter across `displayName`, `tagline`, `categoryTags`)
- `?app=<toolkit_slug>` (e.g. `?app=gmail` — opens the right-side `IntegrationDetailSheet` for that toolkit, matching Image 3 & Image 5)
- `?sheet_tab=overview | accounts | actions | triggers` (sub-section focus inside the open `<Sheet />`)

---

## 4. Component Architecture & Visual Specification

All components live in `apps/web/src/features/integrations/` and adhere strictly to `fenr/AGENTS.md`:
- **Logos**: Every brand mark is loaded via `<IntegrationBrandLogo slug={toolkit.logoSlug} monochrome={toolkit.logoMonochrome} />`, resolving to `https://logos.lndev.me/logos/${slug}.svg` with `dark:invert` applied when `monochrome === true`. Never embed raw brand SVG paths.
- **Scrollbars**: Every scrollable area (the main directory viewport, the right-side `<Sheet />` body, the horizontal screenshot preview gallery, and the Composer `@` popover) uses `<ScrollArea />` from `@workspace/ui/components/scroll-area`.
- **Styling Tokens**: Strictly CSS variable tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-destructive/10`, `text-destructive`).

### 4.1 Feature Folder Structure (`apps/web/src/features/integrations/`)

```text
apps/web/src/features/integrations/
├── api/
│   ├── integrations-queries.ts           # TanStack Query queryOptions & mutation hooks
│   └── integrations.functions.ts         # TanStack Start createServerFn BFF handlers -> Nabu
├── components/
│   ├── integration-brand-logo.tsx        # https://logos.lndev.me/logos/<slug>.svg + dark:invert
│   ├── integrations-header.tsx           # Title, subtitle, Search input, '+ Request' button
│   ├── integrations-filter-bar.tsx       # 'All | Connected | Available' tabs + 'Apps | Source' toggle
│   ├── integrations-needs-action.tsx     # Red warning 'Needs action' section (Image 1)
│   ├── integration-directory-row.tsx     # Compact 2-col card with checkmark, tagline, '+' CTA (Image 1 & 4)
│   ├── integration-settings-card.tsx     # Governance card with Switch, step pills, error badge (Image 5)
│   ├── integration-bundle-row.tsx        # Multi-logo stacked bundle row ('Stripe, Zapier and 2 more >')
│   ├── request-integration-dialog.tsx    # '+ Request' modal backed by TanStack Form + Zod
│   └── sheet/
│       ├── integration-detail-sheet.tsx  # Right-side Sheet shell (Breadcrumb, actions, ScrollArea)
│       ├── sheet-hero-header.tsx         # Logo, Title, 'By <Vendor>', 'Configure'/'Connect' button, tags
│       ├── sheet-preview-gallery.tsx     # Horizontal ScrollArea preview cards (Image 3 & 5)
│       ├── sheet-overview-section.tsx    # 'Overview' + Documentation link & 'How it works'
│       ├── sheet-connected-accounts.tsx  # Active/expired accounts list, 'Reconnect', alias, disconnect
│       └── sheet-tool-policies.tsx       # Per-tool HITL policy selector (Auto / Ask / Deny)
└── hooks/
    └── use-oauth-connect-flow.ts         # Manages popup/redirect OAuth flow + query invalidation + Sonner
```

### 4.2 Detailed Breakdown of Key UI Surfaces

#### A. `"Needs action"` Alert Banner (`integrations-needs-action.tsx` — Image 1)
- Rendered above the category grid whenever `catalog.needsActionAccounts.length > 0`.
- Header: `Alert02Icon` (from `@hugeicons/core-free-icons`, styled `text-destructive`) + `Needs action` label.
- Rows: Full-width interactive cards displaying:
  - `<IntegrationBrandLogo />` + App Name (`Google Drive`, `Google Merchant Center`)
  - Context subtitle: `${account.connectedAssetsLabel ?? "1 account"} · Connected by ${account.externalAccountEmail}`
  - Right-side action: **`Reconnect`** button (triggers `useOauthConnectFlow` with `reconnectAccountId`) and clicking the row opens `?app=googledrive&sheet_tab=accounts`.

#### B. Categorized Directory Grid (`integration-directory-row.tsx` — Image 1 & Image 4)
- Grouped into semantic sections (`Popular`, `Google`, `Communication`, `Developer & Design`, `CRM & Revenue`, `Ad platforms`).
- Each card displays:
  - Left: 40×40 rounded container (`bg-muted/40 border border-border/60`) housing `<IntegrationBrandLogo />`.
  - Center:
    - Title row: `displayName` + verified/connected badge (`CheckmarkBadge01Icon` in `text-primary` when connected) + optional `Beta` or `NEW` badge.
    - Subtitle: When connected, shows account summary (`1 account · ashmit@marketer.com` or `6 assets connected`); when available, shows `tagline` (`Get alerts in your channels and act on them without leaving...`).
  - Right:
    - If not connected: subtle square `+` icon button (`PlusSignIcon`) that immediately initiates connection (or opens the Sheet if setup parameters are required).
    - Clicking anywhere else on the card sets `?app={toolkit.slug}`, sliding open the right-side `IntegrationDetailSheet`.

#### C. Right-Side App Detail `<Sheet />` (`integration-detail-sheet.tsx` — Image 3 & Image 5)
- Uses `@workspace/ui/components/sheet` (`side="right"`, width `sm:max-w-[540px] md:max-w-[600px]`, zero native scrollbar via `<ScrollArea className="h-full" />`).
- **Top Sticky Header Bar**:
  - Left breadcrumb: `Integrations /` (muted) + **`{toolkit.displayName}`** (semibold foreground).
  - Right action cluster:
    1. `MoreVerticalIcon` (`<DropdownMenu />` with *"Manage connected accounts"*, *"Configure approval policies"*, *"View execution audit log"*, and *"Disconnect / Uninstall"* in destructive red).
    2. `LinkSquare02Icon` (opens `toolkit.vendorUrl` or `toolkit.documentationUrl` in a new tab).
    3. `Cancel01Icon` (closes the sheet by clearing `?app=`).
- **Hero Section**:
  - 56×56 rounded-xl logo frame + `displayName` (`text-xl font-semibold`) + `By {toolkit.vendorName}` (`text-sm text-muted-foreground`).
  - Primary CTA button on the right:
    - If unconnected: **`Connect`** (or **`Configure`** with `Link01Icon` matching Image 3/5).
    - If connected & healthy: **`Configure`** (scrolls/switches to Connected Accounts & Tool Policies or adds another account).
    - If expired/broken: **`Reconnect`** (destructive/warning emphasis).
  - Metadata tag pills row:
    - Category pills (`DEVELOPER TOOLS`, `COMMUNICATION`) + Step count pill (`{toolkit.setupStepsCount} STEPS`) + Status pill (`CONNECTED` or `CONNECTION ERROR` in `bg-destructive/10 text-destructive`).
  - `shortDescription` paragraph (`text-sm text-muted-foreground leading-relaxed`).
- **Visual Preview Carousel (`sheet-preview-gallery.tsx`)**:
  - Horizontal `<ScrollArea orientation="horizontal" />` rendering `toolkit.previewMedia` cards (`w-[260px] h-[165px] rounded-xl border border-border overflow-hidden`) showing how the agent interacts with the app.
- **`Overview` & `How it works` Sections**:
  - Structured prose sections matching Image 3 & Image 5, with an inline clickable `Documentation.` link (`toolkit.documentationUrl`).
- **`Connected Accounts` & `Actions & Approval Policies` Accordion/Tabs**:
  - Lists all `integration_connected_accounts` for this toolkit in the workspace (showing personal vs workspace-shared scope, email, connected timestamp, default badge, and **Disconnect** button).
  - Lists the toolkit's `integration_catalog_tools` grouped by `capabilityClass` (`Read-only`, `Write`, `External Communications`, `Destructive`), allowing workspace admins to toggle per-tool approval mode (`Auto-approve`, `Always ask in chat`, `Blocked`).

---

## 5. Prompt Composer & Chat Integration ("Sending an Agent Across Signed-In Apps")

### 5.1 Extending Composer Capabilities & Mention Reconciliation
1. **Mention Kind `"app"` ([`apps/web/src/components/composer/catalog/reconcile.ts`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/components/composer/catalog/reconcile.ts))**:
   - Extend `Mention["kind"]` from `"file" | "person" | "agent"` to `"file" | "person" | "agent" | "app"`.
   - Extend `Mention` with optional `toolkitSlug?: string`, `logoSlug?: string`, `brandAccentHex?: string`, and `connectionStatus?: "connected" | "not_connected" | "needs_reauth"`.
2. **Inline Colored App Pill Rendering (Image 2)**:
   - When a user selects `@Slack` or `@ChatGPT` from the autocomplete popover, the composer renders an inline pill chip:
     - Displays the 14×14 logo from `https://logos.lndev.me/logos/<logoSlug>.svg` + `displayName` tinted with `brandAccentHex` at `12%` opacity background and readable foreground contrast (matching `[ChatGPT]` and `[Slack]` in Image 2).
3. **Rich `@` Autocomplete & `+` AddMenu Rows (Image 2)**:
   - Update [`apps/web/src/components/composer/data/sources.ts`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/components/composer/data/sources.ts) and [`prompt-autocomplete.tsx`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/components/composer/primitives/prompt-autocomplete.tsx) so typing `@` (or opening `+` -> `Apps & Integrations`) renders each integration with:
     - Left: `<IntegrationBrandLogo size={24} />`
     - Top line: **`{toolkit.displayName}`** + status badge pill:
       - If active account exists: `Link01Icon` + `connected` (`bg-muted text-muted-foreground`)
       - If no active account: `Unlink01Icon` + `not connected` (`border border-border text-muted-foreground`)
     - Bottom subtitle: `{toolkit.composerActionHint}` (e.g., *"Send a message to a channel"*, *"Create a task for each lead"*, *"Save leads to a database"*, *"Sync records to a base"*).
   - **What happens when the user selects a `[not connected]` app in the Composer?**
     - The pill is inserted into the prompt with a subtle `Connect` indicator, AND a non-blocking toast / inline popover offers **"Connect {App} now (30s)"** via an OAuth popup window (`window.open` centered 520×680) so the user never loses their typed prompt!
4. **Bottom Connected Apps Bar (Image 2 bottom-left)**:
   - In the composer footer bar, render a compact overlapping logo stack (`Gmail`, `Slack`, `ClickUp`) with label `Connected` (or `{n} Connected`) that opens the quick connection switcher popover when clicked.

### 5.2 Turn Submission Payload (`SendPayload`)
- When the user submits the prompt, `reconcilePromptState` extracts all `@app` mentions and toggled apps from `promptStore` into `pinnedToolkits: string[]` and passes them in `TurnIntegrationContext` to Nabu's `POST /api/v1/threads/{threadId}/turns`.

### 5.3 Chat Turn Rendering & Human-in-the-Loop (HITL) Approval Cards
In [`apps/web/src/features/chat/components/chat-turn-block.tsx`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/features/chat/components/chat-turn-block.tsx):
1. **Branded Tool Call Steps**:
   - When `item.kind === "tool_call"` belongs to a Composio toolkit (`payload.toolkit_slug`), render the app's logo (`https://logos.lndev.me/logos/<slug>.svg`), human-readable action title (`Slack · Send Message to #sales-leads`), and collapsible input/output summary.
2. **Interactive HITL Approval Card (`item.kind === "approval_request"`)**:
   - When Nabu suspends a turn via `suspend_for_approval` (e.g., before `GMAIL_SEND_EMAIL` or `SLACK_SEND_MESSAGE`), `ChatTurnBlock` renders an elevated **Approval Request Card** inline in the turn stream showing:
     - App Logo + Action Title (`Gmail · Send Email`)
     - Connected account badge (`Sending as ashmit@marketer.com`)
     - Formatted parameter preview (e.g. `To`, `Subject`, `Body` preview)
     - Action buttons:
       - **`Approve & Send`** (primary button -> calls `POST /api/v1/threads/{threadId}/turns/{turnId}/approvals/{itemId}` with `{ approved: true }`)
       - **`Always approve for {Action}`** (dropdown split option -> approves + saves `tenant_tool_approval_policies` rule)
       - **`Deny`** (outline button -> calls approval endpoint with `{ approved: false, reason }`)

---

## 6. State Management, Data Fetching, Forms & Observability Rules

1. **TanStack Query (`apps/web/src/features/integrations/api/integrations-queries.ts`)**:
   - All data fetching goes through `queryOptions` prefetched in route loaders via `context.queryClient.ensureQueryData(...)`:
     - `integrationsCatalogQueryOptions(organizationId)`
     - `integrationToolkitDetailQueryOptions(organizationId, toolkitSlug)`
   - Never fetch inside `useEffect` and never mirror server catalog/connection data into Zustand.
2. **Zustand (`apps/web/src/lib/stores/integrations-ui-store.ts`)**:
   - Stores only ephemeral client UI state (e.g., in-flight OAuth popup window tracking, dismissed onboarding tips, recent `@app` mention sort history in `localStorage`).
3. **TanStack Form + Zod (`apps/web/src/lib/schemas/integrations.ts`)**:
   - Shared Zod schemas for:
     - `requestIntegrationSchema` (`requestedAppName`, `requestedAppUrl`, `useCaseDescription`, `priority`)
     - `initiateConnectionSchema` (`toolkitSlug`, `ownerScope`, `accountAlias`, `setupParameters`)
     - `updateToolkitConfigSchema` (`enabledForAgents`, `connectionSharingMode`, `workspaceApprovalPosture`, `customOauthClientId`, `customOauthClientSecret`)
     - `toolApprovalPolicySchema` (`toolkitSlug`, `toolSlug`, `approvalMode`, `maxAutoCallsPerTurn`)
4. **Error Messaging (`<Sonner />`) & Logging (Pino)**:
   - Every mutation failure, OAuth popup cancellation, or expired token error delivers a clear, actionable `<Sonner />` notification (e.g., `toast.error("Couldn't connect Slack", { description: "The authorization window was closed before completion. Click Reconnect to try again." })`).
   - All server function failures log structured wide events via Pino (`logger.error({ err, tenantId, userId, toolkitSlug }, "integration_connection_initiate_failed")`).

---

## 7. Atomic Implementation Roadmap (`fenr`)

Following `fenr/AGENTS.md` Core Workflow, implementation is decomposed into 5 independently verifiable, atomic blocks:

- **Block 1 — `@workspace/database` Schema Mirrors & Parity Tests**:
  - Add `packages/database/src/schema/agent/integrations.ts`, export from `schema/index.ts`, wire relations in `schema/relations.ts`, and update `agent-mirror.test.ts` to verify 100% column parity with Nabu's `0014_composio_integrations_and_connections.sql`.
- **Block 2 — Zod Schemas, Server Functions & TanStack Query Layer**:
  - Add `apps/web/src/lib/schemas/integrations.ts`, BFF server functions in `integrations.functions.ts`, and query/mutation factories in `integrations-queries.ts`.
- **Block 3 — Dedicated `/integrations` Directory Page, `"Needs action"` Banner & `/settings/integrations`**:
  - Add `Integrations` to `nav-config.ts` and `/settings/integrations` to settings navigation.
  - Build `IntegrationBrandLogo`, `IntegrationsHeader`, `IntegrationsFilterBar`, `IntegrationsNeedsActionSection`, `IntegrationDirectoryRow`, `IntegrationSettingsCard`, and `RequestIntegrationDialog`.
- **Block 4 — Right-Side App Detail `<Sheet />` & OAuth Connect/Reconnect Flow**:
  - Build `IntegrationDetailSheet`, `SheetHeroHeader`, `SheetPreviewGallery`, `SheetOverviewSection`, `SheetConnectedAccounts`, `SheetToolPolicies`, and `/integrations/oauth/callback` popup/redirect completion handler.
- **Block 5 — Prompt Composer `@` / `+` App Mentions & Chat HITL Approval Cards**:
  - Extend composer `reconcile.ts`, `sources.ts`, `prompt-autocomplete.tsx`, and `add-menu.tsx` with live integration status badges (`connected` / `not connected`), brand-tinted inline app pills, and Chat Turn HITL approval cards in `chat-turn-block.tsx`.
