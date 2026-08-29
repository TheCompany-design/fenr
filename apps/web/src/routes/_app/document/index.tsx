
import { defaultEditorContent } from '@/editor/core/content'
import { EditorSurface } from '@/editor/core/document-editor'
import { createFileRoute } from '@tanstack/react-router'
import type { JSONContent } from '@tiptap/react'
import { useState } from 'react'

export const Route = createFileRoute('/_app/document/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [editorContent, _setEditorContent] = useState<JSONContent>(defaultEditorContent)
  return (
    <div>
      <EditorSurface
        content={editorContent}
      />
    </div>
  )
}
