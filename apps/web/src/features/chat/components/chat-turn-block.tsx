import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Citations } from "@workspace/ui/components/citations"
import { cn } from "@workspace/ui/lib/utils"
import { useAtom } from "jotai"
import { useMemo } from "react"
import { toast } from "sonner"
import { integrationsCatalogQueryOptions } from "@/features/integrations/api/integrations-queries"
import { logoUrl as brandLogoUrl } from "@/lib/brand/logos"
import { OpenUiRenderer } from "../genui/openui-renderer"
import { extractOpenUiProgram } from "../genui/openui-response"
import { extractCitationsFromMarkdown } from "../lib/extract-citations"
import { copiedMessageIdAtom } from "../state/chat-atoms"
import {
  type ChatTurn,
  turnCitations,
  turnText,
  turnThinking,
} from "../state/chat-turns"
import type { AppMentionApp } from "./app-mention-pill"
import { formatTimestamp } from "./format-timestamp"
import { MessageMarkdown } from "./message-markdown"
import { ThinkingTrace } from "./thinking-trace"

/**
 * The workspace's integrations, flattened to what a mention pill draws.
 * A deployment without the Composio gateway answers an empty registry, and
 * user messages simply keep their plain `@Name` text.
 */
function useAppMentionApps(): readonly AppMentionApp[] {
  const { data } = useQuery(integrationsCatalogQueryOptions())
  return useMemo(() => {
    const catalog = data && !("unavailable" in data) ? data : null
    return (catalog?.toolkits ?? []).map((toolkit) => ({
      slug: toolkit.slug,
      name: toolkit.display_name,
      logoUrl: brandLogoUrl(toolkit.logo_slug),
      accentHex: toolkit.brand_accent_hex,
      monochrome: toolkit.logo_monochrome,
    }))
  }, [data])
}

export interface ChatTurnBlockProps {
  readonly turn: ChatTurn
  readonly onContinue?: (prompt: string) => void
  readonly onInspectTurn?: (turnId: string) => void
}

export function ChatTurnBlock({
  turn,
  onContinue,
  onInspectTurn,
}: ChatTurnBlockProps) {
  const [copiedId, setCopiedId] = useAtom(copiedMessageIdAtom)
  const isUser = turn.isUser
  const appMentionApps = useAppMentionApps()

  if (isUser) {
    const message = turn.messages[0]
    if (!message) return null

    return (
      <div
        data-slot="message"
        data-from="user"
        className="flex w-full justify-end px-2 py-1.5"
      >
        <div className="flex max-w-[85%] sm:max-w-[75%]">
          <div
            data-slot="message-bubble-content"
            className="min-w-0 rounded-2xl bg-muted px-4 py-2.5 text-[13px] leading-relaxed text-foreground shadow-xs"
          >
            <MessageMarkdown
              content={message.content}
              variant="user"
              appMentions={appMentionApps}
            />
          </div>
        </div>
      </div>
    )
  }

  const thinking = turnThinking(turn.messages)
  const text = turnText(turn.messages)
  const hasOpenUi = extractOpenUiProgram(text) !== null

  const turnId = turn.messages.find((message) => message.turnId)?.turnId
  const startedAt = turn.messages.find(
    (message) => message.createdAt,
  )?.createdAt

  const messageCitations = turnCitations(turn.messages)
  const citations = useMemo(() => {
    if (messageCitations.length > 0) return messageCitations
    return extractCitationsFromMarkdown(text)
  }, [messageCitations, text])
  const citationPrefix = `citation-${turnId ?? turn.messages[0]?.id ?? "turn"}`
  const modelCalls = turn.messages.flatMap(
    (message) => message.modelCalls ?? [],
  )
  const latestCall = modelCalls.at(-1)
  const totalInput = modelCalls.reduce(
    (sum, call) => sum + call.usage.input_tokens,
    0,
  )
  const totalOutput = modelCalls.reduce(
    (sum, call) => sum + call.usage.output_tokens,
    0,
  )
  const totalCached = modelCalls.reduce(
    (sum, call) => sum + call.usage.cached_input_tokens,
    0,
  )
  const cacheHitRate =
    totalInput > 0 && totalCached <= totalInput
      ? totalCached / totalInput
      : null
  const compactTokens = (tokens: number) =>
    new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(tokens)
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
    <div
      data-slot="message"
      data-from="assistant"
      className="flex w-full justify-start px-2 py-2"
    >
      <div className="flex w-full max-w-[95%] flex-col sm:max-w-[90%]">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {thinking && (
            <ThinkingTrace
              thinking={thinking}
              isStreaming={turn.isStreaming && !text}
            />
          )}

          {text && hasOpenUi ? (
            <div data-slot="message-content">
              <OpenUiRenderer
                content={text}
                isStreaming={turn.isStreaming}
                onContinue={onContinue ?? (() => {})}
              />
            </div>
          ) : text ? (
            <div
              data-slot="message-bubble-content"
              className="min-w-0 text-[13px] leading-relaxed text-foreground"
            >
              <MessageMarkdown
                content={text}
                isStreaming={turn.isStreaming}
                variant="assistant"
                citationIdPrefix={citationPrefix}
              />
            </div>
          ) : null}

          {citations.length > 0 && (
            <div className="mt-2">
              <Citations citations={citations} idPrefix={citationPrefix} />
            </div>
          )}

          {latestCall && (modelCalls.length > 0 || totalInput > 0) && (
            <button
              type="button"
              onClick={
                turnId && onInspectTurn
                  ? () => onInspectTurn(turnId)
                  : undefined
              }
              className={cn(
                "group/telemetry mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1 text-[11px] font-mono tabular-nums text-muted-foreground/90 transition-all",
                turnId && onInspectTurn
                  ? "cursor-pointer hover:border-border hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  : "cursor-default",
              )}
              title={
                turnId && onInspectTurn
                  ? "Inspect step breakdown and token economics"
                  : undefined
              }
            >
              <span className="font-sans font-medium text-foreground/90">
                {latestCall.model}
              </span>
              {latestCall.effort ? (
                <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground border border-border/40">
                  {latestCall.effort}
                </span>
              ) : null}
              {modelCalls.length > 1 ? (
                <span className="inline-flex items-center gap-1 rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground border border-border/40">
                  <HugeiconsIcon icon={Layers01Icon} size={11} />
                  <span>{modelCalls.length} steps</span>
                </span>
              ) : null}
              <span className="text-muted-foreground/50">·</span>
              <span>
                {compactTokens(totalInput)} in / {compactTokens(totalOutput)}{" "}
                out
              </span>
              {cacheHitRate !== null && cacheHitRate > 0 ? (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>{Math.round(cacheHitRate * 100)}% cached</span>
                  </span>
                </>
              ) : null}
              {turnId && onInspectTurn && (
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={12}
                  className="text-muted-foreground/40 transition-transform group-hover/telemetry:translate-x-0.5 group-hover/telemetry:text-foreground"
                />
              )}
            </button>
          )}

          {(text || startedAt) && (
            <div className="mt-1.5 flex min-h-5 items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {text && !turn.isStreaming && (
                  <div className="opacity-0 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100">
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

              {startedAt && (
                <time
                  dateTime={startedAt}
                  className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70"
                >
                  {formatTimestamp(startedAt)}
                </time>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
