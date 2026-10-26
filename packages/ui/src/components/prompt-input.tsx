"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

type PromptInputContextValue = {
  value: string
  onSubmit: (() => void) | undefined
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
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
  value: string
  onValueChange?: (value: string) => void

  onSubmit?: () => void
}

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  className,
  children,
  ...props
}: PromptInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const contextValue = React.useMemo<PromptInputContextValue>(
    () => ({ value, onSubmit, textareaRef }),
    [value, onSubmit],
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
      className={cn(
        "block min-h-11 w-full resize-none field-sizing-content bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden",
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
  tooltip?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

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
