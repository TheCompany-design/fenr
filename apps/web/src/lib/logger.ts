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

import { serverEnv } from "./env"

export const logger = pino({
  level: serverEnv.LOG_LEVEL,
  base: { app: "fenr" },
})

export function moduleLogger(mod: string): pino.Logger {
  return logger.child({ mod })
}
