import {
  Alert02Icon,
  ArrowUp01Icon,
  Attachment01Icon,
  StopIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { usePromptInput } from "@workspace/ui/components/prompt-input"
import { cn } from "@workspace/ui/lib/utils"
import { useCallback, useMemo } from "react"
import {
  actionForCommandId,
  commandSource,
  referenceSource,
} from "./data/sources"
import { useComposerEvent } from "./hooks/use-composer-event"
import { useComposerShortcuts } from "./hooks/use-composer-shortcuts"
import { measureCaret } from "./primitives/caret"
import { PromptAutocomplete } from "./primitives/prompt-autocomplete"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActionsRow,
  PromptInputLead,
  PromptInputTextarea,
  PromptInputTrail,
} from "./primitives/prompt-input"
import {
  commitSuggestion,
  moveActive,
  recompute,
  type SuggestionItem,
  useSuggestionState,
  useSuggestionStore,
} from "./primitives/suggestion"
import { useCanSend, usePromptStore } from "./state/prompt-store"
import { ContextMeter } from "./surfaces/context-meter"
import { ContextRail } from "./surfaces/context-rail"
import { ComposerFeedback } from "./surfaces/feedback"
import { ModelPicker } from "./surfaces/model-picker"
import { ToolMenu } from "./surfaces/tool-menu"

/**
 * The editor, wired to the suggestion engine.
 *
 * The keyboard arbitration here is the part that decides whether the menu
 * feels like a tool or an interruption, so it is stated explicitly rather than
 * left to the order of `if`s:
 *
 *   menu open, item highlighted  →  commit the item
 *   menu open, nothing highlighted  →  close the menu, insert a newline
 *   menu closed  →  submit (or newline on Shift)
 *
 * The middle case is why `activeIndex` cannot default to 0 the moment a menu
 * opens: a bare `/` would otherwise make Enter commit whichever item happened
 * to sort first, instead of doing nothing.
 */
function PromptEditor() {
  const { value, onSubmit, textareaRef } = usePromptInput()
  const store = useSuggestionStore()
  const suggestion = useSuggestionState(store)

  const mentions = usePromptStore((s) => s.mentions)
  const setText = usePromptStore((s) => s.setText)
  const addMentions = usePromptStore((s) => s.addMentions)

  const sources = useMemo(
    () => ({ slash: commandSource(), mention: referenceSource() }),
    [],
  )

  const sync = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const state = recompute({
      store,
      text: value,
      caret: textarea.selectionStart ?? value.length,
      anchor: null,
      spans: mentions.map((m) => ({ start: m.start, end: m.end })),
      sources,
    })

    // Only measure when there is actually a trigger to anchor to. Measuring on
    // every keystroke would lay out a mirror element per character for a popup
    // that usually does not exist.
    if (state.open) {
      const rect = measureCaret(
        textarea,
        value,
        textarea.selectionStart ?? value.length,
      )
      store.set({ ...state, anchor: rect })
    } else {
      store.set(state)
    }
  }, [store, value, mentions, sources, textareaRef])

  const handleSelect = useCallback(
    (item: SuggestionItem) => {
      const committed = commitSuggestion({
        state: suggestion,
        text: value,
        item,
      })
      if (!committed) return

      if (item.id.startsWith("command:")) {
        const action = actionForCommandId(item.id)
        // A command is an action, not text: the label is inserted so the user
        // can see what they chose, then the action runs.
        setText(committed.text)
        if (action) runCommand(action)
      } else {
        setText(committed.text)
        addMentions([
          {
            id: committed.item.id,
            kind: item.id.startsWith("ref:") ? "file" : "file",
            label: item.label,
            insertText: item.insertText,
            start: committed.start,
            end: committed.end,
          },
        ])
      }
      store.set({
        ...suggestion,
        open: false,
        items: [],
        trigger: null,
        anchor: null,
      })

      // Restore the caret after the insertion so typing continues where the
      // menu left off rather than jumping to the end of the document.
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (!textarea) return
        const caret = committed.end + 1
        textarea.focus()
        textarea.setSelectionRange(caret, caret)
      })
    },
    [addMentions, setText, store, suggestion, textareaRef, value],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const state = store.get()

      if (state.open) {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          store.set(moveActive(state, 1))
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          store.set(moveActive(state, -1))
          return
        }
        if (event.key === "Escape") {
          // First Escape closes the menu and keeps focus in the editor. Only a
          // second one is allowed to blur — one Escape should never cost the
          // user their place in a half-written prompt.
          event.preventDefault()
          store.set({ ...state, open: false, items: [], trigger: null })
          return
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault()
          if (state.activeIndex >= 0 && state.items[state.activeIndex]) {
            handleSelect(state.items[state.activeIndex])
          } else {
            store.set({ ...state, open: false, items: [], trigger: null })
          }
          return
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        onSubmit?.()
      }
    },
    [handleSelect, onSubmit, store],
  )

  return (
    <>
      <PromptInputTextarea
        placeholder="Ask anything, @tag files, or use / for commands"
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setText(event.target.value)
          sync()
        }}
        onKeyUp={sync}
        onClick={sync}
        onSelect={sync}
        onBlur={() => {
          // A delayed close so a click that lands on a menu row is not
          // cancelled by the blur it caused.
          setTimeout(() => {
            const state = store.get()
            if (state.open) store.set({ ...state, open: false })
          }, 120)
        }}
        // Gutters are stated here rather than inherited, because the shell is
        // rendered at `p-0` and three children would otherwise each guess. All
        // three line up on the same optical edge: text and chips at `px-3`, the
        // icon buttons at `px-2` so their circles clear the border.
        className="min-h-12 px-3 pt-3 pb-1 text-base leading-relaxed md:text-base"
      />
      <PromptAutocomplete
        state={suggestion}
        onSelect={handleSelect}
        onActiveIndexChange={(index) =>
          store.set({ ...store.get(), activeIndex: index })
        }
      />
    </>
  )
}

