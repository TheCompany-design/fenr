import { LaptopIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useState } from "react"

import { type ThemeMode, useThemeStore } from "@/components/providers"

const OPTIONS: ReadonlyArray<{
  mode: ThemeMode
  label: string
  icon: typeof Sun03Icon
}> = [
  { mode: "light", label: "Light", icon: Sun03Icon },
  { mode: "dark", label: "Dark", icon: Moon02Icon },
  { mode: "system", label: "System", icon: LaptopIcon },
]

export function ThemeToggle({ className }: { className?: string } = {}) {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

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
            className={cn("rounded-full", className)}
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
            data-active={effectiveMode === optionMode}
          >
            <HugeiconsIcon icon={icon} size={16} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
