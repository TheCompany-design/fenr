import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { Composer } from "./composer"
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

  function render(): void {
    act(() => {
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

  function type(text: string): void {
    act(() => {
      usePromptStore.setState({ text })
    })
  }

  it("rests as a pill", () => {
    render()
    expect(shell()?.getAttribute("data-density")).toBe("pill")
  })

  it("grows into a panel when the draft outgrows one line", () => {
    render()
    layOut(52, 26)
    type("a draft long enough to need a second line")

    expect(shell()?.getAttribute("data-density")).toBe("panel")
  })

  it("collapses back to a pill when the draft is short again", () => {
    render()
    layOut(52, 26)
    type("a draft long enough to need a second line")
    expect(shell()?.getAttribute("data-density")).toBe("panel")

    layOut(26, 26)
    type("short again")
    expect(shell()?.getAttribute("data-density")).toBe("pill")
  })

  it("takes the panel for a staged attachment, however short the draft", () => {
    render()
    expect(shell()?.getAttribute("data-density")).toBe("pill")

    act(() => {
      usePromptStore
        .getState()
        .addAttachments([
          new File(["{}"], "payload.json", { type: "application/json" }),
        ])
    })

    expect(shell()?.getAttribute("data-density")).toBe("panel")

    act(() => {
      usePromptStore.getState().clearAttachments()
    })
    expect(shell()?.getAttribute("data-density")).toBe("pill")
  })

  it("measures a draft that was already there when it mounted", () => {
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
      render()
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

  it("keeps the draft the same width in both densities", () => {
    render()
    const pillClass = shell()?.className ?? ""

    layOut(52, 26)
    type("a draft long enough to need a second line")
    const panelClass = shell()?.className ?? ""

    // The fit test is taken at pill gutters whichever box we are in, so the
    // textarea must be exactly as wide in both. Horizontal shell padding in one
    // density and not the other would have the text measured against a width it
    // never actually gets — off by enough to clip a line.
    expect(shell()?.className).not.toMatch(/\bpx-\d/)
    expect(pillClass).toMatch(/\bpy-3\b/)
    expect(panelClass).not.toMatch(/\bpy-3\b/)
  })

  it("keeps one textarea through the morph", () => {
    render()
    const before = textarea()
    layOut(52, 26)
    type("a draft long enough to need a second line")

    // A remount here would drop the caret, the IME session, and the selection
    // mid-sentence. The morph has to be the same box, not a swap.
    expect(textarea()).toBe(before)
  })

  it("shows the draft's controls in both densities", () => {
    render()
    const lead = () =>
      container?.querySelector('[data-slot="prompt-lead"] button') ?? null
    expect(lead()?.getAttribute("aria-label")).toBe("Add files and tools")

    layOut(52, 26)
    type("a draft long enough to need a second line")

    expect(shell()?.getAttribute("data-density")).toBe("panel")
    expect(lead()?.getAttribute("aria-label")).toBe("Add files and tools")
    expect(
      container?.querySelector('button[aria-label="Send message"]'),
    ).not.toBeNull()
  })
})
