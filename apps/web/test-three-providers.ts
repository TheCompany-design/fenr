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

async function runTurn(
  name: string,
  providerConfigId: string,
  model: string,
  prompt: string,
) {
  console.log(`\n======================================================`)
  console.log(`TESTING: ${name}`)
  console.log(`Provider Config ID: ${providerConfigId}`)
  console.log(`Model: ${model}`)
  console.log(`Prompt: "${prompt}"`)
  console.log(`======================================================`)

  const response = await fetch(`${runtimeUrl}/api/v1/threads/turns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      provider_config_id: providerConfigId,
      model,
      prompt,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`FAILED to start turn: HTTP ${response.status}: ${errorText}`)
    return { success: false, error: `HTTP ${response.status}: ${errorText}` }
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  const events: string[] = []
  let turnStatus = "unknown"
  let failureReason: any = null

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
        const payload = JSON.parse(raw)
        const eventType = payload.type
        events.push(eventType)

        if (eventType === "turn_started") {
          console.log(
            `  -> turn_started: thread=${payload.data.thread_id} turn=${payload.data.turn_id}`,
          )
        } else if (eventType === "model_call_started") {
          console.log(`  -> model_call_started (step ${payload.data.step})`)
        } else if (eventType === "tool_call_started") {
          console.log(
            `  -> tool_call_started: tool=${payload.data.name} id=${payload.data.call_id}`,
          )
        } else if (eventType === "tool_call_completed") {
          console.log(`  -> tool_call_completed: tool=${payload.data.name}`)
        } else if (eventType === "content_fragment") {
          fullContent += payload.data.fragment
        } else if (eventType === "turn_completed") {
          turnStatus = "completed"
          console.log(
            `  -> turn_completed! usage=in:${payload.data.usage?.input_tokens ?? "?"}/out:${payload.data.usage?.output_tokens ?? "?"}`,
          )
        } else if (eventType === "turn_failed") {
          turnStatus = "failed"
          failureReason = payload.data
          console.error(`  -> turn_failed:`, payload.data)
        }
      } catch (e) {
        console.error("  Parse error on raw line:", raw)
      }
    }
  }

  console.log(`Result Status: ${turnStatus}`)
  console.log(`Events seen: [${events.join(", ")}]`)
  if (fullContent) {
    console.log(`Model Response Snippet: "${fullContent.slice(0, 160)}..."`)
  }
  return {
    success: turnStatus === "completed",
    fullContent,
    events,
    failureReason,
  }
}

// 1. Google Gemini 3.5 Flash Lite
const googleResult = await runTurn(
  "Google Gemini 3.5 Flash Lite",
  "01a13226-3b60-7d18-8aa4-0e9067296976",
  "gemini-3.5-flash-lite",
  "What is 34 * 12? Reply with just the number.",
)

// 2. Nvidia Llama 3.1 Nemotron 70B
const nvidiaResult = await runTurn(
  "NVIDIA Llama 3.1 Nemotron 70B",
  "01a13b2b-9d88-78d0-a8f4-764ea0f5143e",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "What is 34 * 12? Reply with just the number.",
)

// 3. OpenRouter Gemma 4 26B (Free)
const openrouterResult = await runTurn(
  "OpenRouter Gemma 4 26B (Free)",
  "01a17b54-ad5b-7f29-8fcc-872f13a7ec88",
  "google/gemma-4-26b-a4b-it:free",
  "What is 34 * 12? Reply with just the number.",
)

console.log("\n================ SUMMARY ================")
console.log(
  `Google Gemini 3.5 Flash Lite: ${googleResult.success ? "PASS" : "FAIL"}`,
)
console.log(`NVIDIA Nemotron 70B: ${nvidiaResult.success ? "PASS" : "FAIL"}`)
console.log(
  `OpenRouter Gemma 4 (Free): ${openrouterResult.success ? "PASS" : "FAIL"}`,
)
