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
  const isTest = process.env.NODE_ENV === "test"
  if (isTest && process.env.TEST_DATABASE_URL)
    return process.env.TEST_DATABASE_URL

  const fromEnvironment = process.env.DATABASE_URL
  if (fromEnvironment) {
    if (isTest && !fromEnvironment.includes("_test")) {
      return fromEnvironment.replace(/(\/[a-zA-Z0-9_]+)(\?.*)?$/, "$1_test$2")
    }
    return fromEnvironment
  }

  const envFile = path.resolve(
    import.meta.dirname ?? globalThis.__dirname ?? process.cwd(),
    "../../apps/web/.env",
  )
  if (!fs.existsSync(envFile)) {
    throw new Error(
      `DATABASE_URL is not set. Create ${path.relative(process.cwd(), envFile)} (see apps/web/.env.example) or export DATABASE_URL.`,
    )
  }

  const content = fs.readFileSync(envFile, "utf8")
  if (isTest) {
    const testMatch = content.match(/^TEST_DATABASE_URL=(.+)$/m)
    if (testMatch?.[1]?.trim()) return testMatch[1].trim()
  }

  const match = content.match(/^DATABASE_URL=(.+)$/m)
  const value = match?.[1]?.trim()
  if (!value) {
    throw new Error(`DATABASE_URL is empty in apps/web/.env`)
  }
  if (isTest && !value.includes("_test")) {
    return value.replace(/(\/[a-zA-Z0-9_]+)(\?.*)?$/, "$1_test$2")
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
