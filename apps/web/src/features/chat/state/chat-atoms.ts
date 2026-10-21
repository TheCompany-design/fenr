import { atom } from "jotai"

export const lastRequestIdAtom = atom<string | null>(null)

export const isStreamingAtom = atom<boolean>(false)

export const isThinkingOpenAtom = atom<boolean>(true)

export const copiedMessageIdAtom = atom<string | null>(null)
