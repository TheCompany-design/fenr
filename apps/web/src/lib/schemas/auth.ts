/**
 * Auth form schemas — single source of truth for sign-in / sign-up forms.
 *
 * Passed directly to TanStack Form as Standard Schema validators and reused
 * by tests. Error messages are written for end users.
 */
import { z } from "zod"

export const emailSchema = z.email("Enter a valid email address")

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be at most 80 characters")

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
})

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
