import { z } from "zod"

export const demoFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
})

export type DemoFormValues = z.infer<typeof demoFormSchema>
