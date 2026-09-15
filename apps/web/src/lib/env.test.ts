import { describe, expect, it } from "bun:test"

import { parseServerEnv } from "./env"

describe("Server Environment Validation (SMTP & Mailer)", () => {
  const baseValidEnv = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/fenr",
    BETTER_AUTH_SECRET: "12345678901234567890123456789012",
    BETTER_AUTH_URL: "http://localhost:3000",
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "user@example.com",
    SMTP_PASSWORD: "secret-password",
  }

  it("validates a fully populated valid configuration", () => {
    const result = parseServerEnv({
      ...baseValidEnv,
      EMAIL_FROM: "Custom Sender <custom@example.com>",
      SMTP_MAILER: "smtp",
      SMTP_PORT: 465,
      SMTP_ENCRYPTION: "ssl",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.EMAIL_FROM).toBe("Custom Sender <custom@example.com>")
      expect(result.data.SMTP_MAILER).toBe("smtp")
      expect(result.data.SMTP_PORT).toBe(465)
      expect(result.data.SMTP_ENCRYPTION).toBe("ssl")
      expect(result.data.SMTP_HOST).toBe("smtp.example.com")
      expect(result.data.SMTP_USER).toBe("user@example.com")
      expect(result.data.SMTP_PASSWORD).toBe("secret-password")
    }
  })

  it("applies defaults for EMAIL_FROM, SMTP_MAILER, and SMTP_PORT when omitted", () => {
    const result = parseServerEnv({
      ...baseValidEnv,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.EMAIL_FROM).toBe("Fenr <no-reply@fenr.app>")
      expect(result.data.SMTP_MAILER).toBe("smtp")
      expect(result.data.SMTP_PORT).toBe(587)
      expect(result.data.SMTP_ENCRYPTION).toBeUndefined()
    }
  })

  it("coerces string port to integer number", () => {
    const result = parseServerEnv({
      ...baseValidEnv,
      SMTP_PORT: "2525",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.SMTP_PORT).toBe(2525)
      expect(typeof result.data.SMTP_PORT).toBe("number")
    }
  })

  it("fails when SMTP_HOST is missing or empty", () => {
    const missingHost = parseServerEnv({
      ...baseValidEnv,
      SMTP_HOST: undefined,
    })
    expect(missingHost.success).toBe(false)

    const emptyHost = parseServerEnv({
      ...baseValidEnv,
      SMTP_HOST: "",
    })
    expect(emptyHost.success).toBe(false)
  })

  it("fails when SMTP_USER is missing or empty", () => {
    const missingUser = parseServerEnv({
      ...baseValidEnv,
      SMTP_USER: undefined,
    })
    expect(missingUser.success).toBe(false)

    const emptyUser = parseServerEnv({
      ...baseValidEnv,
      SMTP_USER: "",
    })
    expect(emptyUser.success).toBe(false)
  })

  it("fails when SMTP_PASSWORD is missing or empty", () => {
    const missingPassword = parseServerEnv({
      ...baseValidEnv,
      SMTP_PASSWORD: undefined,
    })
    expect(missingPassword.success).toBe(false)

    const emptyPassword = parseServerEnv({
      ...baseValidEnv,
      SMTP_PASSWORD: "",
    })
    expect(emptyPassword.success).toBe(false)
  })

  it("does not accept misspelled SMTP_ENCTYPTION as SMTP_ENCRYPTION", () => {
    const result = parseServerEnv({
      ...baseValidEnv,
      SMTP_ENCTYPTION: "tls",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.SMTP_ENCRYPTION).toBeUndefined()
    }
  })

  it("treats empty string encryption as undefined optional", () => {
    const result = parseServerEnv({
      ...baseValidEnv,
      SMTP_ENCRYPTION: "",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.SMTP_ENCRYPTION).toBeUndefined()
    }
  })

  it("accepts all valid encryption enum values", () => {
    const validModes = ["tls", "ssl", "starttls", "none"] as const

    for (const mode of validModes) {
      const res = parseServerEnv({
        ...baseValidEnv,
        SMTP_ENCRYPTION: mode,
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.SMTP_ENCRYPTION).toBe(mode)
      }
    }
  })

  it("rejects invalid encryption enum values", () => {
    const result = parseServerEnv({
      ...baseValidEnv,
      SMTP_ENCRYPTION: "invalid-cipher",
    })

    expect(result.success).toBe(false)
  })

  it("rejects non-positive or float port values", () => {
    const negativePort = parseServerEnv({
      ...baseValidEnv,
      SMTP_PORT: -1,
    })
    expect(negativePort.success).toBe(false)

    const zeroPort = parseServerEnv({
      ...baseValidEnv,
      SMTP_PORT: 0,
    })
    expect(zeroPort.success).toBe(false)

    const floatPort = parseServerEnv({
      ...baseValidEnv,
      SMTP_PORT: 587.5,
    })
    expect(floatPort.success).toBe(false)
  })
})
