import { cn } from "@workspace/ui/lib/utils"
import type { HTMLAttributes } from "react"

type DocumentCanvasProps = HTMLAttributes<HTMLDivElement> & {
  pageWidth?: number
  minHeight?: number
}

export function DocumentCanvas({
  children,
  className,
}: DocumentCanvasProps) {
  return (
    <article
      data-document-canvas
      className={cn(
        "relative mx-auto bg-background",
        className,
      )}
    >
      {children}
    </article>
  )
}
