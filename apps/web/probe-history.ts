/** What the model was re-sent on each step of a looping turn. */
import { db, eq, schema } from "@workspace/database"

type Payload = {
  text?: unknown
  content?: unknown
  arguments?: { text?: unknown }
  output?: unknown
}

const t = process.argv[2]
if (!t) throw new Error("tenant id is required")

const rows = await db
  .select({
    kind: schema.agentItems.kind,
    payload: schema.agentItems.payload,
    turnId: schema.agentItems.turnId,
  })
  .from(schema.agentItems)
  .where(eq(schema.agentItems.tenantId, t))
  .orderBy(schema.agentItems.createdAt, schema.agentItems.id)

// The turn with the most tool calls is the one that looped.
const byTurn = new Map<string, number>()
for (const r of rows) {
  if (r.kind === "tool_call")
    byTurn.set(r.turnId, (byTurn.get(r.turnId) ?? 0) + 1)
}
const looped = [...byTurn.entries()].sort((a, b) => b[1] - a[1])[0]
if (!looped) throw new Error("no tool calls found for tenant")
console.log(`worst turn: ${looped[1]} tool calls\n`)

const items = rows.filter((r) => r.turnId === looped[0])
const REPLAYED = new Set([
  "user_message",
  "agent_message",
  "tool_call",
  "tool_result",
])
for (const it of items) {
  if (!REPLAYED.has(it.kind)) continue
  const p = it.payload as Payload
  const text = String(
    p.text ?? p.content ?? p.arguments?.text ?? p.output ?? "",
  )
  const mark = it.kind === "tool_call" ? "TOOL CALL" : it.kind.toUpperCase()
  console.log(
    `${(`${mark}:`).padEnd(11)} "${text.replace(/\n/g, " ").slice(0, 88)}"`,
  )
}
console.log(`\nreplayed items per model step grows by 3 with every call`)
