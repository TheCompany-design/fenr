import { cn } from "@workspace/ui/lib/utils"
import { HIGHLIGHT_COLOR_SWATCHES, TEXT_COLOR_SWATCHES } from "./colors"

export interface ColorSwatchGridProps {
  /** Active highlight mark value; null means the default swatch is active */
  activeHighlight: string | null
  /** Active text style color; null means the default swatch is active */
  activeTextColor: string | null
  onSelect: (section: "background" | "text", value: string | null) => void
  className?: string
}

/**
 * Notion's two-section color sheet: background swatches rendered as filled
 * squares, text swatches rendered as a colored "A". Swatch colors are
 * document data (see colors.ts), not component styling.
 */
export function ColorSwatchGrid({
  activeHighlight,
  activeTextColor,
  onSelect,
  className,
}: ColorSwatchGridProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 p-1", className)}>
      <section>
        <div className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Background
        </div>
        <div className="grid grid-cols-5 gap-1">
          {HIGHLIGHT_COLOR_SWATCHES.map((swatch) => (
            <SwatchButton
              key={`bg-${swatch.label}`}
              swatch={swatch}
              variant="background"
              active={activeHighlight === swatch.value}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>
      <section>
        <div className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Text
        </div>
        <div className="grid grid-cols-5 gap-1">
          {TEXT_COLOR_SWATCHES.map((swatch) => (
            <SwatchButton
              key={`text-${swatch.label}`}
              swatch={swatch}
              variant="text"
              active={activeTextColor === swatch.value}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

interface SwatchButtonProps {
  swatch: { label: string; value: string | null }
  variant: "background" | "text"
  active: boolean
  onSelect: (section: "background" | "text", value: string | null) => void
}

function SwatchButton({
  swatch,
  variant,
  active,
  onSelect,
}: SwatchButtonProps) {
  return (
    <button
      type="button"
      aria-label={`${variant === "background" ? "Highlight" : "Text color"}: ${swatch.label}`}
      title={swatch.label}
      onClick={() => onSelect(variant, swatch.value)}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent outline-none transition-colors",
        "hover:bg-accent/60 active:scale-95",
        active && "border-border bg-accent",
      )}
    >
      {variant === "background" ? (
        <span
          className="size-5 rounded-[4px] border border-border/40"
          style={
            swatch.value
              ? { backgroundColor: swatch.value }
              : { backgroundColor: "transparent" }
          }
        />
      ) : (
        <span
          className="text-sm font-semibold"
          style={{ color: swatch.value ?? "inherit" }}
        >
          A
        </span>
      )}
    </button>
  )
}
