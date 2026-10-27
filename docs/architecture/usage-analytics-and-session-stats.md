# Session Transcript Stats, Real-Time Session Telemetry Sheet, and Usage Analytics — Architecture & Implementation Plan

**Status:** Ready for Implementation  
**Target Repository:** `fenr` (`/home/muchiri/dev/bag/atelier/fenr`)  
**Companion Specification:** `thebookofnabu/docs/plans/session-transcript-stats-and-usage-analytics.md`

---

## 1. Executive Summary & Codebase Audit Findings

An audit of `fenr` (`apps/web` and `packages/database`) identified six concrete gaps preventing accurate session transcript stats, real-time turn/step telemetry, model/provider badges alongside conversations, and auditable person-attributed global usage analytics:

### 1.1 Finding 1: `streamReducer` Drops `model_call_recorded` Events (`apps/web/src/features/chat/state/stream-reducer.ts:140-142`)
In `apps/web/src/features/chat/state/stream-reducer.ts`:
```ts
// CURRENT NO-OP in apps/web/src/features/chat/state/stream-reducer.ts:140-142
case "model_call_recorded": {
  return state
}
```
Even though `thebookofnabu` emits `model_call_recorded` after every provider call within a turn (including multi-step tool loops), `fenr` discards the event completely. As a result:
- Multi-step tool turns have zero live visibility into per-step token consumption, cache hits, latency, TTFT, context window pressure, or step cost while the turn is running.
- When `turn_completed` arrives (`stream-reducer.ts:144-160`), only `turnUsage` (`prompt_tokens`, `completion_tokens`, `total_tokens`) is attached to `ActiveTurnProjection.usage`, losing `provider`, `model`, `effort`, `cached_input_tokens`, `cache_creation_input_tokens`, `reasoning_tokens`, `latency_ms`, `ttft_ms`, and `cost_breakdown`.

### 1.2 Finding 2: Multi-Step Context Window Inflation in `useChatComposerHost` (`apps/web/src/features/chat/composer-host.ts:144-161`)
In `apps/web/src/features/chat/composer-host.ts:151-159`:
```ts
// CURRENT BUGGY SEED LOGIC in apps/web/src/features/chat/composer-host.ts:151-159
if (turnUsage && turnUsage.total_tokens !== seedRef.current.lastTurnTotal) {
  seedRef.current = {
    promptTokens: turnUsage.prompt_tokens,
    completionTokens: turnUsage.completion_tokens,
    lastTurnTotal: turnUsage.total_tokens,
  }
}
```
In `thebookofnabu`, `turnUsage.prompt_tokens` is the **cumulative sum** of prompt tokens across all Re-Act steps in that turn. If a single turn executes 4 tool calls where the context window grows `10k -> 12k -> 14k -> 16k`, `turnUsage.prompt_tokens` is `52k`. Setting `seedRef.current.promptTokens = 52_000` causes `estimateUsage` (`apps/web/src/components/composer/catalog/usage.ts:55-97`) and `ContextMeter` (`apps/web/src/components/composer/surfaces/context-meter.tsx`) to report `52,000` tokens of context window used instead of `16,000`!
- **Fix:** `seedRef.current` must use `turnUsage.last_step_prompt_tokens` and `turnUsage.last_step_completion_tokens` (updated live on every `model_call_recorded` event as well as `turn_completed`) for context window occupancy, while keeping cumulative `prompt_tokens` and `completion_tokens` for billing and session token totals.

### 1.3 Finding 3: Historical Transcripts Load Zero Turn/Call Metadata (`apps/web/src/features/chat/server/chat.server.ts:27-97`)
`getThreadMessages` in `apps/web/src/features/chat/server/chat.server.ts`:
- Queries **only** `agentItems` (`SELECT id, turn_id, sequence_number, item_type, payload, status, created_at FROM agent_items`).
- Never queries `agentTurns` or `agentModelCalls`!
- Consequently, `buildTurnsFromItems` (`apps/web/src/features/chat/state/chat-turns.ts:29-105`) sets `usage: null` on every historical `ChatTurnView`. Reloading a page or opening an existing thread wipes out all token counts, cache hit rates, model badges, and costs from the conversation transcript.

