/**
 * Mail transport singleton and factory using Nodemailer and serverEnv.
 *
 * SERVER-ONLY: provides SMTP transport configured from validated server environment.
 */
import nodemailer, { type Transporter } from "nodemailer"
import type SMTPPool from "nodemailer/lib/smtp-pool"

import { type ServerEnv, serverEnv } from "../env"

let cachedTransporter: Transporter<SMTPPool.SentMessageInfo> | null = null

export function createMailTransport(
  env: ServerEnv = serverEnv,
): Transporter<SMTPPool.SentMessageInfo> {
  const isSsl =
    env.SMTP_ENCRYPTION === "ssl" ||
    (env.SMTP_PORT === 465 && env.SMTP_ENCRYPTION !== "none")
  const isStarttls =
    !isSsl &&
    env.SMTP_ENCRYPTION !== "none" &&
    (env.SMTP_ENCRYPTION === "starttls" ||
      env.SMTP_ENCRYPTION === "tls" ||
      (!env.SMTP_ENCRYPTION && env.SMTP_PORT === 587))
  const isNone = env.SMTP_ENCRYPTION === "none"

  const transportOptions: SMTPPool.Options = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: isSsl,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    pool: true,
    maxConnections: 5,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    ...(isStarttls ? { requireTLS: true } : {}),
    ...(isNone ? { ignoreTLS: true } : {}),
  }

  return nodemailer.createTransport(transportOptions)
}

export function getMailTransport(): Transporter<SMTPPool.SentMessageInfo> {
  if (!cachedTransporter) {
    cachedTransporter = createMailTransport()
  }
  return cachedTransporter
}

export function setMailTransport(
  transporter: Transporter<SMTPPool.SentMessageInfo> | null,
): void {
  if (cachedTransporter && cachedTransporter !== transporter) {
    try {
      cachedTransporter.close()
    } catch {
      // Ignore errors when closing old transporter
    }
  }
  cachedTransporter = transporter
}

export function closeMailTransport(): void {
  if (cachedTransporter) {
    try {
      cachedTransporter.close()
    } catch {
      // Ignore errors when closing transporter
    } finally {
      cachedTransporter = null
    }
  }
}
