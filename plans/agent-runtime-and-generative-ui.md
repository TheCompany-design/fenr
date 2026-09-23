# Plan — Agent Runtime Distributed State Machine & Multi-Tier Generative UI

> **Status:** Ready for Review  
> **Scope:** Architecture specification and phased execution roadmap unifying the Rust agent runtime (Nabu), TanStack Start BFF, frontend state distribution, resilient event streaming, and a 4-tier Generative UI (GenUI) compiler/renderer.

---

## 1. Executive Summary & Core Architectural Thesis

Building an agentic workspace is **not** a traditional chat UI problem. It is a **distributed state machine problem** spanning three physical boundaries:

1. **Rust Agent Runtime (Nabu):** The canonical authority for agent orchestration, tool execution, model interaction, state persistence, and event sequencing.
2. **TanStack Start BFF (Bun):** The secure gateway, session-authenticating proxy (Better Auth JWT), SSE transport manager, and server-side prefetcher.
3. **Browser Client (Fenr):** A reactive projection and control surface that visualizes state transitions and emits user intent, rather than an independent authority over the agent loop.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RUST AGENT RUNTIME (NABU)                          │
│  Canonical Run State • Tool Execution • Agent Loop • Event Sourcing Engine  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Authenticated Stream / Events
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TANSTACK START BFF (BUN / SSR)                        │
│  Better Auth JWT Gateway • Resumable SSE Transport • Replay Buffer • Pino   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Ordered Event Stream (Cursor / Replay)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER CLIENT (FENR)                             │
│                                                                             │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐  │
│  │     TanStack Query      │  │     Zustand Store     │  │ Event Reducer │  │
│  │ (Durable Server State)  │  │ (Ephemeral UI State)  │  │ (Projection)  │  │
│  └────────────┬────────────┘  └───────────┬───────────┘  └───────┬───────┘  │
│               │                           │                      │          │
│               └───────────────────┬───────┴──────────────────────┘          │
│                                   ▼                                         │
│                    MULTI-TIER GENERATIVE UI RUNTIME                         │
│   Tier 1: Native  │ Tier 2: Composite │ Tier 3: Sandboxed │ Tier 4: MCP App │
│   (shadcn Prims)  │ (Declarative IR)  │ (Canvas/HTML/SVG) │ (Mini-Apps)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Two Fundamental Shifts

1. **Streaming State Transitions, Not Just Tokens:** Once tools, sub-agents, and human-in-the-loop approvals enter the loop, streaming text is incidental. The system streams an append-only sequence of immutable state transitions (`run.started`, `tool.call.started`, `run.waiting`, etc.).
2. **Physics Over Pre-defined Objects in GenUI:** Rather than locking the agent into a fixed component catalog (which degrades LLM quality as it scales) or giving it unconstrained access to DOM APIs, the platform establishes a **multi-tier UI runtime**. The developer defines the *physics of the universe* (security boundaries, sandbox restrictions, theme tokens, and callable capabilities), allowing the agent to dynamically graduate from native cards to interactive scenario simulators.

---

## 2. Distributed State Architecture

To eliminate state synchronization bugs, race conditions, and split-brain states across tab switches and network reconnections, application state is strictly bifurcated into four non-competing domains.

```text
                                 STATE BOUNDARIES
┌───────────────────────┬───────────────────────┬────────────────────────────┐
│ Domain                │ Owner / Technology    │ Responsibilities           │
├───────────────────────┼───────────────────────┼────────────────────────────┤
│ 1. Durable Server     │ TanStack Query        │ Persisted conversations,   │
│    State              │ (Hydrated via BFF)    │ historical messages, runs, │
│                       │                       │ tool call results, meta,   │
│                       │                       │ attachments, pagination.   │
├───────────────────────┼───────────────────────┼────────────────────────────┤
│ 2. Ephemeral UI       │ Zustand               │ Composer draft & inputs,   │
│    State              │ (`apps/web/src/lib/   │ selected conversation ID,  │
│                       │  stores/`)            │ panel collapse/expand,     │
│                       │                       │ active view preferences.   │
├───────────────────────┼───────────────────────┼────────────────────────────┤
│ 3. Transport & Live   │ Typed SSE Protocol +  │ Connection lifecycle,      │
│    Projection State   │ Client Event Reducer  │ reconnect backoff, cursor  │
│                       │                       │ resume, out-of-order       │
│                       │                       │ reconciliation, stream UI. │
├───────────────────────┼───────────────────────┼────────────────────────────┤
│ 4. Agent Coordination │ Rust Runtime (Nabu)   │ Loop execution, tool runs, │
│    State              │                       │ sub-agent lifecycle, human │
│                       │                       │ gates, canonical sequence. │
└───────────────────────┴───────────────────────┴────────────────────────────┘
```

