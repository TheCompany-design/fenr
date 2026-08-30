import { Editor, Tiptap } from "@tiptap/react"
import type { HTMLAttributes, ReactNode } from "react"
import "katex/dist/katex.min.css"
import { EditorSyncBridge } from "../state/sync-bridge"
import { EditorProviderStore } from "../state/editor-store"

export interface EditorRootProps {
  children: ReactNode
}

export const EditorRoot = ({ children }: EditorRootProps) => {
  return <EditorProviderStore>{children}</EditorProviderStore>
}

type EditorSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  editor: Editor
}

export const EditorSurface = ({
  editor,
  className,
}: EditorSurfaceProps) => {
  return (
    <div className={className}>
      <Tiptap editor={editor}>
        <EditorSyncBridge />
        <Tiptap.Content />
      </Tiptap>
    </div>
  )
}