### 1.4 Finding 4: Missing Drizzle Mirror Schemas (`packages/database/src/schema/agent/`)
`packages/database/src/schema/agent/` currently mirrors `agent_threads`, `agent_turns`, `agent_items`, `agent_approvals`, and `agent_tool_intents`, but is missing:
- `agent_model_calls` (from Nabu migrations `0007`, `0011`, and `0013`)
- `agent_tenant_providers` (from Nabu migrations `0006` and `0012`)
- The new attribution and rollup columns on `agent_threads` and `agent_turns` (`created_by_user_id`, `user_id`, token/cost rollup columns, and `models_used`).

### 1.5 Finding 5: Ensure Person Attribution Uses Verified Identity

Usage records must be attributable to the authenticated person through the existing verified subject claim, and the BFF must not accept a caller-supplied identity as authoritative. Roles, teams, and access-control policy are explicitly outside this analytics plan; do not add schema or token claims for them.

### 1.6 Finding 6: Missing UI Surfaces for Session Badges, Live Session Telemetry Sheet, and `/settings/usage`
- **Chat Header (`ChatContainer`):** `apps/web/src/features/chat/components/chat-container.tsx:161-165` portals `<ChatHeaderTitle />` into `<HeaderPortal region="start">`, leaving `<HeaderPortal region="end">` completely empty. There is no session-level stats trigger pill or `SessionStatsSheet`.
- **Chat Turn Blocks (`ChatTurnBlock`):** `apps/web/src/features/chat/components/chat-turn-block.tsx` renders user messages, reasoning, tool calls, and assistant replies, with no per-turn model/effort/token/cache/cost footer.
- **Settings Navigation (`routes/_app/settings/route.tsx`):** `SETTINGS_SECTIONS` has `Account` (`Profile`, `Security`) and `Workspace` (`General`, `AI Providers`, `Members`, `Integrations`), with no `Usage & Analytics` (`/settings/usage`) route.

---

## 2. Database Package (`@workspace/database`) Usage Mirrors & Person Attribution

Usage analytics storage is not an authorization schema. Do not add team/team-member tables, role fields, team IDs, or role/team JWT claims for this feature. Preserve the authenticated person ID as event-time attribution on sessions, turns, and model calls; keep analytics data independent of whichever RBAC/ABAC design is adopted later.

### 2.2 Read-Only Drizzle Mirrors for Nabu Agent Tables (`packages/database/src/schema/agent/`)

1. **Create `packages/database/src/schema/agent/agent-model-calls.ts`:**
   Mirrors `agent_model_calls` (migrations `0007`, `0011`, `0012`, `0013`) with `.existing()`:
   - `id`, `tenantId`, `userId`, `threadId`, `turnId`, `stepIndex`
   - `provider`, `model`, `effort`, `providerConfigId`
   - `status` (`'succeeded' | 'failed' | 'cancelled'`), `finishReason`, `errorCode`
   - `inputTokens`, `uncachedInputTokens`, `outputTokens`, `cachedInputTokens`, `cacheCreationInputTokens`, `reasoningTokens`, `toolUseInputTokens`
   - `latencyMs`, `ttftMs`
   - `estimatedPromptTokens`, `contextWindow`, `windowStartIndex`, `messagesInRequest`, `messagesDropped`
   - `pricingSnapshotId`
   - `uncachedInputCostNanodollars`, `cacheReadCostNanodollars`, `cacheCreationCostNanodollars`, `outputCostNanodollars`, `reasoningCostNanodollars`, `totalCostNanodollars`, `cacheSavingsNanodollars`
   - `createdAt`
2. **Update `packages/database/src/schema/agent/agent-threads.ts`:**
   Add `createdByUserId`, `totalTurns`, `totalModelCalls`, `totalInputTokens`, `totalCachedInputTokens`, `totalCacheCreationInputTokens`, `totalOutputTokens`, `totalReasoningTokens`, `totalCostNanodollars`, `totalCacheSavingsNanodollars`, `lastContextTokens`, `lastContextWindow`, and `modelsUsed` (`jsonb("models_used").$type<ThreadModelBadgeMirror[]>()`).
3. **Update `packages/database/src/schema/agent/agent-turns.ts`:**
   Add `userId`, `provider`, `model`, `effort`, `modelCallCount`, `inputTokens`, `uncachedInputTokens`, `cachedInputTokens`, `cacheCreationInputTokens`, `outputTokens`, `reasoningTokens`, `lastStepPromptTokens`, `lastStepCompletionTokens`, `contextWindow`, `latencyMs`, `ttftMs`, `costNanodollars`, `cacheSavingsNanodollars`.
4. **Update `packages/database/src/schema/agent/agent-mirror.test.ts`:**
   Extend the schema parity test suite to assert that `agentModelCalls`, `agentThreads`, and `agentTurns` match Nabu's `0001..0013` SQL migrations column-for-column.

