/**
 * Auth error message mappings.
 *
 * Translates error codes from query parameters or auth providers into
 * user-friendly, actionable titles and descriptions.
 */

export interface AuthErrorMessage {
  title: string
  description: string
}

export function getAuthErrorMessage(error?: string | null): AuthErrorMessage {
  if (!error) {
    return {
      title: "Sign-in Issue",
      description:
        "An unexpected issue occurred. Please enter your email below to receive a fresh link.",
    }
  }

  switch (error) {
    case "access_resolution_failed":
      return {
        title: "Unable to load workspace",
        description:
          "We couldn't verify your organization access. Please sign in again or check your network connection.",
      }
    case "session_expired":
      return {
        title: "Session Expired",
        description:
          "Your session has expired. Please sign in to resume your work.",
      }
    case "invalid_token":
    case "magic_link_invalid":
    case "token_expired":
      return {
        title: "Sign-in link expired or invalid",
        description:
          "The sign-in link you clicked has expired or was already used. Please request a new link below.",
      }
    default:
      return {
        title: "Sign-in Link Issue",
        description:
          "Your sign-in link has expired, was already used, or is invalid. Please enter your email below to receive a fresh link.",
      }
  }
}
