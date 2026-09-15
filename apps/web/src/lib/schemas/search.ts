import { z } from "zod"

/**
 * Validated search schemas for application routes.
 *
 * Centralized under src/lib/schemas/ per AGENTS.md.
 */

export const authLayoutSearchSchema = z
  .object({
    redirect: z.string().optional(),
  })
  .passthrough()
export type AuthLayoutSearch = z.infer<typeof authLayoutSearchSchema>

export const authSignInSearchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})
export type AuthSignInSearch = z.infer<typeof authSignInSearchSchema>

export const authSignUpSearchSchema = z.object({
  redirect: z.string().optional(),
})
export type AuthSignUpSearch = z.infer<typeof authSignUpSearchSchema>

export const authCheckEmailSearchSchema = z.object({
  email: z.string().default(""),
  redirect: z.string().optional(),
  error: z.string().optional(),
})
export type AuthCheckEmailSearch = z.infer<typeof authCheckEmailSearchSchema>

export const chooseOrganizationSearchSchema = z.object({
  redirect: z.string().optional(),
})
export type ChooseOrganizationSearch = z.infer<
  typeof chooseOrganizationSearchSchema
>

export const invitationAcceptSearchSchema = z.object({
  id: z.string().optional().catch(undefined),
})
export type InvitationAcceptSearch = z.infer<
  typeof invitationAcceptSearchSchema
>

export const ONBOARDING_STEPS = ["naming", "invites", "welcome"] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export const onboardingSearchSchema = z.object({
  step: z.enum(ONBOARDING_STEPS).optional().default("naming").catch("naming"),
  orgId: z.string().uuid().optional().catch(undefined),
})
export type OnboardingSearch = z.infer<typeof onboardingSearchSchema>
