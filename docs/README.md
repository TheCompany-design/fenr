# Fenr Platform Documentation

Welcome to the technical documentation for **Fenr**, an AI-native operational platform built with TanStack Start, React 19, Tailwind CSS v4, and Bun.

---

## 1. Documentation Map

The documentation is organized across core platform subsystems:

```text
docs/
├── architecture/     # Subsystem specifications (document editor, drag handles, Jotai, sync bridges)
├── walkthroughs/     # End-to-end execution walkthroughs and deep-dive traces (chat, streaming, BFF)
└── integrations/     # Third-party integrations (Google, Microsoft, communication, developer tooling)
```

---

## 2. Directory Index

### 🚶 Walkthroughs & Deep Dives

- [Chat Lifecycle Overview](file:///home/muchiri/dev/bag/atelier/fenr/docs/walkthroughs/01_chat_lifecycle_overview.md): High-level architectural overview across React UI components, custom hooks, Zustand stores, TanStack Start BFF proxy, and upstream Nabu.
- [Deep Dive: Initial Request (Turn 0)](file:///home/muchiri/dev/bag/atelier/fenr/docs/walkthroughs/02_initial_turn_deep_dive.md): Code-level trace from Bun.serve, initial client mount state, TanStack Form validation, BFF proxy authentication, outbound EdDSA JWT minting, to SSE parsing and pure reducer state projection.
- [Deep Dive: Subsequent Request (Turn 1)](file:///home/muchiri/dev/bag/atelier/fenr/docs/walkthroughs/03_subsequent_turn_deep_dive.md): Step-by-step trace of a follow-up prompt in the same conversation, thread continuity, non-fighting auto-scroll, and AbortController cancellation mechanics.

### 🏛️ System Architecture

- [Architecture Overview](file:///home/muchiri/dev/bag/atelier/fenr/docs/architecture/README.md): Architecture map and subsystem index.
- [Document System Architecture](file:///home/muchiri/dev/bag/atelier/fenr/docs/architecture/documents/document-system.md): Specification of the ProseMirror/Tiptap, Jotai, and React-based document editing system.
- [Block Drag Handle Subsystem](file:///home/muchiri/dev/bag/atelier/fenr/docs/architecture/documents/drag-handle-architecture.md): Floating block drag handle, coordinate clamping, and HTML5 drag-and-drop integration.
- [Role of Jotai Justification](file:///home/muchiri/dev/bag/atelier/fenr/docs/architecture/documents/jotai-justification.md): In-depth technical justification for choosing Jotai over React Context, Zustand, and Tiptap's `useEditorState`.
- [Role of EditorSyncBridge Justification](file:///home/muchiri/dev/bag/atelier/fenr/docs/architecture/documents/editor-sync-bridge-justification.md): Synchronization boundary between ProseMirror transactions and Jotai.

### 🔌 Third-Party Integrations

- [Integrations Overview](file:///home/muchiri/dev/bag/atelier/fenr/docs/integrations/README.md): Third-party OAuth and service integrations across business, developer, Google, Microsoft, and communication suites.
