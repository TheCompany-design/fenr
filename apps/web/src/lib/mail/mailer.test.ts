import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import type { Transporter } from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"

import { serverEnv } from "../env"
import {
  MailDeliveryError,
  maskEmail,
  sendEmailVerifiedEmail,
  sendMagicLinkEmail,
  sendOrganizationInvitationEmail,
  validateActionUrl,
  validateRecipientEmail,
} from "./mailer"
import { closeMailTransport, setMailTransport } from "./transport"

describe("Mailer Service", () => {
  describe("maskEmail", () => {
    it("masks standard email addresses properly", () => {
      expect(maskEmail("user@example.com")).toBe("u***r@example.com")
      expect(maskEmail("alice.bob@company.org")).toBe("a***b@company.org")
      expect(maskEmail("waburimuchiri@gmail.com")).toBe("w***i@gmail.com")
    })

    it("handles single-character and two-character local parts", () => {
      expect(maskEmail("a@example.com")).toBe("a***@example.com")
      expect(maskEmail("ab@example.com")).toBe("a*b@example.com")
      expect(maskEmail("abc@example.com")).toBe("a***c@example.com")
    })

    it("handles emails with subdomains and tags", () => {
      expect(maskEmail("dev+test@mail.subdomain.co.uk")).toBe(
        "d***t@mail.subdomain.co.uk",
      )
    })

    it("handles invalid or edge-case input safely without throwing", () => {
      expect(maskEmail("")).toBe("")
      // @ts-expect-error - testing invalid types defensively
      expect(maskEmail(null)).toBe("")
      // @ts-expect-error - testing invalid types defensively
      expect(maskEmail(undefined)).toBe("")
      // @ts-expect-error - testing invalid types defensively
      expect(maskEmail(12345)).toBe("")
      expect(maskEmail("invalid-email")).toBe("***")
      expect(maskEmail("@domain.com")).toBe("***")
      expect(maskEmail("user@")).toBe("***")
      expect(maskEmail("   user@example.com   ")).toBe("u***r@example.com")
    })

    it("strips CRLF and control characters defensively from masked email", () => {
      expect(maskEmail("user@example.com\r\ninjected")).toBe(
        "u***r@example.cominjected",
      )
      expect(maskEmail("user\x00@example.com")).toBe("u***r@example.com")
    })
  })

  describe("validateRecipientEmail", () => {
    it("accepts valid email addresses and trims whitespace", () => {
      expect(validateRecipientEmail("user@example.com")).toBe(
        "user@example.com",
      )
      expect(validateRecipientEmail("  test+tag@domain.co.uk  ")).toBe(
        "test+tag@domain.co.uk",
      )
    })

    it("rejects missing, empty, or non-string inputs", () => {
      expect(() => validateRecipientEmail("")).toThrow(MailDeliveryError)
      // @ts-expect-error - testing invalid type
      expect(() => validateRecipientEmail(null)).toThrow(MailDeliveryError)
      // @ts-expect-error - testing invalid type
      expect(() => validateRecipientEmail(undefined)).toThrow(MailDeliveryError)
    })

    it("rejects multiple comma/semicolon-separated recipients", () => {
      expect(() =>
        validateRecipientEmail("alice@example.com, bob@example.com"),
      ).toThrow(MailDeliveryError)
      expect(() =>
        validateRecipientEmail("alice@example.com; bob@example.com"),
      ).toThrow(MailDeliveryError)
    })

    it("rejects invalid dot-atom recipient email addresses", () => {
      expect(() => validateRecipientEmail(".alice@example.com")).toThrow(
        MailDeliveryError,
      )
      expect(() => validateRecipientEmail("alice.@example.com")).toThrow(
        MailDeliveryError,
      )
      expect(() => validateRecipientEmail("alice..smith@example.com")).toThrow(
        MailDeliveryError,
      )
    })

    it("rejects CRLF injection in recipient email", () => {
      expect(() =>
        validateRecipientEmail("alice@example.com\r\nBcc: evil@attacker.com"),
      ).toThrow(MailDeliveryError)
    })
  })

  describe("validateActionUrl", () => {
    it("accepts valid http and https URLs", () => {
      expect(validateActionUrl("https://fenr.app/auth/verify?token=abc")).toBe(
        "https://fenr.app/auth/verify?token=abc",
      )
      expect(validateActionUrl("http://localhost:3000/login")).toBe(
        "http://localhost:3000/login",
      )
    })

    it("rejects invalid or unsafe URL protocols (javascript, data, file)", () => {
      expect(() => validateActionUrl("javascript:alert(1)")).toThrow(
        MailDeliveryError,
      )
      expect(() =>
        validateActionUrl("data:text/html;base64,PHNjcmlwdD4="),
      ).toThrow(MailDeliveryError)
      expect(() => validateActionUrl("file:///etc/passwd")).toThrow(
        MailDeliveryError,
      )
    })

    it("rejects empty or malformed strings", () => {
      expect(() => validateActionUrl("")).toThrow(MailDeliveryError)
      expect(() => validateActionUrl("not-a-url")).toThrow(MailDeliveryError)
    })
  })

  describe("Email Delivery Functions", () => {
    let mockSendMail: ReturnType<typeof mock>

    beforeEach(() => {
      mockSendMail = mock(async () => {
        return {
          messageId: "<mock-msg-1234@fenr.app>",
        }
      })

      const mockTransporter = {
        sendMail: mockSendMail,
        close: mock(() => {}),
      } as unknown as Transporter<SMTPTransport.SentMessageInfo>

      setMailTransport(mockTransporter)
    })

    afterEach(() => {
      closeMailTransport()
    })

    describe("sendMagicLinkEmail", () => {
      it("sends magic link email with HTML and multipart plain text", async () => {
        const to = "recipient@example.com"
        const url = "https://fenr.app/auth/verify?token=secret-token-123"
        const token = "secret-token-123"

        const result = await sendMagicLinkEmail({
          to,
          url,
          token,
          expiresInMinutes: 15,
          correlationId: "req-123",
        })

        expect(result).toEqual({ messageId: "<mock-msg-1234@fenr.app>" })
        expect(mockSendMail).toHaveBeenCalledTimes(1)

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.from).toBe(serverEnv.EMAIL_FROM)
        expect(callArgs.to).toBe(to)
        expect(callArgs.subject).toBe("Sign in to Fenr")

        // Verifies both html and plaintext fallback exist
        expect(typeof callArgs.html).toBe("string")
        expect(callArgs.html).toContain(url)
        expect(callArgs.html).toContain("Fenr")
        expect(callArgs.html).toContain("Sign in to Fenr")
        expect(callArgs.html).toContain("15 minutes")

        expect(typeof callArgs.text).toBe("string")
        expect(callArgs.text).toContain(url)
        expect(callArgs.text).toContain("Fenr")
      })

      it("rejects invalid email address before attempting transport", async () => {
        await expect(
          sendMagicLinkEmail({
            to: "not-an-email",
            url: "https://fenr.app/auth/verify",
          }),
        ).rejects.toThrow(MailDeliveryError)

        expect(mockSendMail).toHaveBeenCalledTimes(0)
      })

      it("rejects non-positive or non-finite expiresInMinutes", async () => {
        await expect(
          sendMagicLinkEmail({
            to: "user@example.com",
            url: "https://fenr.app/auth/verify",
            expiresInMinutes: 0,
          }),
        ).rejects.toThrow("expiresInMinutes must be a positive finite number")

        await expect(
          sendMagicLinkEmail({
            to: "user@example.com",
            url: "https://fenr.app/auth/verify",
            expiresInMinutes: -5,
          }),
        ).rejects.toThrow("expiresInMinutes must be a positive finite number")

        await expect(
          sendMagicLinkEmail({
            to: "user@example.com",
            url: "https://fenr.app/auth/verify",
            expiresInMinutes: Number.NaN,
          }),
        ).rejects.toThrow("expiresInMinutes must be a positive finite number")

        await expect(
          sendMagicLinkEmail({
            to: "user@example.com",
            url: "https://fenr.app/auth/verify",
            expiresInMinutes: Number.POSITIVE_INFINITY,
          }),
        ).rejects.toThrow("expiresInMinutes must be a positive finite number")
      })

      it("throws MailDeliveryError with cause when transport fails", async () => {
        const failureError = new Error("SMTP connection timed out")
        mockSendMail = mock(async () => {
          throw failureError
        })
        setMailTransport({
          sendMail: mockSendMail,
          close: mock(() => {}),
        } as unknown as Transporter<SMTPTransport.SentMessageInfo>)

        await expect(
          sendMagicLinkEmail({
            to: "fail@example.com",
            url: "https://fenr.app/auth/verify?token=xyz",
          }),
        ).rejects.toThrow(MailDeliveryError)

        try {
          await sendMagicLinkEmail({
            to: "fail@example.com",
            url: "https://fenr.app/auth/verify?token=xyz",
          })
        } catch (err) {
          expect(err).toBeInstanceOf(MailDeliveryError)
          expect((err as MailDeliveryError).cause).toBe(failureError)
        }
      })
    })

    describe("sendOrganizationInvitationEmail", () => {
      it("sends invitation email with sanitized headers, HTML, and plain text", async () => {
        const to = "newhire@example.com"
        const organizationName = "Stark Enterprises\r\nBcc: evil@attacker.com"
        const inviterName = "Tony Stark\n"
        const role = "Admin"
        const acceptUrl = "https://fenr.app/invitations/accept?id=inv-456"

        const result = await sendOrganizationInvitationEmail({
          to,
          organizationName,
          inviterName,
          role,
          acceptUrl,
          expiresInHours: 72,
        })

        expect(result).toEqual({ messageId: "<mock-msg-1234@fenr.app>" })
        expect(mockSendMail).toHaveBeenCalledTimes(1)

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.from).toBe(serverEnv.EMAIL_FROM)
        expect(callArgs.to).toBe(to)

        // Subject should have CRLF stripped!
        expect(callArgs.subject).toBe(
          "You've been invited to join Stark Enterprises Bcc: evil@attacker.com on Fenr",
        )
        expect(callArgs.subject).not.toContain("\r")
        expect(callArgs.subject).not.toContain("\n")

        // HTML and plain text
        expect(callArgs.html).toContain("Stark Enterprises")
        expect(callArgs.html).toContain("Tony Stark")
        expect(callArgs.html).toContain(role)
        expect(callArgs.html).toContain(acceptUrl)
        expect(callArgs.html).toContain("72 hours")

        expect(typeof callArgs.text).toBe("string")
        expect(callArgs.text).toContain("Stark Enterprises")
        expect(callArgs.text).toContain(acceptUrl)
      })

      it("rejects non-positive or non-finite expiresInHours", async () => {
        await expect(
          sendOrganizationInvitationEmail({
            to: "newhire@example.com",
            organizationName: "Stark Enterprises",
            inviterName: "Tony Stark",
            role: "Admin",
            acceptUrl: "https://fenr.app/invitations/accept?id=inv-456",
            expiresInHours: 0,
          }),
        ).rejects.toThrow("expiresInHours must be a positive finite number")

        await expect(
          sendOrganizationInvitationEmail({
            to: "newhire@example.com",
            organizationName: "Stark Enterprises",
            inviterName: "Tony Stark",
            role: "Admin",
            acceptUrl: "https://fenr.app/invitations/accept?id=inv-456",
            expiresInHours: -1,
          }),
        ).rejects.toThrow("expiresInHours must be a positive finite number")

        await expect(
          sendOrganizationInvitationEmail({
            to: "newhire@example.com",
            organizationName: "Stark Enterprises",
            inviterName: "Tony Stark",
            role: "Admin",
            acceptUrl: "https://fenr.app/invitations/accept?id=inv-456",
            expiresInHours: Number.NaN,
          }),
        ).rejects.toThrow("expiresInHours must be a positive finite number")

        await expect(
          sendOrganizationInvitationEmail({
            to: "newhire@example.com",
            organizationName: "Stark Enterprises",
            inviterName: "Tony Stark",
            role: "Admin",
            acceptUrl: "https://fenr.app/invitations/accept?id=inv-456",
            expiresInHours: Number.POSITIVE_INFINITY,
          }),
        ).rejects.toThrow("expiresInHours must be a positive finite number")
      })

      it("throws MailDeliveryError when invitation sending fails", async () => {
        const networkError = new Error("Connection refused: port 587")
        mockSendMail = mock(async () => {
          throw networkError
        })
        setMailTransport({
          sendMail: mockSendMail,
          close: mock(() => {}),
        } as unknown as Transporter<SMTPTransport.SentMessageInfo>)

        await expect(
          sendOrganizationInvitationEmail({
            to: "fail@example.com",
            organizationName: "Wayne Enterprises",
            inviterName: "Bruce Wayne",
            role: "Member",
            acceptUrl: "https://fenr.app/invite/err",
          }),
        ).rejects.toThrow(MailDeliveryError)
      })
    })

    describe("sendEmailVerifiedEmail", () => {
      it("sends email verified confirmation email with HTML and plain text", async () => {
        const to = "verified@example.com"
        const result = await sendEmailVerifiedEmail({
          to,
          appName: "Fenr Cloud",
        })

        expect(result).toEqual({ messageId: "<mock-msg-1234@fenr.app>" })
        expect(mockSendMail).toHaveBeenCalledTimes(1)

        const callArgs = mockSendMail.mock.calls[0][0]
        expect(callArgs.from).toBe(serverEnv.EMAIL_FROM)
        expect(callArgs.to).toBe(to)
        expect(callArgs.subject).toBe("Your Fenr Cloud email has been verified")
        expect(callArgs.html).toContain(to)
        expect(typeof callArgs.text).toBe("string")
        expect(callArgs.text).toContain(to)
      })

      it("throws MailDeliveryError when sending verification confirmation fails", async () => {
        mockSendMail = mock(async () => {
          throw new Error("SMTP server unreachable")
        })
        setMailTransport({
          sendMail: mockSendMail,
          close: mock(() => {}),
        } as unknown as Transporter<SMTPTransport.SentMessageInfo>)

        await expect(
          sendEmailVerifiedEmail({ to: "fail@example.com" }),
        ).rejects.toThrow(MailDeliveryError)
      })
    })
  })
})
