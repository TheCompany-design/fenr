import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { useState } from "react"

/** Curated set offered by the callout emoji picker. */
export const CALLOUT_EMOJIS = [
  "💡",
  "📌",
  "📝",
  "⚠️",
  "✅",
  "🔥",
  "❗",
  "ℹ️",
  "🎯",
  "🚀",
  "📖",
  "❓",
] as const

export interface CalloutViewProps {
  node: {
    attrs: { emoji?: string }
  }
  updateAttributes: (attributes: Record<string, unknown>) => void
  selected?: boolean
}

/**
 * NodeView for the callout block: a pickable emoji chip beside the editable
 * body. Rendered inside the editor's React tree, so workspace UI primitives
 * and tokens apply.
 */
export function CalloutView({
  node,
  updateAttributes,
  selected,
}: CalloutViewProps) {
  const [open, setOpen] = useState(false)
  const emoji = typeof node.attrs.emoji === "string" ? node.attrs.emoji : "💡"

  return (
    <NodeViewWrapper
      data-callout=""
      className={cn(
        "my-3 flex gap-2.5 rounded-lg border border-border/50 bg-muted/40 p-3",
        selected && "ring-2 ring-ring/40",
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              contentEditable={false}
              aria-label="Change callout emoji"
              onClick={(event) => {
                event.preventDefault()
                setOpen((value) => !value)
              }}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-lg transition-colors hover:bg-background/70 outline-none"
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          }
        />
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-auto p-1.5"
        >
          <div
            className="grid grid-cols-6 gap-0.5"
            role="listbox"
            aria-label="Callout emoji"
          >
            {CALLOUT_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === emoji}
                aria-label={`Emoji ${option}`}
                onClick={(event) => {
                  event.preventDefault()
                  updateAttributes({ emoji: option })
                  setOpen(false)
                }}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-md text-lg transition-colors hover:bg-accent outline-none",
                  option === emoji && "bg-accent",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <NodeViewContent className="min-w-0 flex-1" />
    </NodeViewWrapper>
  )
}
