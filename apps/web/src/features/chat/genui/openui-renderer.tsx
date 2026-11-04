import { type ActionEvent, Renderer } from "@openuidev/react-lang"
import { ThemeProvider } from "@openuidev/react-ui"
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { moduleLogger } from "@/lib/logger"
import { isDarkApplied, useThemeStore } from "@/lib/stores/theme.store"
import { createOpenUiFollowUp, extractOpenUiProgram } from "./openui-response"

const log = moduleLogger("chat:genui")

export interface OpenUiRendererProps {
  readonly content: string
  readonly isStreaming: boolean
  readonly onContinue: (prompt: string) => void
}

function handleHostAction(
  event: ActionEvent,
  onContinue: (prompt: string) => void,
) {
  if (event.type === "continue_conversation") {
    const prompt = createOpenUiFollowUp(
      event.humanFriendlyMessage,
      event.formState,
    )
    if (prompt) onContinue(prompt)
    return
  }

  if (event.type === "open_url") {
    const rawUrl = event.params?.url
    if (typeof rawUrl !== "string") return
    try {
      const url = new URL(rawUrl)
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        toast.error("This link cannot be opened")
        return
      }
      window.open(url.href, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("This link is invalid")
    }
    return
  }

  log.warn({ actionType: event.type }, "unsupported GenUI host action")
}

export function OpenUiRenderer({
  content,
  isStreaming,
  onContinue,
}: OpenUiRendererProps) {
  const program = extractOpenUiProgram(content)
  const mode = useThemeStore((state) => state.mode)
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => setSystemPrefersDark(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  const dark = isDarkApplied(mode, systemPrefersDark)
  const onAction = useCallback(
    (event: ActionEvent) => handleHostAction(event, onContinue),
    [onContinue],
  )
  const onError = useCallback(
    (
      errors: Parameters<
        NonNullable<React.ComponentProps<typeof Renderer>["onError"]>
      >[0],
    ) => {
      const actionable = errors.filter((error) => error.severity !== "warning")
      if (!actionable.length) return
      log.warn(
        { codes: actionable.map((error) => error.code) },
        "OpenUI response contained invalid component output",
      )
      if (!isStreaming) {
        toast.error("This interactive response could not be rendered")
      }
    },
    [isStreaming],
  )

  if (!program) return null

  return (
    <div className="openui-message min-w-0 w-full overflow-hidden rounded-xl">
      <ThemeProvider mode={dark ? "dark" : "light"}>
        <Renderer
          response={program}
          library={openuiChatLibrary}
          isStreaming={isStreaming}
          onAction={onAction}
          onError={onError}
        />
      </ThemeProvider>
    </div>
  )
}
