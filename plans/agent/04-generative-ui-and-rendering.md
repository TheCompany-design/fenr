# Engineering Notes: Generative UI, Component Composition & Rendering

> **Status:** Working notes / Specification  
> **Author:** Engineer working on Fenr agent integration  
> **Topic:** Why Gen-UI is mandatory, evaluating A2UI / json-render vs OpenUI / Tambo, and defining the multi-tier UI compiler

---

## 1. Why Gen-UI is Non-Negotiable

When interacting with an agent in Fenr—whether in the dedicated chat, the right dock, or a document workspace—text responses alone are quickly frustrating:
- When a user asks: *"Show me unpaid invoices over $5,000 for Acme"*, streaming a Markdown bulleted list is a poor experience. The user wants an interactive data table with sorting, quick actions (*"Send reminder"*, *"Mark paid"*), and status badges.
- When a user asks: *"How do our suppliers compare on price and lead times?"*, they need a side-by-side comparison card, not four paragraphs of prose.
- When a user is in a document: the agent should output our **custom blocks** (like reconciliation tables or metric callouts) directly into the page canvas.

I have concluded that **Gen-UI is critical**. The agent must communicate with rich, interactive, actionable interfaces.

---

## 2. Surveying the Landscape: What I've Looked At

I've familiarized myself with several approaches in the generative UI space, but I am still weighing the trade-offs:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GEN-UI PARADIGM COMPARISON                        │
├─────────────────────┬──────────────────────────┬────────────────────────────┤
│ Approach            │ Core Mechanism           │ My Take for Fenr           │
├─────────────────────┼──────────────────────────┼────────────────────────────┤
│ OpenUI              │ Compact DSL rendered     │ Good reference, but hard-  │
│                     │ from component catalog   │ locked to predefined comps.│
├─────────────────────┼──────────────────────────┼────────────────────────────┤
│ json-render         │ JSON UI specs validated  │ Very promising. Clean spec,│
│ (Vercel)            │ against catalog schemas  │ dynamic catalog filtering. │
├─────────────────────┼──────────────────────────┼────────────────────────────┤
│ A2UI                │ Declarative UI stream,   │ Strong protocol design.    │
│ (Google v0.9/v1.0)  │ separates data from tree │ Framework-agnostic.        │
├─────────────────────┼──────────────────────────┼────────────────────────────┤
│ Tambo               │ React component selector │ Excellent idea around      │
│                     │ + interactable app state │ "interactable" UI surfaces.│
├─────────────────────┼──────────────────────────┼────────────────────────────┤
│ MCP Apps /          │ Sandboxed iframes with   │ Essential escape hatch for │
│ OpenGenerativeUI    │ dynamic HTML/Canvas/app  │ completely custom widgets. │
└─────────────────────┴──────────────────────────┴────────────────────────────┘
```

### 1. The Catalog Ceiling Problem (OpenUI & basic json-render)
The traditional GenUI pattern is:
1. Register 30 React components (`<InvoiceCard />`, `<SupplierTable />`, `<TaskPicker />`).
2. Feed their schemas to the LLM tool definition.
3. The LLM selects one and generates its props.

*The scaling breakdown:* As your platform grows, you register 100+ components. Now your tool schema is 15,000 tokens of boilerplate. The LLM gets confused, picks suboptimal widgets, or hallucinates prop names. json-render addresses this with dynamic catalog filtering, but the fundamental limit remains: **the agent can only render what the developer anticipated and pre-coded.**

### 2. The Tambo Insight: Generative vs Interactable UI
Tambo introduces an idea that I love:
- **Generative components:** Brand new widgets created in response to user conversation.
- **Interactable components:** Existing application surfaces (e.g. an already-mounted analytics dashboard) that the agent can read and modify.
If the user says *"Filter this table to overdue items"*, the agent shouldn't generate a whole new duplicate table in the chat window. It should mutate the state of the table already on the user's screen!

---

## 3. Where I'm Leaning: The Multi-Tier UI Compiler

I am leaning heavily toward an **A2UI / json-render compositional style**, but structured into **progressive tiers** so we don't trap ourselves behind a catalog ceiling:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          4-TIER GEN-UI ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Native Primitives (shadcn in packages/ui)                           │
│   • Button, Card, Badge, Table, Input, Tabs, MetricCard                     │
│   • 100% safe, fast, styled with Tailwind v4 CSS variables                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Declarative Composition (A2UI / json-render)                        │
│   • Model composes primitives into novel surfaces                           │
│   • e.g. Card + Header + Metric + Data Grid + Action Button                 │
│   • Zero custom developer code needed for new domain cards                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Sandboxed Generated App (OpenGenerativeUI)                          │
│   • Isolated <iframe> with dynamic HTML, CSS, SVG, Canvas, or WebGL         │
│   • Used for: D3 network graphs, 3D simulations, complex visualizers        │
│   • Hard security boundary: strict CSP, postMessage RPC only                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tier 4: External Interactive Views (MCP Apps)                               │
│   • Full mini-applications served by remote MCP tool servers                │
│   • Bidirectional tool calls and state sync                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Architectural Shift: "Physics Over Pre-Defined Objects"
I don't need to predict every possible interface the agent will ever generate.  
Instead, I need to define the **physics of the universe**:
- What CSS tokens are injected (`--background`, `--foreground`, `--primary`, `--border`).
- What capabilities the surface can invoke (e.g. `emitAction("approve_invoice", { id })`).
- What it is strictly forbidden from doing (cannot touch parent DOM, cannot read cookies or session tokens, cannot execute arbitrary scripts outside the sandbox).

---

## 4. The Intermediate Representation (IR)

To keep the frontend decoupled from the specific format the model generates, our client will receive a normalized UI spec:

```typescript
export type GenUiSpecification =
  | {
      tier: "tier1_native";
      component: "Metric" | "DataTable" | "Alert" | "ActionCard";
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
    };

