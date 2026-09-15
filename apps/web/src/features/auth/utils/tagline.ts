/**
 * Utility for deriving editorial taglines for auth sub-routes.
 */

export function getAuthTagline(pathname: string): string {
  if (pathname.includes("/sign-up")) {
    return "Create your account and start with a clean, focused canvas."
  }
  if (pathname.includes("/check-email")) {
    return "A quiet workspace for focused work."
  }
  return "A quiet workspace for focused work. Sign in to pick up where you left off."
}
