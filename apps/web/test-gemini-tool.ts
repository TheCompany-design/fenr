import { db, schema } from "@workspace/database"
import { auth } from "./src/lib/auth"

const [user] = await db.select().from(schema.user).limit(1)
const [org] = await db.select().from(schema.organization).limit(1)

const signed = await auth.api.signJWT({
  body: {
    payload: {
      sub: user.id,
      email: user.email,
      activeOrganizationId: org.id,
      role: "owner",
    },
    overrideOptions: { jwt: { audience: "nabu" } },
  },
})

const token = signed.token
const runtimeUrl = "http://localhost:5050"

console.log(
  "Testing Google Gemini 3.5 Flash Lite WITH TOOL CALL (web_search)...",
)

const response = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  },
  body: JSON.stringify({
    provider_config_id: "01a13226-3b60-7d18-8aa4-0e9067296976",
    model: "gemini-3.5-flash-lite",
    prompt:
      "Use web_search to find what the current population of Tokyo is. Return the number.",
  }),
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()
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
    try {
      const p = JSON.parse(raw)
      console.log(
        `Event [${p.type}]`,
        p.data ? JSON.stringify(p.data).slice(0, 120) : "",
      )
    } catch {}
  }
}
