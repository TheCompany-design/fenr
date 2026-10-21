import { sql } from "drizzle-orm"
import { uuid } from "drizzle-orm/pg-core"

export function idColumn(name = "id") {
  return uuid(name).default(sql`uuidv7()`).primaryKey().notNull()
}
