import { z } from "zod"

/**
 * Zod schemas are the single source of truth for form validation in Fenr.
 * TanStack Form consumes them directly via its Standard Schema support.
 */
export const demoFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
})

export type DemoFormValues = z.infer<typeof demoFormSchema>
