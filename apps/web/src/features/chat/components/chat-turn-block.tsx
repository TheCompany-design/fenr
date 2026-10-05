import { CheckmarkCircle02Icon, Copy01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useAtom } from "jotai"
import { toast } from "sonner"
import { copiedMessageIdAtom } from "../state/chat-atoms"
import { type ChatTurn, turnText, turnThinking } from "../state/chat-turns"
import { ThinkingTrace } from "./thinking-trace"

export interface ChatTurnBlockProps {
  readonly turn: ChatTurn
}

/**
 * One reply, however many model steps it took to produce.
 *
 * A turn that calls a tool yields one message per step. Rendering those as
 * separate bubbles gave a single answer a separate avatar, name and timestamp
 * each, so one reply read as several — the reader was shown the plumbing
 * between the model's steps and nothing said what was actually one turn.
 *
 * The steps are kept here rather than collapsed: the reasoning is one trace
 * with its steps apart, and the answer is the steps that produced text.
 */
export function ChatTurnBlock({ turn }: ChatTurnBlockProps) {
  const [copiedId, setCopiedId] = useAtom(copiedMessageIdAtom)
  const isUser = turn.isUser

  if (isUser) {
    // A person's messages are their own: the grouping only ever joins agent
    // steps, so a user turn is a single message in practice.
    const message = turn.messages[0]
    if (!message) return null

    return (
      <div className="flex w-full justify-end px-2 py-1.5">
        <div className="flex max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-2xl bg-muted px-4 py-2.5 text-[13px] leading-relaxed text-foreground shadow-xs">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  const thinking = turnThinking(turn.messages)
  const text = turnText(turn.messages)
  // The turn started when its first step did.
  const startedAt = turn.messages.find(
    (message) => message.createdAt,
  )?.createdAt
  const lastMessage = turn.messages.at(-1)
  const isCopied = lastMessage ? copiedId === lastMessage.id : false

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      if (lastMessage) {
        setCopiedId(lastMessage.id)
      }
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy message")
    }
  }

  return (
    <div className="flex w-full justify-start px-2 py-2">
      <div className="flex w-full max-w-[95%] flex-col sm:max-w-[90%]">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Nabu Agent</span>
            {startedAt && (
              <span className="text-[11px] opacity-70">{startedAt}</span>
            )}
          </div>

          {thinking && (
            <ThinkingTrace
              thinking={thinking}
              isStreaming={turn.isStreaming && !text}
            />
          )}

          {text && (
            <div className="text-[13px] leading-relaxed text-foreground">
              <p className="whitespace-pre-wrap">
                {text}
                {turn.isStreaming && (
                  <span
                    aria-hidden
                    className="ml-1 inline-block h-3.5 w-1 translate-y-0.5 rounded-full bg-foreground animate-pulse"
                  />
                )}
              </p>
            </div>
          )}

          {text && !turn.isStreaming && (
            <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                aria-label={isCopied ? "Copied" : "Copy response"}
                onClick={handleCopy}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={isCopied ? CheckmarkCircle02Icon : Copy01Icon}
                  size={13}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