---

## 3. Auth, Outbound JWT Minting, & BFF Server Functions

### 3.1 Preserve Verified Identity in Outbound Requests (`apps/web/src/lib/http/token.server.ts`)

Ensure the outbound identity token carries the authenticated subject and tenant using the existing trusted auth contract. Do not add roles, team memberships, managed-team lists, or analytics-specific authorization claims. The API must derive the immutable `user_id` attribution from verified claims, never from a client-supplied body/query field. Cache invalidation and token lifetime should follow existing identity-token behavior.

### 3.2 Upgrading `getThreadMessages` & Creating Session/Global Usage Server Functions

1. **Upgrade `getThreadMessages` (`apps/web/src/features/chat/server/chat.server.ts:27-97`):**
   Fetch `agentItems`, `agentTurns`, and `agentModelCalls` for `(tenantId, threadId)` in parallel using `Promise.all`:
   - Return `{ items, turns, modelCalls, threadSummary }` so that `buildTurnsFromItems` populates every historical `ChatTurnView` with:
     - `turn.usage` (normalized token breakdown, `last_step_prompt_tokens`, `last_step_completion_tokens`)
     - `turn.telemetry` (`provider`, `model`, `effort`, `latencyMs`, `ttftMs`, `cacheHitRate`, `costBreakdown`, `contextWindow`, `messagesDropped`)
     - `turn.modelCalls` (the chronological array of step-by-step `RecordedModelCallView` items for that turn).
2. **Create `apps/web/src/features/usage/server/usage.server.ts`:**
   - `getThreadUsageDetail`: Calls Nabu `GET /api/v1/threads/${threadId}/usage` via `nabuFetch` and validates with Zod (`threadUsageDetailSchema`).
   - `listThreadsWithUsage`: Calls Nabu `GET /api/v1/threads?limit=${limit}` (or queries Drizzle mirror) returning threads with `modelsUsed`, token totals, `cacheHitRate`, and `estimatedCostUsd`.
   - `getUsageSummary`: Calls Nabu `GET /api/v1/usage/summary` with `{ userId, provider, model, from, to, tzOffsetMinutes }`, enriching person-attributed rows with user display names/avatars from `@workspace/database` (`users`, `members`). The server-side authorization layer remains authoritative for accessible scopes and person filters.
 
     

---

## 4. Real-Time Stream Projection, `ContextMeter` Fix, & Optimistic Cache Architecture

### 4.1 Updating `agentStreamEventSchema` (`apps/web/src/lib/schemas/agent-stream.ts`)

Update `modelUsageSchema`, `usageReportSchema`, `costBreakdownSchema`, and the `model_call_recorded` variant of `agentStreamEventSchema`:

```ts
export const modelUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  uncached_input_tokens: z.number().int().nonnegative().default(0),
  cached_input_tokens: z.number().int().nonnegative().default(0),
  cache_creation_input_tokens: z.number().int().nonnegative().default(0),
  tool_use_input_tokens: z.number().int().nonnegative().default(0),
  output_tokens: z.number().int().nonnegative(),
  reasoning_tokens: z.number().int().nonnegative().default(0),
  total_tokens: z.number().int().nonnegative(),
})

export const costBreakdownSchema = z.object({
  uncached_input_cost_usd: z.number(),
  cache_read_cost_usd: z.number(),
  cache_creation_cost_usd: z.number(),
  output_cost_usd: z.number(),
  reasoning_cost_usd: z.number(),
  total_cost_usd: z.number(),
  cache_savings_usd: z.number(),
})

export const usageReportSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  uncached_prompt_tokens: z.number().int().nonnegative().default(0),
  cached_prompt_tokens: z.number().int().nonnegative().default(0),
  cache_creation_prompt_tokens: z.number().int().nonnegative().default(0),
  completion_tokens: z.number().int().nonnegative(),
  reasoning_tokens: z.number().int().nonnegative().default(0),
  total_tokens: z.number().int().nonnegative(),
  last_step_prompt_tokens: z.number().int().nonnegative().optional(),
  last_step_completion_tokens: z.number().int().nonnegative().optional(),
  model_call_count: z.number().int().nonnegative().default(1),
})
```

### 4.2 Real-Time Handling of `model_call_recorded` in `streamReducer` (`apps/web/src/features/chat/state/stream-reducer.ts`)

