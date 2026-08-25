/**
 * Theme synchronization (post-hydration).
 *
 * The `dark` class on <html> is applied imperatively — never through React
 * state — so this component:
 *
 *   1. applies the class whenever the persisted mode or the OS preference
 *      changes,
 *   2. subscribes to `prefers-color-scheme` live updates while mode is
 *      "system" (listener torn down on unmount / mode change),
 *   3. keeps the mobile-browser `theme-color` meta in sync.
 *
 * Pre-hydration, the inline script in __root.tsx already applied the correct
 * class; this component takes over after mount without flashing.
 */
import { useEffect, useLayoutEffect } from "react"
import { isDarkApplied, useThemeStore } from "@/lib/stores/theme-store"

/**
 * Layout effect on the client (applies pre-paint), no-op on the server so
 * SSR never logs the "useLayoutEffect does nothing on the server" warning.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

function prefersDarkQuery(): MediaQueryList | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null
  }
  return window.matchMedia("(prefers-color-scheme: dark)")
}

/** Read a CSS custom property from :root (token-driven, theme-aware). */
function readToken(name: string): string {
  if (typeof window === "undefined") return ""
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    ""
  )
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark)
  const background = readToken("--background")
  if (!background) return
  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    meta.content = background
  }
}

export function ThemeSync() {
  const mode = useThemeStore((s) => s.mode)

  useIsomorphicLayoutEffect(() => {
    const query = prefersDarkQuery()

    const update = () =>
      applyTheme(isDarkApplied(mode, query?.matches ?? false))

    update()

    // Live-follow OS preference only while the user wants system mode.
    if (mode !== "system" || !query) return

    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [mode])

  return null
}
