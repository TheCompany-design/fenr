import { describe, expect, it } from "bun:test"
import { Editor } from "@tiptap/react"
import { assembleExtensions } from "../core/extension-registry"
import { CODE_BLOCK_LANGUAGES } from "./code-block"
import { formatLanguageLabel } from "./code-block-view"

describe("CODE_BLOCK_LANGUAGES", () => {
  it("leads with plaintext and sorts the rest", () => {
    expect(CODE_BLOCK_LANGUAGES[0]).toBe("plaintext")
    const rest = CODE_BLOCK_LANGUAGES.slice(1)
    expect(rest).toEqual([...rest].sort())
    expect(rest).toContain("javascript")
    expect(rest).toContain("typescript")
    expect(CODE_BLOCK_LANGUAGES).not.toContain("")
  })
})

describe("formatLanguageLabel", () => {
  it("prettifies special language ids", () => {
    expect(formatLanguageLabel("plaintext")).toBe("Plain text")
    expect(formatLanguageLabel("c++")).toBe("C++")
    expect(formatLanguageLabel("javascript")).toBe("Javascript")
    expect(formatLanguageLabel("")).toBe("")
  })
})

describe("FenrCodeBlock behavior", () => {
  it("stores a language attribute on the code block node", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: assembleExtensions({ capabilities: {} }),
      content: {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "python" },
            content: [{ type: "text", text: "print('hi')" }],
          },
        ],
      },
    })
    try {
      const doc = editor.getJSON()
      expect(doc.content?.[0]?.type).toBe("codeBlock")
      expect(doc.content?.[0]?.attrs).toMatchObject({ language: "python" })

      editor.commands.updateAttributes("codeBlock", { language: "rust" })
      expect(editor.getJSON().content?.[0]?.attrs).toMatchObject({
        language: "rust",
      })
    } finally {
      editor.destroy()
    }
  })
})
