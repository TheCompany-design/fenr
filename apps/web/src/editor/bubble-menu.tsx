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
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { type Editor, useCurrentEditor } from "@tiptap/react"
import { BubbleMenu as TipTapBubbleMenu } from "@tiptap/react/menus"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useAtomValue } from "jotai"
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

const TEXT_TYPES = [
  { value: "text", label: "Text", icon: TextIcon },
  { value: "heading-1", label: "Heading 1", icon: Heading01Icon },
  { value: "heading-2", label: "Heading 2", icon: Heading02Icon },
  { value: "heading-3", label: "Heading 3", icon: Heading03Icon },
] as const

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

  return (
    <TipTapBubbleMenu
      editor={editor}
      className="flex items-center rounded-lg gap-1 border border-border bg-popover p-1 text-popover-foreground shadow-md"
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
                      className="flex items-center justify-between gap-2"
                    >
                      <HugeiconsIcon
                        icon={currentTypeMeta.icon}
                        className="size-3"
                      />
                      <span className="flex items-center justify-between gap-1">
                        {currentTypeMeta.label}{" "}
                        <HugeiconsIcon icon={ArrowDown01Icon} />
                      </span>
                    </Button>
                  }
                />
              }
            />
            <TooltipContent side="top">Text type</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="w-full">
            <DropdownMenuGroup>
              <DropdownMenuRadioGroup
                value={textType}
                onValueChange={handleTypeChange}
              >
                {TEXT_TYPES.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <span className="rounded-sm border p-1">
                      <HugeiconsIcon icon={Icon} className="size-3" />
                    </span>
                    <span>{label}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" />

        {/* Formatting Group */}
        <ToggleGroup variant="default" size="sm" multiple className="gap-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  pressed={isBold}
                  aria-label="Bold"
                  type="button"
                >
                  <HugeiconsIcon icon={TextBoldIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Bold</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  pressed={isItalic}
                  aria-label="Italic"
                  type="button"
                >
                  <HugeiconsIcon icon={TextItalicIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Italic</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  pressed={isStrikethrough}
                  aria-label="Strikethrough"
                  type="button"
                >
                  <HugeiconsIcon icon={TextStrikethroughIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Strikethrough</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  pressed={isBulletList}
                  aria-label="Bullet list"
                  type="button"
                >
                  <HugeiconsIcon icon={LeftToRightListBulletIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Bullet list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  pressed={isOrderedList}
                  aria-label="Numbered list"
                  type="button"
                >
                  <HugeiconsIcon icon={LeftToRightListNumberIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Numbered list</TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <Separator orientation="vertical" />

        {/* Alignment Group */}
        <ToggleGroup variant="default" size="sm" className="gap-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                  pressed={isAlignLeft}
                  aria-label="Align left"
                  type="button"
                >
                  <HugeiconsIcon icon={TextAlignLeftIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Align left</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                  pressed={isAlignCenter}
                  aria-label="Align center"
                  type="button"
                >
                  <HugeiconsIcon icon={TextAlignCenterIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Align center</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                  pressed={isAlignRight}
                  aria-label="Align right"
                  type="button"
                >
                  <HugeiconsIcon icon={TextAlignRightIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Align right</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().setTextAlign("justify").run()
                  }
                  pressed={isAlignJustify}
                  aria-label="Justify"
                  type="button"
                >
                  <HugeiconsIcon icon={TextAlignJustifyCenterIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Justify</TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <Separator orientation="vertical" />

        {/* Misc Group: Code, Code block, Quote, Math */}
        <ToggleGroup variant="default" size="sm" multiple className="gap-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  pressed={isCode}
                  aria-label="Code"
                  type="button"
                >
                  <HugeiconsIcon icon={CodeIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Code</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  pressed={isCodeBlock}
                  aria-label="Code block"
                  type="button"
                >
                  <HugeiconsIcon icon={SourceCodeIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Code block</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                  }
                  pressed={isBlockquote}
                  aria-label="Quote"
                  type="button"
                >
                  <HugeiconsIcon icon={QuoteUpIcon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Quote</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  onClick={handleToggleMath}
                  pressed={isMath}
                  aria-label="Math"
                  type="button"
                >
                  <HugeiconsIcon icon={Summation01Icon} />
                </ToggleGroupItem>
              }
            />
            <TooltipContent side="top">Math formula</TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </TooltipProvider>
    </TipTapBubbleMenu>
  )
}
