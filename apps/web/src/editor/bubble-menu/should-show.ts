/**
 * Visibility predicates for the floating chrome, kept pure so the gating
 * rules are unit-testable without a ProseMirror view.
 */

export interface FormattingBubbleContext {
  isEditable: boolean
  isLinkActive: boolean
  hasFocus: boolean
  isEmptySelection: boolean
  /** No rendered text between from/to (e.g. selection spans one atom node) */
  isEmptyTextBlock: boolean
}

/**
 * The formatting toolbar shows for a non-empty, focused, editable selection,
 * and yields to the link popover when the selection sits inside a link.
 */
export function shouldShowFormattingBubble(
  context: FormattingBubbleContext,
): boolean {
  if (!context.isEditable || context.isLinkActive) return false
  if (!context.hasFocus) return false
  if (context.isEmptySelection) return false
  return !context.isEmptyTextBlock
}

export interface LinkPopoverContext {
  isLinkActive: boolean
}

/**
 * The link editor shows whenever the cursor or selection is inside a link —
 * including a collapsed cursor — mirroring Notion's inline link editing.
 */
export function shouldShowLinkPopover(context: LinkPopoverContext): boolean {
  return context.isLinkActive
}

export interface TableToolbarContext {
  isEditable: boolean
  isActiveTable: boolean
  isEmptySelection: boolean
  /** Selection spans one or more whole cells (ProseMirror CellSelection) */
  isCellSelection: boolean
}

/**
 * The table toolbar shows for a collapsed cursor inside a table or a cell
 * spanning selection. Text selections inside a single cell keep the
 * formatting toolbar instead, so the two never stack.
 */
export function shouldShowTableToolbar(context: TableToolbarContext): boolean {
  if (!context.isEditable || !context.isActiveTable) return false
  return context.isEmptySelection || context.isCellSelection
}
