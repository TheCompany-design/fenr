import type { BetterAuthOptions } from "better-auth"
import { moduleLogger } from "@/lib/logger"

const authLogger = moduleLogger("auth")

type UserHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["user"]
>

export const userHooks: UserHooks = {
  create: {
    async after(user) {
      if (!user) return
      authLogger.info({ userId: user.id }, "user registered")
    },
  },
}