### Anti-Pattern to Avoid: `SSE -> setState(...)`
Connecting an SSE stream directly to naive React `setState` calls leads to dropped updates during re-renders, race conditions on reconnect, out-of-order token fragments, and broken multi-tab state.

### Chosen Pattern: Event Sourcing & Client-Side Reducer

```text
SSE Transport Line
        │ (raw chunks)
        ▼
Event Frame Decoder (validates JSON against Zod schema, checks sequence integrity)
        │ (typed RuntimeEvent)
        ▼
Ordered Event Buffer (deduplicates event_id, verifies sequence continuity)
        │
        ├──▶ TanStack Query Cache Invalidation (on run.completed / message.completed)
        │
        ▼
Pure Client Reducer / Projector (state, event) => LiveRunProjection
        │
        ▼
Reactive UI View (renders message deltas, streaming tool executions, GenUI surfaces)
```

---

## 3. Protocol & Event Contract

Every event emitted from Nabu carries explicit sequence metadata. This makes runs fully resumable if the user disconnects, suspends their machine, or opens the conversation in another tab.

### 3.1 First-Class Identity & Sequence Tuple

```typescript
export interface EventHeader {
  conversationId: string;
  runId: string;
  eventId: string;
  seq: number;          // Monotonically increasing per run (0, 1, 2, ...)
  timestamp: string;    // ISO-8601 UTC
}
```

### 3.2 Canonical Runtime Events

```typescript
export type RuntimeEvent =
  | { type: "run.started"; header: EventHeader; input: { prompt?: string } }
  | { type: "message.created"; header: EventHeader; messageId: string; role: "assistant" | "user" | "system" }
  | { type: "model.started"; header: EventHeader; model: string }
  | { type: "model.delta"; header: EventHeader; textDelta: string }
  | { type: "tool.call.started"; header: EventHeader; toolCallId: string; toolName: string }
  | { type: "tool.call.input.delta"; header: EventHeader; toolCallId: string; jsonDelta: string }
  | { type: "tool.call.completed"; header: EventHeader; toolCallId: string; output: unknown; isError?: boolean }
  | { type: "genui.surface.emitted"; header: EventHeader; surfaceId: string; spec: GenUiSpecification }
  | { type: "genui.surface.updated"; header: EventHeader; surfaceId: string; patch: GenUiPatch }
  | { type: "run.waiting"; header: EventHeader; reason: "human_approval" | "client_action"; actionContext: unknown }
  | { type: "run.completed"; header: EventHeader; usage?: { promptTokens: number; completionTokens: number } }
  | { type: "run.failed"; header: EventHeader; error: { code: string; message: string; recoverable: boolean } };
```

### 3.3 Resumption & Reconnection Protocol

When an SSE stream drops:
1. The browser requests reconnect with `Last-Event-Seq: <last_seen_seq>` and `Run-Id: <run_id>`.
2. The TanStack Start BFF relays to Nabu's replay buffer.
3. If `<last_seen_seq>` is within the replay window, Nabu flushes missed events in order, then resumes the live feed.
4. If `<last_seen_seq>` is expired or purged, the client triggers a TanStack Query cache revalidation (`queryClient.invalidateQueries({ queryKey: ['conversations', conversationId] })`) to fetch canonical durable state from Postgres/Nabu.

---

## 4. TanStack AI Evaluation & Boundary Assessment

TanStack AI provides valuable client abstractions, but its default architectural model assumes the JS/Node backend owns the agent loop. In Fenr, Nabu (Rust) is the authority.

