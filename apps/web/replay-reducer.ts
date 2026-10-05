/**
 * Replay a real turn's frames through the client reducer.
 *
 * The capture scripts show what the server sent. This shows what the interface
 * ends up holding, which is a different question: the two disagree when the
 * reducer's item matching is wrong.
 */

import { chatMessagesReducer } from "@/features/chat/state/chat-messages-reducer"
import type { ChatMessage } from "@/features/chat/types"
import type { AgentStreamEvent } from "@/lib/schemas/agent-stream"
import { parseAgentStreamEvent } from "@/lib/schemas/agent-stream"

const runtimeUrl = (
  process.env.NABU_SERVER_URL ?? "http://127.0.0.1:5050"
).replace(/\/+$/, "")

async function capture(prompt: string): Promise<AgentStreamEvent[]> {
  const { db, schema } = await import("@workspace/database")
  const [user] = await db.select().from(schema.user).limit(1)
  const [org] = await db.select().from(schema.organization).limit(1)
  const token = `replay-${crypto.randomUUID()}`
  await db.insert(schema.session).values({
    token,
    userId: user!.id,
    activeOrganizationId: org!.id,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  const { auth } = await import("@/lib/auth")
  const signed = await auth.api.signJWT({
    body: {
      payload: {
        sub: user!.id,
        email: `${user!.id}@replay.invalid`,
        activeOrganizationId: org!.id,
      },
      overrideOptions: { jwt: { audience: "nabu" } },
    },
  })

  const turn = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signed?.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ prompt }),
  })
  if (!turn.ok || !turn.body) throw new Error(`HTTP ${turn.status}`)

  const reader = turn.body.getReader()
  const decoder = new TextDecoder()
  const events: AgentStreamEvent[] = []
  let buffer = ""
  while (true) {
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
      if (parsed.ok) events.push(parsed.event)
      if (parsed.ok && parsed.event.type === "turn_completed") {
        await reader.cancel().catch(() => undefined)
        return events
      }
    }
  }
  return events
}

function run(events: AgentStreamEvent[]): ChatMessage[] {
  let messages: ChatMessage[] = chatMessagesReducer([], {
    type: "client_send",
    payload: {
      userMessage: {
        id: "local-user",
        role: "user",
        content: "prompt",
        status: "completed",
      },
      agentMessage: {
        id: "local-agent",
        role: "agent",
        content: "",
        thinking: "",
        status: "streaming",
      },
    },
  })

  for (const event of events) {
    messages = chatMessagesReducer(messages, { type: "agent_event", event })
    if (
      event.type === "item_completed" &&
      event.data.payload.kind === "agent_message"
    ) {
      const bubble = messages[messages.length - 1]
      console.log(
        `  after item_completed ${event.data.item_id.slice(-6)}: bubbles=${messages.length}` +
          ` thinking=${(bubble?.thinking ?? "").length} chars id=${bubble?.id.slice(-6)}`,
      )
    }
  }
  return messages
}

const prompt = process.argv[2] ?? "What is 2 + 2?"
const events = await capture(prompt)

console.log(`frames: ${events.length}`)
console.log(
  "item_started kinds:",
  events
    .filter((e) => e.type === "item_started")
    .map((e) => (e as { data: { kind: string } }).data.kind)
    .join(", "),
)
console.log(
  "item_started ids:",
  events
    .filter((e) => e.type === "item_started")
    .map((e) => (e as { data: { item_id: string } }).data.item_id.slice(-6))
    .join(", "),
)

const messages = run(events)
console.log(
  `\n=== what the interface ends up holding: ${messages.length} bubbles ===`,
)
for (const message of messages) {
  console.log(
    `- role=${message.role} id=${message.id.slice(-6)} status=${message.status}`,
  )
  console.log(`    content: ${JSON.stringify(message.content.slice(0, 60))}`)
  console.log(
    `    thinking: ${message.thinking?.length ?? 0} chars — ${JSON.stringify(
      (message.thinking ?? "").slice(0, 90),
    )}`,
  )
}

// How the timeline is presented: one block per reply.
const { groupIntoTurns, turnText, turnThinking } = await import(
  "@/features/chat/state/chat-turns"
)
const turns = groupIntoTurns(messages)
console.log(`\n=== presented as ${turns.length} blocks ===`)
turns.forEach((turn, index) => {
  const who = turn.isUser ? "user" : "agent"
  console.log(
    `- block ${index} (${who}): ${turn.messages.length} message(s)` +
      ` thinking=${turnThinking(turn.messages).length} chars` +
      ` text=${JSON.stringify(turnText(turn.messages).slice(0, 60))}`,
  )
})
