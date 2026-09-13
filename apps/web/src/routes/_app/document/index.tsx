import { createFileRoute } from "@tanstack/react-router"
import type { JSONContent } from "@tiptap/react"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { defaultEditorContent } from "@/editor/core/content"
import { DocumentEditor } from "@/editor/core/document-editor"
import { EditorRoot } from "@/editor/root"
import { selectionAtom } from "@/editor/state/atoms"

export const Route = createFileRoute("/_app/document/")({
  component: RouteComponent,
})

const SelectionLiveBadge = () => {
  const selection = useAtomValue(selectionAtom)
  return (
    <div className="mb-4 rounded border bg-card p-2 text-xs font-mono">
      <span>From: {selection.from}</span> | <span>To: {selection.to}</span> |{" "}
      <span>Highlighted: {selection.empty ? "No" : "Yes"}</span>
    </div>
  )
}

function RouteComponent() {
  const [editorContent, setEditorContent] =
    useState<JSONContent>(defaultEditorContent)
  return (
    <div className="min-h-screen bg-muted/20 p-8">
      <EditorRoot>
        <SelectionLiveBadge />
        <DocumentEditor content={editorContent} onChange={setEditorContent} />
      </EditorRoot>
    </div>
  )
}
