/**
 * /onboarding — Guarded 3-Step Organization Onboarding.
 *
 * 1. Naming & URL slug validation (OrganizationForm)
 * 2. Optional teammate invitations (InviteMembersForm)
 * 3. Welcome & workspace entry confirmation
 *
 * Step progression is URL-persisted and guarded against illegal jumps.
 */
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  Logout03Icon,
  RocketIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"
import { z } from "zod"

import {
  InviteMembersForm,
  OrganizationAvatar,
  OrganizationForm,
} from "@/features/organizations"
import {
  invalidateOrganizationQueries,
  organizationKeys,
  organizationListQueryOptions,
} from "@/features/organizations/queries"
import type {
  CreateOrganizationInput,
  OrganizationRole,
} from "@/features/organizations/schemas"
import {
  createOrganizationFn,
  inviteMemberFn,
} from "@/features/organizations/server"
import { signOut } from "@/lib/auth-client"
import { moduleLogger } from "@/lib/logger"
import { getSession } from "@/lib/session"

const log = moduleLogger("onboarding")

export const onboardingSearchSchema = z.object({
  step: z
    .enum(["naming", "invites", "welcome"])
    .optional()
    .default("naming")
    .catch("naming"),
  orgId: z.string().uuid().optional().catch(undefined),
})

export type OnboardingSearch = z.infer<typeof onboardingSearchSchema>

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch =>
    onboardingSearchSchema.parse(search),
  beforeLoad: async ({ context, search }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: "/onboarding" },
      })
    }

    const currentStep = search.step ?? "naming"

    // Guard step progression: cannot enter 'invites' or 'welcome' without a valid orgId
    if (currentStep === "invites" || currentStep === "welcome") {
      if (!search.orgId) {
        throw redirect({
          to: "/onboarding",
          search: { step: "naming" },
        })
      }

      // Verify user actually belongs to this organization.
      // If ensureQueryData returns stale cache, fallback to fresh network fetch before redirecting.
      let memberships = await context.queryClient.ensureQueryData(
        organizationListQueryOptions(),
      )
      let hasMembership = memberships.some((m) => m.id === search.orgId)
      if (!hasMembership) {
        memberships = await context.queryClient.fetchQuery(
          organizationListQueryOptions(),
        )
        hasMembership = memberships.some((m) => m.id === search.orgId)
      }

      if (!hasMembership) {
        throw redirect({
          to: "/onboarding",
          search: { step: "naming" },
        })
      }
    }

    return { session }
  },
  loader: async ({ context }) => {
    await context.queryClient
      .ensureQueryData(organizationListQueryOptions())
      .catch(() => undefined)
  },
  component: OnboardingPage,
})

const STEPS = [
  { id: "naming", label: "Workspace", stepNumber: 1 },
  { id: "invites", label: "Teammates", stepNumber: 2 },
  { id: "welcome", label: "Ready", stepNumber: 3 },
] as const

