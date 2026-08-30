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

/**
 * Orchestrates the ProseMirror <-> Browser HTML5 Drag & Drop handshake.
 *
 * 1. Creates and dispatches a NodeSelection for the target block.
 * 2. Serializes the block slice into HTML and plain text for the clipboard / dataTransfer.
 * 3. Populates ProseMirror view's internal `dragging` state so native drop handling
 *    moves the block atomically via ProseMirror's dropPoint calculation.
 * 4. Configures the drag preview ghost image.
 */
export function handleBlockDragStart(
  event: DragEvent | React.DragEvent,
  editor: Editor | null | undefined,
  nodePos: number,
): DragStartResult {
  if (!editor || editor.isDestroyed || !editor.view) {
    return { success: false, nodePos }
  }

  const { state, dispatch } = editor.view

  // Validate nodePos
  if (nodePos < 0 || nodePos >= state.doc.content.size) {
    return { success: false, nodePos }
  }

  try {
    // 1. Dispatch NodeSelection to target the whole block
    const selection = NodeSelection.create(state.doc, nodePos)
    dispatch(state.tr.setSelection(selection))

    const slice = selection.content()
    const nodeType = selection.node.type.name

    // 2. Populate native dataTransfer
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copyMove"

      // Attempt high-fidelity serialization via ProseMirror view
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
        // Fallback if serializeForClipboard encounters an error
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

      // 3. Configure drag ghost preview
      const targetDom = editor.view.nodeDOM(nodePos)
      if (
        isHTMLElement(targetDom) &&
        typeof event.dataTransfer.setDragImage === "function"
      ) {
        event.dataTransfer.setDragImage(targetDom, 20, 10)
      }
    }

    // 4. Set ProseMirror view's internal dragging contract for atomic drop transactions
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

/**
 * Cleans up ProseMirror's dragging state when native drag ends or cancels.
 */
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
