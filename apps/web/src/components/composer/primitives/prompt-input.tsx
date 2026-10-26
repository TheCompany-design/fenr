import {
  PromptInputActions,
  type PromptInputProps,
  PromptInput as PromptInputShell,
} from "@workspace/ui/components/prompt-input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"

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
  maxHeight: number
}

export function PromptInputEditor({
  maxHeight,
  className,
  style,
  ...props
}: PromptInputEditorProps) {
  return (
    <ScrollArea
      data-slot="prompt-editor"
      style={{ ...style, maxHeight }}
      className={className}
      {...props}
    />
  )
}

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

export {
  PromptInputAction,
  PromptInputTextarea,
} from "@workspace/ui/components/prompt-input"
