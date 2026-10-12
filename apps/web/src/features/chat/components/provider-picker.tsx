/**
 * The provider picker in the chat header.
 *
 * A conversation runs on one of the workspace's saved providers, and this is
 * where it is chosen. The choice persists on the thread — sent with the next
 * message, stored by the runtime — so it survives the tab, another device, and
 * a suspension; the checkmark shows what the conversation is *actually* set to,
 * read from the record rather than from local state.
 *
 * What it deliberately is not: a place to manage the list. That is the settings
 * screen, linked at the bottom of the menu — a picker that grew add-forms and
 * delete buttons would be a settings page wearing a dropdown.
 */

import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { tenantProvidersQueryOptions } from "@/features/nabu/queries"
import { getThreadProviderFn } from "../chat.functions"

export interface ProviderPickerProps {
  /** The conversation this picker controls, when one exists. */
  readonly threadId?: string
  /** The chosen configuration, controlled by the container. */
  readonly value: string | null
  /** Called when the conversation's choice changes. */
  readonly onChange: (configId: string) => void
  /** Whether a turn is running: a mid-stream switch is a next-turn fact. */
  readonly disabled?: boolean
}

/**
 * The saved list, plus this conversation's current choice.
 *
 * The choice is read only for a conversation that exists; a clean chat has no
 * record yet, and its picker shows the workspace default until the first
 * message persists one.
 */
export function ProviderPicker({
  threadId,
  value,
  onChange,
  disabled,
}: ProviderPickerProps) {
  const navigate = useNavigate()
  const { data: saved } = useQuery(tenantProvidersQueryOptions())
  const { data: threadChoice } = useQuery({
    queryKey: ["chat", "thread-provider", threadId],
    queryFn: () =>
      getThreadProviderFn({ data: { threadId: threadId as string } }),
    enabled: Boolean(threadId),
    staleTime: 1000 * 30,
    retry: 1,
  })

  const providers = saved?.providers ?? []
  if (providers.length === 0) {
    // Nothing saved: turns cannot run at all, and the settings screen says so
    // in full. A disabled dropdown saying "no provider" is the shortest honest
    // pointer there.
    return (
      <button
        type="button"
        onClick={() => void navigate({ to: "/settings/provider" })}
        className="max-w-56 cursor-pointer truncate rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
        title="No model provider is configured yet — add one in settings"
      >
        No model provider configured
      </button>
    )
  }

  // The effective choice: this conversation's own, else the workspace default,
  // else the first saved entry — which is what the runtime resolves to anyway,
  // so the picker never shows a selection that lies about the billing.
  const defaultEntry =
    providers.find((provider) => provider.is_default) ?? providers[0]
  const currentId = value ?? threadChoice ?? defaultEntry.id
  const current = providers.find((provider) => provider.id === currentId)

  return (
    <Select
      value={currentId}
      onValueChange={(next) => {
        if (next && next !== currentId) {
          onChange(next)
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Model provider for this conversation"
        className="max-w-56 cursor-pointer gap-1.5 text-xs font-medium"
      >
        <SelectValue>
          <span className="truncate">
            {current
              ? `${current.model} · ${current.label ?? providerDisplayName(current.provider)}`
              : "Pick a provider"}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {providers.map((provider) => (
          <SelectItem key={provider.id} value={provider.id}>
            <span className="flex items-center gap-2">
              <span className="truncate">
                {provider.model}
                <span className="text-muted-foreground">
                  {" "}
                  · {provider.label ?? providerDisplayName(provider.provider)}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
        <div className="my-1 h-px bg-border" role="presentation" />
        <button
          type="button"
          onClick={() => void navigate({ to: "/settings/provider" })}
          className="w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          Manage saved providers…
        </button>
      </SelectContent>
    </Select>
  )
}

/**
 * The vendor's name as a person reads it, for an entry without its own label.
 *
 * Tolerant on purpose: a runtime that learns a fifth vendor before this build
 * does still renders, naming the vendor it knows and this build does not.
 */
function providerDisplayName(provider: string): string {
  switch (provider) {
    case "openai":
      return "OpenAI"
    case "openrouter":
      return "OpenRouter"
    case "anthropic":
      return "Anthropic"
    case "google":
      return "Google Gemini"
    default:
      return provider
  }
}
