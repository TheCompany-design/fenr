import { atom } from "jotai"

/**
 * Diagnostic request identifier for the active or most recent stream request.
 */
export const lastRequestIdAtom = atom<string | null>(null)

/**
 * Global stream active indicator.
 */
export const isStreamingAtom = atom<boolean>(false)

/**
 * UI disclosure state for the streaming thinking trace.
 */
export const isThinkingOpenAtom = atom<boolean>(true)

/**
 * ID of the most recently copied message, if any.
 */
export const copiedMessageIdAtom = atom<string | null>(null)
