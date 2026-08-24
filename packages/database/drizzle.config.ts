import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "drizzle-kit"

/**
 * Resolve DATABASE_URL for drizzle-kit.
 *
 * Runtime code reads DATABASE_URL straight from process.env (Bun auto-loads
 * apps/web/.env when the app runs from apps/web). drizzle-kit runs from
 * packages/database though, so we fall back to reading the app's .env file
 * explicitly. A real value already present in the environment always wins.
 */
function resolveDatabaseUrl(): string {
  const fromEnvironment = process.env.DATABASE_URL
  if (fromEnvironment) return fromEnvironment

  const envFile = path.resolve(
    import.meta.dirname ?? globalThis.__dirname ?? process.cwd(),
    "../../apps/web/.env",
  )
  if (!fs.existsSync(envFile)) {
    throw new Error(
      `DATABASE_URL is not set. Create ${path.relative(process.cwd(), envFile)} (see apps/web/.env.example) or export DATABASE_URL.`,
    )
  }

  const match = fs.readFileSync(envFile, "utf8").match(/^DATABASE_URL=(.+)$/m)
  const value = match?.[1]?.trim()
  if (!value) {
    throw new Error(`DATABASE_URL is empty in apps/web/.env`)
  }
  return value
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
  strict: true,
  verbose: true,
})
