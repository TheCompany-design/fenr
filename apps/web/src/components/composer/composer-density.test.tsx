import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { Composer } from "./composer"
import { PANEL_EDITOR_MAX_HEIGHT_PX } from "./state/composer-density"
import { usePromptStore } from "./state/prompt-store"

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
      } catch {}
      root = null
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
  })

  function render(): Promise<void> {
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

    expect(shell()?.className).not.toMatch(/\bpx-\d/)
    expect(pillClass).toMatch(/\bpy-3\b/)
    expect(panelClass).not.toMatch(/\bpy-3\b/)
  })

  it("keeps one textarea through the morph", async () => {
    await render()
    const before = textarea()
    layOut(52, 26)
    await type("a draft long enough to need a second line")

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

  it("rounds the pill in units that follow the font, and never into an infinite radius", async () => {
    await render()

    // A pill's end is a semicircle once the radius reaches half the box's
    // height, and the browser clamps anything past that to exactly half — so
    // the only way to get this wrong is to come out *under* it. Both ways this
    // went wrong are invisible without a layout engine, which is why they are
    // pinned here:
    //
    //  - `rounded-full` is `calc(infinity * 1px)`. A transition *into* an
    //    infinite value never finishes in Chromium, so the panel stays fully
    //    rounded forever.
    //  - a radius written as half a line *plus the padding* came out short,
    //    because the shell's line box (1.5) is not the draft's
    //    (`leading-relaxed`). The shortfall read as flat spots, not as a
    //    deliberate shape.
    //
    // So: expressed in `lh`, which tracks the font size, and finite.
    const pillRadius = shell()?.className.match(
      /rounded-\[calc\(([^)]*)\)\]/,
    )?.[1]
    expect(pillRadius).toBeDefined()
    expect(pillRadius).toContain("lh")
    expect(shell()?.className).not.toContain("rounded-full")

    layOut(60, 52)
    await type("a draft long enough to need a second line")
    expect(shell()?.className).not.toContain("rounded-full")
    expect(shell()?.className).not.toContain("rounded-[calc(")
  })

  it("centres the draft in the pill rather than letting the editor's line box push it up", async () => {
    await render()
    // A textarea is an inline-block by default, so it sits on a line box whose
    // strut adds leading *below* the control. Once the scroll area wraps it
    // that stray leading becomes part of the box's height: the pill grew by it
    // and the draft ended up sitting high inside it. Block-level, the editor is
    // exactly as tall as the text and the shell's own padding does the centring.
    expect(textarea()?.className).toContain("block")
    expect(textarea()?.className).not.toContain("inline-block")
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
      outboard()?.querySelector('[data-slot="model-picker-trigger"]'),
    ).not.toBeNull()
    expect(
      trail()?.querySelector('[data-slot="model-picker-trigger"]'),
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
      trail?.querySelector('[data-slot="model-picker-trigger"]'),
    ).not.toBeNull()
  })

  it("never has two model pickers, in either density", async () => {
    await render()
    const pickers = () =>
      container?.querySelectorAll('[data-slot="model-picker-trigger"]')
        .length ?? 0
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
    const picker = outboard?.querySelector('[data-slot="model-picker-trigger"]')

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
