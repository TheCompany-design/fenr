import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "../auth/user"
import { organization } from "./organization"

export const userActiveOrganization = pgTable(
  "user_active_organization",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("user_active_organization_orgId_idx").on(table.organizationId),
  ],
)
