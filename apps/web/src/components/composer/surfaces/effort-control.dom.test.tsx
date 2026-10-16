import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import type { ResolvedCaps } from "../catalog/capabilities"
import { usePromptStore } from "../state/prompt-store"
import { EffortControl } from "./effort-control"

/**
 * The bar's job is to turn a position on a track into a level on *this* model's
 * scale. The store's side of that — settling a level onto a new model's list —
 * is proven in `catalog/effort.test.ts`; what is proven here is that the control
 * asks the model's own scale rather than a fixed one, and that it says the
 * level's name rather than its index.
 */

/** Anthropic's scale: four levels, no `none`, so not a prefix of OpenAI's. */
const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
]

/** A single level, to prove the degenerate case is renderable. */
const SOLO = [{ id: "balanced", label: "Balanced" }]

function capsWith(
  levels: readonly { id: string; label: string }[],
  defaultId: string,
): ResolvedCaps {
  return {
    reasoning: {
      access: { kind: "available" },
      capability: {
        levels,
        default: defaultId,
        encoding: { style: "enum", field: "reasoning_effort" },
      },
    },
  } as unknown as ResolvedCaps
}

describe("EffortControl", () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const original = usePromptStore.getState()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    try {
      act(() => root.unmount())
    } catch {
      // The tree is discarded either way.
    }
    container.remove()
    usePromptStore.setState({
      caps: original.caps,
      effort: original.effort,
      setEffort: original.setEffort,
    })
  })

  function seed(
    levels: readonly { id: string; label: string }[],
    effort: string | null,
  ): void {
    act(() => {
      usePromptStore.setState({ caps: capsWith(levels, levels[0].id), effort })
    })
  }

  function render(): Promise<void> {
    return act(async () => {
      root.render(createElement(EffortControl, {}))
    })
  }

  function bar(): HTMLInputElement {
    const el = container.querySelector<HTMLInputElement>('input[type="range"]')
    if (!el) throw new Error("no effort bar rendered")
    return el
  }

  function marks(): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>("[data-level-mark]")]
  }

  async function settle(value: number, levels: readonly { id: string }[]) {
    await render()
    const el = bar()
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set
    setter?.call(el, String(value))
    await act(async () => {
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    return levels[value]?.id
  }

  it("ranges over the model's own levels", async () => {
    seed(ANTHROPIC, "medium")
    await render()
    const el = bar()
    // Three steps, not four: the value is an index, and `low` is 0.
    expect(el.min).toBe("0")
    expect(el.max).toBe("3")
    expect(el.step).toBe("1")
    expect(el.value).toBe("1")
  })

  it("puts the chosen level's name in the label and in what it announces", async () => {
    seed(ANTHROPIC, "high")
    await render()
    expect(container.textContent).toContain("High")
    // Announced as the level's name, not "2 of 4" — which is the reason labels
    // are declared rather than prettified from the id.
    expect(bar().getAttribute("aria-valuetext")).toBe("High")
  })

  it("draws one mark per level, at that level's own position", async () => {
    seed(ANTHROPIC, "medium")
    await render()
    // Ends included, so the knob can reach them; a bar whose marks stop short of
    // its ends has positions no setting could occupy.
    expect(marks().map((m) => m.style.left)).toEqual([
      "0%",
      "33.33333333333333%",
      "66.66666666666666%",
      "100%",
    ])
  })

  it("fills the bar to the chosen level's position", async () => {
    seed(ANTHROPIC, "max")
    await render()
    expect(bar().style.getPropertyValue("--effort-at")).toBe("100%")
  })

  it("hides the chosen level's own mark, because the knob is on it", async () => {
    seed(ANTHROPIC, "high")
    await render()
    const active = marks().filter((m) => m.dataset.active === "true")
    expect(active).toHaveLength(1)
    expect(active[0].dataset.levelMark).toBe("high")
    expect(active[0].className).toContain("bg-transparent")
  })

  it("sets the level the position names, not a level at the same index elsewhere", async () => {
    const chosen: string[] = []
    act(() => {
      usePromptStore.setState({ setEffort: (effort) => chosen.push(effort) })
    })
    seed(ANTHROPIC, "low")
    // Index 1 is `low` on OpenAI's scale and `medium` on this one. The bar has
    // to ask this model.
    const id = await settle(1, ANTHROPIC)
    expect(id).toBe("medium")
    expect(chosen).toEqual(["medium"])
  })

  it("renders a one-level scale rather than a degenerate range", async () => {
    seed(SOLO, "balanced")
    await render()
    const el = bar()
    // `max` has to exceed `min` for the control to be valid at all.
    expect(el.min).toBe("0")
    expect(el.max).toBe("1")
    expect(el.value).toBe("0")
    // With nothing to compare it to, the single mark sits in the middle.
    expect(marks()[0].style.left).toBe("50%")
  })

  it("renders nothing for a model with no reasoning", async () => {
    act(() => {
      usePromptStore.setState({
        caps: {
          reasoning: {
            access: { kind: "denied", reason: "no" },
            capability: null,
          },
        } as unknown as ResolvedCaps,
        effort: null,
      })
    })
    await render()
    expect(container.querySelector('input[type="range"]')).toBeNull()
  })
})
