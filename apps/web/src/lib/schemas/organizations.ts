import { z } from "zod"

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const
export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES)
export type OrganizationRole = z.infer<typeof organizationRoleSchema>

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "document",
  "documents",
  "help",
  "invitations",
  "invite",
  "login",
  "new",
  "null",
  "onboarding",
  "organization",
  "organizations",
  "settings",
  "signin",
  "signup",
  "support",
  "undefined",
  "user",
  "users",
] as const

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeSlug(raw: string): string {
  if (!raw || typeof raw !== "string") return ""
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number])
}

export function isValidSlugFormat(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 48) return false
  return SLUG_REGEX.test(slug)
}

export const slugSchema = z
  .string()
  .trim()
  .transform(normalizeSlug)
  .pipe(
    z
      .string()
      .min(3, "Slug must be at least 3 characters")
      .max(48, "Slug must be at most 48 characters")
      .refine(isValidSlugFormat, {
        message:
          "Slug must contain only lowercase letters, numbers, and hyphens",
      })
      .refine((val) => !isReservedSlug(val), {
        message: "This slug is reserved and cannot be used",
      }),
  )

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Organization name must be at least 2 characters")
  .max(80, "Organization name must be at most 80 characters")

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: slugSchema,
  logo: z.string().url("Invalid logo URL").nullable().optional(),
})
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>

export const checkSlugSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
})
export type CheckSlugInput = z.infer<typeof checkSlugSchema>

export const setActiveOrganizationSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
})
export type SetActiveOrganizationInput = z.infer<
  typeof setActiveOrganizationSchema
>

export const getOrganizationMembersSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
})
export type GetOrganizationMembersInput = z.infer<
  typeof getOrganizationMembersSchema
>

export const getOrganizationInvitationsSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
})
export type GetOrganizationInvitationsInput = z.infer<
  typeof getOrganizationInvitationsSchema
>

export const inviteMemberSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255, "Email must be at most 255 characters")
    .transform((val) => val.toLowerCase()),
  role: organizationRoleSchema.default("member"),
  note: z
    .string()
    .trim()
    .max(2000, "Personal note must be 2000 characters or fewer")
    .optional(),
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

export const queuedInviteSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  role: organizationRoleSchema,
  status: z.enum(["pending", "sending", "success", "error"]),
  error: z.string().optional(),
})
export const inviteMembersFormSchema = z.object({
  invites: z.array(queuedInviteSchema),
  draft: z.string(),
  note: z.string().max(2000, "Personal note must be 2000 characters or fewer"),
  showMessage: z.boolean(),
  defaultRole: organizationRoleSchema,
})
export type InviteMembersFormValues = z.infer<typeof inviteMembersFormSchema>

export const cancelInvitationSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  invitationId: z.string().uuid("Invalid invitation ID"),
})
export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>

export const updateMemberRoleSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  memberId: z.string().uuid("Invalid member ID"),
  role: organizationRoleSchema,
})
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>

export const updateOrganizationSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  name: organizationNameSchema,
  slug: slugSchema,
  logo: z.string().url("Invalid logo URL").nullable(),
})
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>

export const removeMemberSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  memberId: z.string().uuid("Invalid member ID"),
})
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>

export const organizationMembershipSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
})
export type OrganizationMembershipInput = z.infer<
  typeof organizationMembershipSchema
>

export const getInvitationDetailsSchema = z.object({
  invitationId: z.string().trim().min(1, "Invitation ID is required"),
})
export type GetInvitationDetailsInput = z.infer<
  typeof getInvitationDetailsSchema
>

export const acceptInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation ID"),
})
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
