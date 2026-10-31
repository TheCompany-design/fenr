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
