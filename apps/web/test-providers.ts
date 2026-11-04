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

const provRes = await fetch("http://localhost:5050/api/v1/providers", {
  headers: { Authorization: `Bearer ${token}` },
})
const provs = await provRes.json()
console.log(
  "Providers found:",
  provs.providers.map((p: any) => ({ id: p.id, provider: p.provider })),
)

for (const p of provs.providers) {
  const mRes = await fetch(
    `http://localhost:5050/api/v1/providers/${p.id}/models`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  const models = await mRes.json()
  const modelList = Array.isArray(models)
    ? models
    : (models.models ?? models.items ?? [])
  console.log(
    `\n=== Provider: ${p.provider} (${p.id}) has ${modelList.length} models ===`,
  )
  const freeOrCheap = modelList.filter(
    (m: any) =>
      m.id.toLowerCase().includes("free") ||
      m.id.toLowerCase().includes("flash") ||
      m.id.toLowerCase().includes("lite") ||
      m.id.toLowerCase().includes("llama") ||
      m.pricing?.input_cost_per_million === 0,
  )
  console.log(
    "Sample models:",
    (freeOrCheap.length > 0 ? freeOrCheap : modelList)
      .slice(0, 10)
      .map((m: any) => m.id),
  )
}
