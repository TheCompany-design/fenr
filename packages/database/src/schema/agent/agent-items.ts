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
import { agentThreads } from "./agent-threads"
import { agentTurns } from "./agent-turns"

/**
 * Transcript items, exactly as the runtime records them.
 *
 * `kind` is the runtime's own vocabulary — a message, a tool call, a tool
 * result, or the two halves of an approval — and only the message kinds are
 * chat bubbles. `completedAt` is null while an item is still accumulating:
 * history replays only completed items, because a half-written message must
 * never be shown to the model or to the reader.
 */
export const agentItems = pgTable(
  "agent_items",
  {
    id: idColumn(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id").notNull(),
    /** The tenant the runtime scoped this item to. */
    tenantId: uuid("tenant_id").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    /** Null while the item is still accumulating. */
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.turnId, table.threadId],
      foreignColumns: [agentTurns.id, agentTurns.threadId],
    }).onDelete("cascade"),
    index("idx_agent_items_thread_created").on(table.threadId, table.createdAt),
    index("idx_agent_items_turn").on(table.turnId),
    index("idx_agent_items_tenant_created").on(table.tenantId, table.createdAt),
  ],
)
