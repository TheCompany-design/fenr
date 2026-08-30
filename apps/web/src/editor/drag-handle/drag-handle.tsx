import {
  Add01Icon,
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteUpIcon,
  SourceCodeIcon,
  TextIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Editor } from "@tiptap/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useAtomValue, useSetAtom } from "jotai"
import { type DragEvent, type MouseEvent, useCallback } from "react"
import { toast } from "sonner"
import {
  dragHandleAtom,
  dragHandlePosAtom,
  dragHandleTopAtom,
  isDragHandleLockedAtom,
  isDragHandleVisibleAtom,
} from "../state/atoms/drag-handle"
import { handleBlockDragEnd, handleBlockDragStart } from "./drag-drop-handlers"

export interface DragHandleProps {
  editor: Editor | null
  className?: string
}

export interface BlockDeleteButtonProps {
  editor: Editor | null
  nodePos: number
  className?: string
  top?: number
}

/**
 * Dedicated Block Delete Button rendered in the right gutter of the canvas.
 * Appears as a round button with a trash icon aligned with the active block.
 */
export function BlockDeleteButton({
  editor,
  nodePos,
  className,
  top,
}: BlockDeleteButtonProps) {
  const handleDelete = useCallback(() => {
    if (!editor || editor.isDestroyed || nodePos < 0) return

    try {
      const { state } = editor.view
      if (nodePos >= state.doc.content.size) return
      const node = state.doc.nodeAt(nodePos)
      if (!node) return

      editor
        .chain()
        .focus()
        .deleteRange({ from: nodePos, to: nodePos + node.nodeSize })
        .run()

      toast.success("Block deleted")
    } catch {
      toast.error("Failed to delete block")
    }
  }, [editor, nodePos])

  return (
    <div
      data-drag-delete
      className={cn(
        "absolute right-4 z-20 flex items-center transition-all duration-150 ease-out select-none",
        className,
      )}
      style={top !== undefined ? { top: `${top}px` } : undefined}
    >
      <TooltipProvider delay={200}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={handleDelete}
                type="button"
                aria-label="Delete block"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="right">Delete block</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

/**
 * Presentational Block Drag Handle Chrome rendered in the canvas gutter.
 *
 * Affordances:
 * 1. Quick Add (+) button: Appends an empty paragraph directly beneath the active block.
 * 2. Grip Handle (::): HTML5 draggable handle. Opens context menu (Copy text, Turn into)
 *    on right-click or double-click.
 * 3. Delete button: Round trash icon button on the right side of the canvas.
 */
export function DragHandle({ editor, className }: DragHandleProps) {
  const isVisible = useAtomValue(isDragHandleVisibleAtom)
  const top = useAtomValue(dragHandleTopAtom)
  const nodePos = useAtomValue(dragHandlePosAtom)
  const isLocked = useAtomValue(isDragHandleLockedAtom)
  const setDragHandle = useSetAtom(dragHandleAtom)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setDragHandle((prev) => ({ ...prev, isLocked: open }))
    },
    [setDragHandle],
  )

  const handleDragStartEvent = useCallback(
    (e: DragEvent) => {
      handleBlockDragStart(e, editor, nodePos)
    },
    [editor, nodePos],
  )

  const handleDragEndEvent = useCallback(
    (e: DragEvent) => {
      handleBlockDragEnd(e, editor)
    },
    [editor],
  )

  const handleGripClick = useCallback((e: MouseEvent) => {
    // Suppress default single-click opening of menu
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleGripContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleOpenChange(true)
    },
    [handleOpenChange],
  )

  const handleGripDoubleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleOpenChange(true)
    },
    [handleOpenChange],
  )

  const handleInsertBlockBelow = useCallback(() => {
    if (!editor || editor.isDestroyed || nodePos < 0) return

    try {
      const { state } = editor.view
      if (nodePos >= state.doc.content.size) return
      const node = state.doc.nodeAt(nodePos)
      const insertPos = node ? nodePos + node.nodeSize : nodePos + 1

      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, { type: "paragraph" })
        .run()
    } catch {
      toast.error("Failed to insert block")
    }
  }, [editor, nodePos])

  const handleCopyText = useCallback(() => {
    if (!editor || editor.isDestroyed || nodePos < 0) return

    try {
      const { state } = editor.view
      if (nodePos >= state.doc.content.size) return
      const node = state.doc.nodeAt(nodePos)
      if (!node) return

      navigator.clipboard.writeText(node.textContent)
      toast.success("Block text copied to clipboard")
    } catch {
      toast.error("Failed to copy text")
    }
  }, [editor, nodePos])

  const handleTurnInto = useCallback(
    (type: string, level?: 1 | 2 | 3) => {
      if (!editor || editor.isDestroyed || nodePos < 0) return

      try {
        const chain = editor.chain().focus().setNodeSelection(nodePos)
        switch (type) {
          case "text":
            chain.setParagraph().run()
            break
          case "heading":
            chain.setHeading({ level: level ?? 1 }).run()
            break
          case "bulletList":
            chain.toggleBulletList().run()
            break
          case "orderedList":
            chain.toggleOrderedList().run()
            break
          case "blockquote":
            chain.toggleBlockquote().run()
            break
          case "codeBlock":
            chain.toggleCodeBlock().run()
            break
        }
        toast.success("Block transformed")
      } catch {
        toast.error("Failed to transform block")
      }
    },
    [editor, nodePos],
  )

  if (!isVisible && !isLocked) {
    return null
  }

  return (
    <>
      {/* 1. Left Gutter: Quick Add (+) and Grip Handle (::) */}
      <div
        data-drag-handle
        className={cn(
          "absolute left-4 z-20 flex items-center gap-0.5 transition-all duration-150 ease-out select-none",
          className,
        )}
        style={{ top: `${top}px` }}
      >
        {/* Quick Add (+) Button */}
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={handleInsertBlockBelow}
                  type="button"
                  aria-label="Add block below"
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="left">
              Click to add block below
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Drag Grip (::) & Action Menu Trigger */}
        <DropdownMenu open={isLocked} onOpenChange={handleOpenChange}>
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        draggable
                        onDragStart={handleDragStartEvent}
                        onDragEnd={handleDragEndEvent}
                        onClick={handleGripClick}
                        onContextMenu={handleGripContextMenu}
                        onDoubleClick={handleGripDoubleClick}
                        className="size-6 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                        type="button"
                        aria-label="Drag block (right-click or double-click for options)"
                      >
                        <HugeiconsIcon
                          icon={DragDropVerticalIcon}
                          className="size-3.5"
                        />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent side="left">
                Drag to move (right-click or double-click for options)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenuContent align="start" side="bottom" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleCopyText}>
                <HugeiconsIcon icon={Copy01Icon} className="mr-2 size-4" />
                Copy text
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <HugeiconsIcon icon={TextIcon} className="mr-2 size-4" />
                Turn into
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <DropdownMenuItem onClick={() => handleTurnInto("text")}>
                  <HugeiconsIcon icon={TextIcon} className="mr-2 size-4" />
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("heading", 1)}>
                  <HugeiconsIcon icon={Heading01Icon} className="mr-2 size-4" />
                  Heading 1
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("heading", 2)}>
                  <HugeiconsIcon icon={Heading02Icon} className="mr-2 size-4" />
                  Heading 2
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("heading", 3)}>
                  <HugeiconsIcon icon={Heading03Icon} className="mr-2 size-4" />
                  Heading 3
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("bulletList")}>
                  <HugeiconsIcon
                    icon={LeftToRightListBulletIcon}
                    className="mr-2 size-4"
                  />
                  Bullet list
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("orderedList")}>
                  <HugeiconsIcon
                    icon={LeftToRightListNumberIcon}
                    className="mr-2 size-4"
                  />
                  Numbered list
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("blockquote")}>
                  <HugeiconsIcon icon={QuoteUpIcon} className="mr-2 size-4" />
                  Quote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTurnInto("codeBlock")}>
                  <HugeiconsIcon
                    icon={SourceCodeIcon}
                    className="mr-2 size-4"
                  />
                  Code block
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Right Gutter: Dedicated Round Delete Button with Trash Icon */}
      <BlockDeleteButton editor={editor} nodePos={nodePos} top={top} />
    </>
  )
}
