import {
  Cancel01Icon,
  File01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { type Attachment, isImageAttachment } from "../catalog/attachments"
import { TRANSITION_LAYOUT } from "../catalog/motion"
import { formatBytes } from "../data/sources"
import { usePromptStore } from "../state/prompt-store"

export type ContextRailMode = "chips" | "cards"

/**
 * One rail, two render modes.
 *
 * These look like two designs in the references — chips sitting above the
 * composer, or a card carousel below it — but they are the same list of
 * context items with different information density. Keeping one component and
 * switching the density means a file added by `@` and a file added with the
 * `+` button are indistinguishable downstream, which is the property that
 * actually matters.
 */
export function ContextRail({
  mode = "chips",
  className,
}: {
  mode?: ContextRailMode
  className?: string
}) {
  const attachments = usePromptStore((s) => s.attachments)
  const removeAttachment = usePromptStore((s) => s.removeAttachment)

  if (attachments.length === 0) return null

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="context-rail"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={TRANSITION_LAYOUT}
        className={cn("overflow-hidden", className)}
      >
        <div
          className={cn(
            "flex gap-2 overflow-x-auto",
            // Shares the editor's `px-3` so a chip's icon sits on the same
            // left edge as the first character of the text below it.
            mode === "chips" ? "px-3 pt-2" : "px-2 pb-1",
          )}
        >
          <AnimatePresence initial={false}>
            {attachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                layout
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: mode === "chips" ? "auto" : 200,
                  opacity: 1,
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={TRANSITION_LAYOUT}
                className="shrink-0"
              >
                {mode === "chips" ? (
                  <Chip
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.id)}
                  />
                ) : (
                  <Card
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.id)}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function Chip({
  attachment,
  onRemove,
}: {
  attachment: Attachment
  onRemove: () => void
}) {
  return (
    <div className="bg-muted group flex items-center gap-2 rounded-full py-1 pl-2 pr-1 text-sm">
      <HugeiconsIcon
        icon={isImageAttachment(attachment) ? File01Icon : Folder01Icon}
        className="text-muted-foreground size-3.5 shrink-0"
      />
      <span className="max-w-40 truncate">{attachment.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.name}`}
        className="hover:bg-accent rounded-full p-0.5"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
    </div>
  )
}

function Card({
  attachment,
  onRemove,
}: {
  attachment: Attachment
  onRemove: () => void
}) {
  return (
    <div className="bg-muted group relative flex w-50 shrink-0 flex-col gap-2 rounded-xl p-3">
      <div className="bg-background/40 flex aspect-4/3 items-center justify-center overflow-hidden rounded-lg">
        {attachment.url && isImageAttachment(attachment) ? (
          // Local blob URL, not a network image: no srcset, no loading state,
          // and no layout shift, because the container reserves the box.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.url} alt="" className="size-full object-cover" />
        ) : (
          <HugeiconsIcon
            icon={isImageAttachment(attachment) ? File01Icon : Folder01Icon}
            className="text-muted-foreground size-8"
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {attachment.name}
          </span>
          <span className="text-muted-foreground text-xs">
            {formatBytes(attachment.size)}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
          className="hover:bg-accent rounded-full p-1"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
