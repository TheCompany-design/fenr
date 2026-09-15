/**
 * /invitations/accept — Invitation Acceptance Route.
 *
 * Validates session, confirms email ownership, displays organization details,
 * and accepts the invitation atomically into the user's active tenancy.
 */
import {
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  Logout03Icon,
  Mail01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"

import {
  acceptInvitationFn,
  invalidateOrganizationQueries,
  invitationDetailsQueryOptions,
  OrganizationAvatar,
  organizationKeys,
} from "@/features/organizations"
import { signOut } from "@/lib/auth-client"
import {
  type InvitationAcceptSearch,
  invitationAcceptSearchSchema,
} from "@/lib/schemas/search"
import { getSession } from "@/lib/session"

export const Route = createFileRoute("/invitations/accept")({
  validateSearch: (search: Record<string, unknown>): InvitationAcceptSearch =>
    invitationAcceptSearchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (!session) {
      const redirectTarget = search.id
        ? `/invitations/accept?id=${encodeURIComponent(search.id)}`
        : "/invitations/accept"
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: redirectTarget },
      })
    }
    return { session }
  },
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ context, deps }) => {
    if (deps.id?.trim()) {
      await context.queryClient
        .ensureQueryData(invitationDetailsQueryOptions(deps.id.trim()))
        .catch(() => undefined)
    }
  },
  component: InvitationAcceptPage,
})

