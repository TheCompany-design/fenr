# Engineering Notes: State Boundaries — Query, Zustand & The Jotai Question

> **Status:** Working notes / Evaluation  
> **Author:** Engineer working on Fenr agent integration  
> **Topic:** Demarcating state domains, avoiding library competition, and evaluating atomic vs global state for complex editor/chat interactions

---

## 1. The State Dilemma

I know I am going to have complex state on the frontend:
- Some of it is **durable and asynchronous** (persisted conversations, message lists, run history, tool audit logs).
- Some of it is **global and ephemeral** (which conversation is currently selected, whether the AI dock is expanded, composer draft text, active attachments).
- Some of it is **fine-grained and potentially atomic** (individual streaming text tokens updating at 60fps, inline staged diffs on specific document blocks, per-block pending spinners, interactive slider widgets inside Gen-UI cards).

I am definite about **TanStack Query**—I never write raw `fetch()` calls or roll my own TS network plumbing. But I am actively weighing the boundaries between **Zustand** and **Jotai**, and whether introducing atomic state is actually necessary or just an unnecessary complication.

---

## 2. TanStack Query: The Definite Foundation for Server State

There is zero ambiguity here. Anything whose canonical truth originates from Postgres or the Rust runtime belongs in TanStack Query:

- **What lives in Query:**
  - Conversations list & pagination.
  - Historical messages & verified tool call outputs.
  - Organization members & permissions.
  - Active document content & block structures.
  - Completed run logs & execution metrics.
- **Rules I'm holding myself to:**
  - Never mirror Query data into Zustand or local React state just to read it.
  - Use `ensureQueryData` in TanStack Start route loaders for instant SSR hydration.
  - When an agent run finishes (`run.completed`), the event listener simply triggers `queryClient.invalidateQueries(...)` rather than trying to manually splice complex historical records into cache. Let the database/BFF be the single source of truth.

---

## 3. Zustand: Global Ephemeral UI State

Fenr already has established conventions for Zustand in `apps/web/src/lib/stores/` (e.g. `demo-store.ts`, `theme-store.ts`).

- **What belongs in Zustand:**
  - `selectedConversationId: string | null`
  - `isRightDockOpen: boolean`
  - `activePageContext: PageContext | null`
  - `composerDrafts: Record<string, { text: string; attachments: File[] }>` (persisted to `sessionStorage` so navigating away doesn't wipe a half-typed prompt).
  - Global user preferences for the AI experience (e.g., auto-scroll on/off, streaming animation speed).

This is straightforward and works well with Zustand's `persist` middleware.

---

## 4. The Big Question: Do I Need Jotai for Atomic State?

This is where I've been spending a lot of mental energy.

### Why I'm Tempted by Jotai (The Atomic Argument)

When an agent is actively streaming into a document or a rich Gen-UI canvas:
1. **Streaming Tokens at High Frequency:** Text deltas arrive every 20–50ms. If that streaming text lives in a top-level Zustand store or root component state, every single token might trigger a re-render of the entire chat list, dock container, or document editor tree.
2. **Document Block Diffs:** Imagine a 50-page document with 200 custom blocks. The agent decides to propose diffs to Block #42 and Block #87 simultaneously.
   - With an atomic model (Jotai), `blockDiffAtom(blockId)` allows only Block #42 and Block #87 to re-render. The rest of the 198 blocks stay completely untouched.
   - Independent controls (Accept, Reject, Refine) on each block can read and write to isolated atoms without affecting sibling blocks.
3. **Gen-UI Interactive Inputs:** If a generated card has a financial slider ("Adjust margin: 12%"), tweaking that slider feels like an atomic state change local to that card.

### Why I'm Weighing the Trade-offs (Architecture & Complexity)

1. **Dual Paradigm Overhead:**  
   Introducing Jotai alongside Zustand means living with two distinct state paradigms in the same frontend:
   - Store-based slices vs. atomic graphs.
   - Deciding where the boundary lies for every new feature (should this be an atom or a store slice?).
   - Two different debugging models and devtools setups.
2. **Can Zustand Handle This with Selectors?**  
   Zustand already supports granular subscription via selectors and `useShallow`:
   ```tsx
   // Only re-renders when block #42's diff changes!
   const blockDiff = useAgentRunStore(
     useCallback((s) => s.stagedDiffs["block_42"], [])
   );
   ```
   If store state is keyed by ID (`stagedDiffs: Record<string, Diff>`), components using targeted selectors only re-render when their specific slice changes. Is Jotai strictly necessary, or can well-crafted selectors give us the render isolation we need?
3. **Editor State Architecture & Refactoring:**  
   The document editor was built with its existing state engine to fit earlier requirements. While staged diffs could theoretically live in editor plugin decorations or transactions, I have no attachment to keeping that architecture as-is if agent-driven requirements demand something cleaner. If refactoring the editor's state layer—or backing custom blocks with atomic primitives (Jotai)—provides a substantially better model for streaming diffs and per-block live updates, I am fully open to restructuring it.

### My Current Working Decision

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STATE DECISION MATRIX                            │
├───────────────────────┬──────────────────────┬──────────────────────────────┤
│ State Type            │ Primary Candidate    │ Considerations               │
├───────────────────────┼──────────────────────┼──────────────────────────────┤
│ Server Data / History │ TanStack Query       │ Definite. Single source of   │
│                       │                      │ truth from Postgres/Rust.    │
├───────────────────────┼──────────────────────┼──────────────────────────────┤
│ Global UI & Dock      │ Zustand              │ Clean persistence, simple    │
│ Preferences           │                      │ slices, fits existing views. │
├───────────────────────┼──────────────────────┼──────────────────────────────┤
│ Active Run Projection │ Zustand (keyed) or   │ Keyed by runId/blockId with  │
│ (Streaming Deltas)    │ Jotai atoms          │ selectors, or atomic nodes   │
│                       │                      │ if re-render isolation tests │
│                       │                      │ show stutter.                │
├───────────────────────┼──────────────────────┼──────────────────────────────┤
│ Document Block Diffs  │ Editor Refactor /    │ Refactor editor state if     │
│ & Inline Decorations  │ Jotai Atoms vs       │ needed: atomic block nodes   │
│                       │ Editor Plugin State  │ could make diff staging      │
│                       │                      │ exceptionally clean.         │
└───────────────────────┴──────────────────────┴──────────────────────────────┘
```

The right move is to benchmark the streaming interaction on the document editor. If Zustand selectors handle high-frequency token streams and block diffs without layout thrashing, keeping a single store library is simpler. But if granular per-block diffs and ghost completions feel clunky within that model, I will refactor the editor state layer and bring in Jotai specifically where its atomic model shines.
