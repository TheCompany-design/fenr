# Step-by-Step Deep Dive: Initial Web Request (Turn 0)

This document provides a code-level, execution-order walkthrough of the agent chat lifecycle in **Fenr** during an initial conversation turn (`thread_id: null`). It covers:
1. **Server Boot & In-Memory State**: Bun production server initialization, static asset caching, and TanStack Start handler registration.
2. **Initial Client Mount State**: Initial values in TanStack Router, TanStack Query, and Jotai stream projection atoms.
3. **User Action & Form Validation**: Entering the prompt, TanStack Form validation with Zod (`chatComposerSchema`), and declarative CSS auto-resizing.
4. **Optimistic Rendering & Ingress**: Optimistic user prompt display via `pendingUserMessageAtom`, collapsing the hero greeting, triggering `useAgentStream.send()` with omitted `thread_id`, and binding server thread ID upon `turn_started`.
5. **TanStack Start BFF Proxy Execution**: Session authentication, tenant boundary validation, outbound Ed25519 JWT minting, and zero-buffering proxying.
6. **Client Stream Processing & Pure Reducer Dispatching**: Reading SSE chunks, Zod schema validation, and pure state projection via Jotai atoms.
7. **Turn Finalization & UI Commit**: Query cache commit and invalidation, wide-event logging, and persistence synchronization.

---

## 1. Server Boot & In-Memory State

Fenr runs on pure Bun in production via `apps/web/server.ts`:

```typescript
// apps/web/server.ts:76
async function initializeServer() {
  startupLogger.info("starting Fenr production server")

  // 1. Dynamically import TanStack Start compiled SSR server module
  const serverModule = (await import("./dist/server/server.js")) as {
    default: ServerHandler
  }
  const handler = serverModule.default

  // 2. Preload static assets (HTML/JS/CSS/SVG) into memory with ETags
  const { routes } = await initializeStaticRoutes()

  // 3. Start native Bun.serve HTTP server
  const server = Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    routes: {
      ...routes,
      // 4. Fallback all non-static routes to TanStack Start application handler
      "/*": async (req) => handler.fetch(req),
    },
  })
}
```

### 1.1 In-Memory Server Environment
When initialized, the server environment holds:
- **`serverEnv.NABU_SERVER_URL`**: Upstream address of the Rust agent runtime (e.g. `http://127.0.0.1:3001`).
- **`auth`**: Better-Auth server instance connected to PostgreSQL, configured with Ed25519 cryptographic keypairs for signing service-to-service tokens.
- **Static Assets Cache**: Pre-built client assets from `dist/client` cached with immutable `Cache-Control` headers.

---

## 2. Initial Client Mount State

When an operator navigates to `/chat` (`apps/web/src/routes/_app/chat/index.tsx`), TanStack Router mounts `ChatContainer`:

### 2.1 Route & URL State
- Route: `/_app/chat/`
- `threadId`: `null`
- URL State: Managed via TanStack Router route tree with `NuqsAdapter` mounted at root.

### 2.2 In-Flight Jotai Atoms (`apps/web/src/features/chat/state/chat-atoms.ts`)
```typescript
{
  activeTurnProjectionAtom: {
    threadId: null,
    turnId: null,
    activeItemId: null,
    streamingText: "",
    streamingThinking: "",
    status: "idle",
    error: null,
  },
  lastRequestIdAtom: null,
  isThinkingOpenAtom: true,
}
```

### 2.3 `ChatContainer` & TanStack Query State (`apps/web/src/features/chat/components/chat-container.tsx`)
- `messages`: Query result for `threadMessagesQueryOptions(null)` -> defaults to `[]`.
- `hasStarted`: `false`.
- **UI Layout**: Because `hasStarted` is false, the hero greeting (`"How can Nabu assist you today?"`) is vertically centered (`bottom-1/2 translate-y-1/2`).
- **Zero Local State Anti-Patterns**: No `useState<ChatMessage[]>` or completion `useEffect` hooks.

---

## 3. User Action & Form Validation

The operator types their query into the `ChatComposer` textarea.

### 3.1 Form Validation (`apps/web/src/features/chat/components/chat-composer.tsx`)
TanStack Form validates input using Zod standard schema (`apps/web/src/lib/schemas/agent-stream.ts`):

```typescript
export const chatComposerSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(10_000, "Message is too long"),
})
```

1. **Declarative Auto-Resize**: Uses modern CSS `field-sizing-content` (`field-sizing: content`). The browser automatically expands the textarea up to `max-h-[200px]` with zero JavaScript execution, zero `useRef`, and zero `useEffect`.
2. **Keyboard Capture**:
   ```typescript
   onKeyDown={(e) => {
     if (e.key === "Enter" && !e.shiftKey) {
       e.preventDefault()
       if (!isStreaming && field.state.value.trim().length > 0) {
         void form.handleSubmit()
       }
     }
   }}
   ```
   Pressing Enter submits the form; Shift+Enter inserts a newline.

---

## 4. Optimistic Rendering, Ingress & Server Thread Binding

When the form submits on an initial conversation turn (`threadId: null`), `ChatContainer.handleSend(prompt)` executes:

```typescript
// apps/web/src/features/chat/components/chat-container.tsx
const handleSend = async (prompt: string) => {
  await send(prompt, threadId, {
    onTurnStarted: async (serverThreadId) => {
      await safeNavigate({
        to: "/chat/$threadId",
        params: { threadId: serverThreadId },
        replace: true,
      })
    },
  })
}
```

