import { usePromptInput } from "@workspace/ui/components/prompt-input"
import { cn } from "@workspace/ui/lib/utils"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { Mention } from "../catalog/reconcile"
import {
  type ComposerDensity,
  DRAFT_TEXT_CLASSES,
  draftBoxClasses,
} from "../state/composer-density"

/**
 * One span of the draft as the mention layer paints it: plain text, or an
 * app mention drawn as a pill. `start` is the span's offset in the draft —
 * unique across segments, which is what their React keys are made of.
 */
export type MentionSegment =
  | { kind: "text"; start: number; text: string }
  | { kind: "mention"; start: number; text: string; mention: Mention }

/**
 * Splits the draft around its app mentions. Spans are clamped to the value
 * and taken in order; one that is empty, reversed, or overlaps the one
 * before it is skipped, so a corrupt span degrades to plain text rather than
 * painting a wrong pill.
 */
export function buildMentionSegments(
  value: string,
  mentions: readonly Mention[],
): MentionSegment[] {
  const pills = mentions
    .filter((mention) => mention.kind === "app")
    .slice()
    .sort((a, b) => a.start - b.start)

  const segments: MentionSegment[] = []
  let cursor = 0
  for (const mention of pills) {
    const start = Math.max(0, Math.min(mention.start, value.length))
    const end = Math.max(0, Math.min(mention.end, value.length))
    if (end <= start || start < cursor) continue
    if (start > cursor) {
      segments.push({
        kind: "text",
        start: cursor,
        text: value.slice(cursor, start),
      })
    }
    segments.push({
      kind: "mention",
      start,
      text: value.slice(start, end),
      mention,
    })
    cursor = end
  }
  if (cursor < value.length) {
    segments.push({ kind: "text", start: cursor, text: value.slice(cursor) })
  }
  return segments
}

/** Hex colors only — anything else is ignored, not guessed at. */
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i

function hasAccent(mention: Mention): string | undefined {
  return mention.accentHex && HEX_COLOR.test(mention.accentHex)
    ? mention.accentHex
    : undefined
}

function MentionPill({ text, mention }: { text: string; mention: Mention }) {
  const accent = hasAccent(mention)
  const hasIcon = Boolean(mention.logoUrl)
  // The `@` keeps its advance width — so every glyph after it stays exactly
  // where the caret believes they are — while the mark covers it. That is
  // what turns `@Slack` into [logo] Slack without a character moving.
  const coversAtSign = text.startsWith("@") && hasIcon

  return (
    <span
      className={cn(
        // The generous padding (cancelled by the negative margin, so no
        // glyph moves) is where the mark lives: left of the `@`'s advance,
        // whose remainder becomes the gap between mark and name.
        "relative -mx-2 inline rounded-md px-2 font-medium",
        accent
          ? // The accent rides in a variable so the dark theme can lighten
            // it: brand hexes like Notion's near-black would be unreadable
            // on a dark surface if taken literally.
            "bg-[color:color-mix(in_oklab,var(--mention-accent)_14%,transparent)] text-[color:var(--mention-accent)] dark:bg-[color:color-mix(in_oklab,var(--mention-accent)_25%,transparent)] dark:text-[color:color-mix(in_oklab,var(--mention-accent)_45%,white)]"
          : "bg-muted",
      )}
      style={
        accent ? ({ "--mention-accent": accent } as CSSProperties) : undefined
      }
    >
      {coversAtSign ? <span className="invisible">@</span> : null}
      {text.slice(coversAtSign ? 1 : 0)}
      {hasIcon ? (
        <img
          src={mention.logoUrl}
          alt=""
          className={cn(
            "absolute left-1 top-1/2 size-[0.875em] max-w-none -translate-y-1/2",
            mention.logoMonochrome && "dark:invert",
          )}
        />
      ) : null}
    </span>
  )
}

/**
 * The draft's mention pills, painted over a textarea whose own glyphs have
 * stood down (`text-transparent`).
 *
 * The layer is the same trick `measureCaret` relies on — a div that copies
 * the textarea's typography and box exactly, so its text lays out where the
 * textarea's would — kept permanently mounted beside the draft instead of
 * built per measurement. It renders nothing until an app mention is in the
 * draft, which is also the moment the textarea goes transparent: no mention,
 * no mirror, and ordinary typing (IME included) is untouched.
 *
 * The textarea stays on top of the layer, so the caret and the selection are
 * still the browser's, drawn over the pills. Scrolling is copied across
 * because the pill's one-line clamp can scroll the textarea internally for
 * the instant before the density probe flips the box to a panel.
 */
export function PromptMentionLayer({
  density,
  mentions,
}: {
  density: ComposerDensity
  mentions: readonly Mention[]
}) {
  const { value, textareaRef } = usePromptInput()

  const layerRef = useRef<HTMLDivElement>(null)
  const segments = useMemo(
    () => buildMentionSegments(value, mentions),
    [value, mentions],
  )
  const active = segments.some((segment) => segment.kind === "mention")

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const layer = layerRef.current
    if (!textarea || !layer) return
    layer.scrollTop = textarea.scrollTop
    layer.scrollLeft = textarea.scrollLeft
  }, [textareaRef])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `active` is the signal this effect waits on, not an input it reads — the layer appears and disappears around it, and each appearance has to re-attach the scroll sync to the textarea.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    syncScroll()
    textarea.addEventListener("scroll", syncScroll, { passive: true })
    return () => textarea.removeEventListener("scroll", syncScroll)
  }, [syncScroll, active, textareaRef])

  if (!active) return null

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-slot="prompt-mention-layer"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-foreground",
        DRAFT_TEXT_CLASSES,
        draftBoxClasses(density),
      )}
    >
      {segments.map((segment) =>
        segment.kind === "mention" ? (
          <MentionPill
            key={segment.start}
            text={segment.text}
            mention={segment.mention}
          />
        ) : (
          <span key={segment.start}>{segment.text}</span>
        ),
      )}
    </div>
  )
}
