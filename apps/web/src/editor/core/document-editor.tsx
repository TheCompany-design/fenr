import { Tiptap } from "@tiptap/react"
import type { HTMLAttributes, ReactNode } from "react"
import "katex/dist/katex.min.css"
import { BubbleMenu } from "../bubble-menu"
import { EditorProviderStore } from "../state/editor-store"
import { EditorSyncBridge } from "../state/sync-bridge"
import type { DocumentEditorProps } from "./types"
import { useDocumentEditor } from "./use-document-editor"

export interface EditorRootProps {
  children: ReactNode
}

export const EditorRoot = ({ children }: EditorRootProps) => {
  return <EditorProviderStore>{children}</EditorProviderStore>
}

type EditorSurfaceProps = DocumentEditorProps &
  Omit<HTMLAttributes<HTMLDivElement>, "content">

export const EditorSurface = ({
  content,
  className,
  children,
  onChange,
}: EditorSurfaceProps) => {
  const editor = useDocumentEditor({ content, onChange })

  if (!editor) return null
  return (
    <EditorRoot>
      <div className={className}>
        <Tiptap editor={editor}>
          <EditorSyncBridge />
          <Tiptap.Content />
          <BubbleMenu />
          {children}
        </Tiptap>
      </div>
    </EditorRoot>
  )
}
