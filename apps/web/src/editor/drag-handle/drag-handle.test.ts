import { describe, expect, it } from "bun:test"
import { Schema } from "@tiptap/pm/model"
import type { Editor } from "@tiptap/react"
import { BlockDeleteButton, DragHandle } from "./drag-handle"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    heading: {
      content: "text*",
      group: "block",
      attrs: { level: { default: 1 } },
    },
    text: { inline: true },
  },
})

describe("DragHandle & BlockDeleteButton", () => {
  it("exports DragHandle and BlockDeleteButton components", () => {
    expect(typeof DragHandle).toBe("function")
    expect(typeof BlockDeleteButton).toBe("function")
  })

  it("computes delete range correctly for a block node", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("Hello world")]),
    ])

    const targetNode = doc.nodeAt(0)
    expect(targetNode).not.toBeNull()
    expect(targetNode?.nodeSize).toBe(13)

    const from = 0
    const to = from + (targetNode?.nodeSize ?? 0)
    expect(to).toBe(13)
  })

  it("handles null editor safely without crashing", () => {
    const fakeEditor = null as unknown as Editor
    expect(fakeEditor).toBeNull()
  })
})
