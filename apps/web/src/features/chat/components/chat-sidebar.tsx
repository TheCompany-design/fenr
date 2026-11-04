import {
  AiChat02Icon,
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/feedback/use-confirm"
import {
  SecondarySidebarBody,
  SecondarySidebarGroup,
  SecondarySidebarGroupLabel,
  SecondarySidebarHeader,
  SecondarySidebarItem,
  SecondarySidebarItemAction,
  SecondarySidebarPortal,
  SecondarySidebarRow,
} from "@/components/shell/secondary-sidebar"
import { deleteChatThreadFn } from "../chat.functions"
import { chatKeys, chatThreadsQueryOptions } from "../queries/chat-queries"
import type { ChatThreadSummary } from "../types"
import { groupChatThreads } from "./chat-threads-grouping"

export interface ChatSidebarProps {
  readonly activeThreadId?: string
}

export function ChatSidebar({ activeThreadId }: ChatSidebarProps) {
  const { data: threads = [], isLoading } = useQuery(chatThreadsQueryOptions())
  const [searchQuery, setSearchQuery] = useState("")
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const trimmedQuery = searchQuery.trim().toLowerCase()

  const filteredThreads = useMemo(() => {
    if (!trimmedQuery) {
      return threads
    }
    return threads.filter((t) =>
      (t.title ?? "New chat").toLowerCase().includes(trimmedQuery),
    )
  }, [threads, trimmedQuery])

  const groups = useMemo(() => {
    return groupChatThreads(filteredThreads)
  }, [filteredThreads])

  const handleDeleteThread = useCallback(
    async (
      event: React.MouseEvent<HTMLButtonElement>,
      thread: ChatThreadSummary,
    ) => {
      event.preventDefault()
      event.stopPropagation()

      const title = thread.title?.trim() || "this conversation"
      const confirmed = await confirm({
        title: "Delete conversation?",
        description: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
        confirmText: "Delete",
        variant: "destructive",
      })

      if (!confirmed) {
        return
      }

      try {
        setIsDeletingId(thread.id)
        const deleted = await deleteChatThreadFn({
          data: { threadId: thread.id },
        })

        if (deleted) {
          toast.success("Conversation deleted")
          await queryClient.invalidateQueries({
            queryKey: chatKeys.threads(),
          })
          if (activeThreadId === thread.id) {
            navigate({ to: "/chat" })
          }
        } else {
          toast.error("Could not delete conversation")
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred"
        toast.error("Failed to delete conversation", { description: message })
      } finally {
        setIsDeletingId(null)
      }
    },
    [activeThreadId, confirm, navigate, queryClient],
  )

  return (
    <SecondarySidebarPortal>
      <SecondarySidebarHeader
        title="Chat"
        actions={
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => navigate({ to: "/chat" })}
                  aria-label="New chat"
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} size={15} />
                </Button>
              }
            />
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        }
      />

      <div className="p-2 pb-1">
        <SecondarySidebarItem
          isActive={!activeThreadId}
          label="New conversation"
          icon={<HugeiconsIcon icon={PencilEdit02Icon} size={14} />}
          render={(props) => <Link to="/chat" {...props} />}
        />
      </div>

      <div className="px-2 py-1.5">
        <div className="relative flex items-center">
          <HugeiconsIcon
            icon={Search01Icon}
            size={13}
            className="pointer-events-none absolute left-2.5 text-sidebar-foreground/50"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history…"
            aria-label="Search conversation history"
            className="h-8 rounded-lg border-sidebar-border/50 bg-sidebar-accent/30 pl-8 pr-7 text-xs placeholder:text-sidebar-foreground/40 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 rounded p-0.5 text-sidebar-foreground/50 hover:text-sidebar-foreground focus-visible:outline-hidden"
              aria-label="Clear search query"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={11} />
            </button>
          )}
        </div>
      </div>

      <SecondarySidebarBody>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-24 rounded" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <span className="mb-2 flex size-9 items-center justify-center rounded-xl bg-sidebar-accent/50 text-sidebar-foreground/60">
              <HugeiconsIcon icon={AiChat02Icon} size={18} />
            </span>
            <p className="text-xs font-medium text-sidebar-foreground/80">
              No conversations yet
            </p>
            <p className="mt-1 text-[11px] text-sidebar-foreground/50">
              Start a conversation to see your history here.
            </p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xs font-medium text-sidebar-foreground/70">
              No chats found
            </p>
            <p className="mt-1 text-[11px] text-sidebar-foreground/50">
              No conversations match &ldquo;{searchQuery}&rdquo;.
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-2 h-auto p-0 text-xs text-primary"
            >
              Clear search
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <SecondarySidebarGroup key={group.id}>
              <SecondarySidebarGroupLabel>
                {group.label}
              </SecondarySidebarGroupLabel>
              {group.threads.map((thread) => {
                const isActive = activeThreadId === thread.id
                const displayTitle =
                  thread.title?.trim() || "Untitled conversation"

                return (
                  <SecondarySidebarRow key={thread.id}>
                    <SecondarySidebarItem
                      isActive={isActive}
                      label={displayTitle}
                      icon={<HugeiconsIcon icon={AiChat02Icon} size={14} />}
                      className="pr-8"
                      render={(props) => (
                        <Link
                          to="/chat/$threadId"
                          params={{ threadId: thread.id }}
                          {...props}
                        />
                      )}
                    />
                    <SecondarySidebarItemAction
                      aria-label={`Delete ${displayTitle}`}
                      title="Delete conversation"
                      disabled={isDeletingId === thread.id}
                      onClick={(e) => handleDeleteThread(e, thread)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={13} />
                    </SecondarySidebarItemAction>
                  </SecondarySidebarRow>
                )
              })}
            </SecondarySidebarGroup>
          ))
        )}
      </SecondarySidebarBody>
    </SecondarySidebarPortal>
  )
}
