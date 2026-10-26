import { createServerFn } from "@tanstack/react-start"
import { getCookies } from "@tanstack/react-start/server"

export const getSidebarOpen = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    try {
      return getCookies().sidebar_state !== "false"
    } catch {
      return true
    }
  },
)
