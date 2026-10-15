"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

/**
 * The shared prompt-input shell.
 *
 * One implementation of "rounded panel that focuses a textarea" for every
 * chat surface, with named regions instead of a hard-coded layout: the caller
 * decides what sits in the leading and trailing clusters, and the textarea
 * grows with its content up to `maxHeight`.
 *
 * The context is the measurement handle: the autocomplete popup needs the
 * textarea's ref to measure the caret, and reading it from context beats
 * threading a prop through every layer.
 */
type PromptInputContextValue = {
  value: string
  onSubmit: (() => void) | undefined
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  maxHeight: number | undefined
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(
  null,
)

export function usePromptInput(): PromptInputContextValue {
  const context = React.useContext(PromptInputContext)
  if (!context) {
    throw new Error(
      "usePromptInput must be used inside <PromptInput> — the shell owns the textarea ref and the submit path.",
    )
  }
  return context
}

export type PromptInputProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Controlled text. */
  value: string
  onValueChange?: (value: string) => void
  /** Called on Enter (without Shift) from the textarea. */
  onSubmit?: () => void
  /** Where the textarea stops growing, in pixels. */
  maxHeight?: number
}

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  maxHeight,
  className,
  children,
  ...props
}: PromptInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const contextValue = React.useMemo<PromptInputContextValue>(
    () => ({ value, onSubmit, textareaRef, maxHeight }),
    [value, onSubmit, maxHeight],
  )

  return (
    <PromptInputContext.Provider value={contextValue}>
      <div
        data-slot="prompt-input"
        className={cn(
          "flex flex-col rounded-4xl border border-border/60 bg-card/50 p-0.5 shadow-xs backdrop-blur-md transition-colors focus-within:border-foreground/25",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  )
}

export type PromptInputTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function PromptInputTextarea({
  className,
  onChange,
  onKeyDown,
  ...props
}: PromptInputTextareaProps) {
  const context = React.useContext(PromptInputContext)
  const value = context?.value
  const maxHeight = context?.maxHeight

  // The ref is shared through context so caret measurement sees the live
  // element; a caller-supplied ref is chained rather than replaced.
  //
  // Keyed on the ref itself and not on the context object. The context value is
  // rebuilt whenever `value` changes, so a callback keyed on it is a *new*
  // function per keystroke — and a new ref callback means React detaches the
  // element (`ref(null)`) and reattaches it during the same commit. Anything
  // reading `textareaRef.current` from a layout effect therefore saw `null` on
  // every keystroke, because effects run in tree order and the reader had not
  // reached the reattach yet. The ref object never changes, so keying on it
  // makes the callback stable and the ref stays put.
  const textareaRef = context?.textareaRef
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (textareaRef) textareaRef.current = node
    },
    [textareaRef],
  )

  return (
    <textarea
      ref={setRef}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (
          !event.defaultPrevented &&
          event.key === "Enter" &&
          !event.shiftKey &&
          context?.onSubmit
        ) {
          event.preventDefault()
          context.onSubmit()
        }
      }}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
      className={cn(
        "min-h-11 w-full resize-none field-sizing-content bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden",
        className,
      )}
      {...props}
    />
  )
}

export function PromptInputActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="prompt-input-actions"
      className={cn("flex items-center justify-between px-2", className)}
      {...props}
    />
  )
}

export type PromptInputActionProps = {
  /** Tooltip content; the action renders as a plain cluster when absent. */
  tooltip?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

/**
 * A tooltip-wrapped cluster for the action row.
 *
 * The child is rendered *as* the trigger rather than inside it, so a button
 * keeps its own semantics and the tooltip attaches to it — nesting a focusable
 * control inside a tooltip trigger is how keyboard focus lands on the wrong
 * element.
 */
export function PromptInputAction({
  tooltip,
  children,
  className,
}: PromptInputActionProps) {
  if (!tooltip || !React.isValidElement(children)) {
    return <div className={className}>{children}</div>
  }

  return (
    <Tooltip>
      <TooltipTrigger render={children} className={className} />
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
