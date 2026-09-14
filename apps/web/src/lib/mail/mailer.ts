/**
 * High-level mailer service for Fenr.
 *
 * SERVER-ONLY: handles rendering React Email templates and delivering messages
 * via Nodemailer with structured logging (Pino), masked recipient information,
 * multipart HTML + plain-text fallback, and strict input validation.
 */
import { render } from "@react-email/render"
import { createElement } from "react"

import {
  EmailVerifiedEmail,
  MagicLinkEmail,
  OrganizationInvitationEmail,
} from "../../emails"
import { serverEnv } from "../env"
import { moduleLogger } from "../logger"
import { getMailTransport } from "./transport"

const log = moduleLogger("mail")

export class MailDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "MailDeliveryError"
  }
}

/**
 * Mask an email address for safe operational logging without leaking PII.
 * Example: 'alice@example.com' -> 'a***e@example.com'
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return ""
  }
  const trimmed = email.trim()
  const atIndex = trimmed.lastIndexOf("@")
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return "***"
  }

  const local = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex + 1)

  if (local.length <= 1) {
    return `${local}***@${domain}`
  }

  if (local.length === 2) {
    return `${local[0]}*${local[1]}@${domain}`
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/**
 * Strictly validate a single recipient email address.
 * Rejects multi-recipient strings (commas/semicolons), CRLF injection, and malformed addresses.
 */
export function validateRecipientEmail(email: string): string {
  if (!email || typeof email !== "string") {
    throw new MailDeliveryError("Recipient email address is required")
  }
  const trimmed = email.trim()
  const atIndex = trimmed.lastIndexOf("@")
  const localPart = trimmed.slice(0, atIndex)
  if (
    atIndex <= 0 ||
    trimmed.includes(",") ||
    trimmed.includes(";") ||
    /[\r\n]/.test(trimmed) ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !EMAIL_REGEX.test(trimmed)
  ) {
    throw new MailDeliveryError(
      `Invalid recipient email address format: ${maskEmail(trimmed)}`,
    )
  }
  return trimmed
}

/**
 * Validate that an action URL is well-formed and uses a safe HTTP(S) protocol.
 */
export function validateActionUrl(
  url: string,
  fieldName = "Action URL",
): string {
  if (!url || typeof url !== "string") {
    throw new MailDeliveryError(`${fieldName} is required`)
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new MailDeliveryError(
        `${fieldName} must use http or https protocol`,
      )
    }
    return parsed.toString()
  } catch (error) {
    if (error instanceof MailDeliveryError) {
      throw error
    }
    throw new MailDeliveryError(`Invalid URL provided for ${fieldName}`, {
      cause: error,
    })
  }
}

export interface SendMagicLinkEmailOptions {
  to: string
  url: string
  token?: string
  expiresInMinutes?: number
  correlationId?: string
}

export async function sendMagicLinkEmail({
  to,
  url,
  token: _token,
  expiresInMinutes = 10,
  correlationId,
}: SendMagicLinkEmailOptions): Promise<{ messageId: string }> {
  if (
    typeof expiresInMinutes !== "number" ||
    !Number.isFinite(expiresInMinutes) ||
    expiresInMinutes <= 0
  ) {
    throw new MailDeliveryError(
      "expiresInMinutes must be a positive finite number",
    )
  }
  const recipient = validateRecipientEmail(to)
  const actionUrl = validateActionUrl(url, "Magic link URL")
  const masked = maskEmail(recipient)
  const start = performance.now()

  try {
    const [html, text] = await Promise.all([
      render(
        createElement(MagicLinkEmail, {
          url: actionUrl,
          email: recipient,
          expiresInMinutes,
        }),
      ),
      render(
        createElement(MagicLinkEmail, {
          url: actionUrl,
          email: recipient,
          expiresInMinutes,
        }),
        { plainText: true },
      ),
    ])

    const transport = getMailTransport()
    const result = await transport.sendMail({
      from: serverEnv.EMAIL_FROM,
      to: recipient,
      subject: "Sign in to Fenr",
      html,
      text,
    })

    const durationMs = Math.round(performance.now() - start)
    log.info(
      {
        recipient: masked,
        messageId: result.messageId,
        durationMs,
        correlationId,
      },
      "Magic link email sent successfully",
    )

    return { messageId: result.messageId }
  } catch (error) {
    const durationMs = Math.round(performance.now() - start)
    log.error(
      {
        err: error,
        recipient: masked,
        durationMs,
        correlationId,
      },
      "Failed to send magic link email",
    )
    if (error instanceof MailDeliveryError) {
      throw error
    }
    throw new MailDeliveryError(
      `Failed to send magic link email to ${masked}`,
      { cause: error },
    )
  }
}

