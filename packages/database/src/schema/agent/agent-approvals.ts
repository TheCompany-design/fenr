import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { organization } from "../organizations/organization"
import { agentItems } from "./agent-items"

export const agentApprovals = pgTable(
  "agent_approvals",
  {
    itemId: uuid("item_id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    callId: text("call_id").notNull(),
    tool: text("tool").notNull(),
    arguments: jsonb("arguments").notNull(),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),

    decision: text("decision"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId, table.tenantId],
      foreignColumns: [agentItems.id, agentItems.tenantId],
    }).onDelete("cascade"),
    index("idx_agent_approvals_tenant_requested").on(
      table.tenantId,
      table.requestedAt,
    ),

    check(
      "agent_approvals_decision_complete",
      sql`(${table.decision} IS NULL AND ${table.decidedBy} IS NULL AND ${table.decidedAt} IS NULL)
          OR (${table.decision} IS NOT NULL AND ${table.decidedBy} IS NOT NULL AND ${table.decidedAt} IS NOT NULL)`,
    ),
  ],
)
