import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { organization } from "../organizations/organization"

/** Read-only mirror of the runtime-owned model-call fact table. */
export const agentModelCalls = pgTable(
  "agent_model_calls",
  {
    id: idColumn(),
    threadId: uuid("thread_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id").notNull(),
    attempt: integer("attempt").notNull(),
    step: integer("step").notNull(),
    savedConfigId: uuid("saved_config_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    effort: text("effort"),
    userId: uuid("user_id"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    durationMs: bigint("duration_ms", { mode: "number" }),
    ttftMs: bigint("ttft_ms", { mode: "number" }),
    finishReason: text("finish_reason"),
    errorCode: text("error_code"),
    inputTokens: bigint("input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    uncachedInputTokens: bigint("uncached_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    outputTokens: bigint("output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    cachedInputTokens: bigint("cached_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    cacheCreationInputTokens: bigint("cache_creation_input_tokens", {
      mode: "number",
    })
      .notNull()
      .default(0),
    toolUseInputTokens: bigint("tool_use_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    reasoningTokens: bigint("reasoning_tokens", { mode: "number" })
      .notNull()
      .default(0),
    estimatedPromptTokens: integer("estimated_prompt_tokens"),
    windowStartIndex: integer("window_start_index"),
    messagesInRequest: integer("messages_in_request"),
    messagesDropped: integer("messages_dropped"),
    pricingSnapshotId: text("pricing_snapshot_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_model_calls_tenant_time_idx").on(
      table.tenantId,
      table.startedAt,
    ),
    index("agent_model_calls_thread_idx").on(
      table.threadId,
      table.startedAt,
      table.step,
    ),
    index("agent_model_calls_provider_idx").on(
      table.tenantId,
      table.provider,
      table.model,
      table.startedAt,
    ),
  ],
)
