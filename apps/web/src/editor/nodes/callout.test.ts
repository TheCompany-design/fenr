import { describe, expect, it } from "bun:test"
import { Editor } from "@tiptap/react"
import { assembleExtensions } from "../core/extension-registry"

function createEditor() {
  return new Editor({
    element: document.createElement("div"),
    extensions: assembleExtensions({ capabilities: {} }),
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello" }] },
      ],
    },
  })
}

describe("Callout node", () => {
  it("converts a paragraph into a callout with a default emoji", () => {
    const editor = createEditor()
    try {
      editor.commands.setTextSelection(1)
      editor.commands.setCallout()

      const doc = editor.getJSON()
      expect(doc.content?.[0]?.type).toBe("callout")
      expect(doc.content?.[0]?.attrs).toMatchObject({ emoji: "💡" })
      expect(JSON.stringify(doc)).toContain("hello")
    } finally {
      editor.destroy()
    }
  })

  it("unwraps a callout back into plain blocks", () => {
    const editor = createEditor()
    try {
      editor.commands.setCallout()
      editor.commands.unsetCallout()

      expect(editor.getJSON().content?.[0]?.type).toBe("paragraph")
    } finally {
      editor.destroy()
    }
  })
})

describe("Details (toggle) nodes", () => {
  it("accepts the slash-menu insert structure", () => {
    const editor = createEditor()
    try {
      editor.commands.insertContent({
        type: "details",
        content: [
          {
            type: "detailsSummary",
            content: [{ type: "text", text: "Toggle" }],
          },
          { type: "detailsContent", content: [{ type: "paragraph" }] },
        ],
      })

      const doc = editor.getJSON()
      const details = doc.content?.find((node) => node?.type === "details")
      expect(details).toBeDefined()
      const summary = details?.content?.find(
        (node) => node?.type === "detailsSummary",
      )
      expect(JSON.stringify(summary)).toContain("Toggle")
    } finally {
      editor.destroy()
    }
  })
})
