import { z } from "zod"

export const dashboardPostSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
})

export const dashboardPostsSchema = z.array(dashboardPostSchema)

export type DashboardPost = z.infer<typeof dashboardPostSchema>
