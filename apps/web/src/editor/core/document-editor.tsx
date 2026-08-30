import { cn } from "@workspace/ui/lib/utils"
import { useRef } from "react"
import { BubbleMenu } from "../bubble-menu"
import { DragHandle, useDragHandleSync } from "../drag-handle"
import { EditorSyncBridge } from "../state/sync-bridge"
import { DocumentCanvas } from "./document-canvas"
import { EditorSurface } from "./editor-surface"
import { type DocumentEditorProps, defaultDocumentDefinition } from "./types"
import { useDocumentEditor } from "./use-document-editor"

export function DocumentEditor({
  content,
  definition = defaultDocumentDefinition,
  editable = true,
  onChange,
  className,
}: DocumentEditorProps) {
  const editor = useDocumentEditor({
    content,
    definition,
    editable,
    onChange,
  })

  const canvasRef = useRef<HTMLElement | null>(null)
  useDragHandleSync(editor, canvasRef)

  if (!editor) return null

  const capabilities =
    definition.capabilities ?? defaultDocumentDefinition.capabilities ?? {}
  const showDragHandle =
    capabilities.dragHandle !== false &&
    (definition.editor?.editable ?? editable)

  return (
    <div className={cn("relative w-full", className)}>
      <EditorSyncBridge editor={editor} />
      <BubbleMenu editor={editor} />
      <DocumentCanvas
        ref={canvasRef}
        width={definition.canvas?.width}
        minHeight={definition.canvas?.minHeight}
        padding={definition.canvas?.padding}
      >
        {showDragHandle ? <DragHandle editor={editor} /> : null}
        <EditorSurface editor={editor} />
      </DocumentCanvas>
    </div>
  )
}
