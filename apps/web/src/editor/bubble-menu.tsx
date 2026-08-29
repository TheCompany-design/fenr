import { BubbleMenu as TipTapBubbleMenu } from '@tiptap/react/menus'
import { useCurrentEditor, useEditorState } from '@tiptap/react'

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, TextIcon, Heading01Icon, Heading02Icon, Heading03Icon, TextBoldIcon, TextItalicIcon, TextStrikethroughIcon } from '@hugeicons/core-free-icons'

const TEXT_TYPES = [
  { value: "text", label: "Text", icon: TextIcon },
  { value: "heading-1", label: "Heading 1", icon: Heading01Icon },
  { value: "heading-2", label: "Heading 2", icon: Heading02Icon },
  { value: "heading-3", label: "Heading 3", icon: Heading03Icon },
] as const

export const BubbleMenu = () => {
  const { editor } = useCurrentEditor()
  if (!editor) return null

  const { isBold, isItalic, isStrikethrough, textType } = useEditorState({
    editor,
    selector: (ctx) => {
      let currentType: (typeof TEXT_TYPES)[number]["value"] = "text"
      if (ctx.editor.isActive("heading", { level: 1 })) currentType = "heading-1"
      else if (ctx.editor.isActive("heading", { level: 2 })) currentType = "heading-2"
      else if (ctx.editor.isActive("heading", { level: 3 })) currentType = "heading-3"

      return {
        isBold: ctx.editor.isActive("bold") ?? false,
        isItalic: ctx.editor.isActive("italic") ?? false,
        isStrikethrough: ctx.editor.isActive("strike") ?? false,
        textType: currentType,
      }
    },
  })

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

  const currentTypeMeta =
    TEXT_TYPES.find((t) => t.value === textType) ?? TEXT_TYPES[0]
    
    return (
    <TipTapBubbleMenu editor={editor} className='flex items-center justify-between'>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost">{currentTypeMeta.label}<span><HugeiconsIcon icon={ArrowDown01Icon}/></span></Button>} />
        <DropdownMenuContent className="w-full">
          <DropdownMenuGroup>
              <DropdownMenuRadioGroup value={textType} onValueChange={handleTypeChange}>
                {TEXT_TYPES.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <span className="rounded-sm border-2 p-1">
                      <HugeiconsIcon icon={Icon} className="size-3" />
                    </span>
                    <span>{label}</span>
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToggleGroup variant="default" size="sm" multiple className="gap-0">
        <ToggleGroupItem
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={isBold ? 'is-active' : ''}
          type="button"
        >
          <HugeiconsIcon icon={TextBoldIcon} />
        </ToggleGroupItem>
        <ToggleGroupItem
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={isItalic ? 'is-active' : ''}
          type="button"
        >
          <HugeiconsIcon icon={TextItalicIcon} />
        </ToggleGroupItem>
        <ToggleGroupItem
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={isStrikethrough ? 'is-active' : ''}
          type="button"
        >
          <HugeiconsIcon icon={TextStrikethroughIcon} />
        </ToggleGroupItem>
      </ToggleGroup>
    </TipTapBubbleMenu>
  )
}
