import { jwt } from "better-auth/plugins"
import { serverEnv } from "@/lib/env"

export function createJwtPlugin() {
  return jwt({
    jwt: {
      issuer: serverEnv.BETTER_AUTH_URL,
      audience: "nabu",
      expirationTime: "15m",
      definePayload: ({ user, session }) => ({
        sub: user.id,
        email: user.email,
        activeOrganizationId:
          (
            session as
              | { activeOrganizationId?: string | null }
              | null
              | undefined
          )?.activeOrganizationId ?? undefined,
      }),
    },
    jwks: {
      jwksPath: "/jwks",
    },
  })
}
