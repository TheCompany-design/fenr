import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import type { ResolvedCaps } from "../catalog/capabilities"
import { usePromptStore } from "../state/prompt-store"
import { useContextMeter } from "./use-context-meter"

const SOURCE = () => ({ systemPrompt: ".", messages: [] })

function MeterFixture(): null {
  useContextMeter(SOURCE)
  return null
}

const NOTHING = {
  access: { kind: "denied" as const, reason: "n/a" },
  capability: null,
}

const WITH_MODEL = {
  model: {
    id: "claude-opus-4-5-20251101",
    providerId: "p",
    name: "Claude Opus 4.5",
    tagline: "200k context",
    keyAccessConfirmed: true,
    caps: {},
    limits: { contextWindow: 200_000, maxOutput: 64_000 },
    cost: { inputPerMTok: 0, outputPerMTok: 0 },
  },
  modelAccess: { kind: "available" },
  vision: NOTHING,
  files: NOTHING,
  reasoning: NOTHING,
  tools: NOTHING,
  native: NOTHING,
  search: NOTHING,
} as unknown as ResolvedCaps

const WITHOUT_MODEL = {
  model: null,
  modelAccess: { kind: "available" },
  vision: NOTHING,
  files: NOTHING,
  reasoning: NOTHING,
  tools: NOTHING,
  native: NOTHING,
  search: NOTHING,
} as unknown as ResolvedCaps

describe("useContextMeter", () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const original = usePromptStore.getState()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    usePromptStore.setState({ caps: WITHOUT_MODEL, usage: null })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    usePromptStore.setState(original)
  })

  it("re-offers the measurement when only the resolved window changed", async () => {
    await act(async () => {
      root.render(createElement(MeterFixture))
    })
    expect(usePromptStore.getState().usage?.window).toBe(0)

    await act(async () => {
      usePromptStore.setState({ caps: WITH_MODEL })
    })
    expect(usePromptStore.getState().usage?.window).toBe(200_000)
    expect(usePromptStore.getState().blockers).toEqual([])
  })
})
