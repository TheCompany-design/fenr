import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { organization } from "../organizations/organization"
import { agentThreads } from "./agent-threads"
import { agentTurns } from "./agent-turns"

export const agentItems = pgTable(
  "agent_items",
  {
    id: idColumn(),
    threadId: uuid("thread_id").notNull(),
    turnId: uuid("turn_id").notNull(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.turnId, table.tenantId],
      foreignColumns: [agentTurns.id, agentTurns.tenantId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.threadId, table.tenantId],
      foreignColumns: [agentThreads.id, agentThreads.tenantId],
    }).onDelete("cascade"),
    index("idx_agent_items_thread_created").on(table.threadId, table.createdAt),
    index("idx_agent_items_turn").on(table.turnId),
    index("idx_agent_items_tenant_created").on(table.tenantId, table.createdAt),
  ],
)
