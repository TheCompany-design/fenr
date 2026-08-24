/**
 * Open-redirect guard for post-login navigation.
 *
 * Only relative in-app paths are allowed; anything else falls back.
 */
const FALLBACK_PATH = "/"

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
