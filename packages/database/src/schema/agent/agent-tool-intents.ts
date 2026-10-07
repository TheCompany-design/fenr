import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { organization } from "../organizations/organization"
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
    itemId: uuid("item_id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id").notNull(),
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
    foreignKey({
      columns: [table.itemId, table.tenantId],
      foreignColumns: [agentItems.id, agentItems.tenantId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.turnId, table.tenantId],
      foreignColumns: [agentTurns.id, agentTurns.tenantId],
    }).onDelete("cascade"),
    index("idx_agent_tool_intents_open").on(table.tenantId, table.dispatchedAt),
    index("idx_agent_tool_intents_turn").on(table.turnId),
  ],
)