### 4.1 UI Transitions & In-Place Optimistic Dispatch
In `useAgentStream.send(prompt)`:
1. **Optimistic Append via Pure Reducer**:
   ```typescript
   const userMessage: ChatMessage = {
     id: crypto.randomUUID(),
     role: "user",
     content: trimmedPrompt,
     status: "completed",
     createdAt: new Date().toISOString(),
   }
   const agentPlaceholder: ChatMessage = {
     id: crypto.randomUUID(),
     role: "agent",
     content: "",
     thinking: "",
     status: "streaming",
     createdAt: new Date().toISOString(),
   }

   queryClient.setQueryData<ChatMessage[]>(currentKey, (old = []) =>
     chatMessagesReducer(old, {
       type: "client_send",
       payload: { userMessage, agentMessage: agentPlaceholder },
     }),
   )
   ```
2. **Hero Greeting Collapse**: `hasStarted` immediately computes `true`, smoothly collapsing the greeting and translating the composer to `bottom-0`.
3. **Single Render Loop**: `ChatMessages` renders both the user message and the in-flight assistant message through `messages.map(...)`. There is no secondary streaming bubble component, eliminating any risk of duplicate renders.

### 4.2 Database Invariants: Why Client-Side UUID Generation Fails
In upstream Nabu (`thebookofnabu/crates/nabu-agent/src/storage/postgres.rs`), when a `thread_id` is supplied in the request body, Nabu assumes the thread already exists in PostgreSQL and executes:
```sql
UPDATE agent_threads SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2
```
If an unpersisted UUID generated via `crypto.randomUUID()` were passed, PostgreSQL returns 0 rows updated, and Nabu immediately fails with `StorageError::NotFound` ("Thread not found: <uuid>").
Conversely, when `thread_id` is omitted (`None`/`undefined`), Nabu executes:
```sql
INSERT INTO agent_threads (id, tenant_id, title, created_at, updated_at)
VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
RETURNING id;
```
It then emits `turn_started` SSE event containing the newly minted, PostgreSQL-persisted thread UUID.

### 4.3 Initiating `useAgentStream.send()` & Cache Migration
In `apps/web/src/features/chat/hooks/use-agent-stream.ts`:
1. Cleans up any prior requests: `stop()`.
2. Allocates a new `AbortController`.
3. Dispatches the HTTP fetch request (omitting `thread_id` when on `/chat`):
   ```typescript
   const response = await fetch("/api/agent/stream", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       Accept: "text/event-stream",
     },
     body: JSON.stringify({
       prompt: trimmedPrompt,
       thread_id: threadId ?? undefined,
     }),
     signal: abortController.signal,
   })
   ```
4. When `turn_started` arrives with `event.data.thread_id`, the draft cache data is migrated:
   ```typescript
   const draftData = queryClient.getQueryData<ChatMessage[]>(currentKey) ?? []
   currentKey = chatKeys.messages(serverThreadId)
   queryClient.setQueryData(currentKey, draftData)
   queryClient.removeQueries({ queryKey: chatKeys.messages(null) })
   ```
   and `onTurnStarted` navigates to `/chat/$threadId` with `{ replace: true }`.
*(Note: TanStack Router public route is `/chat/$threadId`, not `/_app/chat/$threadId`, as `_app` is a pathless layout id.)*

---

## 5. TanStack Start BFF Proxy Execution

The POST request arrives at `apps/web/src/routes/api/agent/stream.ts`.

### 5.1 Step 1: Session Authentication & Tenant Isolation
```typescript
const session = await auth.api.getSession({ headers: request.headers })
if (!session?.user?.id) {
  return jsonErrorResponse("Unauthorized", 401, requestId)
}

const activeOrgId = session.session?.activeOrganizationId
if (!activeOrgId) {
  return jsonErrorResponse("Tenant context required", 403, requestId)
}
```

### 5.2 Step 2: Mint Outbound EdDSA JWT
```typescript
const token = await acquireOutboundJwt(
  { type: "authenticated", service: "nabu", audience: "nabu" },
  { headersSource: request.headers },
)
```
The token includes standard claims:
```json
{
  "iss": "fenr-bff",
  "sub": "usr_01923485-abcd-7890-a1b2-c3d4e5f67890",
  "aud": "nabu",
  "activeOrganizationId": "org_01923485-0000-7890-a1b2-c3d4e5f67890",
  "exp": 1727389500
}
```

### 5.3 Step 3: Upstream Call to Nabu Agent Runner
```typescript
const nabuUrl = `${serverEnv.NABU_SERVER_URL}/api/v1/threads/turns`
const nabuResponse = await fetch(nabuUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "X-Request-Id": requestId,
  },
  body: JSON.stringify(payload),
  duplex: "half",
  signal: request.signal,
})
```

---

## 6. Client Stream Processing & Pure Reducer Dispatching

As SSE chunks arrive from the BFF proxy, `useAgentStream` decodes them:

```typescript
const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ""

while (true) {
  const { value, done } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""

  for (const line of lines) {
    if (line.startsWith("data:")) {
      const parsed = JSON.parse(line.slice(5).trim())
      const event = agentStreamEventSchema.parse(parsed)
      setProjection((prev) => streamReducer(prev, event))
    }
  }
}
```

### 6.1 Event Lifecycle
1. **`turn_started`**: Binds `turn_id` and confirms `thread_id`.
2. **`item_started`**: Upstream persists `agent_items` row and returns `item_id`. Assistant message bubble renders with pulsing cursor.
3. **`item_delta`**: Appends streaming text and thinking trace smoothly via Jotai reactive atom.
4. **`turn_completed`**: Commits the finalized assistant message directly to TanStack Query cache `chatKeys.messages(threadId)` and invalidates query options.
