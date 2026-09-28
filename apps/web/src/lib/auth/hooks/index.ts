import type { BetterAuthOptions } from "better-auth"
import { accountHooks } from "./account"
import { sessionHooks } from "./session"
import { userHooks } from "./user"

export * from "./account"
export * from "./session"
export * from "./user"

export function createDatabaseHooks(): NonNullable<
  BetterAuthOptions["databaseHooks"]
> {
  return {
    account: accountHooks,
    user: userHooks,
    session: sessionHooks,
  }
}
