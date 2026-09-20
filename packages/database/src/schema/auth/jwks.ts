import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { idColumn } from "../id"

export const jwks = pgTable("jwks", {
  id: idColumn(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  alg: text("alg"),
  crv: text("crv"),
})
