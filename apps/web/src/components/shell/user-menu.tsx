/**
 * User profile menu — signed-in identity + logout.
 *
 * Defensive by design: missing/empty user fields fall back (name → email →
 * initials). Sign-out failure never traps the user in a broken state: they
 * stay put with an actionable retry message (navigating away would be wrong
 * when the session cookie is still valid — the _protected guard would just
 * bounce them back). Double-invocation guarded via pending.
 */

import { Logout03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useState } from "react"
import { toast } from "sonner"

import { signOut } from "@/lib/auth-client"

export interface SessionUser {
  name: string
  email: string
  image?: string | null
}

function initialsOf(user: SessionUser): string {
  const source = user.name.trim() || user.email.trim()
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
  return initials || "?"
}

export function UserMenu({ user }: { user: SessionUser }) {
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleSignOut = async () => {
    if (pending) return
    setPending(true)
    try {
      const { error } = await signOut()
      if (error) {
        // Soft failure (e.g. transient network error): the session cookie may
        // still be valid, so navigating to /auth/sign-in would bounce straight
        // back through the _protected guard. Stay put with an actionable
        // retry message instead.
        toast.error("Couldn't sign out", {
          description:
            "We couldn't reach the server. Check your connection and try again.",
        })
        setPending(false)
        return
      }
      toast.success("Signed out")
    } catch {
      toast.error("Couldn't sign out", {
        description: "Something went wrong. Please try again.",
      })
      setPending(false)
      return
    }
    await navigate({ to: "/auth/sign-in" }).finally(() => {
      // Always drop cached user-scoped data — even if navigation is
      // interrupted — so nothing survives into a later account's session.
      // Resetting pending here too guards a stuck disabled menu item when
      // navigation rejects without unmounting us.
      queryClient.clear()
      setPending(false)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open profile menu"
            className="rounded-full"
            size="icon"
            variant="ghost"
          />
        }
      >
        <Avatar className="size-8">
          {user.image ? <AvatarImage alt="" src={user.image} /> : null}
          <AvatarFallback>{initialsOf(user)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {/* GroupLabel requires a Group ancestor (Base UI contract) — a bare
            label inside Content throws at render time. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="truncate font-medium">
                {user.name.trim() || user.email}
              </span>
              <span className="text-muted-foreground text-xs">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={handleSignOut}
        >
          <HugeiconsIcon icon={Logout03Icon} size={16} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
