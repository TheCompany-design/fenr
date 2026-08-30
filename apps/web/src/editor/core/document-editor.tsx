import { cn } from "@workspace/ui/lib/utils"
import { BubbleMenu } from "../bubble-menu"
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

  if (!editor) return null

  return (
    <div className={cn("relative w-full", className)}>
      <EditorSyncBridge editor={editor} />
      <BubbleMenu editor={editor} />
      <DocumentCanvas
        width={definition.canvas?.width}
        minHeight={definition.canvas?.minHeight}
        padding={definition.canvas?.padding}
      >
        <EditorSurface editor={editor} />
      </DocumentCanvas>
    </div>
  )
}
