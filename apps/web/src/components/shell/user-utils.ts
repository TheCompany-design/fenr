import { useSyncExternalStore } from "react"

export interface SessionUser {
  name: string
  email: string
  image?: string | null
  tier?: string
  usagePercent?: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function collapsedClip(
  origin: { x: number; y: number },
  size: { width: number; height: number },
): string {
  const half = 8
  const top = clamp(origin.y - half, 0, size.height)
  const right = clamp(size.width - origin.x - half, 0, size.width)
  const bottom = clamp(size.height - origin.y - half, 0, size.height)
  const left = clamp(origin.x - half, 0, size.width)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 12px)`
}

export function initialsOf(user?: SessionUser | null): string {
  if (!user) return "?"
  const source = user.name?.trim() || user.email?.trim() || ""
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
  return initials || "?"
}

const emptySubscribe = () => () => {}
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
