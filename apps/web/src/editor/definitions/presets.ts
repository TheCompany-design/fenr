import { defineDocument, type DocumentDefinition } from "../core/types"

/**
 * Ready-made document definitions. Each preset is pure configuration —
 * no engine changes — demonstrating how future surfaces (invoices,
 * proposals, notes) compose the same editor differently.
 */

/** Compact margins, tables only — numbers and line items, no frills. */
export const invoiceDocument: DocumentDefinition = defineDocument({
  type: "invoice",
  canvas: {
    width: 816,
    minHeight: 1056,
    padding: { x: 56, y: 56 },
  },
  capabilities: {
    mathematics: false,
    embeds: false,
    callouts: false,
  },
})

/** Wide presentation format with the full capability baseline. */
export const proposalDocument: DocumentDefinition = defineDocument({
  type: "proposal",
  canvas: {
    width: 900,
    minHeight: 1200,
    padding: { x: 72, y: 72 },
  },
  capabilities: {},
})

/** Fluid writing surface for notes: narrow rhythm, no page metaphor. */
export const noteDocument: DocumentDefinition = defineDocument({
  type: "document",
  canvas: {
    width: "100%",
    minHeight: 480,
    padding: { x: 16, y: 24 },
  },
  capabilities: {
    tables: false,
    embeds: false,
  },
})
