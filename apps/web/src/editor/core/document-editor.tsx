import type { HTMLAttributes } from "react"
import { Tiptap } from "@tiptap/react"
import { useDocumentEditor } from "./use-document-editor"
import type { DocumentEditorProps } from "./types"

type EditorSurfaceProps = DocumentEditorProps & Omit<HTMLAttributes<HTMLDivElement>, "content">

export const EditorSurface = ({ content, className, children, onChange }: EditorSurfaceProps) => {
  const editor = useDocumentEditor({ content, onChange })

  if ( !editor ) return null
  return (
    <div className={className}>
      <Tiptap editor={editor}>
        <Tiptap.Content />
        {children}
      </Tiptap>
    </div>
  )
}
