import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"
import { ChatSidebar } from "@/features/chat/components/chat-sidebar"
import { chatThreadsQueryOptions } from "@/features/chat/queries/chat-queries"

export const Route = createFileRoute("/_app/chat")({
  loader: async ({ context: { queryClient } }) => {
    try {
      await queryClient.ensureQueryData(chatThreadsQueryOptions())
    } catch {
      // Graceful degradation if threads fail to prefetch on SSR
    }
  },
  component: ChatLayoutComponent,
})

function ChatLayoutComponent() {
  return (
    <>
      <ChatSidebarWrapper />
      <Outlet />
    </>
  )
}

function ChatSidebarWrapper() {
  const params = useParams({ strict: false }) as { threadId?: string }
  return <ChatSidebar activeThreadId={params.threadId} />
}
