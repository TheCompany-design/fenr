import { useAtomValue } from "jotai"
import { cn } from "@workspace/ui/lib/utils"
import { documentStatsAtom } from "../state/atoms"

export interface DocumentStatusBarProps {
  className?: string
}

/** Subtle word/character readout fed by the editor sync bridge. */
export function DocumentStatusBar({ className }: DocumentStatusBarProps) {
  const stats = useAtomValue(documentStatsAtom)

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-xs text-muted-foreground",
        className,
      )}
      role="status"
      aria-label="Document statistics"
    >
      <span>
        {stats.words} {stats.words === 1 ? "word" : "words"}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {stats.characters} {stats.characters === 1 ? "character" : "characters"}
      </span>
    </div>
  )
}
