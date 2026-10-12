import type { SuggestionItem, TriggerSource } from "../primitives/suggestion"
import { usePromptStore } from "../state/prompt-store"

/**
 * The `/` menu.
 *
 * Commands are assembled from live capability state rather than a static list,
 * so `/effort` only appears when the selected model actually has reasoning to
 * configure. A menu that offers an action the current model cannot perform is
 * worse than no menu — it teaches the user that some of these silently do
 * nothing.
 */

type CommandDefinition = {
  id: string
  label: string
  hint: string
  keywords?: string
  /** Hidden unless this returns true. */
  available?: (state: ReturnType<typeof usePromptStore.getState>) => boolean
}

const COMMANDS: CommandDefinition[] = [
  {
    id: "model",
    label: "/model",
    hint: "Switch provider or model",
    keywords: "switch pick change llm",
  },
  {
    id: "provider",
    label: "/provider",
    hint: "Manage saved providers",
    keywords: "connect key byok settings",
  },
  {
    id: "effort",
    label: "/effort",
    hint: "Set reasoning effort",
    keywords: "thinking think reason",
    available: (state) => state.caps.reasoning.capability !== null,
  },
  {
    id: "tools",
    label: "/tools",
    hint: "Choose which tools are enabled",
    keywords: "functions abilities",
  },
  {
    id: "search",
    label: "/search",
    hint: "Toggle web search",
    keywords: "browse internet",
    available: (state) => state.caps.search.access.kind === "available",
  },
  {
    id: "attach",
    label: "/attach",
    hint: "Add files to context",
    keywords: "file upload image",
  },
  {
    id: "clear",
    label: "/clear",
    hint: "Clear the composer",
    keywords: "reset empty wipe",
  },
]

export type CommandAction =
  | { kind: "open-model-picker" }
  | { kind: "open-provider-picker" }
  | { kind: "open-effort" }
  | { kind: "open-tools" }
  | { kind: "toggle-search" }
  | { kind: "open-files" }
  | { kind: "clear" }

const ACTIONS: Record<string, CommandAction> = {
  model: { kind: "open-model-picker" },
  provider: { kind: "open-provider-picker" },
  effort: { kind: "open-effort" },
  tools: { kind: "open-tools" },
  search: { kind: "toggle-search" },
  attach: { kind: "open-files" },
  clear: { kind: "clear" },
}

export function commandItems(): SuggestionItem[] {
  const state = usePromptStore.getState()
  return COMMANDS.filter((command) => command.available?.(state) ?? true).map(
    (command) => ({
      id: `command:${command.id}`,
      insertText: command.label,
      label: command.label,
      hint: command.hint,
      keywords: command.keywords,
    }),
  )
}

export function commandSource(): TriggerSource {
  return () => commandItems()
}

export function actionForCommandId(id: string): CommandAction | null {
  return ACTIONS[id.replace(/^command:/, "")] ?? null
}

/**
 * The `@` menu.
 *
 * Built from what is actually in context — staged attachments plus whatever
 * the caller exposes as referenceable — rather than from the filesystem. A
 * mention that resolves to a real, already-attached item is what makes `@`
 * feel trustworthy; one that guesses at paths the user cannot see does not.
 */

export type ReferenceableItem = {
  id: string
  label: string
  hint?: string
  insertText: string
  icon?: React.ReactNode
}

let extraReferences: ReferenceableItem[] = []

/** Lets a host app add workspace files, URLs, or agents to the `@` menu. */
export function setReferenceableItems(items: ReferenceableItem[]): void {
  extraReferences = items
}

export function referenceItems(): SuggestionItem[] {
  const state = usePromptStore.getState()
  const fromAttachments: SuggestionItem[] = state.attachments.map(
    (attachment) => ({
      id: `ref:${attachment.id}`,
      insertText: `@${attachment.name}`,
      label: attachment.name,
      hint: formatBytes(attachment.size),
    }),
  )
  return [...fromAttachments, ...extraReferences]
}

export function referenceSource(): TriggerSource {
  return () => referenceItems()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
