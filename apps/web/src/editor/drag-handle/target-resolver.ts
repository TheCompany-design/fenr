import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"

export interface DragTarget {
  node: PMNode
  pos: number
  dom: HTMLElement
  rect: DOMRect
}

export interface ResolveDragTargetOptions {
  gutterMargin?: number

  clampedInset?: number
}

function isHTMLElement(node: unknown): node is HTMLElement {
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return true
  }
  return Boolean(
    node &&
      typeof node === "object" &&
      "nodeType" in node &&
      (node as { nodeType: number }).nodeType === 1,
  )
}

export function resolveDragTarget(
  view: EditorView | null | undefined,
  clientX: number,
  clientY: number,
  options: ResolveDragTargetOptions = {},
): DragTarget | null {
  if (!view || view.isDestroyed || !view.dom) {
    return null
  }

  if (view.editable === false) {
    return null
  }

  const editorRect = view.dom.getBoundingClientRect()
  const gutterMargin = options.gutterMargin ?? 80
  const clampedInset = options.clampedInset ?? 12

  if (
    clientY < editorRect.top - 10 ||
    clientY > editorRect.bottom + 10 ||
    clientX < editorRect.left - gutterMargin ||
    clientX > editorRect.right + gutterMargin
  ) {
    return null
  }

  const clampedX = editorRect.left + clampedInset

  const coords = view.posAtCoords({ left: clampedX, top: clientY })
  if (!coords || coords.pos < 0 || coords.pos > view.state.doc.content.size) {
    return null
  }

  const $pos = view.state.doc.resolve(coords.pos)
  if ($pos.depth === 0) {
    return null
  }

  let targetDepth = 1
  for (let d = $pos.depth; d > 0; d--) {
    const nodeType = $pos.node(d).type.name
    if (nodeType === "listItem" || nodeType === "taskItem") {
      targetDepth = d
      break
    }
  }

  while (targetDepth > 0 && !$pos.node(targetDepth).isBlock) {
    targetDepth--
  }

  if (targetDepth === 0) {
    return null
  }

  const targetNode = $pos.node(targetDepth)
  const targetPos = $pos.before(targetDepth)

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
