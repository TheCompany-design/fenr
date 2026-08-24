/**
 * Theme mode store (light / dark / system).
 *
 * Fenr convention: global state lives in Zustand stores. The persisted
 * `mode` is the user's *preference*; the actually-applied theme (the
 * `dark` class on <html>) is applied imperatively by:
 *
 *   1. the FOUC-prevention inline script in `__root.tsx` (pre-hydration,
 *      reads this same localStorage key directly), and
 *   2. `ThemeSync` (`src/components/theme-sync.tsx`) after hydration.
 *
 * React never owns the `dark` class as state, so hydration cannot "correct"
 * what the inline script already applied (zero flash of wrong theme).
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/** Exhaustive set of user-selectable modes. Never a bare boolean. */
export type ThemeMode = "light" | "dark" | "system"

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"]

/** Storage key read directly by the pre-hydration script in __root.tsx — keep in sync. */
export const THEME_STORAGE_KEY = "fenr.theme"

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && THEME_MODES.includes(value as ThemeMode)
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: THEME_STORAGE_KEY,
      version: 1,
      // Corrupt/foreign values fall back to the default ("system").
      migrate: (persisted) =>
        isThemeMode((persisted as { mode?: unknown })?.mode)
          ? (persisted as ThemeState)
          : { mode: "system" },
      ...(typeof window === "undefined"
        ? {}
        : { storage: createJSONStorage(() => window.localStorage) }),
    },
  ),
)

/**
 * Resolve a persisted raw value from localStorage to a ThemeMode without
 * going through the store. Used by the pre-hydration script's logic and its
 * tests. Mirrors `migrate` above: anything unrecognized → "system".
 */
export function resolveStoredMode(raw: string | null): ThemeMode {
  if (!raw) return "system"
  try {
    const parsed: unknown = JSON.parse(raw)
    // Zustand persist shape: { state: { mode }, version: number }
    const mode = (parsed as { state?: { mode?: unknown } })?.state?.mode
    return isThemeMode(mode) ? mode : "system"
  } catch {
    return "system"
  }
}

/**
 * Pure merge guard used by the persist middleware: validates the persisted
 * mode at the localStorage trust boundary. zustand only calls migrate() on
 * version mismatches; this runs on EVERY hydration.
 */
export function mergeThemeState(
  persisted: unknown,
  current: ThemeState,
): ThemeState {
  const mode = (persisted as { mode?: unknown })?.mode
  return { ...current, mode: isThemeMode(mode) ? mode : current.mode }
}

/** Pure helper: given a mode and the OS preference, is dark applied? */
export function isDarkApplied(mode: ThemeMode, prefersDark: boolean): boolean {
  return mode === "dark" || (mode === "system" && prefersDark)
}
