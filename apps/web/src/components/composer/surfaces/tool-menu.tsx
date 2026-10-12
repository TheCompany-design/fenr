import {
  ArrowDown01Icon,
  CommandIcon,
  DatabaseIcon,
  EarthIcon,
  Folder01Icon,
  GlobeIcon,
  Mortarboard01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { useState } from "react"
import {
  isUsable,
  type NativeToolKind,
  type ToolKind,
} from "../catalog/capabilities"
import { useComposerEvent } from "../hooks/use-composer-event"
import { usePromptStore } from "../state/prompt-store"

type ToolDef = {
  id: string
  label: string
  hint: string
  icon: typeof CommandIcon
}

/**
 * Tool ids are `"<kind>:<name>"`. Encoding the kind in the id is what lets the
 * store answer "can this model run that" as a set intersection instead of a
 * registry lookup — see `toolKindOf`.
 */
const LOCAL_TOOLS: ToolDef[] = [
  {
    id: "shell:Bash",
    label: "Run commands",
    hint: "Execute shell commands",
    icon: CommandIcon,
  },
  {
    id: "fs_read:Read",
    label: "Read files",
    hint: "Read from the workspace",
    icon: Folder01Icon,
  },
  {
    id: "fs_write:Write",
    label: "Write files",
    hint: "Create and edit files",
    icon: Wrench01Icon,
  },
  {
    id: "http:Fetch",
    label: "Fetch URL",
    hint: "Make HTTP requests",
    icon: GlobeIcon,
  },
  {
    id: "db:Query",
    label: "Query database",
    hint: "Run SQL against connected sources",
    icon: DatabaseIcon,
  },
]

const NATIVE_LABELS: Record<
  NativeToolKind,
  { label: string; hint: string; icon: typeof EarthIcon }
> = {
  web_search: {
    label: "Web search",
    hint: "Run by the provider",
    icon: EarthIcon,
  },
  code_interpreter: {
    label: "Code interpreter",
    hint: "Run by the provider",
    icon: Mortarboard01Icon,
  },
  computer_use: {
    label: "Computer use",
    hint: "Run by the provider",
    icon: CommandIcon,
  },
  file_search: {
    label: "File search",
    hint: "Run by the provider",
    icon: Folder01Icon,
  },
}

/**
 * Tools the *user* toggles versus tools the *provider* runs.
 *
 * The distinction drives the UI: a local tool is a checkbox the user owns and
 * can always turn off, while a native tool is something the provider executes
 * on its own infrastructure and which may be unavailable on the current key
 * or absent from the current model entirely. Collapsing them into one list
 * would misrepresent who is running what.
 */
export function ToolMenu() {
  const caps = usePromptStore((s) => s.caps)
  const toolIds = usePromptStore((s) => s.toolIds)
  const toggleTool = usePromptStore((s) => s.toggleTool)
  const search = usePromptStore((s) => s.search)
  const toggleSearch = usePromptStore((s) => s.toggleSearch)
  const runtimeTools = usePromptStore((s) => s.runtimeTools)
  const [open, setOpen] = useState(false)

  useComposerEvent("composer:open-tools", () => setOpen(true))

  const supportedKinds = isUsable(caps.tools)
    ? (caps.tools.capability.kinds as readonly ToolKind[])
    : []
  const nativeKinds = caps.native.capability?.kinds ?? []
  const nativeAvailable =
    isUsable(caps.native) || caps.native.access.kind === "gated"

  const available = LOCAL_TOOLS.filter((tool) =>
    supportedKinds.includes(tool.id.split(":")[0] as ToolKind),
  )
  // Tools the model supports but this session has not toggled. Shown, disabled,
  // so the user can see the ceiling rather than wondering what is missing.
  const unavailable = LOCAL_TOOLS.filter(
    (tool) => !supportedKinds.includes(tool.id.split(":")[0] as ToolKind),
  )

  const enabledCount = toolIds.length + (search ? 1 : 0)
  const hasTools =
    available.length > 0 ||
    nativeAvailable ||
    searchAvailable(caps) ||
    runtimeTools.length > 0

  if (!hasTools) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 shrink gap-1.5 rounded-full px-2.5 text-sm font-normal",
              enabledCount > 0 && "bg-accent",
            )}
            aria-label="Tools"
          />
        }
      >
        <HugeiconsIcon icon={Wrench01Icon} className="size-4" />
        <span className="hidden sm:inline">Tools</span>
        {enabledCount > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {enabledCount}
          </span>
        ) : null}
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-72 gap-0 p-1"
      >
        {searchAvailable(caps) ? (
          <>
            <ToolRow
              icon={EarthIcon}
              label="Web search"
              hint={searchOnHint(caps)}
              checked={search}
              onToggle={toggleSearch}
            />
            {available.length > 0 || nativeKinds.length > 0 ? (
              <div className="bg-border my-1 h-px" />
            ) : null}
          </>
        ) : null}

        {nativeKinds.map((kind) => {
          const meta = NATIVE_LABELS[kind]
          return (
            <div
              key={kind}
              className="text-muted-foreground flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm"
            >
              <HugeiconsIcon icon={meta.icon} className="size-4 shrink-0" />
              <span className="flex flex-1 flex-col">
                <span>{meta.label}</span>
                <span className="text-xs">{meta.hint}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wide">
                provider
              </span>
            </div>
          )
        })}

        {runtimeTools.length > 0 ? (
          <>
            {searchAvailable(caps) || nativeKinds.length > 0 ? (
              <div className="bg-border my-1 h-px" />
            ) : null}
            <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">
              Managed by the agent runtime
            </p>
            {runtimeTools.map((tool) => (
              <div
                key={tool.id}
                className="text-muted-foreground flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm"
              >
                <HugeiconsIcon
                  icon={Wrench01Icon}
                  className="size-4 shrink-0"
                />
                <span className="flex flex-1 flex-col">
                  <span>{tool.label}</span>
                  {tool.hint ? (
                    <span className="text-xs">{tool.hint}</span>
                  ) : null}
                </span>
                <span className="text-[10px] uppercase tracking-wide">
                  runtime
                </span>
              </div>
            ))}
          </>
        ) : null}

        {available.length > 0 ? (
          <>
            {nativeKinds.length > 0 ? (
              <div className="bg-border my-1 h-px" />
            ) : null}
            <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">
              Your tools
            </p>
            {available.map((tool) => (
              <ToolRow
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                hint={tool.hint}
                checked={toolIds.includes(tool.id)}
                onToggle={() => toggleTool(tool.id)}
              />
            ))}
          </>
        ) : null}

        {unavailable.length > 0 ? (
          <>
            <div className="bg-border my-1 h-px" />
            <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">
              Not supported by this model
            </p>
            {unavailable.map((tool) => (
              <div
                key={tool.id}
                className="text-muted-foreground/50 flex items-center gap-2.5 px-2 py-1.5 text-sm"
              >
                <HugeiconsIcon icon={tool.icon} className="size-4 shrink-0" />
                <span className="flex-1">{tool.label}</span>
              </div>
            ))}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function searchAvailable(
  caps: ReturnType<typeof usePromptStore.getState>["caps"],
): boolean {
  return caps.search.capability !== null
}

function searchOnHint(
  caps: ReturnType<typeof usePromptStore.getState>["caps"],
): string {
  return caps.search.access.kind === "gated"
    ? "Needs a connected key"
    : "Let the model search the web"
}

function ToolRow({
  icon,
  label,
  hint,
  checked,
  onToggle,
}: {
  icon: typeof EarthIcon
  label: string
  hint: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a full-width toggle row; a native checkbox cannot carry the row's two-line layout
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="hover:bg-accent flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
    >
      <HugeiconsIcon
        icon={icon}
        className="text-muted-foreground size-4 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="text-muted-foreground truncate text-xs">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "size-4 shrink-0 rounded border transition-colors",
          checked ? "border-primary bg-primary" : "border-border",
        )}
      >
        {checked ? (
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="m-auto size-3 text-primary-foreground"
          >
            <path
              d="M2.5 6.5L5 9l4.5-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
    </button>
  )
}
