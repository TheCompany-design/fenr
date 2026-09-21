import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { idColumn } from "../id"

/**
 * JWKS key persistence for Better Auth JWT plugin.
 *
 * NOTE: `privateKey` is automatically encrypted at rest using AES-GCM symmetric
 * encryption with `BETTER_AUTH_SECRET` by the Better Auth JWT plugin before persistence.
 */
export const jwks = pgTable("jwks", {
  id: idColumn(),
  publicKey: text("public_key").notNull(),
  /** Symmetrically encrypted with AES-GCM via Better Auth secret before persistence */
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
