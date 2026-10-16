import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { Composer } from "./composer"
import { PANEL_EDITOR_MAX_HEIGHT_PX } from "./state/composer-density"
import { usePromptStore } from "./state/prompt-store"

/**
 * The morph, driven end to end: a draft is written, the textarea is given the
 * two layout numbers a browser would compute, and the box has to change shape.
 *
 * happy-dom has no layout engine, so `scrollHeight` and `clientHeight` are 0 for
 * every element and the clamp a real browser applies to `max-height` never
 * happens. That is the same gap the chat suite patches by hand, and it is why
 * the clamp's own semantics are proven in `use-composer-density.test.ts` with a
 * fake that models `field-sizing-content`. What is left to prove here is the
 * loop: store → probe → measurement → density → the element's own attribute.
 */

describe("Composer density", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    usePromptStore.setState({
      text: "",
      mentions: [],
      attachments: [],
      selection: null,
      effort: null,
      toolIds: [],
      search: false,
      blockers: [],
      notices: [],
      usage: null,
      status: "ready",
      runtimeTools: [],
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root) {
      try {
        act(() => root?.unmount())
      } catch {
        // Ignored: the tree is discarded either way.
      }
      root = null
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
  })

  function render(): Promise<void> {
    // Awaited, and deliberately so: the scroll area measures itself in a
    // microtask after mount, and a synchronous `act` would let those state
    // updates land outside the act scope — which shows up as a wall of
    // "not wrapped in act" warnings and, worse, leaves the assertions racing a
    // pending render.
    return act(async () => {
      root?.render(createElement(Composer, {}))
    })
  }

  function shell(): HTMLElement | null {
    return (
      container?.querySelector<HTMLElement>('[data-slot="prompt-input"]') ??
      null
    )
  }

  function textarea(): HTMLTextAreaElement | null {
    return container?.querySelector("textarea") ?? null
  }

  /** Stands in for the layout a real browser would compute. */
  function layOut(scrollHeight: number, clientHeight: number): void {
    const element = textarea()
    if (!element) throw new Error("no textarea rendered")
    Object.defineProperty(element, "scrollHeight", {
      value: scrollHeight,
      configurable: true,
    })
    Object.defineProperty(element, "clientHeight", {
      value: clientHeight,
      configurable: true,
    })
  }

  function type(text: string): Promise<void> {
    return act(async () => {
      usePromptStore.setState({ text })
    })
  }

  it("rests as a pill", async () => {
    await render()
    expect(shell()?.getAttribute("data-density")).toBe("pill")
  })

  it("grows into a panel when the draft outgrows one line", async () => {
    await render()
    layOut(52, 26)
    await type("a draft long enough to need a second line")

    expect(shell()?.getAttribute("data-density")).toBe("panel")
  })

  it("collapses back to a pill when the draft is short again", async () => {
    await render()
    layOut(52, 26)
    await type("a draft long enough to need a second line")
    expect(shell()?.getAttribute("data-density")).toBe("panel")

    layOut(26, 26)
    await type("short again")
    expect(shell()?.getAttribute("data-density")).toBe("pill")
  })

  it("takes the panel for a staged attachment, however short the draft", async () => {
    await render()
    expect(shell()?.getAttribute("data-density")).toBe("pill")

    await act(async () => {
      usePromptStore
        .getState()
        .addAttachments([
          new File(["{}"], "payload.json", { type: "application/json" }),
        ])
    })

    expect(shell()?.getAttribute("data-density")).toBe("panel")

    await act(async () => {
      usePromptStore.getState().clearAttachments()
    })
    expect(shell()?.getAttribute("data-density")).toBe("pill")
  })

  it("measures a draft that was already there when it mounted", async () => {
    // A restored draft is real: a thread reopened with text in the box must come
    // up as a panel, not as a pill holding a scrollbar's worth of hidden text.
    //
    // The getters are patched on the prototype because there is no element yet
    // to patch, which makes the restore load-bearing: these getters live on
    // `Element.prototype`, so `HTMLTextAreaElement.prototype` has no own
    // descriptor to put back and the patch must be *deleted*. Leaving it behind
    // would report every later textarea as wrapped.
    const proto = Object.getPrototypeOf(document.createElement("textarea"))
    const scrollHeight = Object.getOwnPropertyDescriptor(proto, "scrollHeight")
    const clientHeight = Object.getOwnPropertyDescriptor(proto, "clientHeight")

    usePromptStore.setState({ text: "a draft that was restored from a thread" })
    Object.defineProperty(proto, "scrollHeight", {
      configurable: true,
      get: () => 78,
    })
    Object.defineProperty(proto, "clientHeight", {
      configurable: true,
      get: () => 26,
    })

    try {
      await render()
      expect(shell()?.getAttribute("data-density")).toBe("panel")
    } finally {
      if (scrollHeight) {
        Object.defineProperty(proto, "scrollHeight", scrollHeight)
      } else {
        delete proto.scrollHeight
      }
      if (clientHeight) {
        Object.defineProperty(proto, "clientHeight", clientHeight)
      } else {
        delete proto.clientHeight
      }
    }
  })

  it("keeps the draft the same width in both densities", async () => {
    await render()
    const pillClass = shell()?.className ?? ""

    layOut(52, 26)
    await type("a draft long enough to need a second line")
    const panelClass = shell()?.className ?? ""

    // The fit test is taken at pill gutters whichever box we are in, so the
    // textarea must be exactly as wide in both. Horizontal shell padding in one
    // density and not the other would have the text measured against a width it
    // never actually gets — off by enough to clip a line.
    expect(shell()?.className).not.toMatch(/\bpx-\d/)
    expect(pillClass).toMatch(/\bpy-3\b/)
    expect(panelClass).not.toMatch(/\bpy-3\b/)
  })

  it("keeps one textarea through the morph", async () => {
    await render()
    const before = textarea()
    layOut(52, 26)
    await type("a draft long enough to need a second line")

    // A remount here would drop the caret, the IME session, and the selection
    // mid-sentence. The morph has to be the same box, not a swap.
    expect(textarea()).toBe(before)
  })

  it("scrolls the draft with the app's scroll area, not the browser's", async () => {
    await render()

    const editor = container?.querySelector<HTMLElement>(
      '[data-slot="prompt-editor"]',
    )
    const viewport = container?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    )
    const draft = textarea()

    // A capped textarea is a native scroll container, and the browser paints
    // its own bar across the text. The cap belongs to the scroll area above it.
    expect(editor?.style.maxHeight).toBe(`${PANEL_EDITOR_MAX_HEIGHT_PX}px`)
    expect(draft?.style.maxHeight).toBe("")
    expect(viewport?.contains(draft ?? null)).toBe(true)
  })

  it("keeps the pill's one-line clamp, which is a measurement, not a cap", async () => {
    await render()
    // The pill is *measured* at one line, so its clamp has to stay on the
    // textarea — the scroll area's cap is eight lines and would let a draft
    // that should have expanded sit inside a scrollbar instead.
    expect(textarea()?.className).toContain("max-h-[1lh]")
  })

  it("keeps the model picker and the meter out of the pill", async () => {
    await render()
    const outboard = () =>
      container?.querySelector('[data-slot="composer-outboard"]') ?? null
    const trail = () =>
      container?.querySelector('[data-slot="prompt-trail"]') ?? null

    // The pill spends its one line on the draft. A picker and a gauge inside it
    // would take a fifth of that line and leave the text ending under a model
    // name — which is the thing the pill is for.
    expect(outboard()).not.toBeNull()
    expect(
      outboard()?.querySelector('button[aria-label="Change model"]'),
    ).not.toBeNull()
    expect(
      trail()?.querySelector('button[aria-label="Change model"]'),
    ).toBeNull()
    expect(
      trail()?.querySelector('button[aria-label="Send message"]'),
    ).not.toBeNull()
  })

  it("brings them back inside once the box has a row to spare", async () => {
    await render()
    layOut(52, 26)
    await type("a draft long enough to need a second line")

    const outboard = container?.querySelector('[data-slot="composer-outboard"]')
    const trail = container?.querySelector('[data-slot="prompt-trail"]')

    expect(shell()?.getAttribute("data-density")).toBe("panel")
    expect(outboard).toBeNull()
    expect(
      trail?.querySelector('button[aria-label="Change model"]'),
    ).not.toBeNull()
  })

  it("never has two model pickers, in either density", async () => {
    await render()
    const pickers = () =>
      container?.querySelectorAll('button[aria-label="Change model"]').length ??
      0
    expect(pickers()).toBe(1)

    layOut(52, 26)
    await type("a draft long enough to need a second line")
    // One at a time, not one of each: two pickers would be two popovers and two
    // subscriptions to the same store, one of which is invisible.
    expect(pickers()).toBe(1)
  })

  it("puts the meter on the same side of the row as the picker", async () => {
    usePromptStore.setState({
      usage: {
        breakdown: {
          system: 0,
          tools: 0,
          history: 1_000,
          attachments: 0,
          draft: 0,
        },
        used: 1_000,
        window: 200_000,
        ratio: 0.005,
        overflow: 0,
      },
    })
    await render()

    const outboard = container?.querySelector('[data-slot="composer-outboard"]')
    const meter = outboard?.querySelector('button[aria-label^="Context"]')
    const picker = outboard?.querySelector('button[aria-label="Change model"]')

    expect(meter).not.toBeNull()
    expect(picker).not.toBeNull()

    // Model on the left, gauge on the right: the diagonal that makes the row
    // read as belonging to the box rather than as a strip of its own.
    const order = Array.from(outboard?.children ?? [])
    expect(order.indexOf(picker as Element)).toBeLessThan(
      order.indexOf(meter as Element),
    )
  })

  it("shows the draft's controls in both densities", async () => {
    await render()
    const lead = () =>
      container?.querySelector('[data-slot="prompt-lead"] button') ?? null
    expect(lead()?.getAttribute("aria-label")).toBe("Add files and tools")

    layOut(52, 26)
    await type("a draft long enough to need a second line")

    expect(shell()?.getAttribute("data-density")).toBe("panel")
    expect(lead()?.getAttribute("aria-label")).toBe("Add files and tools")
    expect(
      container?.querySelector('button[aria-label="Send message"]'),
    ).not.toBeNull()
  })
})
