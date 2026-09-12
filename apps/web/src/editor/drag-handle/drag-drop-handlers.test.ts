import { describe, expect, it } from "bun:test"
import { Schema } from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import {
  FENR_BLOCK_MIME_TYPE,
  handleBlockDragEnd,
  handleBlockDragStart,
} from "./drag-drop-handlers"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    text: { inline: true },
  },
})

const createRealDoc = () =>
  schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("Hello world")]),
  ])

describe("handleBlockDragStart and handleBlockDragEnd", () => {
  it("returns failure when editor is null or destroyed", () => {
    const fakeEvent = {
      dataTransfer: {
        setData: () => {},
        effectAllowed: "",
      },
    } as unknown as DragEvent

    expect(handleBlockDragStart(fakeEvent, null, 0).success).toBe(false)

    const destroyedEditor = {
      isDestroyed: true,
      view: {},
    } as unknown as Editor
    expect(handleBlockDragStart(fakeEvent, destroyedEditor, 0).success).toBe(
      false,
    )
  })

  it("returns failure when nodePos is out of bounds", () => {
    const fakeEvent = {
      dataTransfer: {
        setData: () => {},
        effectAllowed: "",
      },
    } as unknown as DragEvent

    const editor = {
      isDestroyed: false,
      view: {
        state: {
          doc: createRealDoc(),
        },
      },
    } as unknown as Editor

    expect(handleBlockDragStart(fakeEvent, editor, -1).success).toBe(false)
    expect(handleBlockDragStart(fakeEvent, editor, 50).success).toBe(false)
  })

  it("dispatches NodeSelection, sets dataTransfer data and view.dragging", () => {
    const mockDataStore = new Map<string, string>()

    const fakeEvent = {
      dataTransfer: {
        setData: (type: string, val: string) => mockDataStore.set(type, val),
        setDragImage: () => {},
        effectAllowed: "",
      },
    } as unknown as DragEvent

    const doc = createRealDoc()
    let currentSelection: unknown = null
    const mockTargetDom = {
      nodeType: 1,
      getBoundingClientRect: () => ({ top: 0, bottom: 20 }),
    } as unknown as HTMLElement

    const mockView = {
      state: {
        doc,
        get selection() {
          return currentSelection ?? { content: () => ({}) }
        },
        tr: {
          setSelection: (sel: unknown) => {
            currentSelection = sel
            return mockView.state.tr
          },
        },
      },
      dispatch: (_tr: unknown) => {},
      nodeDOM: () => mockTargetDom,
      serializeForClipboard: () => ({
        dom: { innerHTML: "<p>Hello world</p>" },
        text: "Hello world",
      }),
      dragging: null,
    }

    const editor = {
      isDestroyed: false,
      view: mockView,
    } as unknown as Editor

    const result = handleBlockDragStart(fakeEvent, editor, 0)
    expect(result.success).toBe(true)
    expect(result.nodePos).toBe(0)
    expect(result.nodeType).toBe("paragraph")
    expect(currentSelection).not.toBeNull()
    expect(currentSelection instanceof NodeSelection).toBe(true)

    // Verify dataTransfer
    expect(mockDataStore.get("text/html")).toBe("<p>Hello world</p>")
    expect(mockDataStore.get("text/plain")).toBe("Hello world")
    expect(mockDataStore.has(FENR_BLOCK_MIME_TYPE)).toBe(true)

    // Verify view.dragging
    expect(mockView.dragging).not.toBeNull()
    expect(
      (mockView.dragging as unknown as { move: boolean; slice: unknown }).move,
    ).toBe(true)

    // Test drag end resets view.dragging
    handleBlockDragEnd(fakeEvent, editor)
    expect(mockView.dragging).toBeNull()
  })
})
