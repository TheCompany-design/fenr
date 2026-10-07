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
