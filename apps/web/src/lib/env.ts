/**
 * Server environment variables — validated with Zod at the trust boundary.
 *
 * SERVER-ONLY: importing this module pulls in nothing client-safe by design;
 * it reads process.env which only exists meaningfully on the server.
 * Bun auto-loads apps/web/.env (see .env.example) in dev and production.
 */
import { z } from "zod"

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      { message: "DATABASE_URL must be a postgres:// connection string" },
    ),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
})

const parsed = serverEnvSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  )
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`)
}

export const serverEnv = parsed.data

/** True when running on the server (SSR / server functions / prod server). */
export const isServer = typeof window === "undefined"
