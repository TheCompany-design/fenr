# Engineering Notes: Agent Architecture — Overview & Core Use Cases

> **Status:** Working notes / Conceptual  
> **Author:** Engineer working on Fenr agent integration  
> **Topic:** High-level topology, interaction modalities, and linking Rust (Rig) to TanStack Start

---

## 1. Where I Am Right Now

I have already built the agent runtime in Rust using [Rig](https://github.com/0xPlaygrounds/rig) combined with custom orchestration code (in Nabu). That part is feeling solid—it handles the actual agent loop, tool execution pipelines, memory/context retrieval, and model interfacing.

Now the real challenge begins: **linking this Rust runtime with my TanStack Start frontend in Fenr for client use.**

The initial thought might be "just build a chat UI and hook up Server-Sent Events (SSE)". But the more I think about it, the clearer it becomes that treating this as a simple chat interface is a trap. I'm trying to figure out how people are actually going to use this agent day-to-day across the platform, and that interaction model has to dictate the system's architecture—not the other way around.

---

## 2. The Three Primary Interaction Modalities

Looking at our product workflows, users aren't going to interact with the agent in only one way. I see three distinct modalities:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTERACTION MODALITIES                           │
├─────────────────────────┬─────────────────────────┬─────────────────────────┤
│ 1. Dedicated Chat       │ 2. Contextual Dock/Sheet│ 3. Document IDE Collab  │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Full-page immersion   │ • Persistent right dock │ • Inline predictions    │
│ • Exploratory research  │ • Follows user on pages │ • Ghost text / diffs    │
│ • Long-form outputs     │ • Automatic page context│ • Accept / reject edits │
│ • Deep multi-step runs  │ • Quick queries & tasks │ • Custom block awareness│
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### Modality 1: Dedicated Full Chat Interface
- **What it is:** The familiar full-screen conversational interface (ChatGPT/Claude style).
- **When it's used:** When the user is doing deep exploratory work, open-ended research, reviewing long multi-step agent plans, or having an extended back-and-forth that requires a broad canvas.
- **Characteristics:** High vertical/horizontal real estate, full run history, extensive tool output displays, nested Gen-UI cards.

### Modality 2: Contextual Right-Side Dock / Sheet
- **What it is:** A collapsible drawer or right-side docked panel accessible while the user navigates other parts of the application (e.g. looking at an organization dashboard, viewing billing settings, browsing a ledger or inventory table).
- **When it's used:** The user is on a specific page, notices something or needs an action taken, and triggers the assistant without wanting to navigate away.
- **The Core Problem Here — Page Context:** 
  - When the user opens the dock, the agent *must* know what the user is looking at.
  - If they're on `/orgs/acme/invoices/inv_123`, the agent shouldn't ask "which invoice are you looking at?". It should already have that invoice ID and view state injected into its contextual frame.
  - *Still unsure of:* How do we declaratively register page context from the active route into the dock? (Route metadata? An active-context provider hook? Route loader snapshots?). Needs to be lightweight and not trigger full agent prompt invalidation on every tiny scroll or click.

### Modality 3: IDE-like Document Collaboration (Custom Blocks & Diffs)
- **What it is:** Fenr supports rich-text document editing with custom block structures (not just plain markdown blobs). Working with the agent inside documents needs to feel like pair-programming in Cursor or VS Code, rather than "copy-pasting from a chat window".
- **What I want it to do:**
  - **Inline predictions / ghost text:** Tab-to-complete suggestions while writing.
  - **Inline visual diffs:** When the agent modifies text or blocks, render a clear before/after comparison with green/red diff highlights.
  - **Accept / Reject controls:** The user can accept all, reject all, or accept individual hunk edits directly within the document canvas.
  - **Custom block awareness:** The agent can't just emit flat strings. It needs to read, understand, generate, and edit our custom blocks (e.g., embedded metrics, callouts, data tables, checklist tasks).
- *Still unsure of:* How deeply the agent runtime in Rust needs to understand our editor's AST, and how to stream diffs cleanly without causing document state corruption.

---

## 3. The Need for Generative UI (Gen-UI)

Text is not enough. In both the chat canvas and the dock—and especially in the document workspace—the agent needs to communicate through interactive widgets, comparison tables, scenario sliders, and action forms.

- I am leaning toward an **A2UI / json-render style** (declarative composition of known primitives) rather than generating raw unchecked React code.
- But I also recognize that a fixed catalog can become a ceiling when the agent needs to visualize something truly bespoke (like a dynamic chart, D3 network graph, or scenario simulator).
- I need to figure out how far declarative composition can take us before we need sandboxed escape hatches.

---

## 4. What Lies Ahead (Constituent Notes)

To flesh this out properly without drowning in a single monolithic document, I am breaking my thinking into dedicated notes:

1. **`01-interaction-modes-and-document-ide.md`:** Deep-dive into the Dock context-injection mechanism, editor AST integration, inline diffing, and the accept/reject UX.
2. **`02-runtime-boundary-and-transport.md`:** Clarifying the line between Rust (Rig) and TanStack Start, evaluating TanStack AI's actual utility, and designing the resilient SSE event stream.
3. **`03-state-boundaries-query-zustand-jotai.md`:** Untangling state management—where TanStack Query is definite, where Zustand fits, and whether atomic state (Jotai) is warranted for editor diffs and streaming tokens.
4. **`04-generative-ui-and-rendering.md`:** Evaluating A2UI vs json-render vs Tambo vs MCP Apps, defining our UI specification format, and structuring safe component rendering.