```text
Standard TanStack AI Assumption:
React ──▶ TanStack AI ──▶ Bun/Node (AI SDK) ──▶ LLM ──▶ Agent Loop

Fenr's Architecture:
React ──▶ TanStack AI Client Adapter ──▶ TanStack Start BFF ──▶ Rust Runtime (Nabu) ──▶ LLM & Tools
```

### Adoption Decisions

| Layer / Feature | Decision | Rationale |
| :--- | :--- | :--- |
| **Client Message Types & Chat Hooks** | **Adopt (with custom adapter)** | Leverages TanStack AI's UI bindings, auto-scrolling, and input management while feeding from our custom event reducer. |
| **Server AI Orchestrator / Agents** | **Bypass** | Nabu (Rust) owns the agent loop, memory, tool orchestration, and parallel execution. |
| **Transport Layer** | **Bypass / Wrap** | Replace standard LLM stream parser with our typed `RuntimeEvent` protocol carrying sequence IDs and tool lifecycles. |
| **Generative UI Helpers** | **Integrate with Multi-Tier Compiler** | Utilize component-binding patterns where compatible; delegate complex/open rendering to Fenr's GenUI runtime. |

---

## 5. Multi-Tier Generative UI (GenUI) Architecture

Rather than treating generative UI as a single component registry (which hits token limits and design ceilings as catalogs grow), Fenr implements a **4-Tier Adaptive Generative UI Runtime**.

```text
                                  USER PROMPT
                                       │
                                       ▼
                             NABU AGENT / PLANNER
                   "What interface best serves this task?"
                                       │
        ┌───────────────────┬──────────┴──────────┬──────────────────┐
        ▼                   ▼                     ▼                  ▼
    [Tier 1]            [Tier 2]              [Tier 3]           [Tier 4]
  Native UI           Declarative           Sandboxed           External
  Primitives          Composition           Generated App       MCP App
        │                   │                     │                  │
  Pre-registered      Composed Tree        Dynamic HTML/CSS/   Full interactive
  shadcn / UI         (A2UI / json-render) JS/SVG/WebGL/Canvas view served by
  components          no code written      inside secure       remote MCP tool
                      by developer         isolated iframe
        │                   │                     │                  │
        └───────────────────┼─────────────────────┴──────────────────┘
                            ▼
                    FENR UI COMPILER
         (Validates schemas, binds theme tokens,
          enforces capabilities & security sandbox)
                            │
                            ▼
                    RENDERED SURFACE
```

### 5.1 The 4 Tiers Defined

#### Tier 1: Native UI Primitives (Catalog Mode)
- **What it is:** Trusted, pre-compiled shadcn UI components in `packages/ui` (Button, Card, Table, Form, Chart, Calendar, Metric, Tabs).
- **Properties:** Maximum safety, zero bundle overhead, perfect Tailwind v4 dark/light theming, highest performance.
- **Model Interaction:** Model emits structured tool arguments matching a known Zod component schema (e.g. `MetricCardProps`).

#### Tier 2: Declarative Composition (A2UI / json-render Style)
- **What it is:** The agent composes native primitives into novel layouts and domain surfaces that the developer never explicitly coded as a single component.
- **Example:** An ad-hoc `SupplierComparisonMatrix` composed on the fly:
  ```json
  {
    "type": "Card",
    "children": [
      { "type": "Header", "props": { "title": "Supplier Comparison", "badge": "Active" } },
      { "type": "Table", "props": { "columns": ["Supplier", "Price", "Lead Time"], "data": [...] } },
      { "type": "Button", "props": { "label": "Reorder from Acme", "action": "reorder_supplier_1" } }
    ]
  }
  ```
- **Benefit:** Solves the catalog bloat problem. Primitives remain small (~20 core widgets), but combinations are infinite.