Extend `ActiveTurnProjection` (`apps/web/src/features/chat/types.ts`) with:
```ts
export interface RecordedModelCallProjection {
  callId: string
  turnId: string
  stepIndex: number
  provider: string
  model: string
  effort: string | null
  status: "succeeded" | "failed" | "cancelled"
  usage: ModelUsage
  latencyMs: number
  ttftMs: number | null
  finishReason: string | null
  errorCode: string | null
  estimatedPromptTokens: number | null
  contextWindow: number | null
  windowStartIndex: number | null
  messagesInRequest: number | null
  messagesDropped: number | null
  costBreakdown: CostBreakdown | null
}
```
When `case "model_call_recorded"` fires in `streamReducer`:
1. Append (or replace by `step_index`) the `RecordedModelCallProjection` in `state.activeTurn.modelCalls`.
2. Recompute live `state.activeTurn.liveTelemetry`:
   - Cumulative turn `inputTokens`, `uncachedInputTokens`, `cachedInputTokens`, `cacheCreationInputTokens`, `outputTokens`, `reasoningTokens`, `totalTokens`.
   - Live `cacheHitRate = inputTokens > 0 ? cachedInputTokens / inputTokens : null`.
   - Live `costBreakdown` summed across all steps in the turn so far.
   - Latest step's `lastStepPromptTokens = event.usage.input_tokens`, `lastStepCompletionTokens = event.usage.output_tokens`, `contextWindow = event.context_window`, and `messagesDropped = event.messages_dropped`.

### 4.3 Fixing `useChatComposerHost` Context Window Seed (`apps/web/src/features/chat/composer-host.ts`)

Replace the cumulative `turnUsage.prompt_tokens` seed in `apps/web/src/features/chat/composer-host.ts:144-161`:
```ts
// Seed from the latest completed step's actual prompt + completion footprint,
// NEVER the multi-step cumulative sum!
const lastStepPrompt =
  activeTurn?.liveTelemetry?.lastStepPromptTokens ??
  turnUsage?.last_step_prompt_tokens ??
  turnUsage?.prompt_tokens ??
  0
const lastStepCompletion =
  activeTurn?.liveTelemetry?.lastStepCompletionTokens ??
  turnUsage?.last_step_completion_tokens ??
  turnUsage?.completion_tokens ??
  0
```
This guarantees that after a multi-step tool turn (or even mid-turn between tool calls!), `ContextMeter` reflects the exact context window occupancy of the most recent model request plus its response, and when switching from an既存の thread (`turns` loaded from `getThreadMessages`), `seedRef` initializes from the last historical turn's `lastStepPromptTokens + lastStepCompletionTokens`.

---

## 5. UI Surface 1: Session List Badges & Per-Turn Transcript Footer Metadata

### 5.1 Session List Model & Usage Badges
Wherever sessions/threads are listed (e.g., command palette thread switcher, recent sessions drawer, or `/settings/usage` Top Sessions table):
- Render each thread's `modelsUsed` as a compact stack of provider icons (`ProviderLogo`) + abbreviated model pill (e.g., `[AnthropicLogo] Sonnet 4.5`, `+1` badge if multiple models were used in the session, with a tooltip listing all models and their respective call/token counts).
- Render compact formatted token count (`48.2k tok`), cache hit pill (`85% cached` when `cacheHitRate >= 0.1`), and formatted session cost (`$0.07`).

### 5.2 Per-Turn Transcript Footer Metadata (`apps/web/src/features/chat/components/chat-turn-block.tsx`)
Below the assistant response in `ChatTurnBlock` (visible on completed turns and updating live during multi-step tool execution):
- Render a quiet, single-line metadata bar (`text-[11px] text-muted-foreground/80 tabular-nums flex items-center gap-2`):
  - **Model & Effort Badge:** Provider logo + model display name + effort pill (e.g. `Claude Sonnet 4.5 · High`).
  - **Step Count (if > 1):** `3 steps`.
  - **Token Pill:** `12.4k in · 640 out` (with `310 reasoning` when `reasoning_tokens > 0`).
  - **Cache Hit Pill:** `91% cached` (emerald-tinted subtle badge when cache hit rate > 0%).
  - **Cost & Latency Pill:** `$0.014 · 1.8s (TTFT 320ms)`.
  - **Interactive Inspect Action:** Clicking any part of the turn metadata bar opens the `SessionStatsSheet` (Section 6) and scrolls/expands directly to that turn's step-by-step call breakdown (`selectedTurnId`).

---

