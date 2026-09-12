import { describe, expect, test } from "bun:test"

import { magicLinkSchema, signInSchema, signUpSchema } from "./auth.schema"

const strongPassword = "Correct-Horse-42!"

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

describe("signInSchema", () => {
  test("accepts a valid payload", () => {
    const parsed = signInSchema.safeParse({
      email: "ada@example.com",
      password: "hunter2hunter2",
    })
    expect(parsed.success).toBe(true)
  })

  test("rejects an invalid email", () => {
    const parsed = signInSchema.safeParse({ email: "nope", password: "x" })
    expect(parsed.success).toBe(false)
  })

  test("rejects an empty password", () => {
    const parsed = signInSchema.safeParse({
      email: "ada@example.com",
      password: "",
    })
    expect(parsed.success).toBe(false)
  })
})

describe("signUpSchema", () => {
  const validBase = () => ({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: strongPassword,
    confirmPassword: strongPassword,
  })

  test("accepts a valid payload with matching confirmation", () => {
    expect(signUpSchema.safeParse(validBase()).success).toBe(true)
  })

  test("trims surrounding whitespace from the name", () => {
    const parsed = signUpSchema.parse({ ...validBase(), name: "  Ada  " })
    expect(parsed.name).toBe("Ada")
  })

  test.each([
    ["short1!", "too short (under 8)"],
    ["alllowercase-1!", "no uppercase"],
    ["ALLUPPERCASE-1!", "no lowercase"],
    ["NoDigitsHere!!", "no number"],
    ["NoSpecial1234aA", "no special character"],
  ])("rejects %s (%s)", (password) => {
    const parsed = signUpSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password,
      confirmPassword: password,
    })
    expect(parsed.success).toBe(false)
  })

  test("rejects a one-character name", () => {
    const parsed = signUpSchema.safeParse({ ...validBase(), name: "A" })
    expect(parsed.success).toBe(false)
  })

  test("rejects a mismatched confirmation with the error on confirmPassword", () => {
    const parsed = signUpSchema.safeParse({
      ...validBase(),
      confirmPassword: "Different-99?",
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join("."))
      expect(paths).toContain("confirmPassword")
    }
  })

  test("rejects an empty confirmation", () => {
    const parsed = signUpSchema.safeParse({
      ...validBase(),
      confirmPassword: "",
    })
    expect(parsed.success).toBe(false)
  })
})
