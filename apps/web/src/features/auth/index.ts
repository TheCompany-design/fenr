export {
  getSocialProvider,
  SOCIAL_PROVIDERS,
  type SocialProviderConfig,
  type SocialProviderId,
} from "@/lib/auth/providers/social"
export {
  emailSchema,
  type MagicLinkValues,
  magicLinkSchema,
} from "@/lib/schemas/auth"
export { AuthDivider, type AuthDividerProps } from "./components/auth-divider"
export {
  AuthErrorBanner,
  type AuthErrorBannerProps,
} from "./components/auth-error-banner"
export { AuthMethods, type AuthMethodsProps } from "./components/auth-methods"
export { AuthHeader, AuthShell } from "./components/auth-shell"
export { CheckEmailCard } from "./components/check-email-card"
export { FieldError } from "./components/field-error"
export { MagicLinkForm } from "./components/magic-link-form"
export {
  OAuthButtons,
  type OAuthButtonsProps,
} from "./components/oauth-buttons"
export {
  SocialAuthError,
  type SocialSignInVariables,
  useSocialSignIn,
} from "./hooks/use-social-sign-in"
export {
  type AuthErrorMessage,
  getAuthErrorMessage,
} from "./utils/error-messages"
export { getAuthTagline } from "./utils/tagline"
export { useAuthError } from "./utils/use-auth-error"
