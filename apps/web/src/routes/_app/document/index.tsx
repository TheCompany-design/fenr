import { createFileRoute } from "@tanstack/react-router"
import type { JSONContent } from "@tiptap/react"
import { useState } from "react"
import { DocumentStatusBar } from "@/editor/chrome/status-bar"
import { DocumentEditor } from "@/editor/core/document-editor"
import { defaultEditorContent } from "@/editor/core/content"
import { EditorRoot } from "@/editor/root"

export const Route = createFileRoute("/_app/document/")({
  component: RouteComponent,
})

function RouteComponent() {
  const [editorContent, setEditorContent] =
    useState<JSONContent>(defaultEditorContent)
  const [title, setTitle] = useState("")

  return (
    <div className="min-h-screen bg-muted/20 p-8">
      <EditorRoot>
        <div className="mx-auto max-w-[816px]">
          <DocumentEditor
            content={editorContent}
            onChange={setEditorContent}
            header={
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Untitled"
                aria-label="Document title"
                className="mb-4 w-full bg-transparent text-4xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            }
          />
          <DocumentStatusBar className="mt-3" />
        </div>
      </EditorRoot>
    </div>
  )
}
