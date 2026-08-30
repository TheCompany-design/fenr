import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"

export interface DragTarget {
  node: PMNode
  pos: number
  dom: HTMLElement
  rect: DOMRect
}

export interface ResolveDragTargetOptions {
  /**
   * Distance in px into the left margin/gutter where drag handle hover should still detect blocks.
   * Defaults to 80px (covering Fenr's 72px canvas margin).
   */
  gutterMargin?: number
  /**
   * Inset in px from the editor's left/right boundary when clamping coordinates.
   * Defaults to 12px.
   */
  clampedInset?: number
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
 * Resolves the block-level node and DOM element at the given viewport coordinates.
 *
 * Implements horizontal clamping to eliminate the "gutter dead-zone" when hovering
 * in the document margin to the left of the editor content.
 */
export function resolveDragTarget(
  view: EditorView | null | undefined,
  clientX: number,
  clientY: number,
  options: ResolveDragTargetOptions = {},
): DragTarget | null {
  if (!view || view.isDestroyed || !view.dom) {
    return null
  }

  // Disable drag handle target resolution when editor is not editable
  if (view.editable === false) {
    return null
  }

  const editorRect = view.dom.getBoundingClientRect()
  const gutterMargin = options.gutterMargin ?? 80
  const clampedInset = options.clampedInset ?? 12

  // Return early if pointer is far outside vertical or horizontal boundaries
  if (
    clientY < editorRect.top - 10 ||
    clientY > editorRect.bottom + 10 ||
    clientX < editorRect.left - gutterMargin ||
    clientX > editorRect.right + gutterMargin
  ) {
    return null
  }

  // Every block in left-to-right text begins at the left edge of the editor content area.
  // Sampling posAtCoords at editorRect.left + clampedInset guarantees that we reliably hit
  // the block on this vertical line, regardless of line length or whether clientX is in the
  // left gutter, the middle of the document, or approaching the delete button in the right gutter.
  const clampedX = editorRect.left + clampedInset

  const coords = view.posAtCoords({ left: clampedX, top: clientY })
  if (!coords || coords.pos < 0 || coords.pos > view.state.doc.content.size) {
    return null
  }

  const $pos = view.state.doc.resolve(coords.pos)
  if ($pos.depth === 0) {
    return null
  }

  // Find the target block depth. If nested inside a list item or task item,
  // target that item rather than the entire list or inner inline container.
  let targetDepth = 1
  for (let d = $pos.depth; d > 0; d--) {
    const nodeType = $pos.node(d).type.name
    if (nodeType === "listItem" || nodeType === "taskItem") {
      targetDepth = d
      break
    }
  }

  // Ensure the target node is a block node
  while (targetDepth > 0 && !$pos.node(targetDepth).isBlock) {
    targetDepth--
  }

  if (targetDepth === 0) {
    return null
  }

  const targetNode = $pos.node(targetDepth)
  const targetPos = $pos.before(targetDepth)

  // Resolve corresponding DOM element
  let dom: HTMLElement | null = null
  const candidate = view.nodeDOM(targetPos)
  if (isHTMLElement(candidate)) {
    dom = candidate
  } else {
    const domAt = view.domAtPos(targetPos + 1)
    if (isHTMLElement(domAt.node)) {
      dom = domAt.node
    } else if (domAt.node.parentElement) {
      const closestBlock = domAt.node.parentElement.closest(
        "p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, [data-node-view-wrapper]",
      )
      dom = isHTMLElement(closestBlock)
        ? closestBlock
        : domAt.node.parentElement
    }
  }

  if (!isHTMLElement(dom)) {
    return null
  }

  return {
    node: targetNode,
    pos: targetPos,
    dom,
    rect: dom.getBoundingClientRect(),
  }
}
