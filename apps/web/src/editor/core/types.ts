import type { EditorProps } from "@tiptap/pm/view"
import type { Extension, JSONContent } from "@tiptap/react"

export type EditorConfig = {
  extensions: Extension[],
  editorProps?: EditorProps,
  editable?: boolean,
}

export type DocumentEditorProps = {
  content: JSONContent
  editable?: boolean
  onChange?: (content: JSONContent) => void
}
