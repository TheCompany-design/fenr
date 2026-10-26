import {
  Alert02Icon,
  ArrowUp01Icon,
  StopIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { usePromptInput } from "@workspace/ui/components/prompt-input"
import { cn } from "@workspace/ui/lib/utils"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  actionForCommandId,
  commandSource,
  referenceSource,
} from "./data/sources"
import { ComposerDensityProbe } from "./hooks/use-composer-density"
import { useComposerEvent } from "./hooks/use-composer-event"
import { useComposerShortcuts } from "./hooks/use-composer-shortcuts"
import { type CaretRect, measureCaret } from "./primitives/caret"
import { PromptAutocomplete } from "./primitives/prompt-autocomplete"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActionsRow,
  PromptInputEditor,
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
import {
  type ComposerDensity,
  PANEL_EDITOR_MAX_HEIGHT_PX,
  resolveDensity,
} from "./state/composer-density"
import { useCanSend, usePromptStore } from "./state/prompt-store"
import { AddMenu } from "./surfaces/add-menu"
import { ContextMeter } from "./surfaces/context-meter"
import { ContextRail } from "./surfaces/context-rail"
import { ComposerFeedback } from "./surfaces/feedback"
import { ModelPicker } from "./surfaces/model-picker"

function anchorFor(textarea: HTMLTextAreaElement, value: string): CaretRect {
  return (
    measureCaret(
      textarea,
      value,
      textarea.selectionStart ?? value.length,
      textarea.closest<HTMLElement>('[data-slot="prompt-input"]') ?? textarea,
    ) ?? { top: 0, left: 0, height: 0 }
  )
}

function PromptEditor({ density }: { density: ComposerDensity }) {
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

    if (state.open) {
      store.set({ ...state, anchor: anchorFor(textarea, value) })
    } else {
      store.set(state)
    }
  }, [store, value, mentions, sources, textareaRef])

  const resyncAnchor = useCallback(() => {
    const textarea = textareaRef.current
    const state = store.get()
    if (!textarea || !state.open) return
    store.set({ ...state, anchor: anchorFor(textarea, textarea.value) })
  }, [store, textareaRef])

  const resyncRef = useRef(resyncAnchor)
  useLayoutEffect(() => {
    resyncRef.current = resyncAnchor
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: `density` is the signal this effect waits on, not an input it reads — the re-anchor itself reaches the live caret through `resyncRef`, which is refreshed on every render for exactly that reason. A flip needs no keystroke and no geometry change of its own: a narrowed window re-wraps a boundary draft past one line and nothing else observable happens, so without this dependency the popup stays anchored where the caret *was*.
  useLayoutEffect(() => {
    resyncRef.current()
  }, [density])

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
      <PromptInputEditor
        maxHeight={PANEL_EDITOR_MAX_HEIGHT_PX}
        onScroll={resyncAnchor}
      >
        <PromptInputTextarea
          placeholder="Ask anything, or use / for commands"
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setText(event.target.value)
            sync()
          }}
          onKeyUp={sync}
          onClick={sync}
          onSelect={sync}
          onBlur={() => {
            setTimeout(() => {
              const state = store.get()
              if (state.open) store.set({ ...state, open: false })
            }, 120)
          }}
          className={cn(
            "text-base leading-relaxed md:text-base",
            density === "pill"
              ? "max-h-[1lh] min-h-0 py-0 pl-[var(--pill-inset-left,0px)] pr-[var(--pill-inset-right,0px)]"
              : "min-h-12 px-3 pt-3 pb-1",
          )}
        />
      </PromptInputEditor>
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(`composer:${action.kind.replace("open-", "open-")}`),
        )
      }
      break
  }
}

/**
 * ⌘⇧P opens the model picker, ⌘⇧T the add menu, ⌘⏎ sends. Registered at the
 * document rather than on the textarea so they work when focus is on a tool
 * chip or the send button.
 */
function useComposerShortcutsFor(onSubmit: () => void): void {
  useComposerShortcuts({
    onModel: () => {
      window.dispatchEvent(new CustomEvent("composer:open-model-picker"))
    },
    onTools: () => {
      window.dispatchEvent(new CustomEvent("composer:open-tools"))
    },
    onSubmit,
  })
}

/**
 * The chrome that lives outside the box while the box is a pill.
 *
 * A pill has one line and one row, and the controls that describe the draft —
 * which model will answer it, how much of the context it has already spent —
 * are not the same size as the draft. Putting them inside the pill spends a
 * fifth of the line on them and leaves the text ending under a model name; on
 * the row below, the draft gets the whole width and the two controls get a
 * quiet strip that reads as belonging to the box rather than inside it.
 *
 * Rendered *instead of* the in-box copies rather than alongside them, so there
 * is only ever one model picker in the document — two would mean two popovers
 * and two subscriptions to the same store.
 *
 * `px-2` is the action row's gutter, deliberately: when the draft expands and
 * these controls move inside, they land on the same optical edge they occupy
 * here, so the box changing shape does not also shift every control sideways.
 */
function ComposerOutboard() {
  return (
    <div
      data-slot="composer-outboard"
      className="flex items-center justify-between gap-2 px-2"
    >
      <ModelPicker />
      <ContextMeter />
    </div>
  )
}

