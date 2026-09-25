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
import { agentThreads } from "./agent-threads"

export const agentTurns = pgTable(
  "agent_turns",
  {
    id: idColumn(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
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
    uniqueIndex("uidx_agent_turns_id_thread").on(table.id, table.threadId),
  ],
)
