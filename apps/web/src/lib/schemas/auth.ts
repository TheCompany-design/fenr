/**
 * Auth form schemas — single source of truth for sign-in / sign-up forms.
 *
 * Passed directly to TanStack Form as Standard Schema validators and reused
 * by tests. Error messages are written for end users.
 */
import { z } from "zod"

export const emailSchema = z.email("Enter a valid email address")

/**
 * Password policy — resilient by default:
 * 8+ chars, upper + lower case, a digit and a special character.
 * Each rule gets its own message so users know exactly what's missing.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((value) => /[a-z]/.test(value), {
    message: "Password must contain a lowercase letter",
  })
  .refine((value) => /[A-Z]/.test(value), {
    message: "Password must contain an uppercase letter",
  })
  .refine((value) => /\d/.test(value), {
    message: "Password must contain a number",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "Password must contain a special character (e.g. !@#$%)",
  })

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be at most 80 characters")

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
})

export const signUpSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
