import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "../auth/user"
import { idColumn } from "../id"
import { organization } from "./organization"

export const member = pgTable(
  "member",
  {
    id: idColumn(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_organizationId_userId_unique").on(
      table.organizationId,
      table.userId,
    ),
  ],
)