## 6. UI Surface 2: Real-Time Session Stats & Telemetry Sheet (`SessionStatsSheet`)

### 6.1 Placement & Trigger in `ChatContainer` (`apps/web/src/features/chat/components/chat-container.tsx`)

In `apps/web/src/features/chat/components/chat-container.tsx:161-165`, inject `<SessionStatsTrigger />` and `<SessionStatsSheet />` into `<HeaderPortal region="end">`:

```tsx
<HeaderPortal region="start">
  <ChatHeaderTitle threadId={threadId} isStreaming={isStreaming} />
</HeaderPortal>
<HeaderPortal region="end">
  <SessionStatsSheetTrigger
    threadId={threadId}
    turns={turns}
    activeTurn={streamState.activeTurn}
    isStreaming={isStreaming}
    onOpen={() => setStatsSheetOpen(true)}
  />
</HeaderPortal>
```

#### What `<SessionStatsSheetTrigger />` Displays in the Header Bar:
- Even when no turns have completed yet (`threadId === undefined`), shows the active model's context window readiness (`0 tok · $0.00`).
- Once a turn starts or completes, displays:
  - Stacked `ProviderLogo` icons for all models used in the session.
  - Live total session tokens (`tabular-nums`, e.g., `64.8k tok`).
  - Live cache hit rate badge (`88% cache`).
  - Live total session cost (`$0.092`).
  - A subtle pulsing indicator dot during `isStreaming` as `model_call_recorded` events stream in.

### 6.2 Real-Time Data Merging Hook (`useSessionUsageTelemetry`)
Create `apps/web/src/features/chat/hooks/use-session-usage-telemetry.ts`:
- Combines persisted historical data from `getThreadUsageDetail(threadId)` (or `turns` loaded by `getThreadMessages`) with the in-flight `streamState.activeTurn.modelCalls` from `useAgentStream`.
- Deduplicates by `callId` so there is zero double-counting during the transition between `model_call_recorded` $\rightarrow$ `turn_completed` $\rightarrow$ query invalidation.
- Recomputes session totals, per-model breakdown, context window pressure, and per-turn/per-step call rows instantaneously in memory on every SSE event.

### 6.3 Inside `SessionStatsSheet` (`apps/web/src/features/chat/components/session-stats-sheet.tsx`)
Built with `@workspace/ui/components/sheet` (`side="right"`, width `sm:max-w-xl`), structured into four scannable sections:

1. **Section A — Session KPI Grid & Cache Economics Card:**
   - **Total Session Cost:** `$0.1428` (broken down into Uncached Input, Cache Read, Cache Write, Output, and Reasoning).
   - **Net Cache Savings Banner:** Highlights `$0.4120 saved (74% reduction vs uncached baseline)` when positive, or explains cache write priming when negative on Turn 1.
   - **Token Composition Bar:** Horizontal stacked progress bar showing share of:
     - Cached Input Read (emerald)
     - Uncached Input (sky)
     - Cache Creation Write (amber)
     - Output (violet)
     - Reasoning / Thinking (fuchsia)
   - **Cache Hit Rate & TTFT:** Session-wide `cache_hit_rate` (`%`), `cache_write_rate` (`%`), median TTFT (`p50`), and total model calls (`succeeded / failed / cancelled`).
2. **Section B — Context Window Pressure & Truncation Telemetry:**
   - Displays current context window occupancy (`last_step_prompt_tokens + last_step_completion_tokens` vs `context_window`, e.g. `42,180 / 200,000 tokens · 21.1%`).
   - Peak prompt tokens across the session.
   - If any call in the session had `messages_dropped > 0` (`window_start_index > 0`), renders an explicit warning callout showing which turn/step triggered sliding-window truncation and how many messages were dropped.
3. **Section C — Models & Providers Used in This Session:**
   - Grouped by `(provider, model, effort)` used in this conversation.
   - Shows `ProviderLogo`, model name, effort badge (`low | medium | high | max`), call count, input/cached/output/reasoning tokens, cache hit rate %, average TTFT, and exact cost for each model.
   - Handles mid-conversation model switching cleanly (e.g., starting a session with `Claude Haiku 4.5` and switching to `Claude Opus 4.6 (Max)` for a complex turn).
