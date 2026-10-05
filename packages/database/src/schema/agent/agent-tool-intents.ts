import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { agentItems } from "./agent-items"
import { agentTurns } from "./agent-turns"

/**
 * A tool call that was dispatched but never confirmed.
 *
 * The runtime writes the intent before running a tool and removes the doubt by
 * writing a result. A row that survives a worker stopping is an effect nobody
 * observed, and it is never replayed automatically: an unobserved effect is a
 * question for a person, not a retry.
 *
 * Keyed by the tool-call item, with no surrogate identifier, for the same reason
 * approvals are: one call, one record.
 */
export const agentToolIntents = pgTable(
  "agent_tool_intents",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => agentItems.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => agentTurns.id, { onDelete: "cascade" }),
    callId: text("call_id").notNull(),
    tool: text("tool").notNull(),
    dispatchedAt: timestamp("dispatched_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_agent_tool_intents_open").on(table.tenantId, table.dispatchedAt),
    index("idx_agent_tool_intents_turn").on(table.turnId),
  ],
)
