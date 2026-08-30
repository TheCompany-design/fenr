import { atom } from "jotai"

export interface DragHandleState {
  visible: boolean
  top: number
  nodePos: number
  nodeType: string
  isLocked: boolean
}

export const DEFAULT_DRAG_HANDLE_STATE: DragHandleState = {
  visible: false,
  top: 0,
  nodePos: -1,
  nodeType: "",
  isLocked: false,
}

// 1. Primitive atom for drag handle state
export const dragHandleAtom = atom<DragHandleState>(DEFAULT_DRAG_HANDLE_STATE)

// 2. Fine-grained selectors (Vercel best practice: rerender-derived-state)
export const isDragHandleVisibleAtom = atom((get) => {
  const state = get(dragHandleAtom)
  return state.visible || state.isLocked
})
export const dragHandleTopAtom = atom((get) => get(dragHandleAtom).top)
export const dragHandlePosAtom = atom((get) => get(dragHandleAtom).nodePos)
export const dragHandleTypeAtom = atom((get) => get(dragHandleAtom).nodeType)
export const isDragHandleLockedAtom = atom(
  (get) => get(dragHandleAtom).isLocked,
)

/**
 * Shallow equality comparison helper to gate Jotai atom updates
 * and prevent redundant React re-renders.
 */
export function areDragHandleStatesEqual(
  a: DragHandleState,
  b: DragHandleState,
): boolean {
  return (
    a.visible === b.visible &&
    a.top === b.top &&
    a.nodePos === b.nodePos &&
    a.nodeType === b.nodeType &&
    a.isLocked === b.isLocked
  )
}
