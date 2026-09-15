/**
 * Open-redirect guard for post-login navigation.
 *
 * Only relative in-app paths are allowed; anything else falls back.
 */
const FALLBACK_PATH = "/"

const FORBIDDEN_APP_REDIRECT_PREFIXES = [
  "/choose-organization",
  "/onboarding",
  "/auth",
]

export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return FALLBACK_PATH
  // Reject absolute URLs, protocol-relative URLs, and backslash tricks.
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return FALLBACK_PATH
  }

  try {
    const url = new URL(value, "http://localhost")
    if (url.origin !== "http://localhost") return FALLBACK_PATH
  } catch {
    return FALLBACK_PATH
  }

  return value
}

export function safeAppRedirectPath(value: unknown): string {
  const path = safeRedirectPath(value)
  if (path === FALLBACK_PATH) return FALLBACK_PATH

  try {
    const url = new URL(path, "http://localhost")
    if (url.origin !== "http://localhost") return FALLBACK_PATH
    const pathname = url.pathname.toLowerCase()

    if (
      FORBIDDEN_APP_REDIRECT_PREFIXES.some(
        (prefix) =>
          pathname === prefix.toLowerCase() ||
          pathname.startsWith(`${prefix.toLowerCase()}/`),
      )
    ) {
      return FALLBACK_PATH
    }
  } catch {
    return FALLBACK_PATH
  }

  return path
}
