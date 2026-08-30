import { Mathematics } from "@tiptap/extension-mathematics"
import TextAlign from "@tiptap/extension-text-align"
import { type AnyExtension, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
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

  const extensions: AnyExtension[] = [
    StarterKit,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
  ]

  if (capabilities.mathematics !== false) {
    extensions.push(Mathematics)
  }

  if (editorConfig?.extensions) {
    extensions.push(...editorConfig.extensions)
  }

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