export function Composer({ className }: { className?: string }) {
  const addAttachments = usePromptStore((s) => s.addAttachments)
  const hydrated = usePromptStore((s) => s.hydrated)
  const providersError = usePromptStore((s) => s.providersError)
  const text = usePromptStore((s) => s.text)
  const setText = usePromptStore((s) => s.setText)
  const hasAttachments = usePromptStore((s) => s.attachments.length > 0)
  const { canSend, busy } = useCanSend()

  // Measured, never set: the box is a pill or a panel because of what is in it.
  const [overflowing, setOverflowing] = useState(false)
  const density = resolveDensity({ overflowing, hasAttachments })
  const pill = density === "pill"

  const rootRef = useRef<HTMLDivElement>(null)

  /**
   * Gives the draft back the focus a flip tore out from under it.
   *
   * The outboard row unmounts when the box stops being a pill, and the flip
   * does not need a keystroke — a narrowed window can re-wrap a boundary draft,
   * and a dropped file stages without a click. If the picker's popover happened
   * to be open, its teardown leaves the focus nowhere at all, which strands a
   * keyboard user mid-sentence. The guard is narrow on purpose: only a focus
   * that genuinely fell to the body is reclaimed, and never on the first run —
   * a composer that grabs the focus the moment it mounts is a bug, not a
   * courtesy.
   */
  const seenFirstDensity = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `density` is the signal this effect waits on, not an input it reads. The outboard row unmounts on a flip and nothing else in the tree changes, so this is the only thing that can notice the focus was torn out.
  useLayoutEffect(() => {
    if (!seenFirstDensity.current) {
      seenFirstDensity.current = true
      return
    }
    if (document.activeElement !== document.body) return
    rootRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus()
  }, [density])

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

  useComposerShortcutsFor(handleSend)

  useComposerEvent("composer:open-files", pickFiles)

  return (
    <div
      ref={rootRef}
      className={cn("relative flex w-full flex-col gap-2", className)}
    >
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
        // The density is a consequence of the draft and the attachments, so it
        // is stated on the element rather than implied by its class names — both
        // for the stylesheet and for the tests that drive the morph.
        data-density={density}
        // The shell's own padding is replaced rather than added to, because the
        // rail and the toolbar carry their own gutters and stacking two would
        // push the text off-centre relative to the buttons below it.
        //
        // The pill's vertical room lives here for the reason noted on the
        // textarea: its own box is clamped to a single line and cannot hold
        // padding, so the shell is what gives the row its height and its centre.
        // It adds no *horizontal* padding, because the textarea's width has to
        // be the same in both densities — the fit test is taken at pill gutters
        // whatever the box currently is, and a shell that was 8px narrower in
        // one of them would quietly measure against a width the text never gets.
        //
        // The radius is the whole visual difference between the two densities:
        // the palette is monochrome, so height and shape are what say which one
        // you are looking at.
        //
        // Both radii are finite on purpose. `rounded-full` is
        // `calc(infinity * 1px)`, and a transition *into* an infinite value
        // never finishes in Chromium: the box sticks at the clamped maximum and
        // the running transition outranks every later declaration, so the panel
        // stays fully rounded.
        //
        // A pill's end is a semicircle exactly when the radius *reaches* half the
        // box's height, and past that point the browser scales every corner by a
        // single uniform factor — so a radius larger than half renders as
        // precisely half and no more. That is what lets the pill's be an `lh`
        // expression with room to spare instead of exact bookkeeping: the box's
        // height is the text's line plus the shell's padding, the border, and
        // whatever the editor wraps the draft in, and only the first of those is
        // a line. Written as `0.5lh + the padding` it came out two pixels short
        // of a semicircle, because `lh` here is the shell's line box (1.5) and
        // not the draft's (`leading-relaxed`), and the short ends read as flat
        // spots rather than as a deliberate shape. Reaching half is the
        // requirement; clearing it is free.
        className={cn(
          "relative transition-[border-radius] duration-200 motion-reduce:transition-none",
          pill ? "rounded-[calc(0.5lh+1rem)] py-3" : "rounded-4xl p-0 pb-1.5",
        )}
      >
        {/* Rendered unconditionally because the density rule guarantees it: an
            attachment is one of the two reasons there is a panel, so this rail
            is never mounted inside a pill. */}
        <ContextRail mode="chips" />

        <PromptEditor density={density} />

        <PromptInputActionsRow
          // The pill lays its controls *over* the row the text is written into,
          // which is what lets the same three regions serve both densities
          // without moving a single node. The overlay is transparent to input so
          // the empty half of the pill is still the textarea.
          className={cn(
            pill
              ? "pointer-events-none absolute inset-y-0 left-0 right-0"
              : "px-2 pt-0.5",
          )}
        >
          <PromptInputLead className={pill ? "pointer-events-auto" : undefined}>
            <AddMenu />
          </PromptInputLead>

          <PromptInputTrail
            className={pill ? "pointer-events-auto" : undefined}
          >
            {/* The meter and the picker are only in here once there is room for
                a row of their own. In the pill they are below the box — see
                `ComposerOutboard` — which is what buys the draft a full-width
                line instead of a 200px hole at the right end of it. */}
            {pill ? null : (
              <>
                <ContextMeter />
                <ModelPicker />
              </>
            )}

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

        {/* Last, deliberately. This reads the shell's textarea ref from a layout
            effect, and React runs those in tree order — a probe mounted above
            the editor would run before React attached the ref and measure
            nothing on the first paint. */}
        <ComposerDensityProbe
          density={density}
          onOverflowChange={setOverflowing}
        />
      </PromptInput>

      {pill ? <ComposerOutboard /> : null}

      {!hydrated ? (
        <p className="text-muted-foreground px-3 text-xs">Loading providers…</p>
      ) : null}
    </div>
  )
}
