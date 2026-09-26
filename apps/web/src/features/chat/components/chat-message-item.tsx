import {
  AiChat02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useAtom } from "jotai"
import { toast } from "sonner"
import { copiedMessageIdAtom } from "../state/chat-atoms"
import type { ChatMessage } from "../types"
import { ThinkingTrace } from "./thinking-trace"

export interface ChatMessageItemProps {
  readonly message: ChatMessage
  readonly isStreaming?: boolean
}

/**
 * Message item bubble adapted from Beautiful UI chat patterns.
 * Supports thinking disclosure, streaming cursor animation, and copy-to-clipboard.
 */
export function ChatMessageItem({
  message,
  isStreaming = false,
}: ChatMessageItemProps) {
  const [copiedId, setCopiedId] = useAtom(copiedMessageIdAtom)
  const isCopied = copiedId === message.id
  const isUser = message.role === "user"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedId(message.id)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy message")
    }
  }

  if (isUser) {
    return (
      <div className="flex w-full justify-end px-2 py-1.5">
        <div className="flex max-w-[85%] items-start gap-2.5 sm:max-w-[75%]">
          <div className="rounded-2xl bg-muted px-4 py-2.5 text-[13px] leading-relaxed text-foreground shadow-xs">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HugeiconsIcon icon={UserIcon} size={15} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full justify-start px-2 py-2">
      <div className="flex w-full max-w-[95%] items-start gap-3 sm:max-w-[90%]">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={AiChat02Icon} size={15} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Nabu Agent</span>
            {message.createdAt && (
              <span className="text-[11px] opacity-70">
                {message.createdAt}
              </span>
            )}
          </div>

          {message.thinking && (
            <ThinkingTrace
              thinking={message.thinking}
              isStreaming={isStreaming && !message.content}
            />
          )}

          <div className="text-[13px] leading-relaxed text-foreground">
            <p className="whitespace-pre-wrap">
              {message.content}
              {isStreaming && (
                <span
                  aria-hidden
                  className="ml-1 inline-block h-3.5 w-1 translate-y-0.5 rounded-full bg-foreground animate-pulse"
                />
              )}
            </p>
          </div>

          {message.content && !isStreaming && (
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
