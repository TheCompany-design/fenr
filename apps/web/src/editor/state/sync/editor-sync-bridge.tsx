import { type Editor, useCurrentEditor } from "@tiptap/react"
import { useEffect } from "react"
import {
  DEFAULT_FORMATTING_STATE,
  DEFAULT_SELECTION_STATE,
  type FormattingState,
  formattingAtom,
  type SelectionState,
  selectionAtom,
} from "../atoms"
import { useEditorStore } from "../editor-store"

/**
 * Pure function: extracts formatting metadata from the current editor state.
 */
export function deriveFormattingSnapshot(
  editor: Editor | null,
): FormattingState {
  if (!editor || editor.isDestroyed) {
    return DEFAULT_FORMATTING_STATE
  }

  let textType: FormattingState["textType"] = "text"
  if (editor.isActive("heading", { level: 1 })) {
    textType = "heading-1"
  } else if (editor.isActive("heading", { level: 2 })) {
    textType = "heading-2"
  } else if (editor.isActive("heading", { level: 3 })) {
    textType = "heading-3"
  }

  const isAlignCenter = editor.isActive({ textAlign: "center" }) ?? false
  const isAlignRight = editor.isActive({ textAlign: "right" }) ?? false
  const isAlignJustify = editor.isActive({ textAlign: "justify" }) ?? false
  const isAlignLeft =
    (editor.isActive({ textAlign: "left" }) ?? false) ||
    (!isAlignCenter && !isAlignRight && !isAlignJustify)

  return {
    isBold: editor.isActive("bold") ?? false,
    isItalic: editor.isActive("italic") ?? false,
    isStrikethrough: editor.isActive("strike") ?? false,
    isBulletList: editor.isActive("bulletList") ?? false,
    isOrderedList: editor.isActive("orderedList") ?? false,
    textType,
    isAlignLeft,
    isAlignCenter,
    isAlignRight,
    isAlignJustify,
    isCode: editor.isActive("code") ?? false,
    isCodeBlock: editor.isActive("codeBlock") ?? false,
    isBlockquote: editor.isActive("blockquote") ?? false,
    isMath:
      (editor.isActive("inlineMath") || editor.isActive("blockMath")) ?? false,
  }
}

/**
 * Pure function: extracts selection metadata from the current editor state.
 */
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

/**
 * Shallow comparison helper to prevent redundant formatting atom updates.
 */
export function areStatesEqual(
  a: FormattingState,
  b: FormattingState,
): boolean {
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

export const areFormattingStatesEqual = areStatesEqual

export function areSelectionStatesEqual(
  a: SelectionState,
  b: SelectionState,
): boolean {
  return a.from === b.from && a.to === b.to && a.empty === b.empty
}

export interface EditorSyncBridgeProps {
  editor?: Editor | null
}

/**
 * Invisible bridge component mounted at the DocumentEditor boundary.
 * Synchronizes Tiptap state domain-by-domain directly into the instance's Jotai store.
 * Resolves the editor from props if supplied, otherwise falls back to Tiptap Context.
 */
export const EditorSyncBridge = ({
  editor: propEditor,
}: EditorSyncBridgeProps = {}) => {
  const { editor: contextEditor } = useCurrentEditor()
  const editor = propEditor ?? contextEditor ?? null
  const store = useEditorStore()

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const syncFormatting = () => {
      const nextSnapshot = deriveFormattingSnapshot(editor)
      const currentSnapshot = store.get(formattingAtom)
      if (!areStatesEqual(currentSnapshot, nextSnapshot)) {
        store.set(formattingAtom, nextSnapshot)
      }
    }

    const syncSelection = () => {
      const nextSelection = deriveSelectionSnapshot(editor)
      const currentSelection = store.get(selectionAtom)
      if (!areSelectionStatesEqual(currentSelection, nextSelection)) {
        store.set(selectionAtom, nextSelection)
      }
    }

    // 1. Run initial synchronization
    syncFormatting()
    syncSelection()

    // 2. Selection updates trigger selection sync and active formatting sync
    const handleSelectionUpdate = () => {
      syncSelection()
      syncFormatting()
    }

    // 3. Transactions perform domain-specific synchronization
    const handleTransaction = ({
      transaction,
    }: {
      transaction: { docChanged?: boolean; selectionSet?: boolean }
    }) => {
      if (transaction.selectionSet) {
        syncSelection()
      }
      syncFormatting()
    }

    editor.on("selectionUpdate", handleSelectionUpdate)
    editor.on("transaction", handleTransaction)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
      editor.off("transaction", handleTransaction)
    }
  }, [editor, store])

  return null
}
