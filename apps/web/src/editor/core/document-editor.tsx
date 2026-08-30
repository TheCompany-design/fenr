import type { ReactNode } from "react"
import "katex/dist/katex.min.css"
import { EditorProviderStore } from "../state/editor-store"
import type { DocumentEditorProps } from "./types"
import { useDocumentEditor } from "./use-document-editor"
import { EditorSurface } from "./editor-surface"
import { DocumentCanvas } from "./document-canvas"

export interface EditorRootProps {
  children: ReactNode
}

export const EditorRoot = ({ children }: EditorRootProps) => {
  return <EditorProviderStore>{children}</EditorProviderStore>
}

export function DocumentEditor({
  content, onChange
}: DocumentEditorProps) {
  const editor = useDocumentEditor({
    content,
    onChange,
  })

  if (!editor) return null

  return (
    <DocumentCanvas>
      <EditorSurface editor={editor} />
    </DocumentCanvas>
  )
}
