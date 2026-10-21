import { NodeSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"

export const FENR_BLOCK_MIME_TYPE = "application/x-fenr-block"

export interface DragStartResult {
  success: boolean
  nodePos: number
  nodeType?: string
}

function isHTMLElement(node: unknown): node is HTMLElement {
  if (typeof HTMLElement !== "undefined") {
    return node instanceof HTMLElement
  }
  return Boolean(
    node &&
      typeof node === "object" &&
      "nodeType" in node &&
      (node as { nodeType: number }).nodeType === 1,
  )
}

export function handleBlockDragStart(
  event: DragEvent | React.DragEvent,
  editor: Editor | null | undefined,
  nodePos: number,
): DragStartResult {
  if (!editor || editor.isDestroyed || !editor.view) {
    return { success: false, nodePos }
  }

  const { state, dispatch } = editor.view

  if (nodePos < 0 || nodePos >= state.doc.content.size) {
    return { success: false, nodePos }
  }

  try {
    const selection = NodeSelection.create(state.doc, nodePos)
    dispatch(state.tr.setSelection(selection))

    const slice = selection.content()
    const nodeType = selection.node.type.name

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copyMove"

      let html = ""
      let text = ""
      try {
        const viewWithSerialize = editor.view as unknown as {
          serializeForClipboard?: (s: typeof slice) => {
            dom: HTMLElement
            text: string
          }
        }
        if (typeof viewWithSerialize.serializeForClipboard === "function") {
          const serialized = viewWithSerialize.serializeForClipboard(slice)
          html = serialized.dom?.innerHTML ?? ""
          text = serialized.text ?? ""
        }
      } catch {
        text = selection.node.textContent
      }

      if (html) {
        event.dataTransfer.setData("text/html", html)
      }
      if (text) {
        event.dataTransfer.setData("text/plain", text)
      }
      event.dataTransfer.setData(
        FENR_BLOCK_MIME_TYPE,
        JSON.stringify({ pos: nodePos, type: nodeType }),
      )

      const targetDom = editor.view.nodeDOM(nodePos)
      if (
        isHTMLElement(targetDom) &&
        typeof event.dataTransfer.setDragImage === "function"
      ) {
        event.dataTransfer.setDragImage(targetDom, 20, 10)
      }
    }

    const viewWithDragging = editor.view as unknown as {
      dragging?: {
        slice: typeof slice
        move: boolean
      } | null
    }
    viewWithDragging.dragging = {
      slice,
      move: true,
    }

    return { success: true, nodePos, nodeType }
  } catch {
    return { success: false, nodePos }
  }
}

export function handleBlockDragEnd(
  _event: DragEvent | React.DragEvent,
  editor: Editor | null | undefined,
): void {
  if (!editor || editor.isDestroyed || !editor.view) {
    return
  }

  const viewWithDragging = editor.view as unknown as {
    dragging?: unknown
  }
  viewWithDragging.dragging = null
}
