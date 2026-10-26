import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema/index"

export function resolveDatabaseUrl(): string {
  const isTest =
    process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test"

  if (isTest) {
    if (process.env.TEST_DATABASE_URL) {
      return process.env.TEST_DATABASE_URL
    }
    if (process.env.DATABASE_URL) {
      const url = process.env.DATABASE_URL
      if (url.includes("_test")) return url
      return url.replace(/(\/[a-zA-Z0-9_]+)(\?.*)?$/, "$1_test$2")
    }
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy apps/web/.env.example to apps/web/.env and fill it in.",
    )
  }
  return url
}

const DATABASE_URL = resolveDatabaseUrl()

const client = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export * from "drizzle-orm"
export * from "./schema/index"
export { schema }
export type Database = typeof db
