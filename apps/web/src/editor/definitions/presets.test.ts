import { describe, expect, it } from "bun:test"
import { invoiceDocument, noteDocument, proposalDocument } from "./presets"

describe("document presets", () => {
  it("keeps invoices numeric: tables on, decorative blocks off", () => {
    expect(invoiceDocument.type).toBe("invoice")
    expect(invoiceDocument.capabilities?.tables).not.toBe(false)
    expect(invoiceDocument.capabilities?.mathematics).toBe(false)
    expect(invoiceDocument.capabilities?.embeds).toBe(false)
    expect(invoiceDocument.capabilities?.callouts).toBe(false)
  })

  it("gives proposals the wide canvas with the full baseline", () => {
    expect(proposalDocument.type).toBe("proposal")
    expect(proposalDocument.canvas?.width).toBe(900)
    expect(Object.values(proposalDocument.capabilities ?? { v: true })).not.toContain(false)
  })

  it("renders notes fluid without tables or embeds", () => {
    expect(noteDocument.canvas?.width).toBe("100%")
    expect(noteDocument.capabilities?.tables).toBe(false)
    expect(noteDocument.capabilities?.embeds).toBe(false)
  })
})
