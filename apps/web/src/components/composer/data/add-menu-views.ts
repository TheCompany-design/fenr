import {
  Attachment01Icon,
  CommandIcon,
  DatabaseIcon,
  EarthIcon,
  Folder01Icon,
  GlobeIcon,
  Mortarboard01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import {
  type FileKind,
  isUsable,
  type NativeToolKind,
  type ResolvedCaps,
  type ToolKind,
} from "../catalog/capabilities"
import { formatMb } from "../catalog/reconcile"

type RuntimeToolView = {
  id: string
  label: string
  hint?: string
}

type ToolDef = {
  id: string
  label: string
  hint: string
  icon: IconSvgElement
}

const LOCAL_TOOLS: ToolDef[] = [
  {
    id: "shell:Bash",
    label: "Run commands",
    hint: "Execute shell commands",
    icon: CommandIcon,
  },
  {
    id: "fs_read:Read",
    label: "Read files",
    hint: "Read from the workspace",
    icon: Folder01Icon,
  },
  {
    id: "fs_write:Write",
    label: "Write files",
    hint: "Create and edit files",
    icon: Wrench01Icon,
  },
  {
    id: "http:Fetch",
    label: "Fetch URL",
    hint: "Make HTTP requests",
    icon: GlobeIcon,
  },
  {
    id: "db:Query",
    label: "Query database",
    hint: "Run SQL against connected sources",
    icon: DatabaseIcon,
  },
]

const NATIVE_LABELS: Record<
  NativeToolKind,
  { label: string; hint: string; icon: IconSvgElement }
> = {
  web_search: {
    label: "Web search",
    hint: "Run by the provider",
    icon: EarthIcon,
  },
  code_interpreter: {
    label: "Code interpreter",
    hint: "Run by the provider",
    icon: Mortarboard01Icon,
  },
  computer_use: {
    label: "Computer use",
    hint: "Run by the provider",
    icon: CommandIcon,
  },
  file_search: {
    label: "File search",
    hint: "Run by the provider",
    icon: Folder01Icon,
  },
}

const FILE_KIND_LABELS: Record<FileKind, string> = {
  image: "Images",
  pdf: "PDFs",
  text: "Text",
  audio: "Audio",
  video: "Video",
  archive: "Archives",
}

export const ATTACH_FILES_ID = "files"

export type AddMenuItem = {
  id: string
  label: string
  hint?: string
  icon: IconSvgElement
} & (
  | { kind: "action" }
  | { kind: "toggle"; checked: boolean }
  | { kind: "fact" }
)

export type AddMenuSection = {
  id: string

  label: string | null
  items: AddMenuItem[]
}

export type AddMenuView = {
  sections: AddMenuSection[]

  enabledCount: number

  nativeLocked: boolean
}

export function buildAddMenuView(input: {
  caps: ResolvedCaps
  toolIds: readonly string[]
  search: boolean
  runtimeTools: readonly RuntimeToolView[]
}): AddMenuView {
  const { caps } = input
  const sections: AddMenuSection[] = []

  sections.push({
    id: "files",
    label: "Add",
    items: [
      {
        id: ATTACH_FILES_ID,
        kind: "action",
        label: "Files",
        hint: fileHint(caps),
        icon: Attachment01Icon,
      },
    ],
  })

  if (caps.search.capability !== null) {
    sections.push({
      id: "search",
      label: null,
      items: [
        {
          id: "search",
          kind: "toggle",
          label: "Web search",
          hint:
            caps.search.access.kind === "gated"
              ? "Needs a connected key"
              : "Let the model search the web",
          icon: EarthIcon,
          checked: input.search,
        },
      ],
    })
  }

  const nativeKinds = caps.native.capability?.kinds ?? []
  if (nativeKinds.length > 0) {
    sections.push({
      id: "provider-tools",
      label: "Run by the provider",
      items: nativeKinds.map((kind) => ({
        id: `native:${kind}`,
        kind: "fact" as const,
        ...NATIVE_LABELS[kind],
      })),
    })
  }

  if (input.runtimeTools.length > 0) {
    sections.push({
      id: "runtime-tools",
      label: "Managed by the agent runtime",
      items: input.runtimeTools.map((tool) => ({
        id: `runtime:${tool.id}`,
        kind: "fact" as const,
        label: tool.label,
        hint: tool.hint,
        icon: Wrench01Icon,
      })),
    })
  }

  const supportedKinds = isUsable(caps.tools)
    ? (caps.tools.capability.kinds as readonly ToolKind[])
    : []
  const available = LOCAL_TOOLS.filter((tool) =>
    supportedKinds.includes(toolIdKind(tool.id)),
  )
  if (available.length > 0) {
    sections.push({
      id: "tools",
      label: "Your tools",
      items: available.map((tool) => ({
        id: tool.id,
        kind: "toggle" as const,
        label: tool.label,
        hint: tool.hint,
        icon: tool.icon,
        checked: input.toolIds.includes(tool.id),
      })),
    })
  }

  // The ceiling, but only when there is one. A model that supports no tools at
  // all is not better served by five rows announcing exactly that; it is better
  // served by the section being absent.
  const unavailable = LOCAL_TOOLS.filter(
    (tool) => !supportedKinds.includes(toolIdKind(tool.id)),
  )
  if (available.length > 0 && unavailable.length > 0) {
    sections.push({
      id: "unsupported",
      label: "Not supported by this model",
      items: unavailable.map((tool) => ({
        id: `unsupported:${tool.id}`,
        kind: "fact" as const,
        label: tool.label,
        icon: tool.icon,
      })),
    })
  }

  return {
    sections,
    enabledCount: input.toolIds.length + (input.search ? 1 : 0),
    nativeLocked: caps.native.access.kind === "gated",
  }
}

function toolIdKind(toolId: string): ToolKind {
  return toolId.split(":")[0] as ToolKind
}

/**
 * What this model will accept, in the words its own capability record uses.
 *
 * Nothing is said when the model takes no files at all: a hint is only honest
 * when there is something true to hint at.
 */
function fileHint(caps: ResolvedCaps): string | undefined {
  if (!isUsable(caps.files)) return undefined
  const { kinds, maxFiles, maxSizeMb } = caps.files.capability
  const named = kinds.map((kind) => FILE_KIND_LABELS[kind] ?? kind).join(", ")
  if (!named) return undefined
  return `${named} up to ${formatMb(maxSizeMb)} · ${maxFiles} per message`
}
