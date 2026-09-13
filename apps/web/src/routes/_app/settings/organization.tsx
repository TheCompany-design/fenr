/**
 * /settings/organization — Organization workspace settings, teammate invites, and member management.
 *
 * Runs under the _app guard layout, ensuring a valid authenticated session
 * and an active organization are present in route context.
 */
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  OrganizationSettings,
  organizationInvitationsQueryOptions,
  organizationMembersQueryOptions,
} from "@/features/organizations"
import { moduleLogger } from "@/lib/logger"

const log = moduleLogger("organization-settings")

export function OrganizationSettingsErrorComponent({
  reset,
}: ErrorComponentProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)

    try {
      await router.invalidate()
      reset()
    } catch (err) {
      log.error({ err }, "Failed to reload organization settings on retry")
      toast.error("Retry failed", {
        description:
          "Could not reload organization settings. Please try again.",
      })
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false)
      }
    }
  }

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-4">
          <HugeiconsIcon icon={AlertCircleIcon} size={24} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Unable to load organization settings
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          We encountered an error loading the settings or member data for this
          workspace. Please try again.
        </p>
        <div className="mt-4">
          <Button onClick={handleRetry} disabled={isRetrying} variant="outline">
            {isRetrying ? "Retrying..." : "Try again"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_app/settings/organization")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      await Promise.all([
        context.queryClient.ensureQueryData(
          organizationMembersQueryOptions(activeOrg.organization.id),
        ),
        activeOrg.role === "owner" || activeOrg.role === "admin"
          ? context.queryClient.ensureQueryData(
              organizationInvitationsQueryOptions(activeOrg.organization.id),
            )
          : Promise.resolve(),
      ])
    }
  },
  component: OrganizationSettingsRoute,
  errorComponent: OrganizationSettingsErrorComponent,
})

function OrganizationSettingsRoute() {
  const { session, activeOrganization } = Route.useRouteContext()

  return (
    <div className="flex-1 p-6 lg:p-8">
      <OrganizationSettings
        activeOrganization={activeOrganization}
        currentUserId={session.user.id}
      />
    </div>
  )
}
