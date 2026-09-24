import { createFileRoute } from "@tanstack/react-router"
import { ChatContainer } from "@/features/chat/components/chat-container"

export const Route = createFileRoute("/_app/chat/")({
  component: ChatRouteComponent,
})

function ChatRouteComponent() {
  return <ChatContainer />
}
