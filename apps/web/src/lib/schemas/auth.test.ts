import { describe, expect, test } from "bun:test"

import { signInSchema, signUpSchema } from "./auth"

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
  test("accepts a valid payload", () => {
    const parsed = signUpSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse battery",
    })
    expect(parsed.success).toBe(true)
  })

  test("trims surrounding whitespace from the name", () => {
    const parsed = signUpSchema.parse({
      name: "  Ada  ",
      email: "ada@example.com",
      password: "correct horse battery",
    })
    expect(parsed.name).toBe("Ada")
  })

  test("rejects a password shorter than the Better Auth minimum (8)", () => {
    const parsed = signUpSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "short12",
    })
    expect(parsed.success).toBe(false)
  })

  test("rejects a one-character name", () => {
    const parsed = signUpSchema.safeParse({
      name: "A",
      email: "ada@example.com",
      password: "correct horse battery",
    })
    expect(parsed.success).toBe(false)
  })
})
