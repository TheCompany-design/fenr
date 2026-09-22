import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}

/**
 * Hydration-safe client mount hook using useSyncExternalStore.
 * Returns false on the server / initial client render, and true after client hydration,
 * avoiding extra cascading re-renders caused by useEffect(..., []).
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
