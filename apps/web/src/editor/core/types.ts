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

export interface EditorCapabilities {
  mathematics?: boolean
  tables?: boolean
  images?: boolean
  embeds?: boolean
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
  },
})

export interface DocumentCanvasProps extends HTMLAttributes<HTMLElement> {
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
