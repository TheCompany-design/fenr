import {
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Image01Icon,
  Layers01Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  QuoteUpIcon,
  SourceCodeIcon,
  StickyNoteIcon,
  Summation01Icon,
  TableIcon,
  Task01Icon,
  TextIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import type { EditorCapabilities } from "../core/types"
import {
  type ImageUploadHandler,
  uploadAndInsertImage,
} from "../images/image-upload"
import type { SlashMenuGroup, SlashMenuItem } from "./types"

export const SLASH_MENU_GROUPS: SlashMenuGroup[] = [
  { id: "basics", label: "Basic blocks" },
  { id: "media", label: "Media" },
  { id: "advanced", label: "Advanced" },
]

const GROUP_RANK: Record<SlashMenuGroup["id"], number> = {
  basics: 0,
  media: 1,
  advanced: 2,
}

/**
 * Opens a file picker and routes the selection through the upload contract
 * (or a session object URL when no contract is wired).
 */
function pickAndInsertImage(
  upload?: ImageUploadHandler,
): SlashMenuItem["command"] {
  return ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()

    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void uploadAndInsertImage(editor, null, file, upload)
    }
    input.click()
  }
}

/**
 * Builds the slash command registry. Items that need the definition's
 * upload contract (images) close over it here.
 */
export function buildSlashMenuItems(
  options: { uploadImage?: ImageUploadHandler } = {},
): SlashMenuItem[] {
  return [
    {
      id: "text",
      label: "Text",
      description: "Plain paragraph text",
      icon: TextIcon,
      group: "basics",
      keywords: ["paragraph", "p", "body", "plain"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .setParagraph()
          .run()
      },
    },
    {
      id: "heading-1",
      label: "Heading 1",
      description: "Large section heading",
      icon: Heading01Icon,
      group: "basics",
      keywords: ["h1", "title"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .setHeading({ level: 1 })
          .run()
      },
    },
    {
      id: "heading-2",
      label: "Heading 2",
      description: "Medium section heading",
      icon: Heading02Icon,
      group: "basics",
      keywords: ["h2", "subtitle"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .setHeading({ level: 2 })
          .run()
      },
    },
    {
      id: "heading-3",
      label: "Heading 3",
      description: "Small section heading",
      icon: Heading03Icon,
      group: "basics",
      keywords: ["h3"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .setHeading({ level: 3 })
          .run()
      },
    },
    {
      id: "bullet-list",
      label: "Bullet list",
      description: "Unordered list of items",
      icon: LeftToRightListBulletIcon,
      group: "basics",
      keywords: ["unordered", "ul", "list"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .toggleBulletList()
          .run()
      },
    },
    {
      id: "numbered-list",
      label: "Numbered list",
      description: "Ordered list of items",
      icon: LeftToRightListNumberIcon,
      group: "basics",
      keywords: ["ordered", "ol", "list"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .toggleOrderedList()
          .run()
      },
    },
    {
      id: "to-do-list",
      label: "To-do list",
      description: "Checklist with toggling checkboxes",
      icon: Task01Icon,
      group: "basics",
      keywords: ["task", "todo", "checklist", "checkbox"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .toggleTaskList()
          .run()
      },
    },
    {
      id: "quote",
      label: "Quote",
      description: "Captured excerpt with attribution room",
      icon: QuoteUpIcon,
      group: "basics",
      keywords: ["blockquote", "cite"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .toggleBlockquote()
          .run()
      },
    },
    {
      id: "code-block",
      label: "Code block",
      description: "Syntax-highlighted code with language picker",
      icon: SourceCodeIcon,
      group: "basics",
      keywords: ["code", "snippet", "pre", "programming"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .toggleCodeBlock()
          .run()
      },
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal rule separating sections",
      icon: MinusSignIcon,
      group: "basics",
      keywords: ["hr", "horizontal rule", "separator", "line"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      id: "image",
      label: "Image",
      description: "Upload an image from this device",
      icon: Image01Icon,
      group: "media",
      requires: ["images"],
      keywords: ["picture", "photo", "upload", "attachment"],
      command: pickAndInsertImage(options.uploadImage),
    },
    {
      id: "youtube",
      label: "YouTube embed",
      description: "Paste a YouTube link to embed it",
      icon: YoutubeIcon,
      group: "media",
      requires: ["embeds"],
      keywords: ["video", "embed", "youtube", "watch"],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        toast.info("Paste a YouTube link to embed it")
      },
    },
    {
      id: "callout",
      label: "Callout",
      description: "Tinted note with a pickable emoji",
      icon: StickyNoteIcon,
      group: "advanced",
      requires: ["callouts"],
      keywords: ["note", "info", "warning", "aside"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .setCallout()
          .run()
      },
    },
    {
      id: "toggle",
      label: "Toggle block",
      description: "Collapsible section with a summary line",
      icon: Layers01Icon,
      group: "advanced",
      requires: ["toggles"],
      keywords: ["details", "collapse", "accordion", "summary"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .clearNodes()
          .insertContent({
            type: "details",
            content: [
              {
                type: "detailsSummary",
                content: [{ type: "text", text: "Toggle" }],
              },
              { type: "detailsContent", content: [{ type: "paragraph" }] },
            ],
          })
          .run()
      },
    },
    {
      id: "table",
      label: "Table",
      description: "Resizable grid with a header row",
      icon: TableIcon,
      group: "advanced",
      requires: ["tables"],
      keywords: ["grid", "spreadsheet", "rows", "columns"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run()
      },
    },
    {
      id: "math-block",
      label: "Math equation",
      description: "LaTeX equation rendered with KaTeX",
      icon: Summation01Icon,
      group: "advanced",
      requires: ["mathematics"],
      keywords: ["equation", "latex", "formula", "katex"],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertBlockMath({ latex: "" })
          .run()
      },
    },
  ]
}

/** Default item set without an upload contract (object-URL fallback). */
export const SLASH_MENU_ITEMS: SlashMenuItem[] = buildSlashMenuItems()

/** Items visible under the given capability flags, in registry order. */
export function resolveSlashMenuItems(
  items: SlashMenuItem[],
  capabilities: EditorCapabilities,
): SlashMenuItem[] {
  return items.filter((item) =>
    (item.requires ?? []).every((key) => capabilities[key] !== false),
  )
}

/** Match items against the query typed after the slash trigger. */
export function filterSlashMenuItems(
  items: SlashMenuItem[],
  query: string,
): SlashMenuItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.description.toLowerCase().includes(needle) ||
      (item.keywords ?? []).some((keyword) => keyword.includes(needle)),
  )
}

export interface SlashMenuSection {
  group: SlashMenuGroup
  items: SlashMenuItem[]
}

/** Group items for display, skipping empty groups, in canonical order. */
export function groupSlashMenuItems(
  items: SlashMenuItem[],
): SlashMenuSection[] {
  return SLASH_MENU_GROUPS.map((group) => ({
    group,
    items: items
      .filter((item) => item.group === group.id)
      .sort(
        (a, b) =>
          GROUP_RANK[a.group] - GROUP_RANK[b.group] ||
          SLASH_MENU_ITEMS.indexOf(a) - SLASH_MENU_ITEMS.indexOf(b),
      ),
  })).filter((section) => section.items.length > 0)
}