export interface CompositeNode {
  id: string;
  type: "Card" | "Row" | "Column" | "Text" | "Badge" | "Button" | "Table";
  props?: Record<string, unknown>;
  children?: CompositeNode[];
  actionId?: string;
}
```

---

## 5. Security & Sandboxing Details for Tier 3

For Tier 3 (where the agent generates raw HTML/Canvas/SVG), security is paramount:

1. **Sandboxed `<iframe>` Container:**
   ```html
   <iframe
     sandbox="allow-scripts"
     csp="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:;"
     srcDoc={sandboxedHtmlDoc}
   />
   ```
   - Notice: `allow-same-origin` is **omitted**. The iframe is completely isolated from Fenr's domain. It cannot read localStorage, Better Auth session cookies, or parent window state.

2. **Theme Synchronization:**
   - Before mounting, the parent injects a small CSS snippet into the iframe's `<head>` containing the computed values of the host's CSS variables.
   - When the user switches between light and dark mode, the parent sends a `THEME_CHANGE` message via `postMessage`, keeping the generated visualization perfectly in sync with Fenr's theme.

3. **Action Dispatching via RPC Bridge:**
   - If the generated visualization includes an interactive button or slider, it posts a message:
     ```javascript
     window.parent.postMessage({ type: "DISPATCH_ACTION", actionId: "update_scenario", payload: { margin: 0.15 } }, "*");
     ```
   - The parent validates the message against a strict schema and routes it back to the Rust agent runtime via the BFF.

---

## 6. What Needs Concrete Prototyping Next

1. **Prototyping Tier 2 with shadcn:** Build a small recursive renderer `<CompositeSurface node={spec.root} />` that maps nodes (`Card`, `Button`, `Table`) directly to our `@workspace/ui` primitives.
2. **Action Dispatching Contract:** Solidify how user button clicks inside a Gen-UI card route back to the Rust agent as follow-up tool executions or user turns.
3. **Document Editor Embedding:** Connect the Gen-UI renderer into our rich-text custom block system, so that custom blocks can either be native components or composite Gen-UI widgets.
