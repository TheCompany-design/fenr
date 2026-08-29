import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import type { DocumentEditorProps } from "./types"

export const useDocumentEditor = ({ content, editable = true, onChange }: DocumentEditorProps) => {
  return useEditor({
    extensions: [StarterKit],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full",
      }
    },
    onUpdate({ editor }) {
      onChange?.(editor.getJSON())
    }
  })
}
