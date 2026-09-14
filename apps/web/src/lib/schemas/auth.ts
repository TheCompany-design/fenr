import { z } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(255, "Email address must be at most 255 characters")

export const magicLinkSchema = z.object({ email: emailSchema })

export type MagicLinkValues = z.infer<typeof magicLinkSchema>
