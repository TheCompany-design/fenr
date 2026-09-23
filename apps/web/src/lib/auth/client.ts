/**
 * Better Auth client for React/TanStack Start.
 *
 * Talks to the mounted handler at /api/auth (default base path). Safe to
 * import anywhere in the app; contains no secrets and no DB access.
 */
import { magicLinkClient, organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient()],
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  useActiveOrganization,
  useListOrganizations,
} = authClient
