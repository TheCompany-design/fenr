/**
 * Shared types for organization domain data.
 * Safe to import on both client and server.
 */

export interface ActiveOrganization {
  organization: {
    id: string
    name: string
    slug: string
    logo: string | null
    createdAt: Date
  }
  role: string
  joinedAt: Date
  memberCount: number
}

export type AppOrganizationAccess =
  | {
      status: "authorized"
      activeOrganization: ActiveOrganization
    }
  | {
      status: "no_organizations"
    }
  | {
      status: "choose_organization"
      count: number
    }

export type InvitationDetailsResult =
  | { status: "not_found" }
  | { status: "invalid" }
  | {
      status: "valid" | "expired" | "accepted" | "canceled"
      invitation: {
        id: string
        email: string
        role: string
        organizationId: string
        organizationName: string
        organizationSlug: string
        organizationLogo: string | null
        inviterName: string
        expiresAt: Date
        createdAt: Date
      }
    }
