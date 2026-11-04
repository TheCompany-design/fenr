import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { common, createLowlight } from "lowlight"
import { CodeBlockView } from "./code-block-view"

/**
 * Shared lowlight instance backing every code block. `lowlight` keeps a
 * language registry only — it holds no per-document state, so a single
 * instance is safely shared across concurrent editors.
 */
const lowlight = createLowlight(common)

/** Languages offered by the picker; `plaintext` leads the list. */
export const CODE_BLOCK_LANGUAGES: string[] = [
  "plaintext",
  ...lowlight
    .listLanguages()
    .filter((name) => name !== "plaintext")
    .sort(),
]

/**
 * StarterKit's code block upgraded with lowlight highlighting and the
 * Notion-style chrome (language picker + copy button) via a NodeView.
 */
export const FenrCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
})
