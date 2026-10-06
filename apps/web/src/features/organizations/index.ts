export * from "@/lib/schemas/organizations"
export * from "./components"
export * from "./queries"
export * from "./server"
export * from "./types"

// Deliberately NOT re-exporting the workspace-role resolver. It reaches the
// database driver, and this barrel is imported by client components — so making
// it a live export here stops the bundler tree-shaking it away, puts `pg` in the
// browser, and `pg` throws on `Buffer` at import time. The symptom is that every
// route renders but never hydrates. A `.server.ts` module, imported by the one
// server function that needs it, is the only shape that survives.
