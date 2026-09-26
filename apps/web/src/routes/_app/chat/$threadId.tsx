import { createFileRoute } from "@tanstack/react-router"
import { ChatContainer } from "@/features/chat/components/chat-container"
import { threadMessagesQueryOptions } from "@/features/chat/queries/chat-queries"

export const Route = createFileRoute("/_app/chat/$threadId")({
  loader: async ({ context: { queryClient }, params: { threadId } }) => {
    await queryClient.ensureQueryData(threadMessagesQueryOptions(threadId))
  },
  component: ThreadChatRouteComponent,
})

function ThreadChatRouteComponent() {
  const { threadId } = Route.useParams()
  return <ChatContainer threadId={threadId} />
}
