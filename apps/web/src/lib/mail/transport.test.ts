import { afterEach, describe, expect, it, mock } from "bun:test"
import type { Transporter } from "nodemailer"
import type SMTPPool from "nodemailer/lib/smtp-pool"
import type { ServerEnv } from "../env"
import {
  closeMailTransport,
  createMailTransport,
  getMailTransport,
  setMailTransport,
} from "./transport"

describe("Mail Transport", () => {
  afterEach(() => {
    closeMailTransport()
  })

  const baseEnv: ServerEnv = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/fenr",
    BETTER_AUTH_SECRET: "mock-secret-key-that-is-at-least-32-chars-long",
    BETTER_AUTH_URL: "http://localhost:3000",
    LOG_LEVEL: "info",
    EMAIL_FROM: "Fenr <no-reply@fenr.app>",
    SMTP_MAILER: "smtp",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: 587,
    SMTP_USER: "smtp-user",
    SMTP_PASSWORD: "smtp-password",
    SMTP_ENCRYPTION: undefined,
  }

  it("configures standard port 587 with requireTLS: true and secure: false by default", () => {
    const transport = createMailTransport(baseEnv)
    const options = (transport as unknown as { options: SMTPPool.Options })
      .options

    expect(options.host).toBe("smtp.example.com")
    expect(options.port).toBe(587)
    expect(options.secure).toBe(false)
    expect(options.requireTLS).toBe(true)
    expect(options.pool).toBe(true)
    expect(options.maxConnections).toBe(5)
    expect(options.connectionTimeout).toBe(10000)
    expect(options.greetingTimeout).toBe(10000)
    expect(options.socketTimeout).toBe(15000)
  })

  it("configures port 465 with secure: true (implicit TLS) by default", () => {
    const transport = createMailTransport({
      ...baseEnv,
      SMTP_PORT: 465,
      SMTP_ENCRYPTION: undefined,
    })
    const options = (transport as unknown as { options: SMTPPool.Options })
      .options

    expect(options.port).toBe(465)
    expect(options.secure).toBe(true)
    expect(options.requireTLS).toBeUndefined()
  })

  it("configures port 465 with secure: true even if SMTP_ENCRYPTION is tls", () => {
    const transport = createMailTransport({
      ...baseEnv,
      SMTP_PORT: 465,
      SMTP_ENCRYPTION: "tls",
    })
    const options = (transport as unknown as { options: SMTPPool.Options })
      .options

    expect(options.port).toBe(465)
    expect(options.secure).toBe(true)
  })

  it("configures explicit ssl encryption with secure: true regardless of port", () => {
    const transport = createMailTransport({
      ...baseEnv,
      SMTP_PORT: 8465,
      SMTP_ENCRYPTION: "ssl",
    })
    const options = (transport as unknown as { options: SMTPPool.Options })
      .options

    expect(options.secure).toBe(true)
  })

  it("configures none encryption with ignoreTLS: true and secure: false", () => {
    const transport = createMailTransport({
      ...baseEnv,
      SMTP_PORT: 1025,
      SMTP_ENCRYPTION: "none",
    })
    const options = (transport as unknown as { options: SMTPPool.Options })
      .options

    expect(options.secure).toBe(false)
    expect(options.ignoreTLS).toBe(true)
    expect(options.requireTLS).toBeUndefined()
  })

  it("manages singleton caching and teardown properly", () => {
    const t1 = getMailTransport()
    const t2 = getMailTransport()
    expect(t1).toBe(t2)

    let closed = false
    const mockTransporter = {
      close: mock(() => {
        closed = true
      }),
    } as unknown as Transporter<SMTPPool.SentMessageInfo>

    setMailTransport(mockTransporter)
    expect(getMailTransport()).toBe(mockTransporter)

    closeMailTransport()
    expect(closed).toBe(true)

    // After closeMailTransport, next getMailTransport creates a fresh instance
    const t3 = getMailTransport()
    expect(t3).not.toBe(mockTransporter)
  })
})
