import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import type { SuggestionItem, SuggestionState } from "./suggestion"

export type PromptAutocompleteProps = {
  state: SuggestionState
  onSelect: (item: SuggestionItem) => void
  onActiveIndexChange?: (index: number) => void
  className?: string
  /** Pixel gap between the caret and the popup. */
  offset?: number
}

/**
 * Generic list surface for the `/` and `@` menus. It knows how to render items
 * and where to put itself, and nothing about what the items mean — commands
 * and file references share it, as will anything else added later.
 *
 * Positioned from the measured caret rather than from the textarea, so the
 * popup tracks the cursor across a wrapped line. When it would fall off the
 * bottom it flips above the caret, which is the difference between usable and
 * not when the caret sits in the last line of a full-height composer.
 *
 * Rendered inline rather than portalled: it is positioned against the
 * composer box, and a portal would need the anchor rect re-read on every
 * scroll of an ancestor. The composer is already `overflow-visible`, so the
 * only escape is the viewport, which is handled by flipping.
 */
export function PromptAutocomplete({
  state,
  onSelect,
  onActiveIndexChange,
  className,
  offset = 8,
}: PromptAutocompleteProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [flip, setFlip] = React.useState<{
    flipped: boolean
    bottom: number
  } | null>(null)

  const { open, anchor, items, activeIndex } = state

  // Measured when the popup opens rather than in a mount effect: the geometry
  // is only knowable once there is something on screen to measure against.
  //
  // The flip decision needs the caret in *viewport* space, but the anchor is
  // in the shell's space — the popup's containing block, which is its own
  // `offsetParent` once rendered. The shell's live rect converts between the
  // two, and being live is the point: the editor's scroll moves the caret
  // through the viewport without the anchor ever noticing.
  const reposition = React.useCallback(() => {
    if (!anchor || !listRef.current) return
    const shell = listRef.current.offsetParent
    if (!(shell instanceof HTMLElement)) return
    const shellBox = shell.getBoundingClientRect()
    const caretViewportTop = shellBox.top + shell.clientTop + anchor.top
    const spaceBelow = window.innerHeight - caretViewportTop - offset - 24
    const needed = Math.min(items.length, 8) * 40 + 16
    const flipped = spaceBelow < needed && caretViewportTop > spaceBelow
    // CSS `bottom` counts from the containing block's padding-box bottom and
    // `anchor.top` from its padding-box top, so the two together span the
    // shell's client height: the flipped popup's bottom edge lands `offset`
    // px above the caret without a single viewport number in the style.
    const bottomFromShell = shell.clientHeight - anchor.top + offset
    setFlip((current) =>
      current &&
      current.flipped === flipped &&
      current.bottom === bottomFromShell
        ? current
        : { flipped, bottom: bottomFromShell },
    )
  }, [anchor, items.length, offset])

  React.useEffect(() => {
    if (open) reposition()
  }, [open, reposition])

  // Keep the highlighted row visible during keyboard navigation.
  // `block: "nearest"` avoids scrolling the whole composer to follow it.
  // Keyed on the highlighted row as well as the open state — a list longer
  // than the popup otherwise lets the highlight walk off the visible rows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `activeIndex` is the signal this effect waits on, not an input it reads — the highlighted row is found in the DOM by its `data-active` marker, which is what keeps this in step with whatever the rows actually rendered.
  React.useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current
      .querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [open, activeIndex])

  if (!open || !anchor || items.length === 0) return null

  const top = flip?.flipped ? undefined : anchor.top + anchor.height + offset
  const bottom = flip?.flipped ? flip.bottom : undefined

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Suggestions"
      style={{ top, bottom }}
      className={cn(
        "animate-in fade-in-0 zoom-in-95 absolute left-0 z-50 max-h-80 w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
        flip?.flipped ? "slide-in-from-bottom-2" : "slide-in-from-top-2",
        className,
      )}
    >
      {items.map((item, index) => (
        <AutocompleteRow
          key={item.id}
          item={item}
          active={index === activeIndex}
          onSelect={() => onSelect(item)}
          onHover={() => onActiveIndexChange?.(index)}
        />
      ))}
    </div>
  )
}

function AutocompleteRow({
  item,
  active,
  onSelect,
  onHover,
}: {
  item: SuggestionItem
  active: boolean
  onSelect: () => void
  onHover: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-active={active}
      // `onMouseDown`, not `onClick`: by the time a click lands the textarea
      // has already lost focus, and the editor must not blur while the user
      // is choosing from a menu that is about to close.
      onMouseDown={(event) => {
        event.preventDefault()
        onSelect()
      }}
      onMouseMove={onHover}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
    >
      {item.icon ? (
        <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
          {item.icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{item.label}</span>
        {item.hint ? (
          <span className="text-muted-foreground truncate text-xs">
            {item.hint}
          </span>
        ) : null}
      </span>
      {item.trailing ? (
        <span className="text-muted-foreground shrink-0 text-xs">
          {item.trailing}
        </span>
      ) : null}
    </button>
  )
}
