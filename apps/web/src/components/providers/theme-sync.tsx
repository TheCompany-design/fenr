import { useEffect, useLayoutEffect } from "react"
import { isDarkApplied, useThemeStore } from "@/lib/stores/theme.store"

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

    if (mode !== "system" || !query) return

    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [mode])

  return null
}
