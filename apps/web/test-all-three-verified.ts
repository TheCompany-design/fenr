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

interface ProviderTest {
  name: string
  providerId: string
  model: string
  prompt: string
}

const tests: ProviderTest[] = [
  {
    name: "Google (gemini-3.5-flash-lite)",
    providerId: "01a13226-3b60-7d18-8aa4-0e9067296976",
    model: "gemini-3.5-flash-lite",
    prompt: "What is 100 - 43? Reply with only the number.",
  },
  {
    name: "NVIDIA (nvidia/nemotron-3.5-lightning-30b-a3b)",
    providerId: "01a13b2b-9d88-78d0-a8f4-764ea0f5143e",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    prompt: "What is 7 * 8? Reply with only the number.",
  },
  {
    name: "OpenRouter (deepseek/deepseek-chat)",
    providerId: "01a17b54-ad5b-7f29-8fcc-872f13a7ec88",
    model: "deepseek/deepseek-chat",
    prompt: "What is 12 + 15? Reply with only the number.",
  },
]

console.log("==================================================")
console.log("   VERIFYING ALL 3 CONFIGURED PROVIDERS IN NABU   ")
console.log("==================================================")

for (const t of tests) {
  process.stdout.write(`\nTesting ${t.name}... `)
  const res = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      provider_config_id: t.providerId,
      model: t.model,
      prompt: t.prompt,
    }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let text = ""
  let completed = false
  let errorMsg = ""

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
        if (
          p.type === "item_completed" &&
          p.data?.payload?.kind === "agent_message"
        ) {
          text = p.data.payload.text
        }
        if (p.type === "turn_completed" && p.data?.status === "completed") {
          completed = true
        }
        if (p.type === "stream_error") {
          errorMsg = p.data?.code ?? "unknown error"
        }
      } catch {}
    }
  }

  if (completed) {
    console.log(`✅ PASSED!`)
    console.log(`   Model Answer: "${text.trim()}"`)
  } else {
    console.log(`❌ FAILED! (Error: ${errorMsg})`)
  }
}
console.log("\n==================================================")
