import { describe, expect, test } from "bun:test"

import { emailSchema, magicLinkSchema } from "./auth.schema"

describe("emailSchema", () => {
  test("accepts a valid email", () => {
    const parsed = emailSchema.safeParse("user@example.com")
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toBe("user@example.com")
    }
  })

  test("trims whitespace", () => {
    const parsed = emailSchema.safeParse("  user@example.com  ")
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toBe("user@example.com")
    }
  })

  test("rejects an invalid email format", () => {
    const parsed = emailSchema.safeParse("not-an-email")
    expect(parsed.success).toBe(false)
  })
})

describe("magicLinkSchema", () => {
  test("accepts a valid email payload", () => {
    const parsed = magicLinkSchema.safeParse({
      email: "ada@example.com",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.email).toBe("ada@example.com")
    }
  })

  test("trims whitespace from valid email", () => {
    const parsed = magicLinkSchema.safeParse({
      email: "  ada@example.com  ",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.email).toBe("ada@example.com")
    }
  })

  test("rejects an invalid email address", () => {
    const parsed = magicLinkSchema.safeParse({ email: "invalid-email" })
    expect(parsed.success).toBe(false)
  })

  test("rejects an empty email address", () => {
    const parsed = magicLinkSchema.safeParse({ email: "" })
    expect(parsed.success).toBe(false)
  })

  test("rejects an excessively long email address", () => {
    const longEmail = `${"a".repeat(250)}@example.com`
    const parsed = magicLinkSchema.safeParse({ email: longEmail })
    expect(parsed.success).toBe(false)
  })
})
