import {
  PromptInputActions,
  type PromptInputProps,
  PromptInput as PromptInputShell,
} from "@workspace/ui/components/prompt-input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"

/**
 * The composer's view of the shared input shell.
 *
 * The shell itself lives in `@workspace/ui` because the existing chat still uses it,
 * and two implementations of "rounded box that focuses a textarea" is one too
 * many. This adds the only thing the composer needs that the shell does not
 * have: named regions, so the caller decides what sits in the leading and
 * trailing clusters instead of the component hard-coding a layout.
 *
 * The regions are also the measurement handles. The autocomplete popup needs
 * to clamp itself to the box, and reading the rail bounds is cheaper and more
 * stable than reading the shell, whose padding changes as attachments come and
 * go.
 */
export function PromptInput(props: PromptInputProps) {
  return <PromptInputShell {...props} />
}

export function PromptInputActionsRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <PromptInputActions className={className} {...props} />
}

export type PromptInputEditorProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Where the draft stops growing, in pixels. Required — see below. */
  maxHeight: number
}

/**
 * The draft's scroll area.
 *
 * The cap belongs to this element and not to the textarea, and the difference
 * is the scrollbar. A textarea that is itself capped is a scroll container, so
 * the browser draws its own bar across the text — and this repo has one
 * scrollbar language (`ScrollArea`) and no native ones. Here the textarea is
 * left as tall as its text needs to be and this root takes the overflow, which
 * means the *viewport* scrolls and the thumb is ours.
 *
 * `maxHeight` is required rather than optional for the same reason it is the
 * caller's: an uncapped editor does not get shorter, it takes the page with it.
 *
 * The consequence worth knowing: the textarea is no longer the element that
 * scrolls. The browser reveals the caret by scrolling an *ancestor*, so
 * anything positioned from the textarea's own box has to account for the
 * scroll between it and its containing block — see `measureCaret`.
 */
export function PromptInputEditor({
  maxHeight,
  className,
  style,
  ...props
}: PromptInputEditorProps) {
  return (
    <ScrollArea
      data-slot="prompt-editor"
      // The cap is merged into — not replaced by — a caller's style: the
      // spread order would otherwise let an ordinary `style` prop silently
      // delete the one thing this component exists to guarantee.
      style={{ ...style, maxHeight }}
      className={className}
      {...props}
    />
  )
}

/**
 * The element that actually scrolls a given part of the editor.
 *
 * The draft is uncapped by design, so `element.scrollTop = 0` on the textarea
 * is a write to a number that is already zero. Anything that has to move the
 * editor's scroll position — resetting it when the box collapses back to a
 * pill, for one — has to reach the viewport around the textarea instead.
 */
export function editorScrollHost(element: HTMLElement): HTMLElement {
  return (
    element.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ??
    element
  )
}

export function PromptInputLead({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="prompt-lead"
      // `min-w-0` is load-bearing: without it a long model name in the trail
      // cannot shrink, and the row overflows instead of the label truncating.
      className={cn("flex min-w-0 items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function PromptInputTrail({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="prompt-trail"
      // `ms-auto` pins the cluster to the trailing edge, so the send button
      // stays put at the far right no matter what is on the left. Relying on
      // the row's `justify-between` alone is not enough, because a
      // middle-wrap or a hidden control would otherwise pull it inward.
      className={cn("ms-auto flex shrink-0 items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export type {
  PromptInputActionProps,
  PromptInputProps,
  PromptInputTextareaProps,
} from "@workspace/ui/components/prompt-input"
/**
 * Re-exported rather than re-implemented so callers import one module and do
 * not have to know which pieces come from the shared shell and which are
 * composer-specific. A consumer reaching into `@workspace/ui` for half the parts
 * would be a step backwards for portability.
 */
export {
  PromptInputAction,
  PromptInputTextarea,
} from "@workspace/ui/components/prompt-input"
