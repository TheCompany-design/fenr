/**
 * /onboarding — Organization setup & onboarding.
 *
 * Route guard ensures user is authenticated before landing here.
 * Full onboarding creation wizard will be implemented in Atom 9.
 */
import { Building01Icon, RocketIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useState } from "react"
import { toast } from "sonner"

import { signOut } from "@/lib/auth-client"
import { getSession } from "@/lib/session"

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: "/onboarding" },
      })
    }
    return { session }
  },
  component: OnboardingPlaceholder,
})

function OnboardingPlaceholder() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      queryClient.clear()
      await navigate({ to: "/auth/sign-in" })
    } catch {
      toast.error("Couldn't sign out", { description: "Please try again." })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={RocketIcon} size={24} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome to Fenr
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
            <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs">
              <HugeiconsIcon icon={Building01Icon} size={18} />
            </div>
            <h2 className="text-sm font-semibold">
              Create your first organization
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              To get started with Fenr, you need an active organization
              workspace. Organization creation will be available here shortly.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              render={<Link to="/choose-organization" />}
            >
              Choose Existing Organization
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              disabled={signingOut}
              onClick={handleSignOut}
            >
              {signingOut ? "Signing out..." : "Sign out / switch account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
