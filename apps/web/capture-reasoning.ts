/**
 * Capture the reasoning a turn actually streams, verbatim.
 *
 * This exists to answer one question: is the same reasoning being emitted more
 * than once, or is the model genuinely reasoning in more than one block? Those
 * look identical in the interface and have nothing in common as defects, so the
 * frames are recorded exactly as they arrive — no reassembly, no normalisation.
 */

import { parseAgentStreamEvent } from "@/lib/schemas/agent-stream"

const runtimeUrl = (
  process.env.NABU_SERVER_URL ?? "http://127.0.0.1:5050"
).replace(/\/+$/, "")

function log(step: string, detail?: unknown) {
  console.log(`[capture] ${step}`, detail ?? "")
}

async function ensureSession(): Promise<{
  cookie: string
  userId: string
  organizationId: string
}> {
  const { db, schema } = await import("@workspace/database")
  const [user] = await db.select().from(schema.user).limit(1)
  const [organization] = await db.select().from(schema.organization).limit(1)
  if (!user || !organization) {
    throw new Error("need one user and one organization")
  }
  const token = `capture-${crypto.randomUUID()}`
  await db.insert(schema.session).values({
    token,
    userId: user.id,
    activeOrganizationId: organization.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  })
  return {
    cookie: `better-auth.session_token=${token}`,
    userId: user.id,
    organizationId: organization.id,
  }
}

async function main() {
  const session = await ensureSession()
  const { auth } = await import("@/lib/auth")
  const signed = await auth.api.signJWT({
    body: {
      payload: {
        sub: session.userId,
        email: `${session.userId}@capture.invalid`,
        activeOrganizationId: session.organizationId,
      },
      overrideOptions: { jwt: { audience: "nabu" } },
    },
  })
  const token = signed?.token
  if (!token) throw new Error("no token")

  const prompt = process.argv[2] ?? "Reply with the single word: ready"

  const turn = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ prompt }),
  })
  if (!turn.ok || !turn.body) {
    throw new Error(`refused: HTTP ${turn.status} ${await turn.text()}`)
  }

  const reader = turn.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  /** Every reasoning delta, in arrival order, with the item it belongs to. */
  const thinking: { itemId: string; index: number; text: string }[] = []
  const events: string[] = []
  let threadId: string | null = null
  let turnId: string | null = null
  let sawFinal = false

  while (!sawFinal) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const raw = trimmed.slice(5).trim()
      if (!raw) continue

      const parsed = parseAgentStreamEvent(JSON.parse(raw))
      if (!parsed.ok) {
        log("UNMODELLED", raw.slice(0, 120))
        continue
      }
      const event = parsed.event
      events.push(event.type)

      switch (event.type) {
        case "turn_started":
          threadId = event.data.thread_id
          turnId = event.data.turn_id
          break
        case "item_started":
          log("item_started", {
            kind: event.data.kind,
            item: event.data.item_id,
          })
          break
        case "item_delta":
          if (event.data.delta.kind === "thinking_delta") {
            thinking.push({
              itemId: event.data.item_id,
              index: thinking.length,
              text: event.data.delta.text,
            })
          }
          break
        case "item_completed":
          if (event.data.payload.kind === "agent_message") {
            log("agent_message completed", {
              item: event.data.item_id,
              thinking_len: event.data.payload.thinking?.length ?? 0,
              text: event.data.payload.text.slice(0, 60),
            })
          }
          break
        case "turn_completed":
          sawFinal = true
          log("turn_completed", event.data.status)
          break
        case "stream_error":
          sawFinal = true
          log("stream_error", event.data)
          break
      }
    }
  }
  await reader.cancel().catch(() => undefined)

  console.log("\n=== event counts ===")
  for (const type of [...new Set(events)]) {
    console.log(`${type}: ${events.filter((e) => e === type).length}`)
  }

  console.log("\n=== reasoning deltas ===")
  console.log(`count: ${thinking.length}`)
  console.log(`total chars: ${thinking.reduce((n, d) => n + d.text.length, 0)}`)
  const byItem = new Map<string, typeof thinking>()
  for (const d of thinking) {
    if (!byItem.has(d.itemId)) byItem.set(d.itemId, [])
    byItem.get(d.itemId)?.push(d)
  }
  console.log(`distinct items carrying reasoning: ${byItem.size}`)

  for (const [itemId, deltas] of byItem) {
    const joined = deltas.map((d) => d.text).join("")
    console.log(`\n--- item ${itemId} ---`)
    console.log(`  deltas: ${deltas.length}, joined length: ${joined.length}`)
    console.log(`  text: ${JSON.stringify(joined.slice(0, 400))}`)
    // The question: does the joined text repeat itself?
    const half = Math.floor(joined.length / 2)
    if (half > 40 && joined.slice(0, half) === joined.slice(half, half * 2)) {
      console.log("  !! the text is an exact repeat of its first half")
    }
    const words = joined.split(/\s+/)
    const unique = new Set(words)
    if (unique.size < words.length / 2) {
      console.log(
        `  !! heavy repetition: ${words.length} words, ${unique.size} unique`,
      )
    }
  }

  console.log(`\nthread=${threadId} turn=${turnId}`)
}

await main()
