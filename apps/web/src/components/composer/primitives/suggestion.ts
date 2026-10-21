import { useRef, useSyncExternalStore } from "react"
import type { CaretRect } from "./caret"
import {
  applySelection,
  detectTrigger,
  filterItems,
  type Trigger,
} from "./trigger"

export type SuggestionItem = {
  id: string

  insertText: string
  label: string
  hint?: string
  keywords?: string
  icon?: React.ReactNode

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
