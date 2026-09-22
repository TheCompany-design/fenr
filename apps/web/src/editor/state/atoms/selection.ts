import { atom } from "jotai"
import { selectAtom } from "jotai/utils"

export interface SelectionState {
  from: number
  to: number
  empty: boolean
}

export const DEFAULT_SELECTION_STATE: SelectionState = {
  from: 0,
  to: 0,
  empty: true,
}

export const selectionAtom = atom<SelectionState>(DEFAULT_SELECTION_STATE)

export const isSelectionEmptyAtom = atom((get) => get(selectionAtom).empty)
export const selectionRangeAtom = selectAtom(
  selectionAtom,
  (sel) => ({ from: sel.from, to: sel.to }),
  (a, b) => a.from === b.from && a.to === b.to,
)
