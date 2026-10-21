import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import type { ResolvedCaps } from "../catalog/capabilities"
import { usePromptStore } from "../state/prompt-store"
import { EffortControl } from "./effort-control"

const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
]

const SOLO = [{ id: "balanced", label: "Balanced" }]

const TWO = [
  { id: "low", label: "Low" },
  { id: "high", label: "High" },
]

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
    } catch {}
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

  function labels(): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>("[data-effort-label]")]
  }

  async function moveTo(value: number): Promise<void> {
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
  }

  it("ranges over the model's own levels", async () => {
    seed(ANTHROPIC, "medium")
    await render()
    const el = bar()

    expect(el.min).toBe("0")
    expect(el.max).toBe("3")
    expect(el.step).toBe("1")
    expect(el.value).toBe("1")
  })

  it("puts one of the model's own names over each of its stops", async () => {
    seed(ANTHROPIC, "high")
    await render()

    expect(labels().map((l) => l.textContent)).toEqual([
      "Low",
      "Medium",
      "High",
      "Max",
    ])
    expect(labels().map((l) => l.style.left)).toEqual([
      "0%",
      "33.33333333333333%",
      "66.66666666666666%",
      "100%",
    ])

    expect(labels()[0].className).not.toContain("-translate-x")
    expect(labels()[1].className).toContain("-translate-x-1/2")
    expect(labels()[2].className).toContain("-translate-x-1/2")
    expect(labels()[3].className).toContain("-translate-x-full")

    const lit = labels().filter((l) => l.dataset.active === "true")
    expect(lit.map((l) => l.dataset.effortLabel)).toEqual(["high"])
    expect(lit[0].textContent).toBe("High")
    expect(
      container
        .querySelector("[data-effort-labels]")
        ?.getAttribute("aria-hidden"),
    ).toBe("true")
    expect(bar().getAttribute("aria-valuetext")).toBe("High")
  })

  it("carries the knob sizes on a common wrapper, so the marks and labels can see them", async () => {
    seed(ANTHROPIC, "medium")
    await render()

    const scope = container.querySelector<HTMLElement>(".effort-bar-scope")
    expect(
      scope?.contains(container.querySelector("[data-effort-marks]")),
    ).toBe(true)
    expect(scope?.contains(bar())).toBe(true)
    expect(
      scope?.contains(container.querySelector("[data-effort-labels]")),
    ).toBe(true)
    expect(container.querySelector("input[type=range]")?.className).toBe(
      "effort-bar",
    )
  })

  it("stays a plain two-stop bar when the model offers only two levels", async () => {
    seed(TWO, "low")
    await render()

    expect(bar().max).toBe("1")
    expect(bar().value).toBe("0")
    expect(marks().map((m) => m.style.left)).toEqual(["0%", "100%"])

    expect(labels().map((l) => l.textContent)).toEqual(["Low", "High"])
  })

  it("draws one mark per level, at that level's own position", async () => {
    seed(ANTHROPIC, "medium")
    await render()

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

    await moveTo(1)
    expect(chosen).toEqual(["medium"])
  })

  it("renders a one-level scale rather than a degenerate range", async () => {
    seed(SOLO, "balanced")
    await render()
    const el = bar()

    expect(el.min).toBe("0")
    expect(el.max).toBe("1")
    expect(el.value).toBe("0")

    expect(el.disabled).toBe(true)

    expect(marks()[0].style.left).toBe("50%")

    const name = labels()[0]
    expect(name.style.left).toBe("50%")
    expect(name.className).toContain("-translate-x-1/2")
    expect(name.textContent).toBe("Balanced")
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
