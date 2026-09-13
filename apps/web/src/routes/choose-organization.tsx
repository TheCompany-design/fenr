/**
 * /choose-organization — Workspace / Organization Chooser.
 *
 * Route guard ensures user is authenticated and has at least 1 membership.
 * If user has 0 memberships, redirects to /onboarding.
 * Users can switch between their organizations or proceed to active workspace.
 */
import {
  Add01Icon,
  Building01Icon,
  CheckmarkCircle02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import {
  invalidateOrganizationQueries,
  organizationListQueryOptions,
  setActiveOrganizationFn,
} from "@/features/organizations"
import { moduleLogger } from "@/lib/logger"
import { safeAppRedirectPath, safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const log = moduleLogger("choose-organization")

const chooseOrganizationSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/choose-organization")({
  validateSearch: (search) => chooseOrganizationSearchSchema.parse(search),
  beforeLoad: async ({ context, location }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: safeRedirectPath(location.href) },
      })
    }

    const organizations = await context.queryClient.ensureQueryData(
      organizationListQueryOptions(),
    )
    if (organizations.length === 0) {
      throw redirect({ to: "/onboarding", search: { step: "naming" } })
    }

    return { session }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(organizationListQueryOptions()),
  component: ChooseOrganizationRoute,
})

function ChooseOrganizationRoute() {
  const { redirect: redirectParam } = Route.useSearch()
  const { session } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const isSelectingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const { data: organizations } = useSuspenseQuery(
    organizationListQueryOptions(),
  )

  const handleSelect = async (organizationId: string) => {
    if (isSelectingRef.current) return
    isSelectingRef.current = true
    setSelectingId(organizationId)

    try {
      await setActiveOrganizationFn({ data: { organizationId } })
      await invalidateOrganizationQueries(queryClient, organizationId)
      void router.invalidate().catch((err) => {
        log.warn(
          { err, organizationId },
          "Failed to invalidate router after setting active organization",
        )
      })

      if (!isMountedRef.current) return

      const target = safeAppRedirectPath(redirectParam)
      await navigate({ href: target })
    } catch (err) {
      if (!isMountedRef.current) return
      log.error({ err, organizationId }, "Failed to select active organization")
      toast.error("Failed to select organization", {
        description: "Could not switch active organization. Please try again.",
      })
    } finally {
      isSelectingRef.current = false
      if (isMountedRef.current) {
        setSelectingId(null)
      }
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg border-border/60 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={Building01Icon} size={24} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Select an organization
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Choose an organization to open your workspace as{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <ScrollArea className="max-h-[380px] pr-1">
            <div className="flex flex-col gap-2">
              {organizations.map((org) => {
                const isSelected = org.isActive
                const isCurrentPending = selectingId === org.id
                const initial = org.name.trim().charAt(0).toUpperCase() || "O"

                return (
                  <button
                    type="button"
                    key={org.id}
                    disabled={selectingId !== null}
                    aria-label={
                      isSelected ? `Enter ${org.name}` : `Select ${org.name}`
                    }
                    onClick={() => handleSelect(org.id)}
                    className={cn(
                      "w-full text-left flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors cursor-pointer select-none",
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/60 bg-card hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-sm shadow-xs">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-foreground text-sm">
                            {org.name}
                          </span>
                          <Badge
                            variant={
                              org.role === "owner"
                                ? "default"
                                : org.role === "admin"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px] uppercase tracking-wider"
                          >
                            {org.role}
                          </Badge>
                          {isSelected && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-primary font-medium">
                              <HugeiconsIcon
                                icon={CheckmarkCircle02Icon}
                                size={14}
                              />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono truncate">
                            /{org.slug}
                          </span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <HugeiconsIcon
                              icon={UserMultiple02Icon}
                              size={12}
                            />
                            {org.memberCount}{" "}
                            {org.memberCount === 1 ? "member" : "members"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        buttonVariants({
                          variant: isSelected ? "secondary" : "outline",
                          size: "sm",
                        }),
                        "pointer-events-none shrink-0",
                      )}
                    >
                      {isCurrentPending
                        ? "Selecting..."
                        : isSelected
                          ? "Enter"
                          : "Select"}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>

          <div className="border-t border-border/50 pt-4">
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={selectingId !== null}
              nativeButton={false}
              render={
                <Link
                  to="/onboarding"
                  search={{ step: "naming" }}
                  disabled={selectingId !== null}
                />
              }
            >
              <HugeiconsIcon icon={Add01Icon} size={16} />
              Create new organization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
