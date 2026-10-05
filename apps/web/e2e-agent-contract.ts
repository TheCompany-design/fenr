/**
 * End-to-end proof that fenr and the agent runtime agree.
 *
 * Mints a real session, signs the same token the BFF issues, starts a real turn
 * against the running runtime, and parses every SSE frame with fenr's own
 * schema. A frame this client cannot model is reported as such — which is the
 * failure this whole exercise exists to rule out.
 *
 * Run with the runtime listening and `bun run apps/web/e2e-agent-contract.ts`.
 */

import { db, schema } from "@workspace/database"
import { auth } from "@/lib/auth"
import { parseAgentStreamEvent } from "@/lib/schemas/agent-stream"

const runtimeUrl = (
  process.env.NABU_SERVER_URL ?? "http://127.0.0.1:5050"
).replace(/\/+$/, "")

function log(step: string, detail?: unknown) {
  console.log(`[e2e] ${step}`, detail ?? "")
}

/** A session the auth server will accept, for the tenant we already have. */
async function ensureSession(): Promise<{
  cookie: string
  userId: string
  organizationId: string
}> {
  const [user] = await db.select().from(schema.user).limit(1)
  const [organization] = await db.select().from(schema.organization).limit(1)
  if (!user || !organization) {
    throw new Error("need one user and one organization in the database")
  }

  const token = `e2e-${crypto.randomUUID()}`
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
  log("runtime", runtimeUrl)

  const health = await fetch(`${runtimeUrl}/api/v1/system/status`)
  log("health without a token", `HTTP ${health.status}`)

  const session = await ensureSession()
  log("session", `user=${session.userId} org=${session.organizationId}`)

  const signed = await auth.api.signJWT({
    body: {
      payload: {
        sub: session.userId,
        email: `${session.userId}@e2e.invalid`,
        activeOrganizationId: session.organizationId,
      },
      overrideOptions: { jwt: { audience: "nabu" } },
    },
  })
  if (!signed?.token) {
    throw new Error("the runtime token could not be signed")
  }
  log("token signed", `${signed.token.slice(0, 24)}...`)

  const capabilities = await fetch(`${runtimeUrl}/api/v1/capabilities`, {
    headers: { Authorization: `Bearer ${signed.token}` },
  })
  log(
    "capabilities",
    `HTTP ${capabilities.status} ${await capabilities.text()}`,
  )

  const turn = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signed.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ prompt: "Reply with the single word: ready" }),
  })
  log("turn started", `HTTP ${turn.status}`)

  if (!turn.ok || !turn.body) {
    throw new Error(`the runtime refused the turn: ${await turn.text()}`)
  }

  const reader = turn.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const seen: string[] = []
  let unmodelled = 0
  let firstThreadId: string | null = null
  let firstTurnId: string | null = null

  while (seen.length < 60) {
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
        unmodelled += 1
        log("UNMODELLED FRAME", { frame: raw, error: parsed.error })
        continue
      }
      const event = parsed.event
      seen.push(event.type)
      log("event", event.type)

      if (event.type === "turn_started") {
        firstThreadId = event.data.thread_id
        firstTurnId = event.data.turn_id
      }
      if (event.type === "turn_completed") {
        log("turn finished", event.data.status)
      }
      if (event.type === "stream_error") {
        log("stream error", event.data)
      }
    }
  }

  await reader.cancel().catch(() => undefined)

  console.log("\n=== summary ===")
  console.log("events:", [...new Set(seen)].join(", "))
  console.log("frames fenr could not model:", unmodelled)
  console.log("thread:", firstThreadId, "turn:", firstTurnId)

  if (firstTurnId) {
    const items = await fetch(
      `${runtimeUrl}/api/v1/threads/${firstTurnId}/items?limit=50`,
      { headers: { Authorization: `Bearer ${signed.token}` } },
    )
    const body = (await items.json()) as {
      items: { kind: string; payload: { kind: string } }[]
    }
    console.log(
      "transcript kinds:",
      body.items.map((i) => i.kind).join(", ") || "(none)",
    )
  }

  if (unmodelled > 0) {
    process.exitCode = 1
    log("FAILED", "the client could not model every frame the server sent")
  }
}

await main()
