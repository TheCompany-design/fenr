import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { idColumn } from "../id"

export const agentThreads = pgTable(
  "agent_threads",
  {
    id: idColumn(),
    tenantId: text("tenant_id").notNull(),
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
  (table) => [index("idx_agent_threads_tenant").on(table.tenantId)],
)
