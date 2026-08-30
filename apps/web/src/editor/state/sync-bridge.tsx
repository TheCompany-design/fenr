import type { Editor } from "@tiptap/react"
import { useEffect } from "react"
import {
  type BubbleMenuFormattingState,
  DEFAULT_BUBBLE_MENU_FORMATTING,
  bubbleMenuFormattingAtom,
} from "./atoms"
import { useEditorStore } from "./editor-store"

/**
 * Pure function: extracts formatting metadata from the current editor state.
 */
export function deriveFormattingSnapshot(editor: Editor | null): BubbleMenuFormattingState {
  if (!editor || editor.isDestroyed) {
    return DEFAULT_BUBBLE_MENU_FORMATTING
  }

  let textType: BubbleMenuFormattingState["textType"] = "text"
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
 * Shallow comparison helper to prevent redundant atom updates.
 */
function areStatesEqual(
  a: BubbleMenuFormattingState,
  b: BubbleMenuFormattingState,
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

export interface EditorSyncBridgeProps {
  editor: Editor | null
}

/**
 * Invisible bridge component mounted within the editor hierarchy.
 * Synchronizes Tiptap transactions directly into the instance's Jotai store.
 */
export const EditorSyncBridge = ({ editor }: EditorSyncBridgeProps) => {
  const store = useEditorStore()

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const syncState = () => {
      const nextSnapshot = deriveFormattingSnapshot(editor)
      const currentSnapshot = store.get(bubbleMenuFormattingAtom)

      // Only dispatch an atom write if values have genuinely changed!
      if (!areStatesEqual(currentSnapshot, nextSnapshot)) {
        store.set(bubbleMenuFormattingAtom, nextSnapshot)
      }
    }

    // 1. Run initial synchronization
    syncState()

    // 2. Subscribe to Tiptap transaction & selection changes
    editor.on("transaction", syncState)
    editor.on("selectionUpdate", syncState)

    // 3. Clean up listeners on unmount or when the editor instance changes
    return () => {
      editor.off("transaction", syncState)
      editor.off("selectionUpdate", syncState)
    }
  }, [editor, store])

  return null
}
