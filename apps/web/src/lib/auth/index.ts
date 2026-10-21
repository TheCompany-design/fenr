import { db, schema } from "@workspace/database"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { serverEnv } from "@/lib/env"
import { createDatabaseHooks } from "./hooks"
import {
  createCookiesPlugin,
  createJwtPlugin,
  createMagicLinkPlugin,
  createOrganizationPlugin,
} from "./plugins"
import { getSocialProvidersOption } from "./providers"

export * from "./hooks"
export * from "./plugins"
export * from "./providers"

export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  advanced: {
    database: {
      joins: true,
      generateId: false,
    },
  },

  emailAndPassword: {
    enabled: false,
  },

  socialProviders: getSocialProvidersOption(),

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  databaseHooks: createDatabaseHooks(),

  plugins: [
    createMagicLinkPlugin(),
    createOrganizationPlugin(),
    createJwtPlugin(),
    createCookiesPlugin(),
  ],
})

export type Session = typeof auth.$Infer.Session
