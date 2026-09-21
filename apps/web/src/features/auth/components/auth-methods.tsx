/**
 * Unified auth methods composition.
 *
 * Composes email magic-link sign-in/sign-up and social OAuth buttons
 * separated by an accessible semantic divider. Eliminates duplication
 * between sign-in and sign-up flows.
 */
import { AuthDivider } from "./auth-divider"
import { MagicLinkForm } from "./magic-link-form"
import { OAuthButtons, type SocialProviderConfig } from "./oauth-buttons"

export interface AuthMethodsProps {
  redirectTo: string
  defaultEmail?: string
  dividerLabel?: string
  providers?: readonly SocialProviderConfig[]
  className?: string
}

export function AuthMethods({
  redirectTo,
  defaultEmail,
  dividerLabel = "Or continue with",
  providers,
  className,
}: AuthMethodsProps) {
  return (
    <div className={className}>
      <MagicLinkForm redirectTo={redirectTo} defaultEmail={defaultEmail} />
      <AuthDivider label={dividerLabel} />
      <OAuthButtons redirectTo={redirectTo} providers={providers} />
    </div>
  )
}
