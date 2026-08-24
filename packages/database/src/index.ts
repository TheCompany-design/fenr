/**
 * Fenr Postgres connection (Drizzle ORM + postgres.js).
 *
 * SERVER-ONLY: never import this module from client components, hooks, or
 * any code that runs in the browser — the connection string must not leak
 * into a bundle. All app DB I/O goes through server functions.
 *
 * The client is a module-level singleton; postgres.js pools connections and
 * is safe to share across requests. Under Bun this works both in dev SSR
 * (`bun --bun vite`) and the production `Bun.serve` server.
 */
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema/index"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy apps/web/.env.example to apps/web/.env and fill it in.",
  )
}

const client = postgres(DATABASE_URL, {
  // Small pool is plenty for an SSR app; postgres.js queues beyond max.
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export { schema }
export type Database = typeof db
