import type { EditorProps } from "@tiptap/pm/view"
import type { AnyExtension, JSONContent } from "@tiptap/react"
import type { HTMLAttributes } from "react"

export type DocumentType = "proposal" | "invoice" | "quote" | "document"

export interface CanvasConfig {
  width?: number
  minHeight?: number
  padding?: {
    x: number
    y: number
  }
}

/**
 * Declarative feature switches for an editor instance. Every capability is
 * opt-out: an absent (or undefined) flag means enabled. Pass `false` to
 * remove a feature's extensions, chrome, and slash-menu entries entirely.
 */
export interface EditorCapabilities {
  /** LaTeX math via KaTeX (inline `$...$` and `$$...$$` blocks) */
  mathematics?: boolean
  /** Grid tables with resizable columns and a floating table toolbar */
  tables?: boolean
  /** Raster images with upload, drop, and paste flows */
  images?: boolean
  /** Third-party rich embeds (YouTube) */
  embeds?: boolean
  /** Left-gutter drag handle with block actions */
  dragHandle?: boolean
  /** Interactive checkbox task lists */
  taskLists?: boolean
  /** Multicolor text highlights */
  highlights?: boolean
  /** Foreground text colors */
  textColors?: boolean
  /** Syntax-highlighted code blocks with a language picker */
  codeBlocks?: boolean
  /** Ghost prompts on the active empty block ("Type '/' for commands") */
  placeholder?: boolean
  /** The `/` slash command palette */
  slashMenu?: boolean
  /** Tinted emoji callout blocks */
  callouts?: boolean
  /** Collapsible toggle blocks (details/summary) */
  toggles?: boolean
}

export interface EditorConfig {
  extensions?: AnyExtension[]
  editorProps?: EditorProps
  editable?: boolean
}

export interface DocumentDefinition {
  type: DocumentType
  canvas?: CanvasConfig
  editor?: EditorConfig
  capabilities?: EditorCapabilities
}

export function defineDocument(
  definition: DocumentDefinition,
): DocumentDefinition {
  return definition
}

export const defaultDocumentDefinition = defineDocument({
  type: "document",
  canvas: {
    width: 816,
    minHeight: 1056,
    padding: {
      x: 72,
      y: 72,
    },
  },
  capabilities: {
    mathematics: true,
    tables: true,
    images: true,
    embeds: true,
    dragHandle: true,
    taskLists: true,
    highlights: true,
    textColors: true,
    codeBlocks: true,
    placeholder: true,
    slashMenu: true,
    callouts: true,
    toggles: true,
  },
})

export interface DocumentCanvasProps extends HTMLAttributes<HTMLElement> {
  ref?: React.Ref<HTMLElement | null>
  width?: number
  minHeight?: number
  padding?: {
    x: number
    y: number
  }
}

export interface DocumentEditorProps {
  content: JSONContent
  definition?: DocumentDefinition
  editable?: boolean
  onChange?: (content: JSONContent) => void
  className?: string
}
