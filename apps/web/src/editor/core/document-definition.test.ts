import { describe, expect, it } from "bun:test"
import { defaultDocumentDefinition, defineDocument } from "./types"

describe("DocumentDefinition", () => {
  it("provides sensible defaults for document definitions", () => {
    expect(defaultDocumentDefinition.type).toBe("document")
    expect(defaultDocumentDefinition.canvas?.width).toBe(816)
    expect(defaultDocumentDefinition.canvas?.minHeight).toBe(1056)
    expect(defaultDocumentDefinition.canvas?.padding).toEqual({ x: 72, y: 72 })
    expect(defaultDocumentDefinition.capabilities?.mathematics).toBe(true)
  })

  it("creates custom document definitions preserving custom properties", () => {
    const proposal = defineDocument({
      type: "proposal",
      canvas: {
        width: 1000,
        minHeight: 1200,
        padding: { x: 48, y: 48 },
      },
      capabilities: {
        mathematics: false,
        tables: true,
      },
    })

    expect(proposal.type).toBe("proposal")
    expect(proposal.canvas?.width).toBe(1000)
    expect(proposal.capabilities?.mathematics).toBe(false)
    expect(proposal.capabilities?.tables).toBe(true)
  })
})
