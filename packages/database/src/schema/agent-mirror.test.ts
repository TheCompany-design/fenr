/**
 * The agent tables belong to the runtime.
 *
 * `thebookofnabu` owns `agent_threads`, `agent_turns`, `agent_items`,
 * `agent_approvals` and `agent_tool_intents`: it mints their identifiers, writes
 * their rows, and enforces isolation through explicit `tenant_id` predicates
 * and foreign keys to Fenr's `organization` table. Fenr therefore does not
 * migrate them and does not write them — its Drizzle tables exist only so the
 * transcript can be read.
 *
 * That leaves one obligation in this direction: a mirror drifts silently. When
 * the runtime added `tenant_id`, `attempt` and `completed_at`, fenr's mirror
 * kept declaring `turn_count`, and nothing failed until a query selected a
 * column that did not exist.
 *
 * So this file compares the mirror against the database the runtime actually
 * created. It reads `information_schema` rather than a fixture, which means it
 * fails for a real mismatch rather than for a stale copy of the truth.
 */

import { describe, expect, it } from "bun:test"
import { sql } from "drizzle-orm"
import type { PgColumn } from "drizzle-orm/pg-core"
import { db } from "../index"
import {
  agentApprovals,
  agentItems,
  agentThreads,
  agentToolIntents,
  agentTurns,
} from "./agent"

/** Drizzle's own representation of a column, which carries no name at runtime. */
type AnyColumn = PgColumn & { name: string }

/**
 * A table declaration.
 *
 * Drizzle's `PgTable` carries its columns in a branded generic rather than as
 * an index signature, so it is widened here on purpose: the point of this file
 * is to read whatever the table declares, including a column added by accident.
 */
type MirrorTable = object

/** The columns a table declares, as database column names. */
function declaredColumns(table: MirrorTable): string[] {
  return Object.values(table as Record<string, unknown>)
    .filter(
      (value): value is AnyColumn =>
        typeof value === "object" && value !== null && "name" in value,
    )
    .map((column) => column.name)
    .sort()
}

async function actualColumns(table: string): Promise<string[]> {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}
  `)

  const rows = result as unknown as { column_name: string }[]
  if (rows.length === 0) {
    throw new Error(
      `table "${table}" does not exist. The agent runtime owns these tables and ` +
        `creates them with its own migrations; apply them before running this suite.`,
    )
  }
  return rows.map((row) => row.column_name).sort()
}

const MIRRORED_TABLES: { table: string; schema: MirrorTable }[] = [
  { table: "agent_threads", schema: agentThreads },
  { table: "agent_turns", schema: agentTurns },
  { table: "agent_items", schema: agentItems },
  { table: "agent_approvals", schema: agentApprovals },
  { table: "agent_tool_intents", schema: agentToolIntents },
]

describe("agent table mirror matches the runtime schema", () => {
  for (const { table, schema } of MIRRORED_TABLES) {
    it(`${table} declares exactly the columns the runtime created`, async () => {
      expect(declaredColumns(schema)).toEqual(await actualColumns(table))
    })
  }

  it("does not declare a column the runtime does not have", async () => {
    // The specific drift that motivated this: `turn_count` was declared here and
    // never existed in the runtime's table, so any full select failed at
    // runtime rather than at build time.
    expect(declaredColumns(agentThreads)).not.toContain("turn_count")
  })

  it("mirrors the tenancy columns isolation depends on", async () => {
    // These columns are what every reader must explicitly filter on. The
    // database no longer supplies isolation implicitly through RLS.
    expect(declaredColumns(agentTurns)).toContain("tenant_id")
    expect(declaredColumns(agentItems)).toContain("tenant_id")
    expect(declaredColumns(agentApprovals)).toContain("tenant_id")
  })
})