#### Tier 3: Sandboxed Generated Surface (Open UI / Canvas / WebGL)
- **What it is:** The agent generates dynamic HTML, CSS, SVG, Canvas, or Three.js code rendered inside a hardened, isolated `<iframe>` sandbox.
- **Use Cases:** Interactive Monte Carlo simulations, interactive D3 network graphs, 3D product visualizations, scenario modelers, floor plans.
- **Security Boundary:**
  - `sandbox="allow-scripts"` (no `allow-same-origin`, no access to parent DOM, cookies, or localStorage).
  - PostMessage RPC bridge for strictly permitted events (e.g. `request_export`, `emit_filter_change`).
  - CSS variable injection for brand and theme tokens (`--background`, `--foreground`, `--primary`, `--border`) so sandboxed content automatically matches light/dark mode.

#### Tier 4: External Interactive Applications (MCP Apps)
- **What it is:** Embedded micro-applications served directly by Model Context Protocol (MCP) servers/tools.
- **Use Cases:** Complex third-party workflows (e.g., interactive Figma canvases, live SQL query explorers, rich spatial map viewers).
- **Communication:** Bidirectional AG-UI / MCP Apps protocol over postMessage, allowing the embedded app to call tools and receive live agent state.

### 5.2 Intermediate Representation (IR)

```typescript
export type GenUiSpecification =
  | {
      tier: "tier1_native";
      component: "Metric" | "DataTable" | "Chart" | "Alert" | "ActionCard";
      props: Record<string, unknown>;
    }
  | {
      tier: "tier2_composite";
      root: CompositeNode;
      dataBindings?: Record<string, unknown>;
    }
  | {
      tier: "tier3_sandboxed";
      runtime: "html" | "svg" | "canvas" | "webgl";
      bundle: { html: string; css?: string; js?: string };
      permissions: Array<"resize" | "fullscreen">;
    }
  | {
      tier: "tier4_mcp_app";
      appId: string;
      entryUrl: string;
      initialState?: Record<string, unknown>;
    };

export interface CompositeNode {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: CompositeNode[];
  actionId?: string;
}
```

### 5.3 Interactable Existing UI (Tambo Pattern)

The agent can also address and manipulate *already-mounted* application views. When viewing an active analytics dashboard:
1. The dashboard registers its interactable state (e.g. `activeMetric: "transactions"`).
2. The user says: *"Show me revenue instead."*
3. The agent emits a state patch rather than regenerating the entire dashboard:
   ```json
   { "type": "ui.state.patch", "surfaceId": "analytics-main", "patch": { "activeMetric": "revenue" } }
   ```

---

## 6. Security Boundaries & Capability Physics

The runtime does **not** allow untrusted code execution in the primary application context. Security is enforced through strict layer isolation:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ WHAT THE AGENT & GENUI SURFACES CAN DO                                     │
├────────────────────────────────────────────────────────────────────────────┤
│ ✓ Render Tier 1/2 native components with validated Zod props.              │
│ ✓ Render Tier 3 raw code inside a sandboxed iframe without credentials.    │
│ ✓ Dispatch typed action events across postMessage to the parent BFF.       │
│ ✓ Inherit CSS theme variables (dark mode, color tokens) automatically.     │
│ ✓ Read authorized business data passed explicitly in the tool context.     │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ HARD SYSTEM CONSTRAINTS (THE "PHYSICS")                                    │
├────────────────────────────────────────────────────────────────────────────┤
│ ✗ No direct access to DOM, cookies, session tokens, or parent window APIs. │
│ ✗ No arbitrary outbound network access from Tier 3 sandboxes (strict CSP). │
│ ✗ No execution of financial or destructive tools without human approval.   │
│ ✗ No bypass of TanStack Start BFF authentication / Better Auth JWT.        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Technology Landscape & Comparative Matrix

How the leading GenUI and agent protocols inform our design:

| Technology | Architectural Value to Fenr | How We Use / Adapt It |
| :--- | :--- | :--- |
| **A2UI (Google)** | Framework-agnostic declarative protocol separating data binding from layout. | Adopt the structural JSON spec and discriminator patterns for **Tier 2 (Composite UI)**. |
| **json-render (Vercel)** | Dynamic catalog subsetting, cross-platform spec, action bindings. | Borrow the dynamic catalog filtering technique to avoid context window pollution. |
| **MCP Apps** | Official MCP standard for interactive tools embedded in chat surfaces. | Direct foundation for **Tier 4 (External Apps)** via sandboxed tool views. |
| **OpenGenerativeUI** | Raw HTML/SVG/Canvas execution within sandboxed iframes. | Inspiration and security pattern for **Tier 3 (Sandboxed Apps)**. |
| **Tambo** | Distinction between generative components and interactable application state. | Adopt the interactable surface pattern for letting agents manipulate existing React pages. |
| **AG-UI** | Bidirectional agent-to-application transport protocol. | Reference specification for the communication bridge between client surfaces and Nabu. |
| **OpenUI** | Compact streaming language for UI. | Study for streaming token reduction during real-time layout generation. |

