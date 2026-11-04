import { describe, expect, it } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { OpenUiRenderer } from "./openui-renderer"

describe("OpenUiRenderer", () => {
  it("renders supported streamed OpenUI Lang with the chat library", () => {
    const html = renderToStaticMarkup(
      createElement(OpenUiRenderer, {
        content:
          '```openui-lang\nroot = Card([title])\ntitle = TextContent("A local preview")\n```',
        isStreaming: true,
        onContinue: () => {},
      }),
    )

    expect(html).toContain("A local preview")
  })
})
