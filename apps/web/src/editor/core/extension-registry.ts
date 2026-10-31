import {
  Details,
  DetailsContent,
  DetailsSummary,
} from "@tiptap/extension-details"
import { Highlight } from "@tiptap/extension-highlight"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Mathematics } from "@tiptap/extension-mathematics"
import { TableKit } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyleKit } from "@tiptap/extension-text-style"
import { Youtube } from "@tiptap/extension-youtube"
import { CharacterCount, Placeholder } from "@tiptap/extensions"
import type { AnyExtension } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { createImageUploadExtension } from "../images/image-upload"
import { Callout } from "../nodes/callout"
import { FenrCodeBlock } from "../nodes/code-block"
import { createSlashMenuExtension } from "../slash-menu/slash-menu-extension"
import type { EditorCapabilities } from "./types"

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
  /** Upload contract handed to image insert flows (slash, paste, drop) */
  uploadImage?: import("../images/image-upload").ImageUploadHandler
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
  uploadImage,
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
    extensions.push(createImageUploadExtension(uploadImage))
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
    extensions.push(FenrCodeBlock)
  }

  if (capabilities.placeholder !== false) {
    extensions.push(
      Placeholder.configure({
        placeholder: ({ editor, node }) =>
          resolvePlaceholderText(node, editor?.isEmpty ?? false),
      }),
    )
  }

  if (capabilities.characterCount !== false) {
    extensions.push(CharacterCount)
  }

  if (capabilities.callouts !== false) {
    extensions.push(Callout)
  }

  if (capabilities.toggles !== false) {
    extensions.push(Details, DetailsSummary, DetailsContent)
  }

  if (capabilities.slashMenu !== false) {
    extensions.push(createSlashMenuExtension(capabilities, uploadImage))
  }

  extensions.push(...extraExtensions)

  return extensions
}
