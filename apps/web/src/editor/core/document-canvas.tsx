import { cn } from "@workspace/ui/lib/utils"
import type { DocumentCanvasProps } from "./types"

export function DocumentCanvas({
  width = 816,
  minHeight = 1056,
  padding = { x: 72, y: 72 },
  children,
  className,
  style,
  ...props
}: DocumentCanvasProps) {
  return (
    <article
      {...props}
      data-document-canvas
      className={cn("relative mx-auto bg-background shadow-xs", className)}
      style={{
        ...style,
        width: typeof width === "number" ? `${width}px` : width,
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        padding: `${padding.y}px ${padding.x}px`,
      }}
    >
      {children}
    </article>
  )
}
