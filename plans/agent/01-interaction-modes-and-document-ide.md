# Engineering Notes: Interaction Surfaces & Document IDE Collaboration

> **Status:** Working notes / Experimental thoughts  
> **Author:** Engineer working on Fenr agent integration  
> **Topic:** Context-aware right dock, rich-text custom blocks, inline diffs, and accept/reject patterns

---

## 1. Contextual Right-Side Dock: How Does It Know What the User Sees?

The dedicated chat view is relatively straightforward from an input/output perspective. But the **right-side dock/sheet** introduces a major puzzle: **context injection**.

When a user is working on an organization settings page, browsing a financial ledger, or reviewing invoices, and toggles open the AI dock (`Cmd+K` or clicking a persistent edge trigger), they expect the agent to immediately understand their surroundings.

```text
User on Route: /orgs/acme/invoices/inv_9874
      │
      ├── Route Match (TanStack Router)
      ├── Active Route Data (Query Cache: invoice details, line items, status)
      │
      ▼
Context Gathering Pipeline
      │
      ├── 1. Route Path & Params: { orgId: "acme", invoiceId: "inv_9874" }
      ├── 2. Active View Snapshot: { title: "Invoice #9874", amount: 4500, currency: "USD", status: "pending" }
      └── 3. User Selection (optional): text highlighted in the main content area
      │
      ▼
Sent to Rust Runtime as Context Envelope with Prompt
```

### What I've Considered vs What I'm Still Unsure Of

- **Approach A: Implicit Route Scraping (Too magic / brittle):**  
  Trying to serialize whatever DOM is on screen or automatically dumping all active TanStack Query caches into the prompt.  
  *Why I'm hesitant:* Huge token waste, non-deterministic prompts, leaking sensitive off-screen fields, and potential privacy violations.

- **Approach B: Declarative `useAgentPageContext` Hook (Leaning toward this):**  
  Each route or feature page explicitly declares what it wants to expose to the agent when active:
  ```tsx
  // Inside routes/_protected.invoices.$invoiceId.tsx
  useAgentPageContext({
    scope: "invoice",
    summary: `Viewing invoice ${invoice.number} for ${invoice.customerName}`,
    metadata: {
      invoiceId: invoice.id,
      total: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
    },
    quickPrompts: [
      "Summarize outstanding balance",
      "Draft a payment reminder email",
      "Check reconciliation match",
    ],
  });
  ```
  When the dock opens, its initial state reads from this active context registration.

- *Unresolved questions:*
  1. What happens when the user navigates routes while the dock stays open with an active conversation? Does the context dynamically update as a system message in the ongoing run, or does it only attach on the next user turn?
  2. How do we prevent stale context if data mutates in the background?

---

## 2. Document Editing: The "IDE-Like" Collaboration Surface

Fenr has a rich-text document editing component that isn't just flat markdown—it includes **custom blocks** (e.g., structured metrics, callout notes, dynamic tables, signature blocks, task lists). 

I don't want the agent interaction here to feel like a chatbot living in a separate silo where the user has to copy-paste generated text back and forth. I want an IDE-like experience (similar to Cursor or Google Docs' "Help me write", but block-aware).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT CANVAS (EDITOR)                          │
│                                                                             │
│  Paragraph text paragraph text paragraph text...                            │
│                                                                             │
│  ┌─ AGENT STAGED DIFF ───────────────────────────────────────────────────┐  │
│  │ [- The monthly recurring revenue was estimated at $45,000. -]         │  │
│  │ {+ After auditing ledger accounts, MRR is confirmed at $48,250. +}    │  │
│  │                                                                       │  │
│  │  [✓ Accept (Tab)]   [✗ Reject (Esc)]   [💬 Refine with Agent]         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ CUSTOM BLOCK: RECONCILIATION TABLE ──────────────────────────────────┐  │
│  │  Account         │ Stated Balance │ Bank Balance │ Delta              │  │
│  │  Operating Acct  │ $120,400       │ $120,400     │ $0.00              │  │
│  │  Payroll Reserve │ $45,000        │ $43,200      │ -$1,800 (Pending)  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. The Interaction Loops I Want to Support

1. **Inline Predictions / Ghost Text:**
   - As the user pauses while writing, the model suggests the next clause or sentence in faded gray text.
   - User hits `Tab` to accept, or keeps typing to dismiss.
   - *Technical challenge:* Needs sub-200ms latency. Can the Rust/Rig runtime provide a dedicated lightweight prediction endpoint (perhaps using a smaller/faster model or speculative decoding)?

2. **Inline Diffs (Character, Word, and Block-Level):**
   - User highlights a section (or an entire block) and prompts: *"Make this tone more formal"* or *"Update figures based on yesterday's report"*.
   - Instead of immediately replacing the text in the editor, the editor renders a **staged diff view** right where the original content was.
   - Red strikethrough for deleted text/blocks, green highlight for insertions.

3. **Accept / Reject Workflow:**
   - The user must stay in full control. Changes shouldn't silently overwrite user content.
   - Options:
     - Accept all / Reject all (for multi-block refactors).
     - Hunk-by-hunk review (accepting sentence 1, rejecting sentence 2).
   - *State problem:* Applying an accepted diff must integrate cleanly with the editor's undo/redo stack (`history` plugin) as a single coherent transaction, so hitting `Cmd+Z` afterwards undoes the applied agent diff cleanly rather than breaking the document.

4. **Custom Block Awareness:**
   - The agent cannot just think in strings. It needs to know:
     - Block types (e.g. `type: "metric_card"`, `type: "reconciliation_table"`, `type: "callout"`).
     - Block schemas and props.
   - The agent should be able to say: *"I noticed a discrepancy, so I've inserted a Reconciliation Block below."* and emit the JSON structure for that custom block directly into the document AST.

---

## 3. What I'm Still Struggling With Technically

1. **AST Serialization vs Token Consumption:**
   - If our rich-text editor has an internal JSON AST (like ProseMirror / Tiptap nodes), sending the raw AST to the LLM can blow up prompt tokens with formatting metadata, node IDs, and marks.
   - *Alternative:* Converting editor content to an extended Markdown format (Markdown + custom block tags like `<ReconciliationTable data={...} />`) for model consumption, and parsing it back to AST upon receipt.
   - Is that translation layer lossy? How do we preserve unique node IDs so the agent can target a specific block for replacement?

2. **Concurrent Edits & Stale Diffs:**
   - What happens if the user keeps typing while the agent is streaming an edit for an adjacent paragraph?
   - If the user types, the character offsets change. If the agent's diff was calculated against character offset 120–350, applying it will clobber the user's new typing.
   - We need **position-independent anchors** (block IDs) rather than raw string offsets. The agent should target `{ blockId: "block_abc", action: "replace", diff: ... }`.

3. **Where Does Editor State Live?**
   - The document editor has its own internal state engine.
   - The staged diffs and agent proposals feel like an ephemeral layer sitting *on top* of the editor.
   - Does this warrant fine-grained atomic state (like Jotai atoms per block), or does our main Zustand store manage active suggestions? (Exploring this in note `03`).
