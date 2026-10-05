/**
 * Mirrors of tables owned by the agent runtime.
 *
 * The runtime in `thebookofnabu` owns these tables: it mints their
 * identifiers, writes their rows, and enforces isolation on them with row level
 * security that this application must not be able to weaken. Fenr does not
 * migrate them and does not write them; these declarations exist so the
 * transcript can be read. See `agent-mirror.test.ts` for how the mirror is kept
 * honest.
 */
export * from "./agent-approvals"
export * from "./agent-items"
export * from "./agent-threads"
export * from "./agent-tool-intents"
export * from "./agent-turns"
