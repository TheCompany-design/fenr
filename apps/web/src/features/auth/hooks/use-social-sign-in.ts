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
      if (error instanceof SocialAuthError) {
        toast.error("Sign in failed", {
          description: error.message,
        })
      } else {
        toast.error("Network error", {
          description:
            "Unable to reach the authentication service. Please check your connection and try again.",
        })
      }
      options?.onError?.(...args)
    },
  })
}
