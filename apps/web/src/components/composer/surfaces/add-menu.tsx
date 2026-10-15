import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useMemo, useState } from "react"
import {
  type AddMenuItem,
  ATTACH_FILES_ID,
  buildAddMenuView,
} from "../data/add-menu-views"
import { useComposerEvent } from "../hooks/use-composer-event"
import { usePromptStore } from "../state/prompt-store"

/**
 * One selector for everything a message can be given.
 *
 * Files and tools used to be two controls because they were two features. They
 * are one control because they answer the same question — what will this message
 * be able to reach — and two buttons for one answer is how a toolbar starts
 * disagreeing with itself.
 *
 * What the rows *mean* is decided in `data/add-menu-views.ts`; this file renders
 * it and does nothing else. That split is what keeps the awkward distinctions
 * intact: a row the user owns is a switch, a row the provider or the agent
 * runtime executes is a fact, and a fact that looks like a switch is a lie
 * about what will happen on send.
 *
 * It carries no tooltip. The shared provider opens tooltips with no delay, so a
 * label and the menu it labels would open at the same instant in the same place,
 * and the tooltip would flash across the menu on every visit. The trigger's
 * accessible name is what the tooltip was standing in for anyway.
 */
export function AddMenu() {
  const caps = usePromptStore((s) => s.caps)
  const toolIds = usePromptStore((s) => s.toolIds)
  const toggleTool = usePromptStore((s) => s.toggleTool)
  const search = usePromptStore((s) => s.search)
  const toggleSearch = usePromptStore((s) => s.toggleSearch)
  const runtimeTools = usePromptStore((s) => s.runtimeTools)
  const [open, setOpen] = useState(false)

  // `/tools` and the ⌘⇧T shortcut open this, exactly as they opened the tool
  // menu it replaces.
  useComposerEvent("composer:open-tools", () => setOpen(true))

  const view = useMemo(
    () => buildAddMenuView({ caps, toolIds, search, runtimeTools }),
    [caps, toolIds, search, runtimeTools],
  )

  const activate = (item: AddMenuItem) => {
    switch (item.kind) {
      case "action":
        // The composer owns the file input; this only says "attach", so the
        // button, the `/attach` command, and anything else that asks for files
        // get the same picker.
        if (item.id === ATTACH_FILES_ID) {
          window.dispatchEvent(new CustomEvent("composer:open-files"))
        }
        return
      case "toggle":
        if (item.id === "search") toggleSearch()
        else toggleTool(item.id)
        return
      case "fact":
        // A fact is not a control. Rows of this kind render disabled, so this
        // branch only exists to make "a fact can never be activated" a decision
        // the switch states rather than one it implies.
        return
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={
              view.enabledCount > 0
                ? `Add files and tools, ${view.enabledCount} enabled`
                : "Add files and tools"
            }
          />
        }
      >
        <HugeiconsIcon icon={Add01Icon} className="size-4" />
        {/* The count is what the tool trigger's "Tools 3" used to say. Without
            it, switching a tool on would leave no trace once the menu closed —
            and it is guarded by the same state that decides whether those rows
            exist, so it cannot appear over an empty menu. */}
        {view.enabledCount > 0 ? (
          <span className="text-muted-foreground -ms-0.5 text-xs tabular-nums">
            {view.enabledCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-72 gap-0 p-1"
      >
        {view.sections.map((section, index) => (
          <DropdownMenuGroup key={section.id}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {section.label ? (
              <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
            ) : null}
            {section.items.map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                onActivate={() => activate(item)}
              />
            ))}
          </DropdownMenuGroup>
        ))}

        {view.nativeLocked ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Needs a connected key to run.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItem({
  item,
  onActivate,
}: {
  item: AddMenuItem
  onActivate: () => void
}) {
  const body = (
    <>
      <HugeiconsIcon
        icon={item.icon}
        className="text-muted-foreground size-4 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.label}</span>
        {item.hint ? (
          <span className="text-muted-foreground truncate text-xs">
            {item.hint}
          </span>
        ) : null}
      </span>
    </>
  )

  // A checkbox item is the one that stays open, so a turn can be given several
  // tools in a single visit without reopening the menu between each.
  if (item.kind === "toggle") {
    return (
      <DropdownMenuCheckboxItem
        checked={item.checked}
        onCheckedChange={onActivate}
        className="gap-2.5 py-1.5"
      >
        {body}
      </DropdownMenuCheckboxItem>
    )
  }

  if (item.kind === "action") {
    return (
      <DropdownMenuItem onClick={onActivate} className="gap-2.5 px-2 py-1.5">
        {body}
      </DropdownMenuItem>
    )
  }

  // Disabled rather than inert: keyboard navigation still reaches it, so a
  // screen reader can say what the deployment brings and that it is not yours to
  // change.
  return (
    <DropdownMenuItem disabled className="gap-2.5 px-2 py-1.5">
      {body}
    </DropdownMenuItem>
  )
}
