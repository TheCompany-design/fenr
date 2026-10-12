import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { organization } from "../organizations/organization"

/**
 * Threads as the agent runtime owns them.
 *
 * These tables are written by `thebookofnabu`, not by this application: it
 * mints every identifier, and it owns the schema (see its migration
 * `0001_runtime_schema.sql`). This mirror exists so the transcript can be read
 * without a second source of truth, so it must not carry columns the runtime
 * does not have — `turn_count` was one, and querying it failed at runtime.
 *
 * Composite tenant constraints and explicit predicates are part of the runtime
 * contract; this mirror declares the same ownership relationships without
 * migrating or writing these tables.
 */
export const agentThreads = pgTable(
  "agent_threads",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title"),
    /**
     * Which saved provider configuration this conversation runs on, as the
     * chat's picker set it. `null` means the workspace's default — the state of
     * conversations started before the picker existed, and of any conversation
     * whose configuration was deleted (the runtime's reference is `ON DELETE
     * SET NULL`, so the fallback is the database's rule).
     *
     * Written only by the runtime, through its own API; this mirror reads it.
     */
    providerConfigId: uuid("provider_config_id"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("uidx_agent_threads_id_tenant").on(table.id, table.tenantId),
    index("idx_agent_threads_tenant_updated").on(
      table.tenantId,
      table.updatedAt,
    ),
  ],
)
