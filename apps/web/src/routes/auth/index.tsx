/**
 * /auth/ — Root auth index route.
 *
 * Redirects visitors to /auth/sign-in while preserving query parameters.
 */
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

const searchSchema = z
  .object({
    redirect: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough()

export const Route = createFileRoute("/auth/")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/auth/sign-in",
      search,
    })
  },
})