function runCommand(action: ReturnType<typeof actionForCommandId>): void {
  if (!action) return
  const store = usePromptStore.getState()
  switch (action.kind) {
    case "toggle-search":
      store.toggleSearch()
      break
    case "clear":
      store.clearAttachments()
      store.setText("")
      break
    default:
      // Opening the pickers is a UI concern; the commands dispatch a custom
      // event the composer listens for rather than importing the components
      // and creating a cycle.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(`composer:${action.kind.replace("open-", "open-")}`),
        )
      }
      break
  }
}

/**
 * ⌘⇧P toggles the model picker. Registered at the document rather than on the
 * textarea so it works when focus is on a tool chip or the send button.
 */
function useOpenModelPicker() {
  return useComposerShortcuts({
    onModel: () => {
      window.dispatchEvent(new CustomEvent("composer:open-model-picker"))
    },
  })
}

export function Composer({ className }: { className?: string }) {
  const addAttachments = usePromptStore((s) => s.addAttachments)
  const hydrated = usePromptStore((s) => s.hydrated)
  const providersError = usePromptStore((s) => s.providersError)
  const text = usePromptStore((s) => s.text)
  const setText = usePromptStore((s) => s.setText)
  const { canSend, busy } = useCanSend()

  const retryProviders = useCallback(() => {
    usePromptStore.setState({ providersError: null })
    void usePromptStore.getState().hydrate()
  }, [])

  const handleSend = useCallback(() => {
    if (busy) usePromptStore.getState().stop()
    else usePromptStore.getState().submit()
  }, [busy])

  const pickFiles = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.onchange = () => {
      if (input.files) addAttachments(Array.from(input.files))
    }
    input.click()
  }, [addAttachments])

  useOpenModelPicker()

  useComposerEvent("composer:open-files", pickFiles)

  return (
    <div className={cn("relative flex w-full flex-col gap-2", className)}>
      <ComposerFeedback />

      {/* A provider list that could not be read is said out loud, with the
          retry in reach: a silent empty list would hide the failure — and
          with it the context meter, the model picker, and every control that
          needs a model. */}
      {hydrated && providersError ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <HugeiconsIcon
            icon={Alert02Icon}
            className="size-4 shrink-0 text-amber-500"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">Couldn't load your providers.</span>{" "}
            <span className="text-muted-foreground">
              The model list, effort, and the context meter need one.
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-xs"
            onClick={retryProviders}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <PromptInput
        value={text}
        onValueChange={setText}
        onSubmit={handleSend}
        maxHeight={220}
        // The shell's own `p-2` is replaced rather than added to, because the
        // rail and the toolbar carry their own gutters and stacking two would
        // push the text off-centre relative to the buttons below it.
        className="relative p-0 pb-1.5"
      >
        <ContextRail mode="chips" />

        <PromptEditor />

        <PromptInputActionsRow className="px-2 pt-0.5">
          <PromptInputLead>
            <PromptInputAction tooltip="Attach files">
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={pickFiles}
                aria-label="Attach files"
              >
                <HugeiconsIcon icon={Attachment01Icon} className="size-4" />
              </Button>
            </PromptInputAction>

            <ToolMenu />
          </PromptInputLead>

          <PromptInputTrail>
            <ContextMeter />
            <ModelPicker />

            <PromptInputAction tooltip={busy ? "Stop" : "Send"}>
              <Button
                size="icon"
                className="rounded-full transition-all duration-300 ease-out"
                disabled={!busy && !canSend}
                onClick={handleSend}
                aria-label={busy ? "Stop generating" : "Send message"}
              >
                <HugeiconsIcon
                  icon={busy ? StopIcon : ArrowUp01Icon}
                  className="size-4"
                />
              </Button>
            </PromptInputAction>
          </PromptInputTrail>
        </PromptInputActionsRow>
      </PromptInput>

      {!hydrated ? (
        <p className="text-muted-foreground px-3 text-xs">Loading providers…</p>
      ) : null}
    </div>
  )
}
