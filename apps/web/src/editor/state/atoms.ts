// apps/web/src/editor/state/atoms.ts
import { atom } from "jotai"

export type TextType = "text" | "heading-1" | "heading-2" | "heading-3"

export interface BubbleMenuFormattingState {
  isBold: boolean
  isItalic: boolean
  isStrikethrough: boolean
  isBulletList: boolean
  isOrderedList: boolean
  textType: TextType
  isAlignLeft: boolean
  isAlignCenter: boolean
  isAlignRight: boolean
  isAlignJustify: boolean
  isCode: boolean
  isCodeBlock: boolean
  isBlockquote: boolean
  isMath: boolean
}

export const DEFAULT_BUBBLE_MENU_FORMATTING: BubbleMenuFormattingState = {
  isBold: false,
  isItalic: false,
  isStrikethrough: false,
  isBulletList: false,
  isOrderedList: false,
  textType: "text",
  isAlignLeft: true,
  isAlignCenter: false,
  isAlignRight: false,
  isAlignJustify: false,
  isCode: false,
  isCodeBlock: false,
  isBlockquote: false,
  isMath: false,
}

// 1. Primitive atom for formatting snapshot
export const bubbleMenuFormattingAtom = atom<BubbleMenuFormattingState>(
  DEFAULT_BUBBLE_MENU_FORMATTING,
)

export const isBoldAtom = atom((get) => get(bubbleMenuFormattingAtom).isBold)

export const isItalicAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isItalic,
)

export const isStrikethroughAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isStrikethrough,
)

export const isBulletListAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isBulletList,
)

export const isOrderedListAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isOrderedList,
)

export const textTypeAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).textType,
)

export const isAlignLeftAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isAlignLeft,
)

export const isAlignCenterAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isAlignCenter,
)

export const isAlignRightAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isAlignRight,
)

export const isAlignJustifyAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isAlignJustify,
)

export const isCodeAtom = atom((get) => get(bubbleMenuFormattingAtom).isCode)

export const isCodeBlockAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isCodeBlock,
)

export const isBlockquoteAtom = atom(
  (get) => get(bubbleMenuFormattingAtom).isBlockquote,
)

export const isMathAtom = atom((get) => get(bubbleMenuFormattingAtom).isMath)