4. **Section D — Turn-by-Turn & Step-by-Step Call Audit Ledger:**
   - Accordion list of every turn (`Turn #1`, `Turn #2`, ..., plus the live `Active Turn` with a streaming badge).
   - Expanding a turn reveals every individual `agent_model_calls` step (`Step 0`, `Step 1`, ...):
     - Status badge (`Succeeded`, `Failed`, `Cancelled`), `finish_reason`, `error_code`
     - Exact token breakdown (`Uncached In`, `Cache Read`, `Cache Write`, `Out`, `Reasoning`)
     - Step cost breakdown (`$0.0184`, cache savings `+$0.0620`)
     - Timing (`Latency 2,140ms`, `TTFT 380ms`)
     - Context window state (`Est. Prompt: 18,400`, `Window: 12 msgs`, `Dropped: 0 msgs`).

---

## 7. UI Surface 3: Global Usage & Cost Analytics in Settings (`/settings/usage`)

### 7.1 Route & Settings Navigation Integration
1. **Update `apps/web/src/routes/_app/settings/route.tsx`:**
   Add `Usage` under the `Workspace` section in `SETTINGS_SECTIONS`:
   ```ts
   {
     label: "Workspace",
     items: [
       { to: "/settings/workspace", label: "General", icon: HugeiconsBuilding },
       { to: "/settings/providers", label: "AI Providers", icon: HugeiconsCpu },
       { to: "/settings/usage", label: "Usage & Cost", icon: HugeiconsChartHistogram },
       { to: "/settings/members", label: "Members", icon: HugeiconsUsers },
       { to: "/settings/integrations", label: "Integrations", icon: HugeiconsPlug },
     ],
   }
   ```
2. **Create `apps/web/src/routes/_app/settings/usage.tsx`:**
   Loader prefetches `getUsageAccessContext` and initial `getUsageSummary` via TanStack Query so the page renders without layout shift.

### 7.2 Policy-Driven Scope & Filter Bar (Authorization Deferred)

The dashboard may support personal and broader aggregate views, but this plan does not prescribe roles or how access is granted. Gate each selectable scope/filter through the application's existing/future authorization service; server-side policy is authoritative and client controls are only presentation. Do not add role/team-specific schema or JWT claims. Person filters must use stable user IDs and all analytics queries must remain tenant-scoped.

### 7.3 Five Analytics Modules on `/settings/usage`

1. **Module 1 — Executive KPI Cards:**
   - **Total Spend (`total_cost_usd`):** With unpriced call badge if `unpriced_calls > 0` and pricing snapshot identifier tooltip.
   - **Net Cache Savings (`cache_savings_usd`):** Shows exact dollar amount saved by prompt caching and effective discount percentage vs. uncached baseline.
   - **Total Tokens (`total_tokens`):** With input vs. output ratio and reasoning token share.
   - **Cache Hit Rate (`cache_hit_rate`):** Percentage of all input tokens served from provider KV cache (`0.0% – 100.0%`), plus `cache_write_rate`.
   - **Reliability & Speed:** Total sessions, total turns, call success rate (`succeeded / calls`), median TTFT (`p50_ttft_ms`), and p95 latency (`p95_latency_ms`).
2. **Module 2 — Granular Cost Breakdown Panel:**
   - Visualizes the 5 cost buckets side-by-side with exact USD and percentage of total spend:
     1. **Uncached Input Cost** (`uncached_input_cost_usd`)
     2. **Cache Read Cost** (`cache_read_cost_usd`)
     3. **Cache Write / Creation Cost** (`cache_creation_cost_usd`)
     4. **Standard Output Cost** (`output_cost_usd`)
     5. **Reasoning / Thinking Cost** (`reasoning_cost_usd`)
3. **Module 3 — Daily Spend, Token & Cache Hit Trend Chart:**
   - Interactive daily bar/area chart (`by_day` series) with toggleable views:
     - **Cost View ($ USD):** Stacked by cost component or by provider, overlaid with daily cache savings.
     - **Tokens View:** Stacked by Cached Input, Uncached Input, Cache Write, Output, and Reasoning tokens.
     - **Cache Efficiency View (%):** Daily cache hit rate percentage trend line.
4. **Module 4 — Models & Providers Breakdown Table:**
   - Sortable table of every `(provider, model, effort)` used across chats in the selected scope and window:
     - Columns: `Provider & Model`, `Effort`, `Sessions`, `Calls (Ok / Err)`, `Total Input`, `Cache Read`, `Cache Write`, `Cache Hit %`, `Output (Reasoning)`, `Median TTFT`, `Cache Saved`, `Total Cost`.
