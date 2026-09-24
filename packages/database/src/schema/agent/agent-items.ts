import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { agentTurns } from "./agent-turns"

export const agentItems = pgTable(
  "agent_items",
  {
    id: idColumn(),
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
  (table) => [index("idx_agent_items_turn").on(table.turnId)],
)
