import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { organization } from "../organizations/organization"

export const agentThreads = pgTable(
  "agent_threads",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title"),
    turnCount: integer("turn_count").default(0).notNull(),
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
