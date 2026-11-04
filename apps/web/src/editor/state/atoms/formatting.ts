import { atom } from "jotai"

export type TextType = "text" | "heading-1" | "heading-2" | "heading-3"

export interface FormattingState {
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
  /** Active highlight mark color, null when no highlight is set */
  highlightColor: string | null
  /** Active text style color, null when inherited */
  textColor: string | null
}

export const DEFAULT_FORMATTING_STATE: FormattingState = {
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
  highlightColor: null,
  textColor: null,
}

export const formattingAtom = atom<FormattingState>(DEFAULT_FORMATTING_STATE)

export const isBoldAtom = atom((get) => get(formattingAtom).isBold)
export const isItalicAtom = atom((get) => get(formattingAtom).isItalic)
export const isStrikethroughAtom = atom(
  (get) => get(formattingAtom).isStrikethrough,
)
export const isBulletListAtom = atom((get) => get(formattingAtom).isBulletList)
export const isOrderedListAtom = atom(
  (get) => get(formattingAtom).isOrderedList,
)
export const textTypeAtom = atom((get) => get(formattingAtom).textType)
export const isAlignLeftAtom = atom((get) => get(formattingAtom).isAlignLeft)
export const isAlignCenterAtom = atom(
  (get) => get(formattingAtom).isAlignCenter,
)
export const isAlignRightAtom = atom((get) => get(formattingAtom).isAlignRight)
export const isAlignJustifyAtom = atom(
  (get) => get(formattingAtom).isAlignJustify,
)
export const isCodeAtom = atom((get) => get(formattingAtom).isCode)
export const isCodeBlockAtom = atom((get) => get(formattingAtom).isCodeBlock)
export const isBlockquoteAtom = atom((get) => get(formattingAtom).isBlockquote)
export const isMathAtom = atom((get) => get(formattingAtom).isMath)
export const highlightColorAtom = atom(
  (get) => get(formattingAtom).highlightColor,
)
export const textColorAtom = atom((get) => get(formattingAtom).textColor)

export type BubbleMenuFormattingState = FormattingState
export const DEFAULT_BUBBLE_MENU_FORMATTING = DEFAULT_FORMATTING_STATE
export const bubbleMenuFormattingAtom = formattingAtom
