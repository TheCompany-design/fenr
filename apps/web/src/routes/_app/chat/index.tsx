import { createFileRoute } from "@tanstack/react-router"

import { ChatContainer } from "@/features/chat/components/chat-container"

export const Route = createFileRoute("/_app/chat/")({
  component: ChatRouteComponent,
})

function ChatRouteComponent() {
  // The chat feature does not own membership, so it is told what it may offer
  // rather than querying for it: a member should be told which provider is in
  // use, but should not be offered a settings link they would be refused on.
  const { activeOrganization } = Route.useRouteContext()
  const role = activeOrganization.role

  return (
    <ChatContainer
      canAdministerProvider={role === "owner" || role === "admin"}
    />
  )
}
