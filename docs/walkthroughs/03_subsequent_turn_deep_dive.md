# Step-by-Step Deep Dive: Subsequent Web Request & Cancellation (Turn 1)

This document provides a code-level, execution-order walkthrough of the agent chat lifecycle in **Fenr** during a **subsequent conversation turn (`thread_id: Some(...)`)** within an existing chat session.

It builds directly upon the state created in [Deep Dive 1: Initial Web Request (Turn 0)](file:///home/muchiri/dev/bag/atelier/fenr/docs/walkthroughs/02_initial_turn_deep_dive.md), focusing on:
1. **Pre-Existing Frontend & Route State**: TanStack Router URL params (`/chat/<uuid>`), TanStack Query cache, and bottom-docked composer.
2. **Subsequent User Submission**: Form submission carrying the existing `thread_id` from route params.
3. **BFF Proxy Execution for Existing Threads**: Forwarding conversation context and tenant validation.
4. **Reactive Multi-Turn Streaming**: Feed rendering, non-fighting auto-scroll, and the floating scroll button.
5. **Turn 1 Finalization & Query Synchronization**: Committing message items to TanStack Query and invalidating cache.
6. **Cancellation & Abort Mechanics**: Detailed breakdown of what happens when an operator stops generation mid-stream.

---

## 1. Pre-Existing Frontend & Route State (Turn 1 Ingress)

At the conclusion of Turn 0, the client application holds:

### 1.1 TanStack Router & Defensive Route Loader
- Current URL: `/chat/0195c100-aaaa-7000-8000-000000000001`
- Route: `/chat/$threadId` (rendered inside pathless `_app` layout)
- `threadId`: `"0195c100-aaaa-7000-8000-000000000001"` (read via `Route.useParams()`)
- Defensive Route Loader:
  ```typescript
  // apps/web/src/routes/_app/chat/$threadId.tsx
  export const Route = createFileRoute("/_app/chat/$threadId")({
    loader: async ({ context: { queryClient }, params: { threadId } }) => {
      const messages = await queryClient.ensureQueryData(
        threadMessagesQueryOptions(threadId),
      )
      if (messages === null) {
        throw redirect({ to: "/chat" })
      }
    },
    component: ThreadChatRouteComponent,
  })
  ```
  If an operator enters a bogus or non-existent thread UUID, `getThreadMessagesFn` returns `null` and the route loader immediately redirects to `/chat`, safeguarding against broken or stranded empty views.

### 1.2 TanStack Query Cache
Key `["chat", "threads", "0195c100-aaaa-7000-8000-000000000001", "messages"]` contains:
```typescript
[
  {
    id: "0195c100-cccc-7000-8000-000000000001",
    role: "user",
    content: "What is the invoice status for Initech?",
    createdAt: "2026-09-26T19:30:00.000Z",
  },
  {
    id: "0195c100-dddd-7000-8000-000000000001",
    role: "agent",
    content: "Invoice #INV-2024-001 is PAID.",
    thinking: "Checking ledger...",
    createdAt: "2026-09-26T19:30:04.000Z",
  }
]
```

### 1.3 UI Layout Anchor
- `hasStarted`: `true`.
- The hero greeting is completely collapsed (`opacity-0 max-h-0`).
- The composer bar is docked at the bottom of the conversational canvas (`bottom-0 translate-y-0`).

---

## 2. Subsequent User Submission

The operator enters a follow-up query:
> *"Can you summarize the line items for that invoice?"*

### 2.1 Form Submission (`apps/web/src/features/chat/components/chat-composer.tsx`)
```typescript
// apps/web/src/features/chat/components/chat-composer.tsx
const form = useForm({
  defaultValues: { prompt: "" },
  validators: { onChange: chatComposerSchema },
  onSubmit: async ({ value }) => {
    const trimmed = value.prompt.trim()
    if (!trimmed || isStreaming) return
    form.reset()
    await onSend(trimmed)
  },
})
```
- Auto-resizing is handled declaratively with modern CSS `field-sizing-content`.
- Submitting resets the form and invokes `handleSend(prompt)`.

### 2.2 Ingress Coordination in `ChatContainer`
```typescript
// apps/web/src/features/chat/components/chat-container.tsx
const handleSend = async (prompt: string) => {
  await send(prompt, threadId)
}
```
`send(prompt, threadId)` executes `chatMessagesReducer(old, { type: "client_send", payload: { userMessage, agentMessage } })` against `chatKeys.messages(threadId)`, appending the user's message and the streaming agent placeholder.

---

## 3. BFF Proxy Execution for Existing Threads

The fetch request dispatches to `POST /api/agent/stream`:
```json
{
  "prompt": "Can you summarize the line items for that invoice?",
  "thread_id": "0195c100-aaaa-7000-8000-000000000001"
}
```

1. **Authentication & Tenant Isolation**: Verifies session and `activeOrganizationId`.
2. **Outbound JWT**: Mints short-lived token for audience `"nabu"`.
3. **Upstream Forwarding**: Nabu reads `thread_id`, queries `agent_turns` and `agent_items` in PostgreSQL to reconstruct the multi-turn conversational history, and dispatches the prompt + history to the LLM.

---

## 4. Multi-Turn Reactive Streaming & Auto-Scroll

1. **`item_started`**: Emitted by Nabu with a newly generated `item_id`. `chatMessagesReducer` updates the in-flight agent message's ID to match the server item ID.
2. **Smart Scroll Detection (`apps/web/src/features/chat/components/chat-messages.tsx`)**:
   - If user is at bottom (`isAtBottomRef.current === true`), viewport automatically scrolls down with each token.
   - If user has scrolled up to inspect previous turns, auto-scroll is suspended to prevent fighting the operator.
   - A floating "Scroll to bottom" button appears. Clicking it smoothly snaps back to the active turn.

---

## 5. Turn Finalization & Query Synchronization

When `turn_completed` arrives from Nabu:
1. `useAgentStream` dispatches `chatMessagesReducer` with `turn_completed`, transitioning the streaming message's status to `"completed"` in-place.
2. Invalidates the query cache `chatKeys.thread(completedThreadId)` to ensure database sync.
3. No ghost bubbles or duplicate message items can render because `ChatMessages` renders the single array via `messages.map(...)`.

---

## 6. User Cancellation (Stop Generation)

If the user clicks "Stop" while generating:
1. `useAgentStream.stop()` triggers `abortControllerRef.current.abort()`.
2. Active HTTP fetch connection closes.
3. Upstream Rust coordinator cleanly catches client disconnection and writes partial or full response headlessly to PostgreSQL.
4. Stream projection transitions cleanly to `status: "idle"` without triggering an error toast.
