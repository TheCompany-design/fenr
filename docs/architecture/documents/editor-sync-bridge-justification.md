# Architectural Justification: The Role of EditorSyncBridge

This document outlines the architectural necessity, technical design, and performance rationale behind the **`EditorSyncBridge`** within Fenr's Document System.

---

## 1. Executive Summary

Rich-text editors powered by ProseMirror/Tiptap and React operate on opposing paradigms:
- **ProseMirror**: An imperative, synchronous transaction engine running a continuous step-based event loop on real DOM nodes.
- **React**: A declarative, batched reconciliation system managing a virtual DOM tree.

To connect these two worlds without compromising frame rates, an explicit mediator is required. In Fenr, this role is fulfilled by the **`EditorSyncBridge`**.

Rather than allowing UI components to hook directly into ProseMirror events or burying synchronization logic inside visual surface components, `EditorSyncBridge` acts as a **dedicated, renderless orchestration engine** positioned between ProseMirror and Jotai. It provides:
1. **Separation of Operational Synchronization from Visual Rendering**: Cleanly decoupling the ProseMirror DOM surface from synchronization mechanics.
2. **Domain-Specific Transaction Gating**: Segregating selection updates from formatting mark updates.
3. **Shallow Equality Gating**: Preventing redundant atom writes when transactions do not alter formatting state.
4. **Lifecycle and Memory Safety**: Guaranteeing that event listeners are strictly registered and unregistered without leaking memory across document switches.

---

## 2. The Anti-Patterns `EditorSyncBridge` Eliminates

### 2.1. Anti-Pattern 1: Dispersed Event Listeners in UI Components

In un-architected editor codebases, individual toolbar buttons or floating menus subscribe directly to editor events:

```text
ProseMirror Instance
   ├── BoldButton (editor.on("transaction", ...))
   ├── ItalicButton (editor.on("transaction", ...))
   ├── HeadingSelect (editor.on("transaction", ...))
   └── AlignmentButtons (editor.on("transaction", ...))
```

**Consequences**:
- **O(N) Listener Explosion**: Every mounted button maintains its own listener on the ProseMirror instance. 30 buttons generate 30 listener executions per keystroke.
- **Leaked Listeners**: When dropdown menus or popovers open and close, listeners are constantly attached and detached, increasing the risk of memory leaks and stale closures.
- **Inconsistent Snapshots**: If different buttons query ProseMirror at slightly different ticks or under different conditions, UI states can drift out of sync.

### 2.2. Anti-Pattern 2: Burying Synchronization in `EditorSurface`

An earlier architectural iteration placed the sync bridge inside `EditorSurface`:

```tsx
// PREVIOUS ITERATION (Anti-Pattern)
export const EditorSurface = ({ editor }: EditorSurfaceProps) => {
  return (
    <div>
      <Tiptap editor={editor}>
        <EditorSyncBridge />
        <Tiptap.Content />
      </Tiptap>
    </div>
  )
}
```

**Why this was problematic**:
- **Violates Single Responsibility**: `EditorSurface` should only be responsible for rendering the DOM viewport (`<Tiptap.Content />`). Packaging event synchronization inside it conflates visual presentation with state orchestration.
- **Coupling to Canvas**: If the canvas is virtualized, paged, or conditionally unmounted for print preview, the synchronization bridge could be unmounted unexpectedly, severing state updates to floating toolbars or sidebars.

---

## 3. The Current Architecture: Synchronizer at the Orchestration Boundary

In Fenr's refactored architecture, `EditorSyncBridge` is elevated to the `DocumentEditor` orchestrator level:

```text
DocumentEditor (Orchestrator)
   │
   ├── EditorSyncBridge (Pure State Synchronization Engine)
   │        │
   │        ▼ writes to
   │    Scoped Jotai Store
   │        ▲
   │        │ reads from
   ├── BubbleMenu / EditorChrome (Pure Reactive Consumers)
   │
   └── DocumentCanvas (Geometry & Paper Metaphor)
            │
            └── EditorSurface (Pure Presentation Viewport)
                     └── Tiptap.Content (ProseMirror DOM Node)
```

```tsx
// CURRENT IMPLEMENTATION (Clean Boundary)
export function DocumentEditor({ content, definition, onChange }: DocumentEditorProps) {
  const editor = useDocumentEditor({ content, definition, onChange })
  if (!editor) return null

  return (
    <div className="relative w-full">
      {/* 1. Headless Synchronization */}
      <EditorSyncBridge editor={editor} />

      {/* 2. Decoupled UI Chrome */}
      <BubbleMenu editor={editor} />

      {/* 3. Pure Geometry & Surface */}
      <DocumentCanvas {...definition.canvas}>
        <EditorSurface editor={editor} />
      </DocumentCanvas>
    </div>
  )
}
```