function InvitationAcceptPage() {
  const { session } = Route.useRouteContext()
  const search = Route.useSearch()
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isAccepting, setIsAccepting] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const isAcceptingRef = React.useRef(false)
  const isSigningOutRef = React.useRef(false)

  const invitationId = search.id?.trim() ?? ""

  const {
    data: detailsResult,
    isLoading,
    isError,
    refetch,
  } = useQuery(invitationDetailsQueryOptions(invitationId))

  const isEmailVerified = Boolean(session.user.emailVerified)

  const handleSignOut = async () => {
    if (isSigningOutRef.current) return
    isSigningOutRef.current = true
    setIsSigningOut(true)
    try {
      await signOut()
    } catch {
      toast.error("Could not sign out", { description: "Please try again." })
      isSigningOutRef.current = false
      setIsSigningOut(false)
      return
    }

    queryClient.clear()
    const redirectUrl = invitationId
      ? `/invitations/accept?id=${encodeURIComponent(invitationId)}`
      : "/invitations/accept"

    try {
      await navigate({
        to: "/auth/sign-in",
        search: { redirect: redirectUrl },
      })
    } catch {
      toast.error("Signed out, but navigation failed", {
        description: "Please reload the page to continue.",
      })
    } finally {
      isSigningOutRef.current = false
      setIsSigningOut(false)
    }
  }

  const handleAccept = async () => {
    if (!invitationId || isAcceptingRef.current || !isEmailVerified) return
    isAcceptingRef.current = true
    setIsAccepting(true)

    let result: { organizationId: string }
    try {
      result = await acceptInvitationFn({
        data: { invitationId },
      })
    } catch {
      toast.error("Could not accept invitation", {
        description:
          "We were unable to accept this invitation. Please try again or request a new link.",
      })
      await queryClient.invalidateQueries({
        queryKey: organizationKeys.invitationDetails(invitationId),
      })
      isAcceptingRef.current = false
      setIsAccepting(false)
      return
    }

    toast.success("Invitation accepted", {
      description: "Welcome to the workspace!",
    })

    // Keep isAccepting active to prevent duplicate accept submissions while navigating
    try {
      await invalidateOrganizationQueries(queryClient, result.organizationId)
      await router.invalidate()
      await navigate({ to: "/" })
    } catch {
      try {
        await navigate({ to: "/" })
      } catch {
        toast.error("Navigation failed", {
          description:
            "Please reload the page or navigate to the dashboard manually.",
        })
      }
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center p-4 bg-background selection:bg-primary/20">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <Link
          to="/"
          className="text-2xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          Fenr
        </Link>
      </div>

      <Card className="w-full max-w-md border-border/80 bg-card/90 backdrop-blur-md shadow-lg">
        {/* Missing or Invalid ID */}
        {(!invitationId || detailsResult?.status === "invalid") && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <HugeiconsIcon icon={Alert02Icon} className="size-6" />
              </div>
              <CardTitle className="text-xl">Invalid Invitation Link</CardTitle>
              <CardDescription>
                This invitation link is missing or malformed. Please check the
                link in your email or contact your administrator.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Link
                to="/"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Go to Dashboard
              </Link>
            </CardFooter>
          </>
        )}

        {/* Loading State */}
        {invitationId && isLoading && (
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-8 animate-spin text-primary"
            />
            <p className="text-sm text-muted-foreground">
              Retrieving invitation details...
            </p>
          </CardContent>
        )}

        {/* Query Error State */}
        {invitationId && !isLoading && isError && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <HugeiconsIcon icon={Alert02Icon} className="size-6" />
              </div>
              <CardTitle className="text-xl">
                Failed to Load Invitation
              </CardTitle>
              <CardDescription>
                We could not retrieve this invitation due to a network or server
                error. Please check your connection and try again.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void refetch()
                }}
              >
                Try again
              </Button>
              <Link to="/" className={cn(buttonVariants({ variant: "ghost" }))}>
                Go to Dashboard
              </Link>
            </CardFooter>
          </>
        )}

        {/* Invitation Not Found */}
        {invitationId &&
          !isLoading &&
          !isError &&
          detailsResult?.status === "not_found" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <HugeiconsIcon icon={Alert02Icon} className="size-6" />
                </div>
                <CardTitle className="text-xl">Invitation Not Found</CardTitle>
                <CardDescription>
                  We could not retrieve this invitation. It may have expired,
                  been revoked, or is temporarily unavailable.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center">
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Go to Dashboard
                </Link>
              </CardFooter>
            </>
          )}

        {/* Expired */}
        {invitationId &&
          !isLoading &&
          !isError &&
          detailsResult?.status === "expired" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <HugeiconsIcon icon={Alert02Icon} className="size-6" />
                </div>
                <CardTitle className="text-xl">Invitation Expired</CardTitle>
                <CardDescription>
                  This invitation
                  {detailsResult.invitation?.organizationName ? (
                    <>
                      {" "}
                      to join{" "}
                      <strong className="text-foreground font-semibold">
                        {detailsResult.invitation.organizationName}
                      </strong>
                    </>
                  ) : null}{" "}
                  has expired. Please request a new invitation from your team
                  administrator.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center">
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Go to Dashboard
                </Link>
              </CardFooter>
            </>
          )}

        {/* Canceled */}
        {invitationId &&
          !isLoading &&
          !isError &&
          detailsResult?.status === "canceled" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <HugeiconsIcon icon={Alert02Icon} className="size-6" />
                </div>
                <CardTitle className="text-xl">Invitation Canceled</CardTitle>
                <CardDescription>
                  This invitation has been canceled by an organization
                  administrator.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center">
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Go to Dashboard
                </Link>
              </CardFooter>
            </>
          )}

        {/* Already Accepted */}
        {invitationId &&
          !isLoading &&
          !isError &&
          detailsResult?.status === "accepted" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-6"
                  />
                </div>
                <CardTitle className="text-xl">Already Accepted</CardTitle>
                <CardDescription>
                  This invitation
                  {detailsResult.invitation?.organizationName ? (
                    <>
                      {" "}
                      to{" "}
                      <strong className="text-foreground font-semibold">
                        {detailsResult.invitation.organizationName}
                      </strong>
                    </>
                  ) : null}{" "}
                  has already been accepted.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center">
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "default" }))}
                >
                  Open Workspace
                </Link>
              </CardFooter>
            </>
          )}

        {/* Valid Pending Invitation */}
        {invitationId &&
          !isLoading &&
          !isError &&
          detailsResult?.status === "valid" &&
          detailsResult.invitation &&
          (session.user.email.trim().toLowerCase() !==
          detailsResult.invitation.email.trim().toLowerCase() ? (
            // Email Mismatch Guard
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <HugeiconsIcon icon={Shield01Icon} className="size-6" />
                </div>
                <CardTitle className="text-xl">Email Mismatch</CardTitle>
                <CardDescription className="text-left space-y-2 pt-2">
                  <p>
                    This invitation was sent to:
                    <br />
                    <strong className="text-foreground font-semibold">
                      {detailsResult.invitation.email}
                    </strong>
                  </p>
                  <p>
                    You are currently signed in as:
                    <br />
                    <strong className="text-foreground font-semibold">
                      {session.user.email}
                    </strong>
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    To accept this invitation, sign out and sign in with the
                    matching email address.
                  </p>
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full gap-2"
                >
                  <HugeiconsIcon
                    icon={isSigningOut ? Loading03Icon : Logout03Icon}
                    className={`size-4 ${isSigningOut ? "animate-spin" : ""}`}
                  />
                  {isSigningOut
                    ? "Signing out..."
                    : "Switch to invited account"}
                </Button>
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
                >
                  Back to Dashboard
                </Link>
              </CardFooter>
            </>
          ) : (
            // Valid Matching Email -> Ready to Accept
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3">
                  <OrganizationAvatar
                    name={detailsResult.invitation.organizationName}
                    logo={detailsResult.invitation.organizationLogo}
                    size="lg"
                  />
                </div>
                <CardTitle className="text-xl">
                  Join {detailsResult.invitation.organizationName}
                </CardTitle>
                <CardDescription>
                  <strong className="text-foreground font-medium">
                    {detailsResult.invitation.inviterName}
                  </strong>{" "}
                  invited you to collaborate as{" "}
                  <Badge
                    variant="secondary"
                    className="capitalize font-normal text-xs ml-1"
                  >
                    {detailsResult.invitation.role}
                  </Badge>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2.5">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    className="size-4 shrink-0 text-foreground"
                  />
                  <span>
                    Accepting as{" "}
                    <strong className="text-foreground font-medium">
                      {session.user.email}
                    </strong>
                  </span>
                </div>

                {!isEmailVerified && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2.5">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      className="size-4 shrink-0"
                    />
                    <span>
                      Your email address is not verified. Please verify your
                      email before accepting this invitation.
                    </span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting || !isEmailVerified}
                  className="w-full gap-2"
                >
                  <HugeiconsIcon
                    icon={isAccepting ? Loading03Icon : ArrowRight01Icon}
                    className={`size-4 ${isAccepting ? "animate-spin" : ""}`}
                  />
                  {isAccepting ? "Joining..." : "Accept & Launch Workspace"}
                </Button>
                <Link
                  to="/"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full text-xs",
                  )}
                >
                  Go back
                </Link>
              </CardFooter>
            </>
          ))}

        {/* Unexpected / Unhandled State Fallback */}
        {invitationId &&
          !isLoading &&
          !isError &&
          detailsResult?.status !== "invalid" &&
          detailsResult?.status !== "not_found" &&
          detailsResult?.status !== "expired" &&
          detailsResult?.status !== "canceled" &&
          detailsResult?.status !== "accepted" &&
          !(detailsResult?.status === "valid" && detailsResult.invitation) && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <HugeiconsIcon icon={Alert02Icon} className="size-6" />
                </div>
                <CardTitle className="text-xl">
                  Unable to Process Invitation
                </CardTitle>
                <CardDescription>
                  An unexpected error occurred while processing this invitation.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center">
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Go to Dashboard
                </Link>
              </CardFooter>
            </>
          )}
      </Card>
    </div>
  )
}
