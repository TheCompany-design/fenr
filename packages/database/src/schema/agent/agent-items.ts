import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { agentThreads } from "./agent-threads"
import { agentTurns } from "./agent-turns"

export const agentItems = pgTable(
  "agent_items",
  {
    id: idColumn(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => agentTurns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agent_items_thread_created").on(table.threadId, table.createdAt),
    index("idx_agent_items_turn").on(table.turnId),
  ],
)
