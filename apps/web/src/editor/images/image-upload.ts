import { Plugin } from "@tiptap/pm/state"
import { Extension } from "@tiptap/react"
import { toast } from "sonner"

/**
 * Contract resolving a picked/dropped/pasted image file to a URL that can
 * be persisted in the document. Definitions wire this to their storage
 * backend; without one, images fall back to session object URLs.
 */
export type ImageUploadHandler = (file: File) => Promise<string>

/** Resolve an image file to a URL via the contract or a local object URL. */
export async function resolveImageUrl(
  file: File,
  upload?: ImageUploadHandler,
): Promise<string> {
  if (upload) {
    return upload(file)
  }
  return URL.createObjectURL(file)
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

/**
 * Upload (or localize) an image and insert it at `pos` — or at the current
 * selection when null. Failures surface through Sonner and leave the
 * document untouched.
 */
export async function uploadAndInsertImage(
  editor: import("@tiptap/react").Editor,
  pos: number | null,
  file: File,
  upload?: ImageUploadHandler,
): Promise<string | null> {
  const toastId = toast.loading("Uploading image…")
  try {
    const url = await resolveImageUrl(file, upload)
    const at = pos ?? editor.state.selection.from
    editor
      .chain()
      .focus()
      .insertContentAt(at, {
        type: "image",
        attrs: { src: url, alt: file.name },
      })
      .run()
    toast.success("Image added", { id: toastId })
    return url
  } catch {
    toast.error("Image upload failed", { id: toastId })
    return null
  }
}

function imageFilesFrom(dataTransfer: DataTransfer | null): File[] {
  return Array.from(dataTransfer?.files ?? []).filter(isImageFile)
}

/**
 * Handles image files arriving via paste or drag-and-drop: uploads each
 * through the contract and inserts the result, claiming the event so
 * ProseMirror does not treat the file as text.
 */
export function createImageUploadExtension(
  upload?: ImageUploadHandler,
): Extension {
  return Extension.create({
    name: "imageUpload",

    addProseMirrorPlugins() {
      const editor = this.editor

      const handleFiles = (
        view: import("@tiptap/pm/view").EditorView,
        dataTransfer: DataTransfer | null,
        dropped: boolean,
        event: ClipboardEvent | DragEvent,
      ): boolean => {
        const files = imageFilesFrom(dataTransfer)
        if (files.length === 0) return false

        event.preventDefault()
        let pos: number | null = null
        if (dropped && "clientX" in event) {
          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          pos = coords?.pos ?? null
        }
        for (const file of files) {
          void uploadAndInsertImage(editor, pos, file, upload)
        }
        return true
      }

      return [
        new Plugin({
          props: {
            handlePaste: (view, event) =>
              handleFiles(view, event.clipboardData, false, event),
            handleDrop: (view, event, _slice, moved) => {
              if (moved) return false
              return handleFiles(view, event.dataTransfer, true, event)
            },
          },
        }),
      ]
    },
  })
}
