import { AiBrain01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

export interface ThinkingTraceProps {
  readonly thinking: string
  readonly isStreaming?: boolean
  readonly defaultExpanded?: boolean
}

/**
 * Expandable agent thinking/reasoning trace adapted from Beautiful UI.
 * Features a hairline connector, stateful disclosure, and responsive typography.
 */
export function ThinkingTrace({
  thinking,
  isStreaming = false,
  defaultExpanded = true,
}: ThinkingTraceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!thinking && !isStreaming) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-1 py-1">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="group -ml-1 flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HugeiconsIcon
          icon={AiBrain01Icon}
          size={14}
          className={
            isStreaming ? "animate-pulse text-primary" : "text-muted-foreground"
          }
        />
        <span>{isStreaming ? "Thinking..." : "Thought process"}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={12}
          className={`text-muted-foreground/70 transition-transform duration-200 group-hover:text-foreground ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="relative ml-2 border-l border-border pl-3 pt-0.5 text-xs leading-relaxed text-muted-foreground">
          <p className="whitespace-pre-wrap font-sans text-[12.5px] text-muted-foreground/90">
            {thinking || (isStreaming ? "Synthesizing request..." : "")}
          </p>
        </div>
      )}
    </div>
  )
}
