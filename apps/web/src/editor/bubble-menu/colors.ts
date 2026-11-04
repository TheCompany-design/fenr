/**
 * Content color palettes, Notion-style.
 *
 * These are DOCUMENT DATA (mark attribute values persisted in the document
 * JSON), not UI chrome — they are intentionally absolute colors so authored
 * documents render identically in light and dark mode, and they never feed
 * component styling.
 */

export interface ColorSwatch {
  /** Human label announced to screen readers and shown in tooltips */
  label: string
  /** Mark value; null resets to the inherited default */
  value: string | null
}

export const TEXT_COLOR_SWATCHES: ColorSwatch[] = [
  { label: "Default", value: null },
  { label: "Gray", value: "#787774" },
  { label: "Brown", value: "#9F6B53" },
  { label: "Orange", value: "#CB712F" },
  { label: "Yellow", value: "#D3A82E" },
  { label: "Green", value: "#448361" },
  { label: "Blue", value: "#337EA9" },
  { label: "Purple", value: "#9065B0" },
  { label: "Pink", value: "#C14C8A" },
  { label: "Red", value: "#D44C47" },
]

export const HIGHLIGHT_COLOR_SWATCHES: ColorSwatch[] = [
  { label: "Default", value: null },
  { label: "Gray", value: "#F1F1EF" },
  { label: "Brown", value: "#F4EEEE" },
  { label: "Orange", value: "#FAEBDD" },
  { label: "Yellow", value: "#FBF3DB" },
  { label: "Green", value: "#EDF3EC" },
  { label: "Blue", value: "#E7F3F8" },
  { label: "Purple", value: "#F6F3F9" },
  { label: "Pink", value: "#FAF1F5" },
  { label: "Red", value: "#FDEBEC" },
]
