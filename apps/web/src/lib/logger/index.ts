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