5. **Module 5 — Top Sessions & Person Attribution Tabs:**
   - **Tab 1: Top Sessions (`top_threads`):** Lists conversations with highest token/cost usage in the scope, showing session title, initiating user, `models_used` badges, total tokens, cache hit rate, total cost, and a direct link (`/chat/$threadId`) to open the conversation or inspect its transcript stats.
   - **Tab 2: By Person (`by_actor`, only when authorized):** Shows per-user usage (`User`, `Sessions`, `Turns`, `Calls`, `Input Tokens`, `Output Tokens`, `Cache Hit %`, `Cache Saved`, `Total Cost`); selecting a person filters the dashboard subject to server-side policy.

---

## 8. Non-Happy-Path & Edge-Case Matrix (`fenr`)

| # | Scenario | Failure Mode if Unhandled | Required Handling in `fenr` |
| :--- | :--- | :--- | :--- |
| 1 | **Streaming disconnect or aborted turn mid-call** | `useAgentStream` aborts or SSE closes before `turn_completed`; any `model_call_recorded` steps from earlier tool steps in the same turn could be lost on abort. | On stream completion, error, or abort (`use-agent-stream.ts`), invalidate `["thread-usage", threadId]` and `["thread-messages", threadId]` so persisted `agent_model_calls` rows (including `cancelled` / `failed` calls) are reconciled from the server. |
| 2 | **Duplicate or re-delivered `model_call_recorded` vs persisted query refetch** | Live SSE projection + TanStack Query refetch briefly counts the same `call_id` twice in `SessionStatsSheet`. | `useSessionUsageTelemetry` keys all calls in a `Map<string, RecordedModelCallProjection>` by `callId` (falling back to `${turnId}:${stepIndex}`), guaranteeing idempotent merging. |
| 3 | **Legacy threads / turns created before Migration `0013`** | Old turns have `agent_turns.input_tokens == 0` or `created_by_user_id == null` and zero `agent_model_calls` rows. | `buildTurnsFromItems` and `SessionStatsSheet` check `modelCallCount > 0 || totalTokens > 0`. For pre-telemetry turns, render `"Legacy turn (telemetry not recorded)"` instead of misleading `0 tok · $0.00` badges. |
| 4 | **Unpriced custom model in a session (`cost_breakdown == null`)** | Summing `null` as `$0.00` without indicator misleads users into thinking a custom model is free. | Whenever `unpriced_calls > 0`, display an amber info badge (`"Partial cost · N calls unpriced"`) next to the USD total with a tooltip listing which `(provider, model)` lacked catalog pricing. |
| 5 | **Cold cache write on Turn 1 (`cache_savings_usd < 0`)** | Displaying `"-$0.0075 saved"` looks like a calculation bug to users unfamiliar with Anthropic's 1.25x cache write fee. | Format negative `cache_savings_usd` explicitly as `"Cache write investment: +$0.0075 (priming KV cache)"` in amber, and positive values as `"Cache savings: $0.2700 saved"` in emerald. |
| 6 | **Unauthorized deep link to a broader usage scope** | Client URL state requests a broader scope, potentially exposing usage if the server trusts UI state. | The server-side authorization boundary rejects unauthorized scope/person filters; client-side search params are not evidence of access. Keep every query tenant-scoped. |

---

## 9. Atomic Implementation Blocks & Verification Checklists

Each block is an atomic, independently verifiable unit of work per `fenr/AGENTS.md`.

### Block 1: `@workspace/database` Usage Mirrors & Person Attribution
- **Files to Create / Modify:**
  - `packages/database/src/schema/organizations/index.ts` & `packages/database/src/schema/index.ts`
  - `packages/database/src/schema/agent/agent-model-calls.ts` (new read-only mirror)
  - `packages/database/src/schema/agent/agent-tenant-providers.ts` (new read-only mirror)
  - `packages/database/src/schema/agent/agent-threads.ts` & `agent-turns.ts` (add attribution & rollup columns)
  - `packages/database/src/schema/agent/index.ts`
  - `packages/database/src/schema/agent/agent-mirror.test.ts` (add parity assertions for `agent_model_calls`, `agent_threads`, `agent_turns`)
- **Verification:**
  - Run `bun run --filter @workspace/database test` and `bun run typecheck`.

