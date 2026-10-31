import { describe, expect, it } from "bun:test"
import { Editor, Extension } from "@tiptap/react"
import {
  assembleExtensions,
  resolvePlaceholderText,
} from "./extension-registry"
import { defaultDocumentDefinition } from "./types"

/**
 * Kit extensions (StarterKit, TableKit, TextStyleKit) aggregate child
 * extensions, so array-level names hide what actually registers. Building a
 * real Editor resolves the full flattened extension list — exactly what
 * ProseMirror will see.
 */
function resolveExtensionNames(
  capabilities: Parameters<typeof assembleExtensions>[0]["capabilities"],
  extraExtensions?: Extension[],
) {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: assembleExtensions({ capabilities, extraExtensions }),
  })

  try {
    return editor.extensionManager.extensions.map((e) => e.name)
  } finally {
    editor.destroy()
  }
}

describe("assembleExtensions", () => {
  it("resolves the full default capability baseline in a real editor", () => {
    const names = resolveExtensionNames(
      defaultDocumentDefinition.capabilities ?? {},
    )

    for (const expected of [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "taskList",
      "taskItem",
      "blockquote",
      "codeBlock",
      "horizontalRule",
      "link",
      "underline",
      "textAlign",
      // @tiptap/extension-mathematics registers its own name capitalized and
      // additionally provides the inlineMath/blockMath nodes.
      "Mathematics",
      "inlineMath",
      "blockMath",
      "table",
      "tableRow",
      "tableHeader",
      "tableCell",
      "image",
      "youtube",
      "highlight",
      "textStyleKit",
      "color",
      "placeholder",
      "slashMenu",
    ]) {
      expect(names).toContain(expected)
    }
  })

  it("omits the placeholder extension when disabled", () => {
    const names = resolveExtensionNames({ placeholder: false })
    expect(names).not.toContain("placeholder")
  })

  it("omits the slash menu extension when disabled", () => {
    const names = resolveExtensionNames({ slashMenu: false })
    expect(names).not.toContain("slashMenu")
  })

  it("derives heading and paragraph placeholder prompts", () => {
    expect(
      resolvePlaceholderText(
        { type: { name: "heading" }, attrs: { level: 2 } },
        false,
      ),
    ).toBe("Heading 2")
    expect(
      resolvePlaceholderText({ type: { name: "paragraph" }, attrs: {} }, true),
    ).toBe("Write, press '/' for commands…")
    expect(
      resolvePlaceholderText({ type: { name: "paragraph" }, attrs: {} }, false),
    ).toBe("Type '/' for commands")
    expect(
      resolvePlaceholderText({ type: { name: "heading" }, attrs: {} }, false),
    ).toBe("Heading")
  })

  it("registers exactly one code block implementation", () => {
    const enabled = resolveExtensionNames({})
    expect(enabled.filter((name) => name === "codeBlock")).toHaveLength(1)

    const disabled = resolveExtensionNames({ codeBlocks: false })
    expect(disabled.filter((name) => name === "codeBlock")).toHaveLength(1)
  })

  it("drops capability-driven extensions when disabled", () => {
    const names = resolveExtensionNames({
      mathematics: false,
      tables: false,
      images: false,
      embeds: false,
      highlights: false,
      textColors: false,
      taskLists: false,
      placeholder: false,
    })

    for (const banned of [
      "Mathematics",
      "inlineMath",
      "blockMath",
      "table",
      "image",
      "youtube",
      "highlight",
      "textStyleKit",
      "color",
      "taskList",
      "taskItem",
      "placeholder",
    ]) {
      expect(names).not.toContain(banned)
    }

    // Disabling task lists must not take the rest of the list kit down.
    for (const kept of ["bulletList", "orderedList", "listItem"]) {
      expect(names).toContain(kept)
    }
  })

  it("registers definition-supplied extensions alongside the baseline", () => {
    const sentinel = Extension.create({ name: "sentinelExtension" })
    const names = resolveExtensionNames({}, [sentinel])

    // The extension manager reorders by priority, so "last" is not a stable
    // contract — what matters is that extras resolve alongside the baseline.
    expect(names).toContain("sentinelExtension")
  })

  it("keeps the baseline deterministic across calls", () => {
    expect(resolveExtensionNames({})).toEqual(resolveExtensionNames({}))
  })
})
