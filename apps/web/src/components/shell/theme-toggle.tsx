/**
 * Theme mode toggle (light / dark / system).
 *
 * Writes only the user's preference to the theme store; applying it to the
 * DOM is ThemeSync's job. The icon reflects the selected preference, not
 * the resolved theme.
 */
import { LaptopIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useEffect, useState } from "react"

import { type ThemeMode, useThemeStore } from "@/lib/stores/theme-store"

const OPTIONS: ReadonlyArray<{
  mode: ThemeMode
  label: string
  icon: typeof Sun03Icon
}> = [
  { mode: "light", label: "Light", icon: Sun03Icon },
  { mode: "dark", label: "Dark", icon: Moon02Icon },
  { mode: "system", label: "System", icon: LaptopIcon },
]

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  // The persisted mode resolves synchronously on the client but the server
  // always renders the default ("system"). Render that same default until
  // after mount so hydration output matches the server HTML exactly.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const effectiveMode = mounted ? mode : "system"
  const active =
    OPTIONS.find((option) => option.mode === effectiveMode) ?? OPTIONS[2]
  const ActiveIcon = active.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Theme: ${active.label}. Change theme`}
            size="icon"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon icon={ActiveIcon} size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ icon, label, mode: optionMode }) => (
          <DropdownMenuItem
            key={optionMode}
            onClick={() => setMode(optionMode)}
            data-active={mode === optionMode}
          >
            <HugeiconsIcon icon={icon} size={16} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
