import { describe, expect, test } from "bun:test"

import {
  isDarkApplied,
  mergeThemeState,
  resolveStoredMode,
  THEME_STORAGE_KEY,
} from "./theme-store"

describe("resolveStoredMode", () => {
  test("returns system for null/empty storage", () => {
    expect(resolveStoredMode(null)).toBe("system")
    expect(resolveStoredMode("")).toBe("system")
  })

  test("parses the zustand persist shape", () => {
    expect(
      resolveStoredMode(
        JSON.stringify({ state: { mode: "dark" }, version: 1 }),
      ),
    ).toBe("dark")
    expect(
      resolveStoredMode(
        JSON.stringify({ state: { mode: "light" }, version: 1 }),
      ),
    ).toBe("light")
    expect(
      resolveStoredMode(
        JSON.stringify({ state: { mode: "system" }, version: 1 }),
      ),
    ).toBe("system")
  })

  test("falls back to system for corrupt JSON", () => {
    expect(resolveStoredMode("{not json")).toBe("system")
  })

  test("falls back to system for unknown modes (forward compatibility)", () => {
    expect(
      resolveStoredMode(
        JSON.stringify({ state: { mode: "sepia" }, version: 1 }),
      ),
    ).toBe("system")
    expect(resolveStoredMode(JSON.stringify({ state: {}, version: 1 }))).toBe(
      "system",
    )
    expect(resolveStoredMode('"just a string"')).toBe("system")
  })
})

describe("isDarkApplied", () => {
  test("explicit modes ignore OS preference", () => {
    expect(isDarkApplied("dark", false)).toBe(true)
    expect(isDarkApplied("light", true)).toBe(false)
  })

  test("system follows OS preference", () => {
    expect(isDarkApplied("system", true)).toBe(true)
    expect(isDarkApplied("system", false)).toBe(false)
  })
})

describe("storage key contract", () => {
  // The pre-hydration script in __root.tsx reads this key directly — if the
  // key or persist shape ever changes, both places must change together.
  test("FOUC script reads the same key + persist shape as the store", async () => {
    const source = await Bun.file(
      new URL("../../routes/__root.tsx", import.meta.url),
    ).text()
    expect(source).toContain(THEME_STORAGE_KEY)
    expect(source).toContain("p.state.mode")
  })
})

describe("mergeThemeState (hydration trust boundary)", () => {
  const current = { mode: "system" as const, setMode: () => {} }

  test("accepts valid persisted modes", () => {
    for (const mode of ["light", "dark", "system"] as const) {
      expect(mergeThemeState({ mode }, current).mode).toBe(mode)
    }
  })

  test("rejects invalid/corrupt modes, keeping the current value", () => {
    expect(mergeThemeState({ mode: "sepia" }, current).mode).toBe("system")
    expect(mergeThemeState({ mode: 42 }, current).mode).toBe("system")
    expect(mergeThemeState({}, current).mode).toBe("system")
    expect(mergeThemeState(null, current).mode).toBe("system")
  })
})
