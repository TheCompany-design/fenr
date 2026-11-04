import { ArrowUpRightIcon, UnlinkIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Editor } from "@tiptap/react"
import { useCurrentEditor } from "@tiptap/react"
import { BubbleMenu as TipTapBubbleMenu } from "@tiptap/react/menus"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { shouldShowLinkPopover } from "../bubble-menu/should-show"
import { selectionAtom } from "../state/atoms"

export interface LinkPopoverProps {
  editor?: Editor | null
}

/**
 * Notion-style inline link editor: selecting or cursoring into a link opens
 * a small popover with an editable URL, an open action, and unlink.
 */
export function LinkPopover({ editor: propEditor }: LinkPopoverProps = {}) {
  const { editor: contextEditor } = useCurrentEditor()
  const editor = propEditor ?? contextEditor
  // Subscribing to the selection keeps attribute reads fresh while open.
  const selection = useAtomValue(selectionAtom)
  const [draft, setDraft] = useState<string | null>(null)

  const isLinkActive = editor?.isActive("link") ?? false
  const href =
    typeof editor?.getAttributes("link").href === "string"
      ? (editor.getAttributes("link").href as string)
      : ""

  useEffect(() => {
    if (!isLinkActive) return
    setDraft(href)
    // Re-seed the draft whenever the anchor moves into a different link or
    // the applied value changes.
  }, [isLinkActive, selection.from, selection.to, href])

  if (!editor) return null

  const value = draft ?? href
  const canOpen = /^(https?:\/\/|mailto:)/i.test(href)

  const apply = () => {
    const next = value.trim()
    const chain = editor.chain().focus().extendMarkRange("link")
    if (!next) {
      chain.unsetLink().run()
    } else {
      chain.setLink({ href: next }).run()
    }
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
  }

  const openExternal = () => {
    if (!canOpen) return
    window.open(href, "_blank", "noopener,noreferrer")
  }

  return (
    <TipTapBubbleMenu
      editor={editor}
      shouldShow={({ editor: instance }) =>
        shouldShowLinkPopover({ isLinkActive: instance.isActive("link") })
      }
      className="rounded-xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-md"
    >
      <TooltipProvider delay={300}>
        <div
          className="flex items-center gap-1"
          role="toolbar"
          aria-label="Link editing"
        >
          <input
            value={value}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                apply()
              }
            }}
            placeholder="Paste or type a link…"
            aria-label="Link URL"
            className={cn(
              "h-8 w-56 rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none",
              "placeholder:text-muted-foreground focus-visible:border-border focus-visible:bg-background",
            )}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Open link in new tab"
                  disabled={!canOpen}
                  onClick={openExternal}
                  type="button"
                >
                  <HugeiconsIcon icon={ArrowUpRightIcon} className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Open in new tab</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label="Remove link"
                  onClick={remove}
                  type="button"
                >
                  <HugeiconsIcon icon={UnlinkIcon} className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Remove link</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </TipTapBubbleMenu>
  )
}
