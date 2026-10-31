import { useEditor } from "@tiptap/react"
import { useMemo } from "react"
import { assembleExtensions } from "./extension-registry"
import { type DocumentEditorProps, defaultDocumentDefinition } from "./types"

export const useDocumentEditor = ({
  content,
  definition = defaultDocumentDefinition,
  editable = true,
  onChange,
}: DocumentEditorProps) => {
  const capabilities =
    definition.capabilities ?? defaultDocumentDefinition.capabilities ?? {}
  const editorConfig = definition.editor

  // Memoized so a re-render with the same definition never hands useEditor a
  // fresh extensions array identity.
  const extensions = useMemo(
    () =>
      assembleExtensions({
        capabilities,
        extraExtensions: editorConfig?.extensions,
      }),
    [capabilities, editorConfig],
  )

  return useEditor({
    extensions,
    content,
    editable: editorConfig?.editable ?? editable,
    editorProps: {
      ...editorConfig?.editorProps,
      attributes: {
        class:
          "prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full",
        ...editorConfig?.editorProps?.attributes,
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getJSON())
    },
  })
}
