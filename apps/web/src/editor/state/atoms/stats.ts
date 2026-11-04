import { atom } from "jotai"

export interface DocumentStats {
  words: number
  characters: number
}

export const DEFAULT_DOCUMENT_STATS: DocumentStats = {
  words: 0,
  characters: 0,
}

export const documentStatsAtom = atom<DocumentStats>(DEFAULT_DOCUMENT_STATS)

export function areDocumentStatsEqual(a: DocumentStats, b: DocumentStats): boolean {
  return a.words === b.words && a.characters === b.characters
}
