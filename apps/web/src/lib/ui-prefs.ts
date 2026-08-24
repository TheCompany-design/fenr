/**
 * Server helpers for UI preferences persisted in cookies.
 *
 * Lives in a lib module (not a route file) because route files are in the
 * client bundle and TanStack Start's import protection denies server-only
 * specifiers there — same pattern as lib/session.ts.
 *
 * The sidebar collapsed/expanded state is written by the SidebarProvider
 * primitive (@workspace/ui sidebar.tsx) into the `sidebar_state` cookie
 * (path=/, max-age 7d, samesite=lax) on every toggle. Reading it on the
 * server lets the first SSR paint match how the user left the sidebar —
 * no post-hydration jump.
 */
import { createServerFn } from "@tanstack/react-start"
import { getCookies } from "@tanstack/react-start/server"

export const getSidebarOpen = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    try {
      // getCookies() returns a plain Record<string, string>. Anything other
      // than the literal "false" (missing cookie, corrupt value) means open.
      return getCookies().sidebar_state !== "false"
    } catch {
      // No request context available — default expanded.
      return true
    }
  },
)
