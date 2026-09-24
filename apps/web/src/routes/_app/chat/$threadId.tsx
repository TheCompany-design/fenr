import { createFileRoute } from "@tanstack/react-router"
import { ChatContainer } from "@/features/chat/components/chat-container"

export const Route = createFileRoute("/_app/chat/$threadId")({
  component: ThreadChatRouteComponent,
})

function ThreadChatRouteComponent() {
  const { threadId } = Route.useParams()
  return <ChatContainer initialThreadId={threadId} />
}