### Block 2: Verified Identity & BFF Server Functions (`token.server.ts`, `chat.server.ts`, `usage.server.ts`)
- **Files to Create / Modify:**
  - `apps/web/src/lib/http/token.server.ts` (preserve verified subject and tenant in the existing outbound-token contract; no analytics roles or team claims)
  - `apps/web/src/lib/schemas/agent-stream.ts` & `apps/web/src/lib/schemas/nabu.ts` (Zod schemas for normalized `ModelUsage`, `UsageReport`, `CostBreakdown`, `ThreadUsageDetail`, `UsageSummaryResponse`, `UsageAccessContext`)
  - `apps/web/src/features/chat/server/chat.server.ts` (upgrade `getThreadMessages` to join/fetch `agentTurns` and `agentModelCalls` alongside `agentItems`)
  - `apps/web/src/features/usage/server/usage.server.ts` (create `getThreadUsageDetail`, `listThreadsWithUsage`, `getUsageAccessContext`, `getUsageSummary`)
- **Verification:**
  - Unit tests verifying outbound identity subject/tenant attribution and rejection of client-supplied identity.
  - Unit tests for `agent-stream.ts` and `nabu.ts` Zod schemas against sample Nabu payloads.

### Block 3: Real-Time Stream Reducer, Historical Turn Reconstruction, & `ContextMeter` Seed Fix
- **Files to Modify:**
  - `apps/web/src/features/chat/types.ts` (`RecordedModelCallProjection`, `TurnTelemetry`, enriched `ChatTurnView` and `ActiveTurnProjection`)
  - `apps/web/src/features/chat/state/stream-reducer.ts` (implement `case "model_call_recorded"` and enrich `case "turn_completed"`)
  - `apps/web/src/features/chat/state/chat-turns.ts` (update `buildTurnsFromItems` to merge persisted turn/call usage and telemetry into each `ChatTurnView`)
  - `apps/web/src/features/chat/composer-host.ts` (fix `seedRef.current` to use `last_step_prompt_tokens` and `last_step_completion_tokens` instead of multi-step cumulative `prompt_tokens`)
  - `apps/web/src/features/chat/hooks/use-agent-stream.ts` (invalidate/update session usage query cache on `model_call_recorded` and `turn_completed`)
- **Verification:**
  - Reducer unit tests (`stream-reducer.test.ts`):
    - Simulate a 3-step tool turn (`turn_started` $\rightarrow$ `model_call_recorded` step 0 $\rightarrow$ tool events $\rightarrow$ `model_call_recorded` step 1 $\rightarrow$ `turn_completed`) and assert that `activeTurn.modelCalls` has 2 steps, cumulative tokens equal `step0 + step1`, and `lastStepPromptTokens` equals `step1.usage.input_tokens`.
    - Verify `useChatComposerHost` seeds `ContextMeter` with `step1.usage.input_tokens + step1.usage.output_tokens`, not `step0 + step1`.

### Block 4: Per-Turn Transcript Footer, Session List Badges, & Real-Time `SessionStatsSheet`
- **Files to Create / Modify:**
  - `apps/web/src/features/chat/hooks/use-session-usage-telemetry.ts` (real-time + persisted call deduplication and rollup hook)
  - `apps/web/src/features/chat/components/session-stats-sheet.tsx` (`SessionStatsSheet` and `SessionStatsSheetTrigger`)
  - `apps/web/src/features/chat/components/chat-turn-block.tsx` (per-turn model/effort/token/cache/cost metadata bar with click-to-inspect in `SessionStatsSheet`)
  - `apps/web/src/features/chat/components/chat-container.tsx` (mount `SessionStatsSheetTrigger` in `<HeaderPortal region="end">` and wire `SessionStatsSheet`)
- **Verification:**
  - Component & hook tests verifying live updates on each `model_call_recorded` event, multi-model session badge rendering, and cold-cache vs. warm-cache savings display.

### Block 5: Global Usage & Cost Analytics in Settings (`/settings/usage`)
- **Files to Create / Modify:**
  - `apps/web/src/routes/_app/settings/route.tsx` (add `Usage & Cost` nav item pointing to `/settings/usage`)
  - `apps/web/src/routes/_app/settings/usage.tsx` (route component with search params validation for `scope`, `userId`, `provider`, `model`, `range`)
  - `apps/web/src/features/usage/components/usage-dashboard.tsx` (policy-gated scope switcher, KPI cards, 5-part cost breakdown panel, daily trend chart, model/provider breakdown table, and top sessions / person attribution tabs)
- **Verification:**
  - Run `bun run typecheck`, `bun run lint`, and `bun run test` across the workspace.
  - Verify unauthorized scopes/filters are denied by the server policy boundary; analytics data remains tenant-scoped and person attribution is not inferred from roles.
