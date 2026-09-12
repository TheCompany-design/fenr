import { describe, expect, it } from "bun:test"
import { createStore } from "jotai"
import {
  areDragHandleStatesEqual,
  DEFAULT_DRAG_HANDLE_STATE,
  type DragHandleState,
  dragHandleAtom,
  dragHandlePosAtom,
  dragHandleTopAtom,
  dragHandleTypeAtom,
  isDragHandleLockedAtom,
  isDragHandleVisibleAtom,
} from "../state/atoms/drag-handle"
import { setupDragHandleSync } from "./drag-handle-plugin"

describe("DragHandleState Atoms", () => {
  it("initializes with default state", () => {
    const store = createStore()
    const state = store.get(dragHandleAtom)
    expect(state).toEqual(DEFAULT_DRAG_HANDLE_STATE)
    expect(state.visible).toBe(false)
    expect(state.isLocked).toBe(false)
    expect(state.nodePos).toBe(-1)
    expect(state.nodeType).toBe("")
    expect(state.top).toBe(0)
  })

  it("evaluates selectors correctly", () => {
    const store = createStore()

    // 1. When visible is true, isDragHandleVisibleAtom is true
    store.set(dragHandleAtom, {
      visible: true,
      top: 42,
      nodePos: 10,
      nodeType: "heading",
      isLocked: false,
    })
    expect(store.get(isDragHandleVisibleAtom)).toBe(true)
    expect(store.get(dragHandleTopAtom)).toBe(42)
    expect(store.get(dragHandlePosAtom)).toBe(10)
    expect(store.get(dragHandleTypeAtom)).toBe("heading")
    expect(store.get(isDragHandleLockedAtom)).toBe(false)

    // 2. When visible is false but isLocked is true, isDragHandleVisibleAtom remains true
    store.set(dragHandleAtom, {
      visible: false,
      top: 42,
      nodePos: 10,
      nodeType: "heading",
      isLocked: true,
    })
    expect(store.get(isDragHandleVisibleAtom)).toBe(true)
    expect(store.get(isDragHandleLockedAtom)).toBe(true)

    // 3. When both are false, isDragHandleVisibleAtom is false
    store.set(dragHandleAtom, {
      visible: false,
      top: 0,
      nodePos: -1,
      nodeType: "",
      isLocked: false,
    })
    expect(store.get(isDragHandleVisibleAtom)).toBe(false)
  })

  it("areDragHandleStatesEqual handles equality accurately", () => {
    const stateA: DragHandleState = {
      visible: true,
      top: 50,
      nodePos: 12,
      nodeType: "paragraph",
      isLocked: false,
    }
    const stateB: DragHandleState = { ...stateA }
    expect(areDragHandleStatesEqual(stateA, stateB)).toBe(true)

    expect(
      areDragHandleStatesEqual(stateA, { ...stateA, visible: false }),
    ).toBe(false)
    expect(areDragHandleStatesEqual(stateA, { ...stateA, top: 55 })).toBe(false)
    expect(areDragHandleStatesEqual(stateA, { ...stateA, nodePos: 14 })).toBe(
      false,
    )
    expect(
      areDragHandleStatesEqual(stateA, { ...stateA, nodeType: "heading" }),
    ).toBe(false)
    expect(
      areDragHandleStatesEqual(stateA, { ...stateA, isLocked: true }),
    ).toBe(false)
  })
})

describe("setupDragHandleSync", () => {
  it("returns no-op function when editor is null or destroyed", () => {
    const store = createStore()
    const cleanupNull = setupDragHandleSync({ editor: null, store })
    expect(typeof cleanupNull).toBe("function")
    cleanupNull()

    const mockDestroyed = {
      isDestroyed: true,
    } as unknown as import("@tiptap/react").Editor

    const cleanupDestroyed = setupDragHandleSync({
      editor: mockDestroyed,
      store,
    })
    expect(typeof cleanupDestroyed).toBe("function")
    cleanupDestroyed()
  })
})
