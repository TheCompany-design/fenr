import type { JSONContent } from "@tiptap/react"

export type DocumentEditorProps = {
  content: JSONContent
  editable?: boolean
  onChange?: (content: JSONContent) => void
}
