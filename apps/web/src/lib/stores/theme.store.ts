import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type ThemeMode = "light" | "dark" | "system"

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"]

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

      migrate: (persisted) =>
        isThemeMode((persisted as { mode?: unknown })?.mode)
          ? (persisted as ThemeState)
          : { mode: "system" },
      merge: mergeThemeState,
      ...(typeof window === "undefined"
        ? {}
        : { storage: createJSONStorage(() => window.localStorage) }),
    },
  ),
)

export function resolveStoredMode(raw: string | null): ThemeMode {
  if (!raw) return "system"
  try {
    const parsed: unknown = JSON.parse(raw)

    const mode = (parsed as { state?: { mode?: unknown } })?.state?.mode
    return isThemeMode(mode) ? mode : "system"
  } catch {
    return "system"
  }
}

export function mergeThemeState(
  persisted: unknown,
  current: ThemeState,
): ThemeState {
  const mode = (persisted as { mode?: unknown })?.mode
  return { ...current, mode: isThemeMode(mode) ? mode : current.mode }
}

export function isDarkApplied(mode: ThemeMode, prefersDark: boolean): boolean {
  return mode === "dark" || (mode === "system" && prefersDark)
}
