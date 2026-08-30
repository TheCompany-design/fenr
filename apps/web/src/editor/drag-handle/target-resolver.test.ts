import { describe, expect, it } from "bun:test"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"
import { resolveDragTarget } from "./target-resolver"

interface MockNodeOptions {
  name: string
  isBlock?: boolean
}

const createMockNode = ({ name, isBlock = true }: MockNodeOptions): PMNode => {
  return {
    type: { name },
    isBlock,
    nodeSize: 10,
  } as unknown as PMNode
}

const createMockEditorView = (options: {
  destroyed?: boolean
  editable?: boolean
  editorRect?: { left: number; right: number; top: number; bottom: number }
  posAtCoordsResult?: { pos: number; inside: number } | null
  nodesByDepth?: PMNode[]
  domElement?: HTMLElement | null
}) => {
  const editorRect = options.editorRect ?? {
    left: 100,
    right: 800,
    top: 50,
    bottom: 600,
  }

  const dom = {
    nodeType: 1,
    getBoundingClientRect: () => editorRect,
  } as unknown as HTMLElement

  const targetDom =
    options.domElement ??
    ({
      nodeType: 1,
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 130,
        left: 100,
        right: 800,
        width: 700,
        height: 30,
      }),
    } as unknown as HTMLElement)

  let clampedCoordCaptured: { left: number; top: number } | null = null

  const nodes = options.nodesByDepth ?? [
    createMockNode({ name: "doc", isBlock: false }),
    createMockNode({ name: "paragraph", isBlock: true }),
  ]

  const view = {
    isDestroyed: options.destroyed ?? false,
    editable: options.editable ?? true,
    dom,
    posAtCoords: (coords: { left: number; top: number }) => {
      clampedCoordCaptured = coords
      return options.posAtCoordsResult !== undefined
        ? options.posAtCoordsResult
        : { pos: 5, inside: 5 }
    },
    state: {
      doc: {
        content: { size: 100 },
        resolve: (pos: number) => ({
          pos,
          depth: nodes.length - 1,
          node: (depth: number) => nodes[depth],
          before: (depth: number) => (depth === 1 ? 0 : 2),
        }),
      },
    },
    nodeDOM: (_pos: number) => targetDom,
    domAtPos: (_pos: number) => ({ node: targetDom, offset: 0 }),
    getClampedCoords: () => clampedCoordCaptured,
  } as unknown as EditorView & {
    getClampedCoords: () => { left: number; top: number } | null
  }

  return view
}

describe("resolveDragTarget", () => {
  it("returns null when view is null or destroyed", () => {
    expect(resolveDragTarget(null, 100, 100)).toBeNull()
    const destroyedView = createMockEditorView({ destroyed: true })
    expect(resolveDragTarget(destroyedView, 100, 100)).toBeNull()
  })

  it("returns null when view is not editable (read-only)", () => {
    const readOnlyView = createMockEditorView({ editable: false })
    expect(resolveDragTarget(readOnlyView, 100, 100)).toBeNull()
  })

  it("returns null when pointer is far out of bounds vertically or horizontally", () => {
    const view = createMockEditorView({
      editorRect: { left: 100, right: 800, top: 100, bottom: 500 },
    })

    // Pointer way above editor
    expect(resolveDragTarget(view, 200, 50)).toBeNull()
    // Pointer way below editor
    expect(resolveDragTarget(view, 200, 550)).toBeNull()
    // Pointer way to the left outside gutter margin
    expect(resolveDragTarget(view, 0, 200, { gutterMargin: 50 })).toBeNull()
    // Pointer way to the right outside gutter margin
    expect(resolveDragTarget(view, 920, 200, { gutterMargin: 80 })).toBeNull()
  })

  it("clamps X coordinate when pointer is hovering inside the left or right gutter margin", () => {
    const view = createMockEditorView({
      editorRect: { left: 100, right: 800, top: 100, bottom: 500 },
    })

    // Mouse is at X=40 (60px to the left of editor, inside the 80px gutter)
    const targetLeft = resolveDragTarget(view, 40, 200, {
      gutterMargin: 80,
      clampedInset: 16,
    })
    expect(targetLeft).not.toBeNull()
    const clampedLeft = (
      view as unknown as {
        getClampedCoords: () => { left: number; top: number } | null
      }
    ).getClampedCoords()
    expect(clampedLeft?.left).toBe(116)

    // Mouse is at X=850 (50px to the right of editor, inside the 80px gutter)
    const targetRight = resolveDragTarget(view, 850, 200, {
      gutterMargin: 80,
      clampedInset: 16,
    })
    expect(targetRight).not.toBeNull()
    const clampedRight = (
      view as unknown as {
        getClampedCoords: () => { left: number; top: number } | null
      }
    ).getClampedCoords()
    expect(clampedRight?.left).toBe(116)
  })

  it("resolves top-level paragraph blocks correctly", () => {
    const pNode = createMockNode({ name: "paragraph" })
    const view = createMockEditorView({
      nodesByDepth: [createMockNode({ name: "doc", isBlock: false }), pNode],
    })

    const target = resolveDragTarget(view, 150, 120)
    expect(target).not.toBeNull()
    expect(target?.node.type.name).toBe("paragraph")
    expect(target?.pos).toBe(0)
    expect(target?.rect.height).toBe(30)
  })

  it("resolves listItem depth when nested inside bulletList or orderedList", () => {
    const docNode = createMockNode({ name: "doc", isBlock: false })
    const listNode = createMockNode({ name: "bulletList", isBlock: true })
    const listItemNode = createMockNode({ name: "listItem", isBlock: true })
    const pNode = createMockNode({ name: "paragraph", isBlock: true })

    const view = createMockEditorView({
      nodesByDepth: [docNode, listNode, listItemNode, pNode],
    })

    const target = resolveDragTarget(view, 120, 120)
    expect(target).not.toBeNull()
    expect(target?.node.type.name).toBe("listItem")
    expect(target?.pos).toBe(2)
  })

  it("returns null if posAtCoords returns null", () => {
    const view = createMockEditorView({ posAtCoordsResult: null })
    expect(resolveDragTarget(view, 120, 120)).toBeNull()
  })

  it("returns null if view.dom is missing", () => {
    const view = createMockEditorView({})
    ;(view as { dom: unknown }).dom = null
    expect(resolveDragTarget(view, 120, 120)).toBeNull()
  })

  it("falls back to domAtPos if nodeDOM returns null", () => {
    const pNode = createMockNode({ name: "paragraph" })
    const fallbackDom = {
      nodeType: 1,
      parentElement: null,
      getBoundingClientRect: () => ({
        top: 150,
        bottom: 180,
        left: 100,
        right: 800,
        width: 700,
        height: 30,
      }),
    } as unknown as HTMLElement

    const view = createMockEditorView({
      nodesByDepth: [createMockNode({ name: "doc", isBlock: false }), pNode],
      domElement: null,
    })
    ;(view as { nodeDOM: unknown }).nodeDOM = () => null
    ;(view as { domAtPos: unknown }).domAtPos = () => ({
      node: fallbackDom,
      offset: 0,
    })

    const target = resolveDragTarget(view, 150, 160)
    expect(target).not.toBeNull()
    expect(target?.dom).toBe(fallbackDom)
  })
})
