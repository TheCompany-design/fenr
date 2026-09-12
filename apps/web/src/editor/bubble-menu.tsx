import {
  ArrowDown01Icon,
  CodeIcon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteUpIcon,
  SourceCodeIcon,
  Summation01Icon,
  TextAlignCenterIcon,
  TextAlignJustifyCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextBoldIcon,
  TextIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { type Editor, useCurrentEditor } from "@tiptap/react"
import { BubbleMenu as TipTapBubbleMenu } from "@tiptap/react/menus"
import { AnimatedDropdown } from "@workspace/ui/components/animated-dropdown"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { SPRING_LAYOUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { useAtomValue } from "jotai"
import { motion, useReducedMotion } from "motion/react"
import { useId, useState } from "react"
import {
  isAlignCenterAtom,
  isAlignJustifyAtom,
  isAlignLeftAtom,
  isAlignRightAtom,
  isBlockquoteAtom,
  isBoldAtom,
  isBulletListAtom,
  isCodeAtom,
  isCodeBlockAtom,
  isItalicAtom,
  isMathAtom,
  isOrderedListAtom,
  isStrikethroughAtom,
  textTypeAtom,
} from "./state/atoms"

export const TEXT_TYPES = [
  { value: "text", label: "Text", icon: TextIcon, shortcut: "⌥⌘0" },
  {
    value: "heading-1",
    label: "Heading 1",
    icon: Heading01Icon,
    shortcut: "⌥⌘1",
  },
  {
    value: "heading-2",
    label: "Heading 2",
    icon: Heading02Icon,
    shortcut: "⌥⌘2",
  },
  {
    value: "heading-3",
    label: "Heading 3",
    icon: Heading03Icon,
    shortcut: "⌥⌘3",
  },
] as const

export interface TextTypeMenuItemsProps {
  currentType: string
  onSelect: (value: string) => void
}

/**
 * Animated text-type selection menu featuring the signature gliding hover pill.
 * Glides seamlessly across options with spring physics and returns to the active type.
 */
export function TextTypeMenuItems({
  currentType,
  onSelect,
}: TextTypeMenuItemsProps) {
  const [activeId, setActiveId] = useState<string | null>(currentType)
  const reduce = useReducedMotion() ?? false
  const menuId = useId()

  return (
    <div
      role="menu"
      aria-label="Text type options"
      className="flex flex-col gap-0.5 outline-none"
      onMouseLeave={() => setActiveId(currentType)}
    >
      {TEXT_TYPES.map((item) => {
        const isActive = activeId === item.value
        const isSelected = currentType === item.value

        return (
          <button
            key={item.value}
            type="button"
            id={item.value}
            role="menuitemradio"
            aria-checked={isSelected}
            data-menu-item="true"
            onPointerDown={(e) => {
              // Crucial for rich text editors: prevent losing selection in editor before click executes
              e.preventDefault()
            }}
            onFocus={() => setActiveId(item.value)}
            onPointerMove={(e) => {
              if (e.pointerType !== "touch") {
                setActiveId(item.value)
              }
            }}
            onClick={() => onSelect(item.value)}
            className={cn(
              "group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sm outline-none select-none transition-colors",
              "text-foreground/90 hover:text-foreground focus:text-foreground",
              "active:scale-[0.98]",
            )}
          >
            {/* Animated Glide Pill matching user-menu mechanics */}
            {isActive ? (
              <motion.span
                layoutId={`${menuId}-glider`}
                className="absolute inset-0 -z-10 rounded-xl border border-border/70 bg-accent shadow-xs"
                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
              />
            ) : null}

            <div className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/50 text-muted-foreground transition-colors group-hover/item:border-border group-hover/item:text-foreground">
                <HugeiconsIcon icon={item.icon} className="size-3.5" />
              </span>
              <span className="text-foreground">{item.label}</span>
            </div>

            <div className="flex items-center gap-2">
              <kbd className="rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors group-hover/item:border-border group-hover/item:text-foreground">
                {item.shortcut}
              </kbd>
              {isSelected ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="size-3.5 text-primary shrink-0"
                />
              ) : (
                <span className="size-3.5 shrink-0" aria-hidden="true" />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export interface ToolbarItem {
  id: string
  label: string
  icon: typeof TextBoldIcon
  pressed?: boolean
  onClick: () => void
}

export interface BubbleToolbarGroupProps {
  ariaLabel: string
  items: readonly ToolbarItem[]
}

/**
 * Animated toolbar group featuring the shared-layout gliding hover pill
 * with spring physics and tactile press feedback.
 */
export function BubbleToolbarGroup({
  ariaLabel,
  items,
}: BubbleToolbarGroupProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const reduce = useReducedMotion() ?? false
  const groupId = useId()

  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 outline-none"
      onMouseLeave={() => setHoveredId(null)}
    >
      {items.map((item) => {
        const isHovered = hoveredId === item.id

        return (
          <Tooltip key={item.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  id={item.id}
                  aria-label={item.label}
                  aria-pressed={item.pressed}
                  onPointerDown={(e) => {
                    // Prevent stealing focus / clearing editor selection on click
                    e.preventDefault()
                  }}
                  onFocus={() => setHoveredId(item.id)}
                  onPointerMove={(e) => {
                    if (e.pointerType !== "touch") {
                      setHoveredId(item.id)
                    }
                  }}
                  onClick={item.onClick}
                  className={cn(
                    "group/btn relative isolate flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none select-none transition-colors",
                    "hover:text-foreground focus-visible:text-foreground",
                    "active:scale-90",
                    item.pressed &&
                      "bg-accent text-accent-foreground font-medium shadow-xs",
                  )}
                >
                  {/* Shared-layout Glide-Pill matching user-menu mechanics */}
                  {isHovered ? (
                    <motion.span
                      layoutId={`${groupId}-hover-pill`}
                      className={cn(
                        "absolute inset-0 -z-10 rounded-lg",
                        item.pressed
                          ? "border border-border/50 bg-accent/80"
                          : "border border-border/30 bg-muted/70",
                      )}
                      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                    />
                  ) : null}

                  <HugeiconsIcon
                    icon={item.icon}
                    className="size-4 shrink-0 transition-transform group-active/btn:scale-95"
                  />
                </button>
              }
            />
            <TooltipContent side="top">{item.label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export interface BubbleMenuProps {
  editor?: Editor | null
}

export const BubbleMenu = ({ editor: propEditor }: BubbleMenuProps = {}) => {
  const { editor: currentEditor } = useCurrentEditor()
  const editor = propEditor ?? currentEditor
  const isBold = useAtomValue(isBoldAtom)
  const isItalic = useAtomValue(isItalicAtom)
  const isStrikethrough = useAtomValue(isStrikethroughAtom)
  const isBulletList = useAtomValue(isBulletListAtom)
  const isOrderedList = useAtomValue(isOrderedListAtom)
  const textType = useAtomValue(textTypeAtom)
  const isAlignLeft = useAtomValue(isAlignLeftAtom)
  const isAlignCenter = useAtomValue(isAlignCenterAtom)
  const isAlignRight = useAtomValue(isAlignRightAtom)
  const isAlignJustify = useAtomValue(isAlignJustifyAtom)
  const isCode = useAtomValue(isCodeAtom)
  const isCodeBlock = useAtomValue(isCodeBlockAtom)
  const isBlockquote = useAtomValue(isBlockquoteAtom)
  const isMath = useAtomValue(isMathAtom)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (!editor) return null

  const handleTypeChange = (value: string) => {
    const chain = editor.chain().focus()
    switch (value) {
      case "text":
        chain.setParagraph().run()
        break
      case "heading-1":
        chain.setHeading({ level: 1 }).run()
        break
      case "heading-2":
        chain.setHeading({ level: 2 }).run()
        break
      case "heading-3":
        chain.setHeading({ level: 3 }).run()
        break
    }
  }

  const handleToggleMath = () => {
    if (editor.isActive("inlineMath")) {
      editor.commands.deleteInlineMath()
    } else if (editor.isActive("blockMath")) {
      editor.commands.deleteBlockMath()
    } else {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to)
      editor.commands.insertInlineMath({ latex: selectedText || "E = mc^2" })
    }
  }

  const currentTypeMeta =
    TEXT_TYPES.find((t) => t.value === textType) ?? TEXT_TYPES[0]

  const formattingItems: ToolbarItem[] = [
    {
      id: "bold",
      label: "Bold",
      icon: TextBoldIcon,
      pressed: isBold,
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "Italic",
      icon: TextItalicIcon,
      pressed: isItalic,
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "strike",
      label: "Strikethrough",
      icon: TextStrikethroughIcon,
      pressed: isStrikethrough,
      onClick: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "bullet-list",
      label: "Bullet list",
      icon: LeftToRightListBulletIcon,
      pressed: isBulletList,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "ordered-list",
      label: "Numbered list",
      icon: LeftToRightListNumberIcon,
      pressed: isOrderedList,
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ]

  const alignItems: ToolbarItem[] = [
    {
      id: "align-left",
      label: "Align left",
      icon: TextAlignLeftIcon,
      pressed: isAlignLeft,
      onClick: () => editor.chain().focus().setTextAlign("left").run(),
    },
    {
      id: "align-center",
      label: "Align center",
      icon: TextAlignCenterIcon,
      pressed: isAlignCenter,
      onClick: () => editor.chain().focus().setTextAlign("center").run(),
    },
    {
      id: "align-right",
      label: "Align right",
      icon: TextAlignRightIcon,
      pressed: isAlignRight,
      onClick: () => editor.chain().focus().setTextAlign("right").run(),
    },
    {
      id: "align-justify",
      label: "Justify",
      icon: TextAlignJustifyCenterIcon,
      pressed: isAlignJustify,
      onClick: () => editor.chain().focus().setTextAlign("justify").run(),
    },
  ]

  const miscItems: ToolbarItem[] = [
    {
      id: "code",
      label: "Code",
      icon: CodeIcon,
      pressed: isCode,
      onClick: () => editor.chain().focus().toggleCode().run(),
    },
    {
      id: "code-block",
      label: "Code block",
      icon: SourceCodeIcon,
      pressed: isCodeBlock,
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "blockquote",
      label: "Quote",
      icon: QuoteUpIcon,
      pressed: isBlockquote,
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "math",
      label: "Math formula",
      icon: Summation01Icon,
      pressed: isMath,
      onClick: handleToggleMath,
    },
  ]

  return (
    <TipTapBubbleMenu
      editor={editor}
      className="flex items-center gap-1 rounded-2xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-md"
    >
      <TooltipProvider delay={300}>
        <Tooltip open={dropdownOpen ? false : undefined}>
          <AnimatedDropdown
            open={dropdownOpen}
            onOpenChange={setDropdownOpen}
            side="bottom"
            align="start"
            sideOffset={6}
            className="w-52 bg-popover/95"
            trigger={
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex items-center justify-between gap-2 transition-colors",
                      dropdownOpen && "bg-accent text-accent-foreground",
                    )}
                  >
                    <HugeiconsIcon
                      icon={currentTypeMeta.icon}
                      className="size-3"
                    />
                    <span className="flex items-center justify-between gap-1">
                      {currentTypeMeta.label}{" "}
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        className={cn(
                          "size-3 transition-transform duration-200",
                          dropdownOpen && "rotate-180",
                        )}
                      />
                    </span>
                  </Button>
                }
              />
            }
          >
            {(onClose) => (
              <TextTypeMenuItems
                currentType={textType}
                onSelect={(value) => {
                  handleTypeChange(value)
                  onClose()
                }}
              />
            )}
          </AnimatedDropdown>
          <TooltipContent side="top">Text type</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 bg-border/60" />

        <BubbleToolbarGroup ariaLabel="Formatting" items={formattingItems} />

        <Separator orientation="vertical" className="h-5 bg-border/60" />

        <BubbleToolbarGroup ariaLabel="Text alignment" items={alignItems} />

        <Separator orientation="vertical" className="h-5 bg-border/60" />

        <BubbleToolbarGroup ariaLabel="Insert & style" items={miscItems} />
      </TooltipProvider>
    </TipTapBubbleMenu>
  )
}
