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

async function testModel(
  providerId: string,
  model: string,
  prompt = "Hi, reply with pong",
) {
  console.log(`\nTesting ${model}...`)
  const response = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      provider_config_id: providerId,
      model,
      prompt,
    }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let success = false
  let text = ""

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
          success = true
        }
        if (p.type === "stream_error") {
          console.log(`  stream_error:`, p.data)
        }
      } catch {}
    }
  }

  console.log(
    `  -> Result: ${success ? "SUCCESS" : "FAILED"}. Output: "${text.trim()}"`,
  )
  return success
}

// OpenRouter free models
const orModels = [
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "thinkingmachines/inkling-small:free",
  "dots-studio/dots-3-note-preview:free",
  "cohere/north-mini-code:free",
]

console.log("=== TESTING OPENROUTER FREE MODELS ===")
for (const m of orModels) {
  const ok = await testModel("01a17b54-ad5b-7f29-8fcc-872f13a7ec88", m)
  if (ok) break
}

// NVIDIA models
const nvModels = [
  "mistralai/mistral-7b-instruct-v0.3",
  "ibm/granite-3.0-8b-instruct",
  "deepseek-ai/deepseek-v4.1-flash",
  "meta/llama2-70b",
]

console.log("\n=== TESTING NVIDIA MODELS ===")
for (const m of nvModels) {
  const ok = await testModel("01a13b2b-9d88-78d0-a8f4-764ea0f5143e", m)
  if (ok) break
}
