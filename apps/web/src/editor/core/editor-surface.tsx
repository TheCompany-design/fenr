import { type Editor, Tiptap } from "@tiptap/react"
import type { HTMLAttributes } from "react"

export interface EditorSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  editor: Editor
}

export const EditorSurface = ({
  editor,
  className,
  ...props
}: EditorSurfaceProps) => {
  return (
    <div className={className} {...props}>
      <Tiptap editor={editor}>
        <Tiptap.Content />
      </Tiptap>
    </div>
  )
}
