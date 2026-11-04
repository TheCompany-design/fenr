/** Resolve a website URL to its conventional root favicon location. */
export function getFaviconUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return new URL("/favicon.ico", url.origin).toString()
  } catch {
    return null
  }
}
