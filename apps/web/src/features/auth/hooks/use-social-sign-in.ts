/**
 * TanStack Query mutation hook for outbound social sign-in requests.
 *
 * Wraps Better Auth authClient.signIn.social in a declarative mutation,
 * managing pending state and user-facing error toasts via Sonner.
 */
import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { safeRedirectPath } from "@/lib/redirect"
import type { SocialProviderId } from "@/lib/social-providers"

export interface SocialSignInVariables {
  provider: SocialProviderId
  redirectTo?: string
}

export class SocialAuthError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "SocialAuthError"
    this.status = status
  }
}

export type SocialSignInResult = Awaited<
  ReturnType<typeof authClient.signIn.social>
>

function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") {
    return true
  }
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true
  }
  return false
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      error.name === "NetworkError" ||
      msg.includes("failed to fetch") ||
      msg.includes("network") ||
      msg.includes("load failed") ||
      msg.includes("connection")
    )
  }
  return false
}

export function useSocialSignIn(
  options?: Omit<
    UseMutationOptions<SocialSignInResult, Error, SocialSignInVariables>,
    "mutationFn"
  >,
): UseMutationResult<SocialSignInResult, Error, SocialSignInVariables> {
  return useMutation({
    ...options,
    mutationFn: async ({ provider, redirectTo }: SocialSignInVariables) => {
      const targetRedirect = safeRedirectPath(redirectTo)
      const result = await authClient.signIn.social({
        provider,
        callbackURL: targetRedirect,
      })

      if (result?.error) {
        throw new SocialAuthError(
          result.error.message ||
            `Unable to sign in with ${provider}. Please try again.`,
          result.error.status,
        )
      }

      return result
    },
    onError: (...args) => {
      const [error] = args

      if (isAbortError(error)) {
        options?.onError?.(...args)
        return
      }

      if (error instanceof SocialAuthError) {
        toast.error("Sign in failed", {
          description: error.message,
        })
      } else if (isNetworkError(error)) {
        toast.error("Network error", {
          description:
            "Unable to reach the authentication service. Please check your connection and try again.",
        })
      } else {
        toast.error("Authentication error", {
          description:
            "An unexpected error occurred during sign in. Please try again.",
        })
      }
      options?.onError?.(...args)
    },
  })
}
