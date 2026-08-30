import { atom } from "jotai"

export interface SelectionState {
  from: number
  to: number
  empty: boolean
}

export const DEFAULT_SELECTION_STATE: SelectionState = {
  from: 0,
  to: 0,
  empty: true
}

export const selectionAtom = atom<SelectionState>(DEFAULT_SELECTION_STATE)

export const isSelectionEmptyAtom = atom((get) => get(selectionAtom).empty)
export const selectionRangeAtom = atom((get) => {
  const sel = get(selectionAtom)
  return { from: sel.from, to: sel.to }
})
