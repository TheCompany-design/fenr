import { Delete02Icon, GridTableIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { CellSelection } from "@tiptap/pm/tables"
import type { Editor } from "@tiptap/react"
import { useCurrentEditor } from "@tiptap/react"
import { BubbleMenu as TipTapBubbleMenu } from "@tiptap/react/menus"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { shouldShowTableToolbar } from "../bubble-menu/should-show"

export interface TableToolbarProps {
  editor?: Editor | null
}

/**
 * Floating controls while the cursor or a cell selection is inside a table.
 * Row and column operations are text-labeled menu items — clearer than
 * ambiguous glyphs — with a quick destructive delete beside them.
 */
export function TableToolbar({ editor: propEditor }: TableToolbarProps = {}) {
  const { editor: contextEditor } = useCurrentEditor()
  const editor = propEditor ?? contextEditor

  if (!editor) return null

  const run = (command: () => void) => command()

  return (
    <TipTapBubbleMenu
      editor={editor}
      shouldShow={({ editor: instance, state }) =>
        shouldShowTableToolbar({
          isEditable: instance.isEditable,
          isActiveTable: instance.isActive("table"),
          isEmptySelection: state.selection.empty,
          isCellSelection: state.selection instanceof CellSelection,
        })
      }
      className="flex items-center gap-1 rounded-2xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-md"
    >
      <TooltipProvider delay={300}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1.5"
                      aria-label="Table operations"
                    >
                      <HugeiconsIcon icon={GridTableIcon} className="size-3.5" />
                      Table
                    </Button>
                  }
                />
              }
            />
            <TooltipContent side="top">Table operations</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  run(() => editor.chain().focus().addColumnBefore().run())
                }
              >
                Insert column left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  run(() => editor.chain().focus().addColumnAfter().run())
                }
              >
                Insert column right
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  run(() => editor.chain().focus().addRowBefore().run())
                }
              >
                Insert row above
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  run(() => editor.chain().focus().addRowAfter().run())
                }
              >
                Insert row below
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  run(() => editor.chain().focus().toggleHeaderRow().run())
                }
              >
                Toggle header row
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() =>
                  run(() => editor.chain().focus().deleteRow().run())
                }
              >
                Delete row
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() =>
                  run(() => editor.chain().focus().deleteColumn().run())
                }
              >
                Delete column
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() =>
                  run(() => editor.chain().focus().deleteTable().run())
                }
              >
                Delete table
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 bg-border/60" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete table"
                onClick={() => run(() => editor.chain().focus().deleteTable().run())}
                type="button"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="top">Delete table</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </TipTapBubbleMenu>
  )
}