function OnboardingPage() {
  const { session } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const queryClient = useQueryClient()

  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const isSigningOutRef = React.useRef(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const isCreatingRef = React.useRef(false)
  const [isEntering, setIsEntering] = React.useState(false)
  const isEnteringRef = React.useRef(false)

  const [createdOrg, setCreatedOrg] = React.useState<{
    id: string
    name: string
    slug: string
  } | null>(null)
  const [invitedCount, setInvitedCount] = React.useState(0)

  // Fetch memberships for resilient resume
  const { data: organizations = [] } = useQuery(organizationListQueryOptions())

  // Find target organization if orgId is in search params
  const currentOrg = React.useMemo(() => {
    if (createdOrg && (!search.orgId || createdOrg.id === search.orgId)) {
      return createdOrg
    }
    if (search.orgId) {
      const found = organizations.find((o) => o.id === search.orgId)
      if (found) {
        return {
          id: found.id,
          name: found.name,
          slug: found.slug,
        }
      }
    }
    return null
  }, [createdOrg, search.orgId, organizations])

  const handleSignOut = async () => {
    if (isSigningOutRef.current) return
    isSigningOutRef.current = true
    setIsSigningOut(true)
    try {
      await signOut()
      queryClient.clear()
      await navigate({ to: "/auth/sign-in" })
    } catch (err) {
      log.error({ err }, "Sign out failed")
      toast.error("Couldn't sign out", { description: "Please try again." })
    } finally {
      isSigningOutRef.current = false
      setIsSigningOut(false)
    }
  }

  // Step 1: Create Organization Submit
  const handleCreateOrganization = async (values: CreateOrganizationInput) => {
    if (isCreatingRef.current || createdOrg) return
    isCreatingRef.current = true
    setIsCreating(true)

    let org: { id: string; name: string; slug: string }
    try {
      org = await createOrganizationFn({ data: values })
    } catch (err) {
      log.error(
        { err, name: values.name, slug: values.slug },
        "Failed to create workspace",
      )
      toast.error("Could not create workspace", {
        description: "The workspace could not be created. Please try again.",
      })
      isCreatingRef.current = false
      setIsCreating(false)
      return
    }

    setCreatedOrg(org)
    queryClient.setQueryData(
      organizationKeys.lists(),
      (old: Array<{ id: string; name: string; slug: string }> = []) => [
        ...old,
        org,
      ],
    )
    toast.success("Workspace created", {
      description: `Welcome to ${org.name}!`,
    })

    try {
      await invalidateOrganizationQueries(queryClient, org.id)
      await navigate({
        search: { step: "invites", orgId: org.id },
      })
    } catch (postCreateErr) {
      log.error(
        { err: postCreateErr, orgId: org.id },
        "Error during post-creation invalidation or navigation",
      )
      try {
        await navigate({
          search: { step: "invites", orgId: org.id },
        })
      } catch {
        toast.info(
          "Workspace created, but could not advance automatically. Please refresh.",
        )
      }
    } finally {
      setIsCreating(false)
    }
  }

  // Step 2: Invitations Submit
  const handleSendInvites = async (
    invites: Array<{ email: string; role: OrganizationRole }>,
  ) => {
    const orgId = search.orgId ?? currentOrg?.id
    if (!orgId) {
      throw new Error("Organization ID is missing")
    }

    const settledResults = await Promise.allSettled(
      invites.map(async (invite) => {
        await inviteMemberFn({
          data: {
            organizationId: orgId,
            email: invite.email,
            role: invite.role,
          },
        })
        return invite.email
      }),
    )

    const results: Array<{ email: string; success: boolean; error?: string }> =
      settledResults.map((settled, index) => {
        const invite = invites[index]
        if (settled.status === "fulfilled") {
          return { email: invite.email, success: true }
        }
        log.warn(
          { email: invite.email, err: settled.reason },
          "Failed to send onboarding invite",
        )
        return {
          email: invite.email,
          success: false,
          error:
            settled.reason instanceof Error
              ? settled.reason.message
              : "Failed to deliver invitation",
        }
      })

    const successful = results.filter((r) => r.success).length
    if (successful > 0) {
      setInvitedCount((prev) => prev + successful)
      await invalidateOrganizationQueries(queryClient, orgId)
    }

    return results
  }

  const handleSkipInvites = async () => {
    const orgId = search.orgId ?? currentOrg?.id
    await navigate({
      search: { step: "welcome", orgId },
    })
  }

  const handleInvitesComplete = async () => {
    const orgId = search.orgId ?? currentOrg?.id
    await navigate({
      search: { step: "welcome", orgId },
    })
  }

  // Step 3: Enter Application
  const handleEnterApp = async () => {
    if (isEnteringRef.current) return
    isEnteringRef.current = true
    setIsEntering(true)
    try {
      await invalidateOrganizationQueries(queryClient)
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (err) {
      log.error({ err }, "Navigation to workspace failed")
      toast.error("Navigation failed", {
        description: "Please reload the page or navigate to your workspace.",
      })
      isEnteringRef.current = false
      setIsEntering(false)
    }
  }

  const currentStep = search.step ?? "naming"
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center p-4 bg-background">
      {/* Top utility bar */}
      <div className="fixed top-4 right-4 flex items-center gap-3">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Signed in as{" "}
          <strong className="font-medium text-foreground">
            {session.user.email}
          </strong>
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={Logout03Icon} size={14} className="mr-1.5" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Step Indicator Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <HugeiconsIcon icon={RocketIcon} size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome to Fenr
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Let&apos;s set up your team workspace in a few simple steps.
            </p>
          </div>

          {/* Stepper pills */}
          <div className="flex items-center gap-2 pt-2">
            {STEPS.map((s, idx) => {
              const isPast = idx < currentStepIndex
              const isCurrent = idx === currentStepIndex

              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors select-none",
                      isCurrent &&
                        "bg-primary text-primary-foreground shadow-xs",
                      isPast && "bg-muted text-foreground",
                      !isCurrent && !isPast && "text-muted-foreground/60",
                    )}
                  >
                    <span>{s.stepNumber}.</span>
                    <span>{s.label}</span>
                    {isPast && (
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        size={12}
                        className="text-primary"
                      />
                    )}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="w-3 h-px bg-border shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Card Container */}
        <Card className="border-border/70 shadow-xl overflow-hidden">
          {/* STEP 1: Workspace Naming */}
          {currentStep === "naming" && (
            <>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Name your workspace
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose a display name and unique URL for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <OrganizationForm
                  onSubmit={handleCreateOrganization}
                  isSubmitting={isCreating}
                  submitLabel="Continue to Teammates"
                />
              </CardContent>
            </>
          )}

          {/* STEP 2: Optional Teammates */}
          {currentStep === "invites" && (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      Invite your team
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Collaborate with teammates in{" "}
                      <strong className="font-medium text-foreground">
                        {currentOrg?.name ?? "your new workspace"}
                      </strong>
                      . This is optional.
                    </CardDescription>
                  </div>
                  {currentOrg && (
                    <OrganizationAvatar
                      name={currentOrg.name}
                      slug={currentOrg.slug}
                      size="sm"
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <InviteMembersForm
                  organizationId={search.orgId}
                  onInvite={handleSendInvites}
                  onSkip={handleSkipInvites}
                  onComplete={handleInvitesComplete}
                  submitLabel="Send Invites & Continue"
                  skipLabel="Skip for now"
                />
              </CardContent>
            </>
          )}

          {/* STEP 3: Welcome & Finish */}
          {currentStep === "welcome" && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2">
                  <OrganizationAvatar
                    name={currentOrg?.name}
                    slug={currentOrg?.slug}
                    size="xl"
                    className="shadow-md"
                  />
                </div>
                <CardTitle className="text-xl font-bold">
                  You&apos;re all set!
                </CardTitle>
                <CardDescription className="text-sm">
                  Workspace{" "}
                  <span className="font-semibold text-foreground">
                    {currentOrg?.name}
                  </span>{" "}
                  is ready.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 pt-2">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Workspace URL</span>
                    <span className="font-mono font-medium text-foreground">
                      fenr.app/{currentOrg?.slug}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Your Role</span>
                    <Badge variant="default" className="capitalize text-[10px]">
                      Owner
                    </Badge>
                  </div>
                  {invitedCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Teammates Invited
                      </span>
                      <span className="font-medium text-foreground">
                        {invitedCount}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={handleEnterApp}
                  disabled={isEntering}
                  className="w-full text-sm font-medium"
                >
                  {isEntering ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={16}
                        className="mr-2 animate-spin"
                      />
                      Launching Workspace...
                    </>
                  ) : (
                    <>
                      Launch Workspace
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={16}
                        className="ml-2"
                      />
                    </>
                  )}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
