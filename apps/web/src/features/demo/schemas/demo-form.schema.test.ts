import { describe, expect, test } from "bun:test"
import { demoFormSchema } from "./demo-form.schema"

describe("demo form schema (zod)", () => {
  test("accepts a valid payload", () => {
    const parsed = demoFormSchema.safeParse({
      name: "Fenr",
      email: "hello@fenr.dev",
      message: "This message is long enough.",
    })
    expect(parsed.success).toBe(true)
  })

  test("rejects a short name and bad email", () => {
    const parsed = demoFormSchema.safeParse({
      name: "F",
      email: "nope",
      message: "short",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.length).toBeGreaterThanOrEqual(3)
    }
  })
})
