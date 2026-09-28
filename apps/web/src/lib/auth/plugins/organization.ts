import { organization } from "better-auth/plugins"
import { serverEnv } from "@/lib/env"
import { sendOrganizationInvitationEmail } from "@/lib/mail"

export function createOrganizationPlugin() {
  return organization({
    allowUserToCreateOrganization: true,
    creatorRole: "owner",
    invitationExpiresIn: 48 * 60 * 60, // 48 hours
    sendInvitationEmail: async (data) => {
      const baseUrl = serverEnv.BETTER_AUTH_URL.replace(/\/+$/, "")
      const acceptUrl = `${baseUrl}/invitations/accept?id=${encodeURIComponent(data.id)}`
      const inviterName = data.inviter?.user?.name || "A team member"

      await sendOrganizationInvitationEmail({
        to: data.email,
        organizationName: data.organization.name,
        inviterName,
        role: data.role,
        acceptUrl,
        expiresInHours: 48,
      })
    },
  })
}
