import { atom } from "jotai"
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
