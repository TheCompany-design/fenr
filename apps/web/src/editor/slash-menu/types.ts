import type { Editor, Range } from "@tiptap/react"
import type { EditorCapabilities } from "../core/types"

/** Icon objects from @hugeicons/core-free-icons share this shape. */
export type SlashMenuIcon = typeof import("@hugeicons/core-free-icons").TextIcon

export type SlashMenuGroupId = "basics" | "media" | "advanced"

export interface SlashMenuGroup {
  id: SlashMenuGroupId
  label: string
}

export interface SlashMenuCommandContext {
  editor: Editor
  range: Range
}

export interface SlashMenuItem {
  /** Stable identifier, unique across the registry */
  id: string
  label: string
  description: string
  icon: SlashMenuIcon
  group: SlashMenuGroupId
  /**
   * Capability keys that must not be explicitly disabled for this item to
   * appear. Absent capability flags mean enabled (opt-out model).
   */
  requires?: ReadonlyArray<keyof EditorCapabilities>
  /** Extra search terms matched against the typed query */
  keywords?: string[]
  /** Invoked with the suggestion range so the trigger text is removed */
  command: (context: SlashMenuCommandContext) => void
}
