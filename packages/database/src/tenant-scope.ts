/**
 * Reading tables the agent runtime owns.
 *
 * The runtime's `agent_*` tables use row level security with `FORCE`, so the
 * table's own owner is filtered like everyone else. A row is visible only while
 * the transaction says which tenant is asking, through the setting the runtime
 * reads in its policies.
 *
 * Without that setting a read does not fail — it returns nothing. That is the
 * point of the isolation, and it is also why a missing scope is so easy to miss:
 * the query succeeds, the transcript is simply empty, and the interface looks
 * like the conversation was lost rather than like a query that was never
 * permitted to see a row.
 *
 * The setting name is a cross-repository contract. It lives here, next to the
 * tables it governs, so that every read goes through one place rather than
 * repeating a string that has to match the runtime's migration.
 */

import { sql } from "drizzle-orm"
import { db } from "./index"

/** The setting the runtime's row level security policies filter on. */
export const NABU_TENANT_SETTING = "nabu.tenant_id"

/**
 * Runs a read as one tenant, inside a transaction that carries the scope.
 *
 * The scope is transaction-local, so it cannot outlive the call or leak into the
 * next tenant's work on a pooled connection — which matters here, because a
 * connection's scope set by someone else is a cross-tenant read.
 */
export async function withTenantScope<T>(
  tenantId: string,
  read: (scoped: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config(${NABU_TENANT_SETTING}, ${tenantId}, true)`,
    )
    // The transaction is the only place the setting applies, so the reads are
    // given this transaction rather than the pool.
    return read(tx as unknown as typeof db)
  })
}
