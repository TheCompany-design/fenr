/**
 * Structured logging via Pino.
 *
 * SERVER-ONLY: never import from client components/hooks — Pino writes to
 * stdout and must not be bundled for the browser.
 *
 * Conventions (/logging-best-practices):
 * - One child logger per module via `moduleLogger("<name>")`.
 * - Log structured fields, not string interpolation.
 * - Never log secrets (passwords, tokens, cookies, connection strings).
 * - Levels: error = needs action now, warn = degraded but serving,
 *   info = meaningful state transitions, debug = diagnostics.
 */
import pino from "pino"

const logLevel =
  typeof window !== "undefined" ? "info" : (process.env.LOG_LEVEL ?? "info")

export const logger = pino({
  level: logLevel,
  base: { app: "fenr" },
  browser: typeof window !== "undefined" ? { asObject: true } : undefined,
  redact: {
    paths: [
      "password",
      "token",
      "secret",
      "*.password",
      "*.token",
      "*.secret",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
})

export function moduleLogger(mod: string): pino.Logger {
  return logger.child({ mod })
}

export * from "./wide-event"
