import type { BetterAuthOptions } from "better-auth"

type AccountHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["account"]
>

export const accountHooks: AccountHooks = {
  create: {
    async before(account) {
      if (!account) return { data: account }
      const currentIssuer = (account as { issuer?: string }).issuer
      return {
        data: {
          ...account,
          issuer: currentIssuer || account.providerId || "local:credential",
        },
      }
    },
  },
}
