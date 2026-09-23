import { magicLink } from "better-auth/plugins"
import { sendMagicLinkEmail } from "@/lib/mail"

export function createMagicLinkPlugin() {
  return magicLink({
    sendMagicLink: async ({ email, token, url }) => {
      await sendMagicLinkEmail({
        to: email,
        token,
        url,
        expiresInMinutes: 10,
      })
    },
    expiresIn: 600, // 10 minutes
  })
}
