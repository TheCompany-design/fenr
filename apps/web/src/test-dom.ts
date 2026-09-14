import { GlobalWindow } from "happy-dom"

export function setupTestDOM() {
  if (typeof globalThis.window === "undefined" || !globalThis.document) {
    const win = new GlobalWindow({ url: "http://localhost:3000" })
    Object.assign(globalThis, {
      window: win,
      document: win.document,
      navigator: win.navigator,
      customElements: win.customElements,
      Element: win.Element,
      HTMLElement: win.HTMLElement,
      HTMLInputElement: win.HTMLInputElement,
      HTMLTextAreaElement: win.HTMLTextAreaElement,
      Node: win.Node,
      Event: win.Event,
      UIEvent: win.UIEvent,
      MouseEvent: win.MouseEvent,
      KeyboardEvent: win.KeyboardEvent,
      InputEvent: win.InputEvent ?? win.Event,
      MutationObserver: win.MutationObserver,
      getComputedStyle: win.getComputedStyle?.bind(win),
      scrollTo: () => {},
      requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
      cancelAnimationFrame: (id: number) => clearTimeout(id),
    })
  } else {
    const win = globalThis.window as unknown as Record<string, unknown>
    if (!globalThis.MutationObserver && win.MutationObserver) {
      globalThis.MutationObserver =
        win.MutationObserver as typeof MutationObserver
    }
    if (
      !globalThis.getComputedStyle &&
      typeof win.getComputedStyle === "function"
    ) {
      globalThis.getComputedStyle = (
        win.getComputedStyle as Window["getComputedStyle"]
      ).bind(win as unknown as Window)
    }
    if (!globalThis.HTMLInputElement && win.HTMLInputElement) {
      globalThis.HTMLInputElement =
        win.HTMLInputElement as typeof HTMLInputElement
    }
    if (!globalThis.HTMLTextAreaElement && win.HTMLTextAreaElement) {
      globalThis.HTMLTextAreaElement =
        win.HTMLTextAreaElement as typeof HTMLTextAreaElement
    }
    if (!globalThis.Element && win.Element) {
      globalThis.Element = win.Element as typeof Element
    }
    if (!globalThis.HTMLElement && win.HTMLElement) {
      globalThis.HTMLElement = win.HTMLElement as typeof HTMLElement
    }
    if (!globalThis.Node && win.Node) {
      globalThis.Node = win.Node as typeof Node
    }
    if (!globalThis.Event && win.Event) {
      globalThis.Event = win.Event as typeof Event
    }
    if (!globalThis.KeyboardEvent && win.KeyboardEvent) {
      globalThis.KeyboardEvent = win.KeyboardEvent as typeof KeyboardEvent
    }
    if (!globalThis.MouseEvent && win.MouseEvent) {
      globalThis.MouseEvent = win.MouseEvent as typeof MouseEvent
    }
  }

  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
}

setupTestDOM()
