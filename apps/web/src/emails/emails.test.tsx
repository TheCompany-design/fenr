import { describe, expect, it } from "bun:test"
import { render } from "@react-email/render"
import { createElement } from "react"

import {
  EmailVerifiedEmail,
  MagicLinkEmail,
  OrganizationInvitationEmail,
} from "./index"

describe("React Email Templates", () => {
  describe("MagicLinkEmail", () => {
    it("renders non-empty HTML with action URL, logo, and defaults", async () => {
      const url = "https://fenr.app/auth/verify?token=magic-token-xyz"
      const html = await render(
        createElement(MagicLinkEmail, {
          url,
        }),
      )

      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(100)
      expect(html).toContain("Fenr")
      expect(html).toContain("Sign in to Fenr")
      expect(html).toContain(url)
      expect(html).toContain("10 minutes")
      expect(html).toContain(
        "If you didn&#x27;t request this email, you can safely ignore it.",
      )
    })

    it("renders recipient email and custom expiration time", async () => {
      const url = "https://fenr.app/auth/verify?token=magic-token-123"
      const email = "developer@fenr.app"
      const html = await render(
        createElement(MagicLinkEmail, {
          url,
          email,
          expiresInMinutes: 15,
        }),
      )

      expect(html).toContain(email)
      expect(html).toContain("15 minutes")
      expect(html).toContain(url)
    })
  })

  describe("OrganizationInvitationEmail", () => {
    it("renders invitation details, role, acceptUrl, and defaults", async () => {
      const acceptUrl = "https://fenr.app/invite/token-abc-789"
      const html = await render(
        createElement(OrganizationInvitationEmail, {
          organizationName: "Acme Labs",
          inviterName: "Sarah Connor",
          role: "Engineer",
          acceptUrl,
        }),
      )

      expect(html).toBeTruthy()
      expect(html).toContain("Fenr")
      expect(html).toContain("Acme Labs")
      expect(html).toContain("Sarah Connor")
      expect(html).toContain("Engineer")
      expect(html).toContain(acceptUrl)
      expect(html).toContain("48 hours")
      expect(html).toContain(
        "If you were not expecting this invitation, you can safely ignore this email.",
      )
    })

    it("renders custom expiration hours", async () => {
      const acceptUrl = "https://fenr.app/invite/token-custom"
      const html = await render(
        createElement(OrganizationInvitationEmail, {
          organizationName: "Globex Corp",
          inviterName: "Hank Scorpio",
          role: "Owner",
          acceptUrl,
          expiresInHours: 72,
        }),
      )

      expect(html).toContain("72 hours")
      expect(html).toContain("Globex Corp")
      expect(html).toContain("Hank Scorpio")
      expect(html).toContain("Owner")
      expect(html).toContain(acceptUrl)
    })
  })

  describe("EmailVerifiedEmail", () => {
    it("renders confirmation with default app name", async () => {
      const email = "verified-user@fenr.app"
      const html = await render(
        createElement(EmailVerifiedEmail, {
          email,
        }),
      )

      expect(html).toBeTruthy()
      expect(html).toContain("Fenr")
      expect(html).toContain("Email verified")
      expect(html).toContain(email)
      expect(html).toContain(
        "If you didn&#x27;t create an account or verify this email address",
      )
    })

    it("renders custom app name when specified", async () => {
      const email = "custom-user@example.com"
      const html = await render(
        createElement(EmailVerifiedEmail, {
          email,
          appName: "Fenr Enterprise",
        }),
      )

      expect(html).toContain("Fenr Enterprise")
      expect(html).toContain(email)
    })
  })
})
