import { HugeiconsIcon } from "@hugeicons/react"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useImperativeHandle, useRef, useState } from "react"
import { groupSlashMenuItems } from "./slash-menu-items"
import type { SlashMenuItem } from "./types"

export interface SlashMenuPopupHandle {
  /** Delegated from the suggestion plugin; returns true when consumed */
  onKeyDown: (event: KeyboardEvent) => boolean
}

export interface SlashMenuPopupProps {
  items: SlashMenuItem[]
  command: (item: SlashMenuItem) => void
  query: string
  ref?: React.Ref<SlashMenuPopupHandle>
}

/**
 * Notion-style command palette rendered by the slash-menu suggestion plugin.
 * Keyboard selection wraps around, hovering preselects, and the active row
 * is kept in view while filtering.
 */
export function SlashMenuPopup({
  items,
  command,
  query,
  ref,
}: SlashMenuPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Reset to the top only when the visible result set changes, not on every
  // suggestion update (repositions and selection moves must not reset).
  // Adjusting state during render is React's endorsed pattern for
  // props-derived resets and keeps Biome's exhaustive-deps hook clean.
  const resultSignature = items.map((item) => item.id).join(",")
  const [lastSignature, setLastSignature] = useState(resultSignature)
  if (lastSignature !== resultSignature) {
    setLastSignature(resultSignature)
    setSelectedIndex(0)
    selectedIndexRef.current = 0
  }

  useEffect(() => {
    const container = listRef.current
    if (!container) return
    container
      .querySelector(`[data-slash-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  const selectAt = (index: number) => {
    selectedIndexRef.current = index
    setSelectedIndex(index)
  }

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (event: KeyboardEvent): boolean => {
        if (event.key === "ArrowDown" && items.length > 0) {
          selectAt((selectedIndexRef.current + 1) % items.length)
          return true
        }
        if (event.key === "ArrowUp" && items.length > 0) {
          selectAt((selectedIndexRef.current - 1 + items.length) % items.length)
          return true
        }
        if (event.key === "Enter") {
          const item = items[selectedIndexRef.current]
          if (!item) return true
          command(item)
          return true
        }
        return false
      },
    }),
    [items, command],
  )

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-xl border border-border/80 bg-popover/95 p-3 text-sm text-muted-foreground shadow-2xl backdrop-blur-md">
        No results for "{query.trim()}"
      </div>
    )
  }

  const sections = groupSlashMenuItems(items)

  return (
    <div className="w-80 overflow-hidden rounded-xl border border-border/80 bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-md">
      <ScrollArea className="max-h-80">
        <div ref={listRef} role="listbox" aria-label="Block commands">
          {sections.map((section) => (
            <div key={section.group.id}>
              <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.group.label}
              </div>
              {section.items.map((item) => {
                const index = items.indexOf(item)
                const isSelected = index === selectedIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-slash-index={index}
                    onMouseEnter={() => selectAt(index)}
                    onClick={() => command(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors",
                      isSelected && "bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground transition-colors",
                        isSelected &&
                          "border-border bg-background text-foreground",
                      )}
                    >
                      <HugeiconsIcon icon={item.icon} className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
