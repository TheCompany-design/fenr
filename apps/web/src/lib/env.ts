/**
 * Server environment variables — validated with Zod at the trust boundary.
 *
 * SERVER-ONLY: importing this module pulls in nothing client-safe by design;
 * it reads process.env which only exists meaningfully on the server.
 * Bun auto-loads apps/web/.env (see .env.example) in dev and production.
 */
import { z } from "zod"

export const serverEnvSchema = z.object({
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
  EMAIL_FROM: z.string().default("Fenr <no-reply@fenr.app>"),
  SMTP_MAILER: z.string().default("smtp"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_ENCRYPTION: z.enum(["tls", "ssl", "starttls", "none"]).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(
  env: Record<string, unknown | undefined> = process.env,
) {
  const rawEncryption = env.SMTP_ENCRYPTION ?? env.SMTP_ENCTYPTION
  const encryption = rawEncryption === "" ? undefined : rawEncryption

  const raw = {
    ...env,
    ...(rawEncryption !== undefined ? { SMTP_ENCRYPTION: encryption } : {}),
  }

  return serverEnvSchema.safeParse(raw)
}

const parsed = parseServerEnv(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  )
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`)
}

export const serverEnv = parsed.data
