/**
 * Better Auth client for React/TanStack Start.
 *
 * Talks to the mounted handler at /api/auth (default base path). Safe to
 * import anywhere in the app; contains no secrets and no DB access.
 */
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
