import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { CODE_BLOCK_LANGUAGES } from "./code-block"

export interface CodeBlockViewProps {
  node: {
    attrs: { language?: string }
    textContent: string
  }
  updateAttributes: (attributes: Record<string, unknown>) => void
  selected?: boolean
}

/** Format a language id for display ("plaintext" → "Plain text"). */
export function formatLanguageLabel(language: string): string {
  if (language === "plaintext") return "Plain text"
  if (language === "c++") return "C++"
  if (language === "csp") return "CSP"
  return language.charAt(0).toUpperCase() + language.slice(1)
}

/**
 * Notion-style code block chrome: a language picker and copy button in a
 * header bar above the highlighted code surface.
 */
export function CodeBlockView({ node, updateAttributes, selected }: CodeBlockViewProps) {
  const language = typeof node.attrs.language === "string" && node.attrs.language
    ? node.attrs.language
    : "plaintext"

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent)
      toast.success("Code copied to clipboard")
    } catch {
      toast.error("Failed to copy code")
    }
  }

  return (
    <NodeViewWrapper
      data-code-block-wrapper=""
      className={cn(
        "my-3 overflow-hidden rounded-lg border border-border/60 bg-muted/30",
        selected && "ring-2 ring-ring/40",
      )}
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-2 py-1"
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                aria-label="Code language"
              >
                {formatLanguageLabel(language)}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-72 w-44 overflow-hidden">
            <ScrollArea className="max-h-64">
              {CODE_BLOCK_LANGUAGES.map((name) => (
                <DropdownMenuItem
                  key={name}
                  onClick={() => updateAttributes({ language: name })}
                  className={cn(name === language && "bg-accent")}
                >
                  <span className="flex-1">{formatLanguageLabel(name)}</span>
                  {name === language ? (
                    <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          aria-label="Copy code"
          onClick={copy}
          type="button"
        >
          <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
        </Button>
      </div>
      {/* NodeViewContent's as prop is typed narrowly, but the rendered
          element must match the codeBlock schema tag (pre). */}
      <NodeViewContent as={"pre" as "div"} />
    </NodeViewWrapper>
  )
}
