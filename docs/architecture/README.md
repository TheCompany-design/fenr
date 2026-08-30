# Fenr Architecture Documentation

Welcome to the architectural specifications for the **Fenr** platform.

## Document System Architecture

The document subsystem specifications are located in [`documents/`](./documents/):

- [Document System Architecture & End-to-End Flow](./documents/document-system.md): Comprehensive specification of the ProseMirror/Tiptap, Jotai, and React-based document editing system, including component boundaries, lifecycle flows, and extensibility contracts.
- [Architectural Justification: The Role of Jotai](./documents/jotai-justification.md): In-depth technical justification for choosing Jotai over React Context, Zustand, and Tiptap's `useEditorState`, with performance profiling and multi-instance isolation analysis.
- [Architectural Justification: The Role of EditorSyncBridge](./documents/editor-sync-bridge-justification.md): Detailed analysis of the synchronization boundary between ProseMirror transactions and Jotai, write gating, domain routing, and lifecycle safety.
