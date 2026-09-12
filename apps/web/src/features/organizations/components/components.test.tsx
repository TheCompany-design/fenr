import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { InviteMembersForm } from "./invite-members-form"
import { OrganizationAvatar } from "./organization-avatar"
import { OrganizationForm } from "./organization-form"

function renderWithQuery(component: () => React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(component),
    ),
  )
}

describe("Organization Domain Components (Atom 7)", () => {
  describe("OrganizationAvatar", () => {
    it("renders uppercase initial letter from organization name", () => {
      const html = renderToStaticMarkup(
        createElement(OrganizationAvatar, { name: "Acme Corp" }),
      )
      expect(html).toContain('role="img"')
      expect(html).toContain('aria-label="Acme Corp"')
      expect(html).toContain("A")
    })

    it("falls back to slug initial when name is missing", () => {
      const html = renderToStaticMarkup(
        createElement(OrganizationAvatar, { slug: "fenr-labs" }),
      )
      expect(html).toContain('aria-label="fenr-labs"')
      expect(html).toContain("F")
    })

    it("falls back to ? when neither name nor slug is provided", () => {
      const html = renderToStaticMarkup(createElement(OrganizationAvatar, {}))
      expect(html).toContain('aria-label="Organization"')
      expect(html).toContain("?")
    })

    it("renders image tag when logo is provided", () => {
      const html = renderToStaticMarkup(
        createElement(OrganizationAvatar, {
          name: "Acme",
          logo: "https://example.com/logo.png",
        }),
      )
      expect(html).toContain("<img")
      expect(html).toContain('src="https://example.com/logo.png"')
      expect(html).toContain('alt="Acme"')
    })

    it("applies appropriate size classes", () => {
      const smallHtml = renderToStaticMarkup(
        createElement(OrganizationAvatar, { name: "Acme", size: "sm" }),
      )
      expect(smallHtml).toContain("size-8")

      const largeHtml = renderToStaticMarkup(
        createElement(OrganizationAvatar, { name: "Acme", size: "lg" }),
      )
      expect(largeHtml).toContain("size-12")
    })
  })

  describe("OrganizationForm", () => {
    it("renders name and slug input fields with proper labels and accessibility attributes", () => {
      const html = renderWithQuery(() =>
        createElement(OrganizationForm, {
          defaultValues: { name: "Acme Inc", slug: "acme-inc" },
          onSubmit: () => {},
        }),
      )

      expect(html).toContain('id="org-form-name"')
      expect(html).toContain('id="org-form-slug"')
      expect(html).toContain('for="org-form-name"')
      expect(html).toContain('for="org-form-slug"')
      expect(html).toContain("Organization Name")
      expect(html).toContain("Workspace URL")
      expect(html).toContain("fenr.app/")
      expect(html).toContain("Acme Inc")
      expect(html).toContain("acme-inc")
      expect(html).toContain("Create Organization")
    })

    it("renders cancel button when onCancel prop is supplied", () => {
      const html = renderWithQuery(() =>
        createElement(OrganizationForm, {
          onSubmit: () => {},
          onCancel: () => {},
          submitLabel: "Save Changes",
        }),
      )

      expect(html).toContain("Cancel")
      expect(html).toContain("Save Changes")
    })
  })

  describe("InviteMembersForm", () => {
    it("renders email input, role buttons, and action buttons", () => {
      const html = renderToStaticMarkup(
        createElement(InviteMembersForm, {
          onInvite: async () => [],
          submitLabel: "Invite Teammates",
          skipLabel: "Not now",
          onSkip: () => {},
        }),
      )

      expect(html).toContain('id="invite-email-input"')
      expect(html).toContain('for="invite-email-input"')
      expect(html).toContain("Teammate Email")
      expect(html).toContain("colleague@example.com")
      expect(html).toContain("member")
      expect(html).toContain("admin")
      expect(html).toContain("Add")
      expect(html).toContain("Invite Teammates")
      expect(html).toContain("Not now")
    })
  })

  describe("OrganizationMembers", () => {
    it("renders member rows, roles, and action triggers when data is preloaded", async () => {
      const { OrganizationMembers } = await import("./organization-members")
      const { organizationKeys } = await import("../queries")

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      const testOrgId = "018f1a1a-0000-7000-8000-000000000001"

      queryClient.setQueryData(organizationKeys.members(testOrgId), {
        callerRole: "owner",
        members: [
          {
            id: "mem-1",
            userId: "user-1",
            role: "owner",
            createdAt: new Date("2026-01-15T00:00:00Z"),
            user: {
              id: "user-1",
              name: "Alice Founder",
              email: "alice@example.com",
              image: null,
            },
          },
          {
            id: "mem-2",
            userId: "user-2",
            role: "member",
            createdAt: new Date("2026-02-01T00:00:00Z"),
            user: {
              id: "user-2",
              name: "Bob Teammate",
              email: "bob@example.com",
              image: null,
            },
          },
        ],
      })

      queryClient.setQueryData(organizationKeys.invitations(testOrgId), [])

      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(OrganizationMembers, {
            organizationId: testOrgId,
            currentUserId: "user-1",
            currentUserRole: "owner",
          }),
        ),
      )

      expect(html).toContain("Alice Founder")
      expect(html).toContain("alice@example.com")
      expect(html).toContain("Bob Teammate")
      expect(html).toContain("bob@example.com")
      expect(html).toContain("owner")
      expect(html).toContain("member")
      expect(html).toContain("Members (2)")
      expect(html).toContain("Pending Invitations (0)")
    })
  })
})
