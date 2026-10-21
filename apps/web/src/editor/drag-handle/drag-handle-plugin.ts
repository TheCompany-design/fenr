import type { Editor } from "@tiptap/react"
import { useEffect } from "react"
import {
  areDragHandleStatesEqual,
  type DragHandleState,
  dragHandleAtom,
} from "../state/atoms/drag-handle"
import { useEditorStore } from "../state/editor-store"
import { resolveDragTarget } from "./target-resolver"

export interface DragHandleSyncOptions {
  editor: Editor | null
  store: {
    get: <T>(atom: import("jotai").Atom<T>) => T
    set: <T, A extends unknown[], R>(
      atom: import("jotai").WritableAtom<T, A, R>,
      ...args: A
    ) => R
  }
  container?: HTMLElement | null

  verticalOffset?: number
}

export function setupDragHandleSync({
  editor,
  store,
  container,
  verticalOffset = 2,
}: DragHandleSyncOptions): () => void {
  if (!editor || editor.isDestroyed || typeof window === "undefined") {
    return () => {}
  }

  const canvas =
    container ??
    (editor.view?.dom?.closest(
      "[data-document-canvas]",
    ) as HTMLElement | null) ??
    editor.view?.dom?.parentElement ??
    null

  if (!canvas) {
    return () => {}
  }

  let rafId: number | null = null
  let lastClientX = 0
  let lastClientY = 0

  const updateTarget = (clientX: number, clientY: number) => {
    if (editor.isDestroyed || !editor.view) return

    const currentState = store.get(dragHandleAtom)

    if (currentState.isLocked) return

    if (!editor.isEditable) {
      if (currentState.visible) {
        store.set(dragHandleAtom, {
          ...currentState,
          visible: false,
        })
      }
      return
    }

    const canvasRect = canvas.getBoundingClientRect()

    if (
      clientX < canvasRect.left ||
      clientX > canvasRect.right ||
      clientY < canvasRect.top ||
      clientY > canvasRect.bottom
    ) {
      if (currentState.visible) {
        store.set(dragHandleAtom, {
          ...currentState,
          visible: false,
        })
      }
      return
    }

    if (currentState.visible && currentState.nodePos >= 0) {
      const activeDom = editor.view.nodeDOM(currentState.nodePos)
      let elementToMeasure: HTMLElement | null = null

      if (activeDom instanceof HTMLElement) {
        elementToMeasure = activeDom
      } else {
        const domAt = editor.view.domAtPos(currentState.nodePos + 1)
        if (domAt.node instanceof HTMLElement) {
          elementToMeasure = domAt.node
        } else if (domAt.node.parentElement) {
          elementToMeasure = domAt.node.parentElement
        }
      }

      if (elementToMeasure) {
        const blockRect = elementToMeasure.getBoundingClientRect()
        const verticalTolerance = 10
        if (
          clientY >= blockRect.top - verticalTolerance &&
          clientY <= blockRect.bottom + verticalTolerance
        ) {
          return
        }
      }
    }

    const target = resolveDragTarget(editor.view, clientX, clientY)
    if (!target) {
      if (currentState.visible) {
        store.set(dragHandleAtom, {
          ...currentState,
          visible: false,
        })
      }
      return
    }

    const relativeTop =
      target.rect.top - canvasRect.top + canvas.scrollTop + verticalOffset

    const nextState: DragHandleState = {
      visible: true,
      top: Math.round(relativeTop),
      nodePos: target.pos,
      nodeType: target.node.type.name,
      isLocked: false,
    }

    if (!areDragHandleStatesEqual(currentState, nextState)) {
      store.set(dragHandleAtom, nextState)
    }
  }

  const handlePointerMove = (e: MouseEvent | PointerEvent) => {
    if ("pointerType" in e && e.pointerType === "touch") {
      return
    }

    const targetElement = e.target as HTMLElement | null
    if (
      targetElement &&
      typeof targetElement.closest === "function" &&
      (targetElement.closest("[data-drag-handle]") ||
        targetElement.closest("[data-drag-delete]"))
    ) {
      return
    }

    lastClientX = e.clientX
    lastClientY = e.clientY

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      rafId = null
      updateTarget(lastClientX, lastClientY)
    })
  }

  const handleMouseLeave = (e: MouseEvent) => {
    if (e.relatedTarget && canvas.contains(e.relatedTarget as Node)) {
      return
    }

    const current = store.get(dragHandleAtom)
    if (!current.isLocked && current.visible) {
      store.set(dragHandleAtom, {
        ...current,
        visible: false,
      })
    }
  }

  const handleDocChange = () => {
    const current = store.get(dragHandleAtom)
    if (!current.visible || current.isLocked) return

    if (!editor.view || editor.isDestroyed) return

    if (
      current.nodePos < 0 ||
      current.nodePos >= editor.state.doc.content.size
    ) {
      store.set(dragHandleAtom, { ...current, visible: false })
      return
    }

    const targetDom = editor.view.nodeDOM(current.nodePos)
    if (targetDom instanceof HTMLElement) {
      const canvasRect = canvas.getBoundingClientRect()
      const targetRect = targetDom.getBoundingClientRect()
      const newTop = Math.round(
        targetRect.top - canvasRect.top + canvas.scrollTop + verticalOffset,
      )
      if (newTop !== current.top) {
        store.set(dragHandleAtom, { ...current, top: newTop })
      }
    }
  }

  canvas.addEventListener("pointermove", handlePointerMove, { passive: true })
  canvas.addEventListener("mouseleave", handleMouseLeave, { passive: true })
  editor.on("transaction", handleDocChange)

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    canvas.removeEventListener("pointermove", handlePointerMove)
    canvas.removeEventListener("mouseleave", handleMouseLeave)
    editor.off("transaction", handleDocChange)
  }
}

export function useDragHandleSync(
  editor: Editor | null,
  containerRef?: React.RefObject<HTMLElement | null>,
) {
  const store = useEditorStore()

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const cleanup = setupDragHandleSync({
      editor,
      store,
      container: containerRef?.current,
    })
    return cleanup
  }, [editor, store, containerRef])
}
