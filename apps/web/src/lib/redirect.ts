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
  return value
}

export function safeAppRedirectPath(value: unknown): string {
  const path = safeRedirectPath(value)
  if (
    FORBIDDEN_APP_REDIRECT_PREFIXES.some(
      (prefix) =>
        path === prefix ||
        path.startsWith(`${prefix}/`) ||
        path.startsWith(`${prefix}?`),
    )
  ) {
    return FALLBACK_PATH
  }
  return path
}
