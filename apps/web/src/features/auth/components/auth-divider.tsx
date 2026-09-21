/**
 * Semantic divider with label between authentication methods.
 *
 * Uses design tokens only (border-border, bg-background, text-muted-foreground).
 */
import { cn } from "@workspace/ui/lib/utils"

export interface AuthDividerProps {
  label?: string
  className?: string
}

export function AuthDivider({
  label = "Or continue with",
  className,
}: AuthDividerProps) {
  return (
    <div className={cn("relative my-6", className)}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <span className="w-full border-border border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}
