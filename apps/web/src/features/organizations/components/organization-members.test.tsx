import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { organizationKeys } from "../queries"
import {
  getMemberInitials,
  getMemberTone,
  OrganizationMembers,
} from "./organization-members"

const mockUpdateMemberRole = mock(async () => {})
const mockRemoveMember = mock(async () => {})
const mockCancelInvitation = mock(async () => {})
const mockUpdateOrganization = mock(async () => ({}))
const mockLeaveOrganization = mock(async () => ({ success: true }))
const mockDeleteOrganization = mock(async () => ({ success: true }))
const mockInviteMember = mock(async () => ({}))

mock.module("../server", () => ({
  updateMemberRoleFn: mockUpdateMemberRole,
  removeMemberFn: mockRemoveMember,
  cancelInvitationFn: mockCancelInvitation,
  updateOrganizationFn: mockUpdateOrganization,
  leaveOrganizationFn: mockLeaveOrganization,
  deleteOrganizationFn: mockDeleteOrganization,
  inviteMemberFn: mockInviteMember,
}))

describe("OrganizationMembers Component (Block 4)", () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient
  const testOrgId = "018f1a1a-0000-7000-8000-000000000001"

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockUpdateMemberRole.mockClear()
    mockRemoveMember.mockClear()
    mockCancelInvitation.mockClear()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    document.body.innerHTML = ""
    queryClient.clear()
  })

  describe("utility helpers", () => {
    it("computes deterministic member tone", () => {
      const tone1 = getMemberTone("alice@example.com")
      const tone2 = getMemberTone("alice@example.com")
      expect(tone1).toBe(tone2)
      expect(tone1).toContain("bg-")
      expect(tone1).toContain("text-")
    })

    it("computes initials correctly from name and email", () => {
      expect(getMemberInitials("Ada Lovelace", "ada@example.com")).toBe("AL")
      expect(getMemberInitials("Linus", "linus@kernel.org")).toBe("LI")
      expect(getMemberInitials("", "grace@cobol.io")).toBe("GR")
      expect(getMemberInitials(null, null)).toBe("??")
    })
  })

  describe("rendering", () => {
    it("renders member rows, roles, and pending invitations cleanly", () => {
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
              name: "Ada Lovelace",
              email: "ada@calculus.dev",
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
              name: "Alan Turing",
              email: "alan@enigma.uk",
              image: null,
            },
          },
        ],
      })

      queryClient.setQueryData(organizationKeys.invitations(testOrgId), [
        {
          id: "inv-1",
          email: "grace@cobol.io",
          role: "admin",
          expiresAt: new Date("2026-03-01T00:00:00Z"),
          createdAt: new Date("2026-02-20T00:00:00Z"),
        },
      ])

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

      // Active members
      expect(html).toContain("Ada Lovelace")
      expect(html).toContain("ada@calculus.dev")
      expect(html).toContain("Alan Turing")
      expect(html).toContain("alan@enigma.uk")
      expect(html).toContain("AL")
      expect(html).toContain("AT")
      expect(html).toContain("You")

      // Pending invitations
      expect(html).toContain("grace@cobol.io")
      expect(html).toContain("admin")
      expect(html).toContain("pending")
      expect(html).toContain("Members (2)")
      expect(html).toContain("Pending Invitations (1)")
    })

    it("hides pending invitations section for regular members", () => {
      queryClient.setQueryData(organizationKeys.members(testOrgId), {
        callerRole: "member",
        members: [
          {
            id: "mem-2",
            userId: "user-2",
            role: "member",
            createdAt: new Date("2026-02-01T00:00:00Z"),
            user: {
              id: "user-2",
              name: "Alan Turing",
              email: "alan@enigma.uk",
              image: null,
            },
          },
        ],
      })

      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(OrganizationMembers, {
            organizationId: testOrgId,
            currentUserId: "user-2",
            currentUserRole: "member",
          }),
        ),
      )

      expect(html).toContain("Alan Turing")
      expect(html).not.toContain("Pending Invitations")
    })
  })

  describe("actions and interactions", () => {
    it("handles invitation cancellation with confirmation", async () => {
      const { useConfirmStore } = await import(
        "@/components/feedback/confirm.store"
      )
      useConfirmStore.setState({ openConfirm: async () => true })

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
              name: "Ada Lovelace",
              email: "ada@calculus.dev",
              image: null,
            },
          },
        ],
      })

      queryClient.setQueryData(organizationKeys.invitations(testOrgId), [
        {
          id: "inv-1",
          email: "grace@cobol.io",
          role: "member",
          expiresAt: new Date("2026-03-01T00:00:00Z"),
          createdAt: new Date("2026-02-20T00:00:00Z"),
        },
      ])

      await act(async () => {
        root.render(
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
      })

      const revokeBtn = container.querySelector(
        'button[aria-label="Revoke invitation for grace@cobol.io"]',
      ) as HTMLButtonElement | null
      expect(revokeBtn).not.toBeNull()

      await act(async () => {
        revokeBtn?.click()
      })

      expect(mockCancelInvitation).toHaveBeenCalledWith({
        data: {
          organizationId: testOrgId,
          invitationId: "inv-1",
        },
      })
    })

    it("prevents double-submitting while action is in-flight", async () => {
      const { useConfirmStore } = await import(
        "@/components/feedback/confirm.store"
      )
      useConfirmStore.setState({ openConfirm: async () => true })

      let resolveCancel: () => void = () => {}
      const cancelPromise = new Promise<void>((resolve) => {
        resolveCancel = resolve
      })
      mockCancelInvitation.mockImplementationOnce(async () => cancelPromise)

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
              name: "Ada Lovelace",
              email: "ada@calculus.dev",
              image: null,
            },
          },
        ],
      })

      queryClient.setQueryData(organizationKeys.invitations(testOrgId), [
        {
          id: "inv-1",
          email: "grace@cobol.io",
          role: "member",
          expiresAt: new Date("2026-03-01T00:00:00Z"),
          createdAt: new Date("2026-02-20T00:00:00Z"),
        },
      ])

      await act(async () => {
        root.render(
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
      })

      const revokeBtn = container.querySelector(
        'button[aria-label="Revoke invitation for grace@cobol.io"]',
      ) as HTMLButtonElement | null
      expect(revokeBtn).not.toBeNull()

      // First click initiates
      await act(async () => {
        revokeBtn?.click()
      })
      expect(mockCancelInvitation).toHaveBeenCalledTimes(1)

      // Second click while in-flight is rejected by loadingActionIds guard
      await act(async () => {
        revokeBtn?.click()
      })
      expect(mockCancelInvitation).toHaveBeenCalledTimes(1)

      // Finish pending action
      await act(async () => {
        resolveCancel()
      })
    })
  })
})