export interface SendOrganizationInvitationEmailOptions {
  to: string
  organizationName: string
  inviterName: string
  role: string
  acceptUrl: string
  expiresInHours?: number
  personalNote?: string
  correlationId?: string
}

export async function sendOrganizationInvitationEmail({
  to,
  organizationName,
  inviterName,
  role,
  acceptUrl,
  expiresInHours = 48,
  personalNote,
  correlationId,
}: SendOrganizationInvitationEmailOptions): Promise<{ messageId: string }> {
  if (
    typeof expiresInHours !== "number" ||
    !Number.isFinite(expiresInHours) ||
    expiresInHours <= 0
  ) {
    throw new MailDeliveryError(
      "expiresInHours must be a positive finite number",
    )
  }
  const recipient = validateRecipientEmail(to)
  const url = validateActionUrl(acceptUrl, "Invitation accept URL")
  const masked = maskEmail(recipient)
  const start = performance.now()

  // Sanitize user-provided values to prevent CRLF injection in SMTP headers and formatting issues
  const safeOrgName =
    organizationName.replace(/[\r\n]+/g, " ").trim() || "an organization"
  const safeInviterName =
    inviterName.replace(/[\r\n]+/g, " ").trim() || "Someone"
  const safeRole = role.replace(/[\r\n]+/g, " ").trim() || "member"
  const safePersonalNote = personalNote
    ?.replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 2000)

  try {
    const [html, text] = await Promise.all([
      render(
        createElement(OrganizationInvitationEmail, {
          organizationName: safeOrgName,
          inviterName: safeInviterName,
          role: safeRole,
          acceptUrl: url,
          expiresInHours,
          personalNote: safePersonalNote,
        }),
      ),
      render(
        createElement(OrganizationInvitationEmail, {
          organizationName: safeOrgName,
          inviterName: safeInviterName,
          role: safeRole,
          acceptUrl: url,
          expiresInHours,
          personalNote: safePersonalNote,
        }),
        { plainText: true },
      ),
    ])

    const transport = getMailTransport()
    const result = await transport.sendMail({
      from: serverEnv.EMAIL_FROM,
      to: recipient,
      subject: `You've been invited to join ${safeOrgName} on Fenr`,
      html,
      text,
    })

    const durationMs = Math.round(performance.now() - start)
    log.info(
      {
        recipient: masked,
        organizationName: safeOrgName,
        messageId: result.messageId,
        durationMs,
        correlationId,
      },
      "Organization invitation email sent successfully",
    )

    return { messageId: result.messageId }
  } catch (error) {
    const durationMs = Math.round(performance.now() - start)
    log.error(
      {
        err: error,
        recipient: masked,
        organizationName: safeOrgName,
        durationMs,
        correlationId,
      },
      "Failed to send organization invitation email",
    )
    if (error instanceof MailDeliveryError) {
      throw error
    }
    throw new MailDeliveryError(
      `Failed to send organization invitation email to ${masked}`,
      { cause: error },
    )
  }
}

export interface SendEmailVerifiedEmailOptions {
  to: string
  appName?: string
  correlationId?: string
}

export async function sendEmailVerifiedEmail({
  to,
  appName = "Fenr",
  correlationId,
}: SendEmailVerifiedEmailOptions): Promise<{ messageId: string }> {
  const recipient = validateRecipientEmail(to)
  const masked = maskEmail(recipient)
  const safeAppName = appName.replace(/[\r\n]+/g, " ").trim() || "Fenr"
  const start = performance.now()

  try {
    const [html, text] = await Promise.all([
      render(
        createElement(EmailVerifiedEmail, {
          email: recipient,
          appName: safeAppName,
        }),
      ),
      render(
        createElement(EmailVerifiedEmail, {
          email: recipient,
          appName: safeAppName,
        }),
        { plainText: true },
      ),
    ])

    const transport = getMailTransport()
    const result = await transport.sendMail({
      from: serverEnv.EMAIL_FROM,
      to: recipient,
      subject: `Your ${safeAppName} email has been verified`,
      html,
      text,
    })

    const durationMs = Math.round(performance.now() - start)
    log.info(
      {
        recipient: masked,
        messageId: result.messageId,
        durationMs,
        correlationId,
      },
      "Email verified confirmation sent successfully",
    )

    return { messageId: result.messageId }
  } catch (error) {
    const durationMs = Math.round(performance.now() - start)
    log.error(
      {
        err: error,
        recipient: masked,
        durationMs,
        correlationId,
      },
      "Failed to send email verified confirmation",
    )
    if (error instanceof MailDeliveryError) {
      throw error
    }
    throw new MailDeliveryError(
      `Failed to send email verified confirmation to ${masked}`,
      { cause: error },
    )
  }
}
