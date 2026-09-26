import { atom } from "jotai"
import type { ChatMessage } from "../types"
import {
  type ActiveTurnProjection,
  initialTurnProjection,
} from "./stream-reducer"

/**
 * Jotai atom holding the in-flight SSE streaming turn projection.
 * Decouples active streaming deltas from local component state and avoids
 * React re-render cascades or useEffect synchronization hazards.
 */
export const activeTurnProjectionAtom = atom<ActiveTurnProjection>(
  initialTurnProjection,
)

/**
 * Diagnostic request identifier for the active or most recent stream request.
 */
export const lastRequestIdAtom = atom<string | null>(null)

/**
 * UI disclosure state for the streaming thinking trace.
 */
export const isThinkingOpenAtom = atom<boolean>(true)

/**
 * ID of the most recently copied message, if any.
 */
export const copiedMessageIdAtom = atom<string | null>(null)

/**
 * Ephemeral active thread ID for client transition coordination.
 */
export const activeChatThreadIdAtom = atom<string | null>(null)

/**
 * Optimistic user message displayed while initial turn is created on server.
 */
export const pendingUserMessageAtom = atom<ChatMessage | null>(null)
