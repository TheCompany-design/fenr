import { useRef, useSyncExternalStore } from "react"
import type { CaretRect } from "./caret"
import {
  applySelection,
  detectTrigger,
  filterItems,
  type Trigger,
} from "./trigger"

/**
 * Per-instance suggestion state.
 *
 * Built as a plain external store for the same reason `use-window-dropzone`
 * is: the keydown handler and the textarea need to read and write this from
 * outside React, and `useState` would force that logic through a re-render.
 * `useSyncExternalStore` hands the lifecycle to React without an effect.
 */

export type SuggestionItem = {
  id: string
  /** Text written into the editor when chosen. */
  insertText: string
  label: string
  hint?: string
  keywords?: string
  icon?: React.ReactNode
  /** Right-aligned metadata: a shortcut, a count, a price. */
  trailing?: React.ReactNode
}

export type SuggestionState = {
  open: boolean
  trigger: Trigger | null
  anchor: CaretRect | null
  items: readonly SuggestionItem[]
  activeIndex: number
}

const CLOSED: SuggestionState = {
  open: false,
  trigger: null,
  anchor: null,
  items: [],
  activeIndex: 0,
}

export type SuggestionStore = {
  get: () => SuggestionState
  set: (next: SuggestionState) => void
  subscribe: (onChange: () => void) => () => void
}

export function createSuggestionStore(): SuggestionStore {
  let state = CLOSED
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set(next) {
      if (
        next.open === state.open &&
        next.activeIndex === state.activeIndex &&
        next.items === state.items &&
        next.trigger === state.trigger &&
        next.anchor === state.anchor
      ) {
        return
      }
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
  }
}

export function useSuggestionState(store: SuggestionStore): SuggestionState {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/**
 * Clamps rather than wraps. Wrapping is the more common choice in list
 * widgets, but here the list is anchored to the caret: arrowing past the last
 * item and having the popup teleport above the line you are typing on reads
 * as a glitch, so the selection stops at the ends instead.
 */
export function moveActive(
  state: SuggestionState,
  delta: number,
): SuggestionState {
  if (!state.open || state.items.length === 0) return state
  const next = Math.min(
    state.items.length - 1,
    Math.max(0, state.activeIndex + delta),
  )
  return { ...state, activeIndex: next }
}

/**
 * Returns the edited text and the span the chosen item now occupies, or null
 * when there is nothing to apply. Keeping this pure means the keydown handler
 * decides *whether* a keystroke is a selection without needing the rendered
 * list to agree with it.
 */
export function commitSuggestion(input: {
  state: SuggestionState
  text: string
  item?: SuggestionItem | null
}): { text: string; item: SuggestionItem; start: number; end: number } | null {
  const { state, text } = input
  if (!state.open || !state.trigger) return null
  const item = input.item ?? state.items[state.activeIndex]
  if (!item) return null

  const applied = applySelection({
    text,
    trigger: state.trigger,
    insertText: item.insertText,
  })

  return { ...applied, item }
}

export type TriggerSource = (input: {
  trigger: Trigger
  text: string
}) => readonly SuggestionItem[]

/**
 * Recomputes the menu from the current text. `anchor` is passed in rather than
 * measured here so the caller owns the DOM access — this function stays
 * testable and has no opinion about where the popup renders.
 */
export function recompute(input: {
  store: SuggestionStore
  text: string
  caret: number
  anchor: CaretRect | null
  spans?: readonly { start: number; end: number }[]
  sources: Partial<Record<Trigger["kind"], TriggerSource>>
}): SuggestionState {
  const trigger = detectTrigger({
    text: input.text,
    caret: input.caret,
    spans: input.spans,
  })

  if (!trigger) return { ...CLOSED }

  const source = input.sources[trigger.kind]
  if (!source) return { ...CLOSED }

  const items: SuggestionItem[] = filterItems(
    source({ trigger, text: input.text }),
    trigger.query,
    (item) => `${item.label} ${item.keywords ?? ""}`,
  )

  if (items.length === 0) return { ...CLOSED }

  return {
    open: true,
    trigger,
    anchor: input.anchor,
    items,
    activeIndex: 0,
  }
}

/** Stable per-component store, created lazily without `useState`. */
export function useSuggestionStore(): SuggestionStore {
  const ref = useRef<SuggestionStore | null>(null)
  ref.current ??= createSuggestionStore()
  return ref.current
}
