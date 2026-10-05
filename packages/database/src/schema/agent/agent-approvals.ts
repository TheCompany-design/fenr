import { sql } from "drizzle-orm"
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { agentItems } from "./agent-items"

/**
 * A request for a human decision, and the decision once given.
 *
 * The runtime writes the request with the decision columns null, and fills them
 * in exactly once: a second decision is refused rather than overwriting the
 * first. A null `decision` therefore means "still waiting on someone", which is
 * the one thing a client most needs to tell apart from "never asked".
 */
export const agentApprovals = pgTable(
  "agent_approvals",
  {
    /**
     * The approval-request item this answers, and the primary key.
     *
     * There is no surrogate identifier: one request, one row, keyed by the item
     * that records it. That is what makes a second decision a conflict rather
     * than a second row.
     */
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => agentItems.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    /** The tool call being approved, as the model named it. */
    callId: text("call_id").notNull(),
    tool: text("tool").notNull(),
    arguments: jsonb("arguments").notNull(),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    /** `approved` or `denied`, or null while the request is still open. */
    decision: text("decision"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("idx_agent_approvals_tenant_requested").on(
      table.tenantId,
      table.requestedAt,
    ),
    // Mirrors the runtime's constraint: a decision is complete or absent, so a
    // half-recorded approval cannot exist.
    check(
      "agent_approvals_decision_complete",
      sql`(${table.decision} IS NULL AND ${table.decidedBy} IS NULL AND ${table.decidedAt} IS NULL)
          OR (${table.decision} IS NOT NULL AND ${table.decidedBy} IS NOT NULL AND ${table.decidedAt} IS NOT NULL)`,
    ),
  ],
)
