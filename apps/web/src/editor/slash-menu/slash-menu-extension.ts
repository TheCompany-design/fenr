import { PluginKey } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import { Extension, ReactRenderer } from "@tiptap/react"
import {
  Suggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion"
import type { EditorCapabilities } from "../core/types"
import {
  buildSlashMenuItems,
  filterSlashMenuItems,
  resolveSlashMenuItems,
} from "./slash-menu-items"
import {
  SlashMenuPopup,
  type SlashMenuPopupHandle,
  type SlashMenuPopupProps,
} from "./slash-menu-popup"
import type { SlashMenuItem } from "./types"

export const SLASH_MENU_PLUGIN_KEY = new PluginKey("slashMenu")

function isTextEntrySurface(editor: Editor): boolean {
  return (
    editor.isEditable &&
    !editor.isActive("codeBlock") &&
    !editor.isActive("code") &&
    !editor.isActive("blockMath") &&
    !editor.isActive("inlineMath")
  )
}

/**
 * Builds the `/` command-menu extension for the given capability flags.
 * Uses @tiptap/suggestion's managed mounting: the popup element is anchored
 * to the cursor and repositioned on scroll/resize by the plugin itself, and
 * Escape dismissal is handled by the plugin.
 */
export function createSlashMenuExtension(
  capabilities: EditorCapabilities,
  uploadImage?: import("../images/image-upload").ImageUploadHandler,
): Extension {
  const items = resolveSlashMenuItems(
    buildSlashMenuItems({ uploadImage }),
    capabilities,
  )

  return Extension.create({
    name: "slashMenu",

    addProseMirrorPlugins() {
      let renderer: ReactRenderer<SlashMenuPopupHandle> | null = null
      let unmountPopup: (() => void) | null = null

      const teardown = () => {
        unmountPopup?.()
        unmountPopup = null
        renderer?.destroy()
        renderer = null
      }

      const toPopupProps = (
        props: SuggestionProps<SlashMenuItem>,
      ): SlashMenuPopupProps => ({
        items: props.items,
        command: props.command,
        query: props.query,
      })

      return [
        Suggestion<SlashMenuItem>({
          editor: this.editor,
          pluginKey: SLASH_MENU_PLUGIN_KEY,
          char: "/",
          startOfLine: false,
          allow: ({ editor }) => isTextEntrySurface(editor),
          items: ({ query }) => filterSlashMenuItems(items, query),
          command: ({ editor, range, props: item }) =>
            item.command({ editor, range }),
          render: () => ({
            onStart: (props) => {
              renderer = new ReactRenderer<
                SlashMenuPopupHandle,
                SlashMenuPopupProps
              >(SlashMenuPopup, {
                editor: props.editor,
                props: toPopupProps(props),
              })
              unmountPopup = props.mount(renderer.element)
            },
            onUpdate: (props) => {
              renderer?.updateProps(toPopupProps(props))
            },
            onKeyDown: (props: SuggestionKeyDownProps): boolean =>
              Boolean(renderer?.ref?.onKeyDown(props.event)),
            onExit: () => teardown(),
          }),
        }),
      ]
    },
  })
}
