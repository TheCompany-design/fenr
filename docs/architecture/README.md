# Fenr Architecture Documentation

Welcome to the architectural specifications for the **Fenr** platform.

## Document System Architecture

The document subsystem specifications are located in [`documents/`](./documents/):

- [Document System Architecture & End-to-End Flow](./documents/document-system.md): Comprehensive specification of the ProseMirror/Tiptap, Jotai, and React-based document editing system, including component boundaries, lifecycle flows, and extensibility contracts.
- [Block Drag Handle Subsystem Architecture](./documents/drag-handle-architecture.md): Architectural design of the floating block drag handle, coordinate clamping, HTML5 drag-and-drop integration, and scoped Jotai synchronization.
- [Architectural Justification: The Role of Jotai](./documents/jotai-justification.md): In-depth technical justification for choosing Jotai over React Context, Zustand, and Tiptap's `useEditorState`, with performance profiling and multi-instance isolation analysis.
- [Architectural Justification: The Role of EditorSyncBridge](./documents/editor-sync-bridge-justification.md): Detailed analysis of the synchronization boundary between ProseMirror transactions and Jotai, write gating, domain routing, and lifecycle safety.

## Agent Chat & Generative UI Architecture

The agent chat subsystem specifications and end-to-end execution traces are located in [`../walkthroughs/`](../walkthroughs/):

- [Chat Lifecycle Overview](../walkthroughs/01_chat_lifecycle_overview.md): High-level architectural overview across React UI components, custom hooks, Zustand stores, TanStack Start BFF proxy, and upstream Nabu.
- [Deep Dive: Initial Request (Turn 0)](../walkthroughs/02_initial_turn_deep_dive.md): Code-level trace from Bun.serve, initial client mount state, TanStack Form validation, BFF proxy authentication, outbound EdDSA JWT minting, to SSE parsing and pure reducer state projection.
- [Deep Dive: Subsequent Request (Turn 1)](../walkthroughs/03_subsequent_turn_deep_dive.md): Step-by-step trace of a follow-up prompt in the same conversation, thread continuity, non-fighting auto-scroll, and AbortController cancellation mechanics.

