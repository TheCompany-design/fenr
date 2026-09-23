# Engineering Notes: Runtime Boundary, TanStack AI & Resilient Transport

> **Status:** Working notes / Architectural evaluation  
> **Author:** Engineer working on Fenr agent integration  
> **Topic:** Demarcating Rust (Rig) vs TanStack Start, evaluating TanStack AI, and designing the SSE event reducer

---

## 1. The Core Tension: Where Does the "Brain" Live?

My backend agent runtime is built in **Rust using Rig plus custom orchestration code** (Nabu). It manages the model calls, orchestrates tool pipelines, handles database writes, executes background workflows, and maintains memory.

When I started looking at frontend integration, I investigated libraries like **TanStack AI**. But looking through their demos and docs gave me pause:

> *All the demos show TanStack AI handling most of what an agent harness does—the agent loop, tool execution, model selection, prompt building, and execution lifecycle on Node/Bun.*

If I adopted TanStack AI wholesale as advertised, it would be in direct conflict with my Rust runtime. It wants to own the agent harness, whereas my architecture strictly dictates:

```text
WHAT TANSTACK AI DEMOS ASSUME:
React UI  ──▶  TanStack AI Client  ──▶  TanStack AI Server (Bun)  ──▶  LLM / Tools / Loop

WHAT MY PLATFORM ACTUALLY REQUIRES:
React UI  ──▶  Client Transport Adapter  ──▶  TanStack Start BFF  ──▶  Rust Runtime (Nabu)
                                                (Better Auth JWT)          (Rig + Loop + Tools)
```

### So What Parts of TanStack AI Are Actually Useful for Me?

I don't yet have a crystal-clear conception of all of TanStack AI's dimensions, so I've been trying to dissect where the seams are:

- **What would be great to use (if decoupled):**
  - Standardized client-side UI hooks (handling auto-scroll to bottom, input auto-resize, message submission helpers).
  - Client message schema interfaces (if flexible enough to support custom blocks and tool call states).
  - Form validation bindings for chat composers (TanStack Form integration).

- **What I have to bypass or override:**
  - **The Server Agent Harness:** I cannot let a JS library manage tool dispatch or agent loops. Rust does this.
  - **The Model Protocol:** TanStack AI's default streaming protocol is largely tailored to model-centric token streaming (`text-delta`). But my Rust runtime emits a richer stream of **distributed state transitions** (`tool.call.started`, `tool.call.completed`, `run.waiting_for_approval`, `genui.surface.emitted`).
  - **Memory & Conversation Ownership:** Conversations and runs are stored in Postgres via our database package and Rust runtime, not in TanStack AI server memory.

*Tentative Conclusion:* If TanStack AI's client primitives can be easily plugged into a custom transport adapter that speaks my Rust event format, great. If it forces me into a rigid client-server protocol designed around its own Bun server harness, it's safer to write a lightweight, bespoke React hook that fits my exact event contract.

---

## 2. The Transport Layer: Why Naive SSE Breaks

The easy, naive implementation that everyone starts with is:
```typescript
// THE NAIVE PATTERN (DO NOT DO THIS)
const eventSource = new EventSource('/api/agent/stream');
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  setMessages(prev => [...prev, data]); // State clobbering, race conditions, dropped frames
};
```

This works for a 5-minute demo where an LLM streams a short haiku. But in a real agent workspace with tools, background steps, and long multi-turn sessions, it falls apart:

1. **The Disconnection Problem (The "Event 147" Scenario):**
   - The user asks a complex question. The agent starts executing three tools in parallel.
   - At event #147, the user closes their laptop lid, or walks out of Wi-Fi range.
   - The Rust agent runtime does *not* die—it keeps executing the tools and finishes the task.
   - Three minutes later, the user opens the laptop on route `/chat/123`.
   - If the browser was just capturing transient SSE frames into local component `setState`, that state is gone. The browser now has an incomplete or frozen view, or duplicates everything if it initiates a fresh run.

2. **Out-of-Order / Dropped Frames:**
   - In choppy network conditions or during fast chunk emissions, React state batches can drop intermediate states or render tool call results before the tool call start was even painted.

---

## 3. The Pattern I'm Moving Toward: Event Sourcing & Client Reducer

Instead of `SSE -> setState`, I want to treat the stream as an **ordered append-only event log**, decoded by an event reducer into a local projection:

```text
SSE Line (Raw Chunks)
        │
        ▼
Event Decoder (Validates frame schema, checks seq integrity)
        │
        ▼
Ordered Buffer (Deduplicates event_id, verifies seq continuity: 145, 146, 147...)
        │
        ▼
Pure Reducer: (prevProjection, event) => nextProjection
        │
        ├── Updates Live UI Projection (active streaming tokens, pending spinners)
        │
        └── On `run.completed`: Invalidate TanStack Query (durable cache updates from DB)
```

### Event Tuple & Identity Contract
Every single event emitted by Rust must carry:
```typescript
interface EventHeader {
  conversationId: string;
  runId: string;
  eventId: string;
  seq: number;          // 0, 1, 2, 3...
  timestamp: string;
}
```

### How Resumption Will Work
1. When the SSE connection drops, the client immediately records `lastSeenSeq`.
2. When reconnecting to the TanStack Start BFF:
   - Header: `Last-Event-Seq: 147`
   - Header: `Run-Id: run_xyz`
3. The BFF relays to Nabu. Nabu has an in-memory ring buffer of the recent run events.
4. Nabu replays events 148..N immediately, then continues the live stream.
5. If the connection was dead for too long and the ring buffer was pruned, Nabu tells the BFF `REPLAY_EXPIRED`, and the browser falls back to a clean re-fetch of the conversation state via TanStack Query.

---

## 4. Cancellation & Human-in-the-Loop Interruption

What if the user clicks "Stop" while the agent is running?
- It's not enough to close the SSE connection in the browser. Closing the SSE connection only closes the client socket; the Rust backend might keep burning tokens and running tools unless explicitly notified.
- The browser must emit an explicit POST `/api/agent/runs/:runId/cancel`.
- The BFF validates the user session and sends an abort signal to the running task in Nabu.
- Nabu emits `run.failed` with `{ code: "CANCELLED_BY_USER" }`, logs the cancellation in Pino, and cleanly unwinds any active child tasks.

*Still pondering:* What about approval gates? When the agent wants to execute a destructive tool (e.g. deleting a database record or issuing a payment), Nabu emits `run.waiting_for_approval`. The stream stays open (or transitions to idle polling), and the browser renders an interactive confirmation card. Once confirmed, a POST sends the approval token back to Rust to resume the loop.
