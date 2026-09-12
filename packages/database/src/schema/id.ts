import { sql } from "drizzle-orm"
import { uuid } from "drizzle-orm/pg-core"

/**
 * Standard primary key column helper using native Postgres 18 UUIDv7.
 */
export function idColumn(name = "id") {
  return uuid(name).default(sql`uuidv7()`).primaryKey().notNull()
}
