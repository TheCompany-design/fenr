export {
  emailSchema,
  type MagicLinkValues,
  magicLinkSchema,
} from "@/lib/schemas/auth"
export {
  AuthErrorBanner,
  type AuthErrorBannerProps,
} from "./components/auth-error-banner"
export { AuthHeader, AuthShell } from "./components/auth-shell"
export { CheckEmailCard } from "./components/check-email-card"
export { FieldError } from "./components/field-error"
export { MagicLinkForm } from "./components/magic-link-form"
export { OAuthButtons } from "./components/oauth-buttons"
export {
  type AuthErrorMessage,
  getAuthErrorMessage,
} from "./utils/error-messages"
export { getAuthTagline } from "./utils/tagline"
