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
  Loading03Icon,
  Logout03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"
import { z } from "zod"

import { AuthShell } from "@/features/auth/components/auth-shell"
import {
  InviteMembersForm,
  OrganizationAvatar,
  OrganizationForm,
} from "@/features/organizations"
import {
  invalidateOrganizationQueries,
  organizationInvitationsQueryOptions,
  organizationListQueryOptions,
} from "@/features/organizations/queries"
import type {
  CreateOrganizationInput,
  OrganizationRole,
} from "@/features/organizations/schemas"
import {
  createOrganizationFn,
  inviteMemberFn,
  setActiveOrganizationFn,
} from "@/features/organizations/server"
import { signOut } from "@/lib/auth-client"
import { moduleLogger } from "@/lib/logger"
import { safeRedirectPath } from "@/lib/redirect"
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
  beforeLoad: async ({ context, location, search }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: safeRedirectPath(location.href) },
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

  // Fetch invitations for target organization to resiliently populate invitedCount even on reload
  const targetOrgId = search.orgId ?? currentOrg?.id ?? ""
  const { data: invitations = [] } = useQuery({
    ...organizationInvitationsQueryOptions(targetOrgId),
    enabled: Boolean(targetOrgId),
  })
  const displayInvitedCount = Math.max(invitedCount, invitations.length)

  const handleSignOut = async () => {
    if (
      isSigningOutRef.current ||
      isCreatingRef.current ||
      isEnteringRef.current
    ) {
      return
    }
    isSigningOutRef.current = true
    setIsSigningOut(true)
    try {
      const res = await signOut()
      if (res?.error) {
        log.error({ err: res.error }, "Sign out failed")
        toast.error("Couldn't sign out", { description: "Please try again." })
        return
      }
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
    if (isSigningOutRef.current || isCreatingRef.current) return
    if (createdOrg) {
      try {
        await navigate({
          search: { step: "invites", orgId: createdOrg.id },
        })
      } catch (retryErr) {
        log.error({ err: retryErr }, "Failed to navigate to invites on retry")
      }
      return
    }

    isCreatingRef.current = true
    setIsCreating(true)

    let org: { id: string; name: string; slug: string }
    try {
      org = await createOrganizationFn({ data: values })
      setCreatedOrg(org)
      toast.success("Workspace created", {
        description: `Welcome to ${org.name}!`,
      })
    } catch (err) {
      log.error(
        { err, name: values.name, slug: values.slug },
        "Failed to create workspace",
      )
      const description =
        err instanceof Error
          ? err.message
          : "The workspace could not be created. Please try again."
      toast.error("Could not create workspace", { description })
      isCreatingRef.current = false
      setIsCreating(false)
      return
    }

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
      isCreatingRef.current = false
      setIsCreating(false)
    }
  }

  // Step 2: Invitations Submit
  const handleSendInvites = async (
    invites: Array<{ email: string; role: OrganizationRole; note?: string }>,
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
            note: invite.note,
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
    if (isSigningOutRef.current || isEnteringRef.current) return
    isEnteringRef.current = true
    setIsEntering(true)
    try {
      const targetOrgId = search.orgId ?? currentOrg?.id
      if (targetOrgId) {
        try {
          await setActiveOrganizationFn({
            data: { organizationId: targetOrgId },
          })
        } catch (setErr) {
          log.warn(
            { err: setErr, targetOrgId },
            "Failed to explicitly set active organization",
          )
        }
      }
      await invalidateOrganizationQueries(queryClient, targetOrgId)
      await navigate({ to: "/" })
    } catch (err) {
      log.error({ err }, "Navigation to workspace failed")
      toast.error("Navigation failed", {
        description: "Please reload the page or navigate to your workspace.",
      })
    } finally {
      isEnteringRef.current = false
      setIsEntering(false)
    }
  }

  const currentStep = search.step ?? "naming"
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <AuthShell
      eyebrow="Fenr"
      quoteEyebrow="Onboarding"
      tagline="A single canvas for documentation, engineering specs, and team alignment."
    >
      {/* Top utility row with Stepper and Sign Out */}
      <div className="mb-8 flex items-center justify-between border-b border-border/40 pb-4">
        <Stepper currentStepIndex={currentStepIndex} />

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {session.user.email}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleSignOut}
            disabled={isSigningOut || isCreating || isEntering}
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <HugeiconsIcon icon={Logout03Icon} size={13} className="mr-1" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>

      {/* STEP 1: Workspace Naming */}
      {currentStep === "naming" && (
        <div
          className="flex min-w-0 flex-col gap-6"
          data-testid="onboarding-step-naming"
        >
          <header>
            <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
              Name your workspace
            </div>
            <h1 className="mt-2 font-heading text-3xl leading-tight text-foreground">
              What are we calling it?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a display name and unique URL for your organization.
            </p>
          </header>

          <OrganizationForm
            onSubmit={handleCreateOrganization}
            isSubmitting={isCreating || isSigningOut}
            submitLabel="Continue to Teammates"
          />
        </div>
      )}

      {/* STEP 2: Optional Teammates */}
      {currentStep === "invites" && (
        <div
          className="flex flex-col gap-6"
          data-testid="onboarding-step-invites"
        >
          <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
                Bring people with you
              </div>
              <h1 className="mt-2 font-heading text-3xl leading-tight text-foreground">
                Invite teammates
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Collaborate with teammates in{" "}
                <strong className="font-medium text-foreground break-words">
                  {currentOrg?.name ?? "your new workspace"}
                </strong>
                . Optional — you can add anyone later.
              </p>
            </div>
            {currentOrg && (
              <OrganizationAvatar
                name={currentOrg.name}
                slug={currentOrg.slug}
                size="md"
                className="shrink-0 self-start"
              />
            )}
          </header>

          <InviteMembersForm
            organizationId={search.orgId}
            onInvite={handleSendInvites}
            onSkip={handleSkipInvites}
            onComplete={handleInvitesComplete}
            submitLabel="Send Invites & Continue"
            skipLabel="Skip for now"
          />
        </div>
      )}

      {/* STEP 3: Welcome & Finish */}
      {currentStep === "welcome" && (
        <div
          className="flex flex-col gap-6"
          data-testid="onboarding-step-welcome"
        >
          <header>
            <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
              You&apos;re set
            </div>
            <h1 className="mt-2 font-heading text-3xl leading-tight text-foreground">
              Welcome to {currentOrg?.name ?? "Fenr"}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {displayInvitedCount === 0
                ? "Quiet for now — when you're ready, invite people from workspace settings."
                : `We've sent ${displayInvitedCount} invite${displayInvitedCount === 1 ? "" : "s"}. They'll show up in members once accepted.`}
            </p>
          </header>

          <div className="grid grid-cols-3 gap-3">
            <FactCard
              label="Workspace"
              value={currentOrg?.name ?? "Untitled"}
            />
            <FactCard label="Members" value={String(displayInvitedCount + 1)} />
            <FactCard
              label="Slug"
              value={currentOrg?.slug ? `/${currentOrg.slug}` : "—"}
            />
          </div>

          <Button
            size="lg"
            onClick={handleEnterApp}
            disabled={isEntering || isSigningOut}
            className="mt-2 w-full text-sm font-medium gap-2 cursor-pointer"
          >
            {isEntering ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="animate-spin"
                />
                <span>Launching Workspace…</span>
              </>
            ) : (
              <>
                <span>Launch Workspace</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </>
            )}
          </Button>
        </div>
      )}
    </AuthShell>
  )
}

function Stepper({ currentStepIndex }: { currentStepIndex: number }) {
  return (
    <section
      aria-label={`Progress: Step ${currentStepIndex + 1} of ${STEPS.length}`}
      className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]"
    >
      <span>
        Step {String(currentStepIndex + 1).padStart(2, "0")} / {STEPS.length}
      </span>
      <div aria-hidden="true" className="ml-2 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === currentStepIndex
                ? "w-5 bg-foreground"
                : i < currentStepIndex
                  ? "w-1.5 bg-foreground/70"
                  : "w-1.5 bg-foreground/20",
            )}
          />
        ))}
      </div>
    </section>
  )
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
        {label}
      </div>
      <div
        title={value}
        className="mt-1 truncate font-heading text-sm font-medium text-foreground"
      >
        {value}
      </div>
    </div>
  )
}
