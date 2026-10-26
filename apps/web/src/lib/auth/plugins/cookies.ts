import { tanstackStartCookies } from "better-auth/tanstack-start"

export function createCookiesPlugin() {
  return tanstackStartCookies()
}