### Architectural Benefits:
1. **`EditorSurface` is Pure**: It contains zero synchronization logic, zero hooks other than receiving the editor instance, and no vendor stylesheet imports.
2. **Headless & Testable**: The synchronization pipeline can be exercised and verified in unit tests ([`sync-bridge.test.ts`](file:///home/muchiri/dev/bag/atelier/fenr/apps/web/src/editor/state/sync-bridge.test.ts)) without requiring a real browser DOM canvas or layout calculations.
3. **Resilient Chrome**: `BubbleMenu`, `SlashMenu`, and future status bars consume state from Jotai without caring where the editor is physically mounted on screen.

---

## 4. Technical Mechanics of `EditorSyncBridge`

### 4.1. Domain-Specific Synchronization

Transactions in ProseMirror are not uniform. A user may:
- **Move the cursor** without changing any text (`selectionSet === true`, `docChanged === false`).
- **Type regular text** without changing the selection range type (`docChanged === true`, `selectionSet === true`).
- **Update metadata / plugin state** without altering text or selection (`docChanged === false`, `selectionSet === false`).

`EditorSyncBridge` enforces domain-specific event routing:

```ts
const handleSelectionUpdate = () => {
  syncSelection()
  syncFormatting()
}

const handleTransaction = ({
  transaction,
}: {
  transaction: { docChanged?: boolean; selectionSet?: boolean }
}) => {
  if (transaction.selectionSet) {
    syncSelection()
  }
  if (transaction.docChanged || transaction.selectionSet) {
    syncFormatting()
  }
}

editor.on("selectionUpdate", handleSelectionUpdate)
editor.on("transaction", handleTransaction)
```

### 4.2. Pure Function Extractors

All extraction logic is decoupled into pure, deterministic functions:

```ts
export function deriveFormattingSnapshot(editor: Editor | null): FormattingState {
  if (!editor || editor.isDestroyed) {
    return DEFAULT_FORMATTING_STATE
  }

  // Pure extraction of 14 formatting markers from ProseMirror state...
  return {
    isBold: editor.isActive("bold") ?? false,
    isItalic: editor.isActive("italic") ?? false,
    // ...
  }
}

export function deriveSelectionSnapshot(editor: Editor | null): SelectionState {
  if (!editor || editor.isDestroyed || !editor.state) {
    return DEFAULT_SELECTION_STATE
  }

  const { selection } = editor.state
  return {
    from: selection.from,
    to: selection.to,
    empty: selection.empty,
  }
}
```

Because these functions are pure, they can be tested exhaustively across simulated editor states (including destroyed editors, heading levels, alignments, math formulas, and code blocks) without React rendering overhead.

### 4.3. The Shallow Comparison Guard (Write Gating)

Even with Jotai's fine-grained atoms, writing to a primitive atom triggers downstream evaluation of its derived selectors. If a user types 100 characters in a plain paragraph:
- 100 transactions are emitted.
- In all 100 transactions, `isBold` remains `false`, `textType` remains `"text"`, and `isItalic` remains `false`.

`EditorSyncBridge` prevents unnecessary atom writes through shallow equality gating:

```ts
const syncFormatting = () => {
  const nextSnapshot = deriveFormattingSnapshot(editor)
  const currentSnapshot = store.get(formattingAtom)

  // Gate writes: Only dispatch an atom write if values genuinely changed
  if (!areStatesEqual(currentSnapshot, nextSnapshot)) {
    store.set(formattingAtom, nextSnapshot)
  }
}
```

Where `areStatesEqual` executes a strict, 14-point boolean check:

```ts
export function areStatesEqual(a: FormattingState, b: FormattingState): boolean {
  return (
    a.isBold === b.isBold &&
    a.isItalic === b.isItalic &&
    a.isStrikethrough === b.isStrikethrough &&
    a.isBulletList === b.isBulletList &&
    a.isOrderedList === b.isOrderedList &&
    a.textType === b.textType &&
    a.isAlignLeft === b.isAlignLeft &&
    a.isAlignCenter === b.isAlignCenter &&
    a.isAlignRight === b.isAlignRight &&
    a.isAlignJustify === b.isAlignJustify &&
    a.isCode === b.isCode &&
    a.isCodeBlock === b.isCodeBlock &&
    a.isBlockquote === b.isBlockquote &&
    a.isMath === b.isMath
  )
}
```

#### Performance Consequence:
During continuous typing inside a paragraph, **`store.set(formattingAtom, ...)` is called 0 times**. The entire React tree stays completely idle.

---

## 5. Lifecycle and Memory Invariants

| Invariant | Defensive Implementation in `EditorSyncBridge` |
| :--- | :--- |
| **No Stale Listeners** | The `useEffect` returns a cleanup function explicitly unregistering `editor.off("selectionUpdate")` and `editor.off("transaction")`. |
| **Destroyed Editor Safety** | Guard checks `if (!editor \|\| editor.isDestroyed) return` before attaching listeners or querying marks. |
| **Initial Hydration Sync** | `syncFormatting()` and `syncSelection()` run synchronously on mount so that the Jotai store is populated before the first user interaction. |
| **Instance Isolation** | Reads `store` from `useEditorStore()`, guaranteeing that updates are dispatched into the instance's scoped store rather than a global singleton. |

---

## 6. Summary

`EditorSyncBridge` is the linchpin that makes Fenr's document editor architecture both **robust** and **fast**:
- It protects React from ProseMirror's high-frequency transaction stream.
- It protects ProseMirror from React's render cycles.
- It allows `EditorSurface` to remain a simple visual container.
- It ensures that UI chrome receives clean, shallow-gated, domain-specific state updates with zero wasted CPU cycles.
