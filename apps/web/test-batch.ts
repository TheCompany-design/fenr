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
  prompt = "Say hello in one word.",
) {
  process.stdout.write(`Testing [${model}]... `)
  try {
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
    let errCode = ""

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
            errCode = p.data?.code ?? "error"
          }
        } catch {}
      }
    }

    if (success) {
      console.log(`✅ SUCCESS! Response: "${text.trim()}"`)
      return true
    } else {
      console.log(`❌ FAILED (${errCode})`)
      return false
    }
  } catch (e: any) {
    console.log(`❌ ERROR (${e.message})`)
    return false
  }
}

// 1. OpenRouter
console.log("=== BATCH TESTING OPENROUTER ===")
const orList = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "recursive/flint-v1.0:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3.5-content-safety:free",
]
for (const m of orList) {
  if (await testModel("01a17b54-ad5b-7f29-8fcc-872f13a7ec88", m)) break
}

// 2. NVIDIA NIM
console.log("\n=== BATCH TESTING NVIDIA NIM ===")
const nvList = [
  "nvidia/llama-3.1-nemotron-51b-instruct",
  "nvidia/nemotron-4-340b-instruct",
  "01-ai/yi-large",
  "microsoft/phi-3.5-moe-instruct",
  "moonshotai/kimi-k2.6",
  "minimaxai/minimax-m3.1-flash",
  "writer/palmyra-creative-122b",
  "aisingapore/sea-lion-7b-instruct",
  "google/gemma-3-12b-it",
  "google/gemma-3-4b-it",
]
for (const m of nvList) {
  if (await testModel("01a13b2b-9d88-78d0-a8f4-764ea0f5143e", m)) break
}
