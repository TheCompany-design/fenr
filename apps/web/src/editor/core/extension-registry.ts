import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { Highlight } from "@tiptap/extension-highlight"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Mathematics } from "@tiptap/extension-mathematics"
import { TableKit } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyleKit } from "@tiptap/extension-text-style"
import { Youtube } from "@tiptap/extension-youtube"
import { Placeholder } from "@tiptap/extensions"
import type { AnyExtension } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { common, createLowlight } from "lowlight"
import { createSlashMenuExtension } from "../slash-menu/slash-menu-extension"
import type { EditorCapabilities } from "./types"

/**
 * Shared lowlight instance backing every code block. `lowlight` keeps a
 * language registry only — it holds no per-document state, so a single
 * instance is safely shared across concurrent editors.
 */
const sharedLowlight = createLowlight(common)

export interface AssembleExtensionsOptions {
  /**
   * Resolved capability flags for the editor instance. Absent flags mean
   * enabled (opt-out model — see {@link EditorCapabilities}).
   */
  capabilities: EditorCapabilities
  /**
   * Extensions supplied by the {@link DocumentDefinition}; always appended
   * last so a definition can layer extra nodes and marks on top of the
   * capability-driven baseline.
   */
  extraExtensions?: AnyExtension[]
}

/**
 * Ghost prompts for the active empty block, Notion-style. Only the focused
 * empty node shows a prompt, and headings name themselves so an empty
 * outline is still readable.
 */
export function resolvePlaceholderText(
  node: { type: { name: string }; attrs: Record<string, unknown> },
  editorIsEmpty: boolean,
): string {
  if (node.type.name === "heading") {
    const level = node.attrs.level
    return typeof level === "number" ? `Heading ${level}` : "Heading"
  }
  return editorIsEmpty
    ? "Write, press '/' for commands…"
    : "Type '/' for commands"
}

/**
 * Pure capability → extension assembler for the document engine. This is the
 * single place where a capability flag is translated into concrete TipTap
 * extensions, keeping `useDocumentEditor` a thin React binding and letting
 * any future surface (email composer, comments, proposal builder) reuse the
 * same baseline by passing a different `DocumentDefinition`.
 */
export function assembleExtensions({
  capabilities,
  extraExtensions = [],
}: AssembleExtensionsOptions): AnyExtension[] {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      // The lowlight variant below replaces StarterKit's plain code block,
      // so the built-in one must be suppressed when code blocks are enabled.
      ...(capabilities.codeBlocks === false
        ? {}
        : { codeBlock: false as const }),
      // Links are edited through the inline link popover; clicking a link
      // must not navigate away mid-edit. Rendered anchors open safely.
      link: {
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      },
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
  ]

  if (capabilities.taskLists !== false) {
    // StarterKit's list kit ships bullet/ordered lists only — task lists are
    // opt-in members of @tiptap/extension-list.
    extensions.push(TaskList, TaskItem)
  }

  if (capabilities.mathematics !== false) {
    extensions.push(Mathematics)
  }

  if (capabilities.tables !== false) {
    extensions.push(TableKit.configure({ table: { resizable: true } }))
  }

  if (capabilities.images !== false) {
    extensions.push(
      Image.configure({
        allowBase64: true,
      }),
    )
  }

  if (capabilities.embeds !== false) {
    extensions.push(
      Youtube.configure({
        nocookie: true,
        controls: true,
        allowFullscreen: true,
      }),
    )
  }

  if (capabilities.highlights !== false) {
    extensions.push(Highlight.configure({ multicolor: true }))
  }

  if (capabilities.textColors !== false) {
    extensions.push(
      TextStyleKit.configure({
        backgroundColor: false,
        fontFamily: false,
        fontSize: false,
        lineHeight: false,
      }),
    )
  }

  if (capabilities.codeBlocks !== false) {
    extensions.push(
      CodeBlockLowlight.configure({
        lowlight: sharedLowlight,
        defaultLanguage: "plaintext",
      }),
    )
  }

  if (capabilities.placeholder !== false) {
    extensions.push(
      Placeholder.configure({
        placeholder: ({ editor, node }) =>
          resolvePlaceholderText(node, editor?.isEmpty ?? false),
      }),
    )
  }

  if (capabilities.slashMenu !== false) {
    extensions.push(createSlashMenuExtension(capabilities))
  }

  extensions.push(...extraExtensions)

  return extensions
}
