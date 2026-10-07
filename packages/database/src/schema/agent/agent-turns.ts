import {
  foreignKey,
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
import { agentThreads } from "./agent-threads"

export const agentTurns = pgTable(
  "agent_turns",
  {
    id: idColumn(),
    threadId: uuid("thread_id").notNull(),
    /** The tenant the runtime scoped this turn to. */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    /** Which attempt this row is. Attempts are counted from one. */
    attempt: integer("attempt").default(1).notNull(),
    /**
     * One of the runtime's turn statuses. Held as text rather than an enum so a
     * new status on the server is visible here as a value to handle rather than
     * a decode failure; the Zod contract is where it is validated.
     */
    status: text("status").notNull(),
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
    index("idx_agent_turns_thread").on(table.threadId),
    uniqueIndex("uidx_agent_turns_thread_turn_index").on(
      table.threadId,
      table.turnIndex,
    ),
    uniqueIndex("uidx_agent_turns_id_tenant").on(table.id, table.tenantId),
    foreignKey({
      columns: [table.threadId, table.tenantId],
      foreignColumns: [agentThreads.id, agentThreads.tenantId],
    }).onDelete("cascade"),
    index("idx_agent_turns_tenant_status").on(table.tenantId, table.status),
  ],
)