---

## 8. Implementation Roadmap (Atomic Work Blocks)

Following the repository's strict development lifecycle, implementation decomposes into small, independently verifiable units. Each block is implemented by the primary implementer, reviewed by the adversarial review team (correctness, concurrency, quality), verified (`bun run check`, `bun test`), and committed atomically.

```text
Block 1: Protocol & Schemas ──▶ Block 2: Resilient SSE Transport & Reducer
                                              │
                                              ▼
Block 4: Tier 3/4 Sandboxed ◀── Block 3: Tier 1/2 GenUI Compiler & Renderer
         Surfaces & Security
                                              │
                                              ▼
                                Block 5: Agent State Integration (Nabu BFF)
```

### Block 1 — Protocol Schemas & Zod Contracts
- Define typed `RuntimeEvent` schemas and `GenUiSpecification` unions in `apps/web/src/lib/schemas/agent/`.
- Create sequence validators, event headers, and error shapes.
- Add unit tests verifying parsing of malformed, out-of-order, and backward-compatible payloads.

### Block 2 — Resilient SSE Transport & Client-Side Reducer
- Build the SSE transport client in `apps/web/src/features/nabu/transport/` supporting `Last-Event-Seq` reconnection and exponential backoff.
- Implement the pure client-side event reducer and projection hook (`useAgentRunProjection`).
- Integrate with Zustand for ephemeral run UI state and TanStack Query for durable invalidations.
- Write tests simulating network drops, event reordering, and reconnection replay.

### Block 3 — Tier 1 & Tier 2 GenUI Compiler & Renderer
- Implement the GenUI catalog registry mapping declarative schemas to `packages/ui` primitives (Button, Card, Table, Metric, Chart).
- Build the recursive `CompositeSurface` component with error boundaries and fallback rendering.
- Wire theme token inheritance to ensure flawless Tailwind v4 dark mode support.
- Add test coverage for catalog resolution and missing prop fallbacks.

### Block 4 — Tier 3 Sandboxed Surface & MCP Apps Bridge
- Create the hardened `<SandboxedSurface />` component using an isolated `<iframe>` with strict CSP and `sandbox="allow-scripts"`.
- Implement the typed bidirectional `postMessage` RPC bridge for theme syncing, sizing, and action dispatching.
- Add safety tests asserting that sandboxed scripts cannot access parent storage or trigger unapproved actions.

### Block 5 — End-to-End Nabu BFF Integration & UX Feedback
- Wire the TanStack Start server functions and Better Auth JWT gateway to route live runs to Nabu.
- Implement actionable `<Sonner />` notifications for network failures, approval gates, and error boundaries.
- Add structured Pino operational logging on server transitions.
- Verify end-to-end flow with manual execution and automated tests.

---

## 9. Verification & Acceptance Criteria

- [ ] **Type & Lint Safety:** `bun run check` passes with zero errors across all workspaces.
- [ ] **Event Resiliency:** Disconnecting the SSE connection mid-stream and reconnecting resumes from `<last_seen_seq>` without UI duplication or dropped messages.
- [ ] **State Separation:** Zero query results mirrored into Zustand stores; zero ephemeral composer text stored in TanStack Query.
- [ ] **GenUI Sandboxing:** Tier 3 iframe scripts attempting `window.parent.document` or `localStorage` access are blocked by browser security.
- [ ] **Theme Integrity:** Tier 1, 2, and 3 surfaces automatically reflect light/dark mode transitions without flash of unstyled content (FOUC).
- [ ] **Error Handling:** All server and stream exceptions produce structured Pino log records and user-friendly, actionable `<Sonner />` notifications.

