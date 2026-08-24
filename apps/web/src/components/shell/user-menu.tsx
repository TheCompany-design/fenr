/**
 * User profile menu — signed-in identity + logout.
 *
 * Defensive by design: missing/empty user fields fall back (name → email →
 * initials). Sign-out failure never traps the user: they still navigate
 * away (the _protected guard re-checks the session on next navigation) and
 * get an actionable Sonner message. Double-invocation guarded via pending.
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
        // Session may be stale or the backend unreachable — either way the
        // guard re-validates on navigation, so we still leave.
        toast.error("Couldn't sign out cleanly", {
          description:
            "You've been returned to the sign-in page. Try again there.",
        })
      } else {
        toast.success("Signed out")
      }
      // Drop any cached user-scoped data so nothing leaks across accounts.
      queryClient.clear()
    } catch {
      toast.error("Couldn't sign out", {
        description: "Something went wrong. Please try again.",
      })
      setPending(false)
      return
    }
    await navigate({ to: "/auth/sign-in" })
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
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-medium">
              {user.name.trim() || user.email}
            </span>
            <span className="text-muted-foreground text-xs">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={handleSignOut}>
          <HugeiconsIcon icon={Logout03Icon} size={16} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
