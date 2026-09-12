import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { idColumn } from "../id"
import { organization } from "../organizations/organization"
import { user } from "./user"

export const session = pgTable(
  "session",
  {
    id: idColumn(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid("active_organization_id").references(
      () => organization.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    index("session_activeOrganizationId_idx").on(table.activeOrganizationId),
  ],
)
