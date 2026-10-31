import { type Editor, useCurrentEditor } from "@tiptap/react"
import { useEffect } from "react"
import {
  DEFAULT_DOCUMENT_STATS,
  DEFAULT_FORMATTING_STATE,
  DEFAULT_SELECTION_STATE,
  areDocumentStatsEqual,
  type DocumentStats,
  type FormattingState,
  formattingAtom,
  type SelectionState,
  selectionAtom,
} from "../atoms"
import { documentStatsAtom } from "../atoms/stats"
import { useEditorStore } from "../editor-store"

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

  const highlightAttributes = editor.getAttributes("highlight")
  const textStyleAttributes = editor.getAttributes("textStyle")

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
    highlightColor:
      typeof highlightAttributes.color === "string"
        ? highlightAttributes.color
        : null,
    textColor:
      typeof textStyleAttributes.color === "string"
        ? textStyleAttributes.color
        : null,
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
    a.isMath === b.isMath &&
    a.highlightColor === b.highlightColor &&
    a.textColor === b.textColor
  )
}

export const areFormattingStatesEqual = areStatesEqual

export function deriveDocumentStats(editor: Editor | null): DocumentStats {
  if (!editor || editor.isDestroyed) {
    return DEFAULT_DOCUMENT_STATS
  }
  const storage = (
    editor.storage as unknown as Record<
      string,
      { words?: () => number; characters?: () => number } | undefined
    >
  ).characterCount
  if (typeof storage?.words !== "function" || typeof storage?.characters !== "function") {
    return DEFAULT_DOCUMENT_STATS
  }
  return {
    words: storage.words(),
    characters: storage.characters(),
  }
}

export function areDocumentStatsStatesEqual(
  a: DocumentStats,
  b: DocumentStats,
): boolean {
  return areDocumentStatsEqual(a, b)
}

export function areSelectionStatesEqual(
  a: SelectionState,
  b: SelectionState,
): boolean {
  return a.from === b.from && a.to === b.to && a.empty === b.empty
}

export interface EditorSyncBridgeProps {
  editor?: Editor | null
}

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

    const syncStats = () => {
      const nextStats = deriveDocumentStats(editor)
      const currentStats = store.get(documentStatsAtom)
      if (!areDocumentStatsEqual(currentStats, nextStats)) {
        store.set(documentStatsAtom, nextStats)
      }
    }

    const syncSelection = () => {
      const nextSelection = deriveSelectionSnapshot(editor)
      const currentSelection = store.get(selectionAtom)
      if (!areSelectionStatesEqual(currentSelection, nextSelection)) {
        store.set(selectionAtom, nextSelection)
      }
    }

    syncFormatting()
    syncSelection()
    syncStats()

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
      if (transaction.docChanged) {
        syncStats()
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
