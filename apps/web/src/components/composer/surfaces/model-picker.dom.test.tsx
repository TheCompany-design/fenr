import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import type { ProviderSpec, ResolvedCaps } from "../catalog/capabilities"
import {
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  PROVIDERS,
} from "../catalog/providers"
import { usePromptStore } from "../state/prompt-store"
import { ModelPicker } from "./model-picker"

describe("ModelPicker trigger", () => {
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
      providers: original.providers,
      runtime: original.runtime,
      selection: original.selection,
      caps: original.caps,
      effort: original.effort,
      hydrated: original.hydrated,
      providersError: original.providersError,
      starredModels: original.starredModels,
    })
  })

  function capsFor(
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

  const ANTHROPIC_SCALE = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
    { id: "max", label: "Max" },
  ]

  function seed(input: {
    models: typeof OPENAI_MODELS
    providerId: string
    modelId: string
    caps?: ResolvedCaps
    effort?: string | null
  }): void {
    const provider = PROVIDERS.find((p) => p.id === input.providerId)
    if (!provider) throw new Error(`no provider ${input.providerId}`)
    act(() => {
      usePromptStore.setState({
        providers: PROVIDERS,
        hydrated: true,
        providersError: null,
        runtime: {
          [input.providerId]: {
            connection: { state: "ready", validatedAt: Date.now() },
            catalog: {
              state: "ready",
              models: input.models,
              fetchedAt: Date.now(),
              degraded: false,
            },
            entitlements: {},
          },
        } as never,
        selection: { providerId: input.providerId, modelId: input.modelId },
        caps: input.caps ?? original.caps,
        effort: input.effort ?? null,
      })
    })
  }

  function render(): Promise<void> {
    return act(async () => {
      root.render(createElement(ModelPicker, {}))
    })
  }

  function trigger(): HTMLElement {
    const el = container.querySelector<HTMLElement>(
      '[data-slot="model-picker-trigger"]',
    )
    if (!el) throw new Error("no model picker trigger rendered")
    return el
  }

  /**
   * The spoken half of the name: the `sr-only` text, with anything marked
   * `aria-hidden` left out.
   *
   * Deliberately not a stand-in for the whole accessible name. A single helper
   * that "computes" the name is exactly how an effort label ends up asserted
   * against a near-empty string, which passes whether or not the visible label
   * leaks into the name — so the visible side is asserted separately with
   * `textContent` throughout.
   */
  function spokenText(): string {
    return [...trigger().querySelectorAll("*")]
      .filter(
        (el) =>
          el.getAttribute("aria-hidden") !== "true" &&
          el.className.toString().includes("sr-only"),
      )
      .map((el) => el.textContent ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim()
  }

  it("shows the model and the effort beside it", async () => {
    seed({
      models: ANTHROPIC_MODELS,
      providerId: "anthropic",
      modelId: "claude-opus-5",
      caps: capsFor(ANTHROPIC_SCALE, "high"),
      effort: "high",
    })
    await render()
    const text = trigger().textContent ?? ""
    expect(text).toContain("Claude Opus 5")
    expect(text).toContain("High")
  })

  it("says both, and what the effort is, in the accessible name", async () => {
    seed({
      models: ANTHROPIC_MODELS,
      providerId: "anthropic",
      modelId: "claude-opus-5",
      caps: capsFor(ANTHROPIC_SCALE, "high"),
      effort: "max",
    })
    await render()
    // A static `aria-label` on this button used to replace its content entirely,
    // so the model name was never announced at all; the name now comes from the
    // content, and says both what pressing it does and what it is currently set
    // to — a button that announced only its current value gives no hint that it
    // changes anything.
    expect(spokenText()).toContain("Change model.")
    expect(spokenText()).toContain("Model:")
    expect(spokenText()).toContain("effort Max")
    expect(trigger().getAttribute("aria-label")).toBeNull()
  })

  it("shows the level the provider declared, not a prettified guess at its id", async () => {
    // The id and the label disagree on purpose.
    const model = {
      ...OPENAI_MODELS[0],
      caps: {
        ...OPENAI_MODELS[0].caps,
        reasoning: {
          supported: true as const,
          levels: [{ id: "medium_effort", label: "Balanced" }],
          default: "medium_effort",
        },
      },
    }
    seed({
      models: [model],
      providerId: "openai",
      modelId: model.id,
      caps: capsFor(
        [{ id: "medium_effort", label: "Balanced" }],
        "medium_effort",
      ),
      effort: "medium_effort",
    })
    await render()
    const text = trigger().textContent ?? ""
    expect(text).toContain("Balanced")
    expect(text).not.toContain("Medium_effort")
  })

  it("says nothing about effort for a model that has none", async () => {
    seed({
      models: ANTHROPIC_MODELS,
      providerId: "anthropic",
      modelId: "claude-fable-5",
      // Reasoning unavailable, which is what a model that offers none resolves
      // to — so the label's absence comes from the capability, not from the
      // test simply not having set an effort.
      caps: {
        reasoning: {
          access: { kind: "denied", reason: "Not supported by this model" },
          capability: null,
        },
      } as unknown as ResolvedCaps,
      effort: null,
    })
    await render()
    expect(trigger().textContent).toContain("Claude Fable 5")
    expect(spokenText()).not.toContain("effort")
    expect(trigger().textContent).not.toContain("effort")
  })

  it("still says what it does when no model is chosen", async () => {
    // These are the branches whose name the aria-label removal changed, and they
    // had no coverage at all — every other test here seeds a selection.
    act(() => {
      usePromptStore.setState({
        providers: PROVIDERS,
        hydrated: true,
        providersError: null,
        selection: null,
        effort: null,
      })
    })
    await render()
    expect(trigger().textContent).toContain("Select model")
    expect(spokenText()).toContain("Change model.")
    // Nothing to announce about an effort that was never chosen.
    expect(spokenText()).not.toContain("effort")
  })

  it("keeps the action in the name when there is no provider to choose from", async () => {
    act(() => {
      usePromptStore.setState({
        providers: [],
        hydrated: true,
        providersError: null,
        selection: null,
        effort: null,
      })
    })
    await render()
    // A bare status string would otherwise be announced as though it were the
    // button's command, which is how "No provider configured, button" happens.
    expect(trigger().textContent).toContain("No provider configured")
    expect(spokenText()).toContain("Change model.")
  })

  it("shows the effort a different model settles on, not the one left over", async () => {
    // `max` exists on Anthropic's scale and not on OpenAI's, so switching across
    // has to move the label rather than leave a level this model cannot take.
    seed({
      models: OPENAI_MODELS,
      providerId: "openai",
      modelId: OPENAI_MODELS[0].id,
      caps: capsFor(
        [
          { id: "none", label: "None" },
          { id: "low", label: "Low" },
          { id: "medium", label: "Medium" },
          { id: "high", label: "High" },
        ],
        "medium",
      ),
      effort: "high",
    })
    await render()
    const text = trigger().textContent ?? ""
    expect(text).toContain("High")
    expect(text).not.toContain("Max")
  })
})

/**
 * A failed catalogue read must say so where the models would have been.
 *
 * The failure this guards against is a lie the picker once told: a catalog
 * that could not be read rendered as "No matches" — a claim that a search ran
 * and found nothing, when nothing was ever searched. A stall (a resolver
 * hiccup, a vendor that timed out) is a finding with a retry, not an empty
 * vendor.
 */
describe("ModelPicker failed slot", () => {
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
      providers: original.providers,
      runtime: original.runtime,
      selection: original.selection,
      caps: original.caps,
      effort: original.effort,
      hydrated: original.hydrated,
      providersError: original.providersError,
      starredModels: original.starredModels,
    })
  })

  async function render(): Promise<void> {
    await act(async () => {
      root.render(createElement(ModelPicker, {}))
    })
  }

  function trigger(): HTMLElement {
    const el = container.querySelector<HTMLElement>(
      '[data-slot="model-picker-trigger"]',
    )
    if (!el) throw new Error("no model picker trigger rendered")
    return el
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => (button.textContent ?? "").includes(label))
  }

  /** A provider tab, found by its accessible name: the tab renders the
   * vendor's mark, not its name, so text alone cannot find it. */
  function tab(label: string): HTMLButtonElement | undefined {
    return [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.getAttribute("aria-label") === label)
  }

  it("names a failed read in the runtime's own words, and a retry reloads it", async () => {
    const finding = "the provider could not be reached from the runtime"
    // The failed state the slot is seeded with is itself the first attempt;
    // the retry below is the second.
    let attempts = 1
    const provider: ProviderSpec = {
      id: "nvidia",
      label: "NVIDIA NIM",
      plan: "workspace",
      source: {
        id: "nvidia",
        label: "NVIDIA NIM",
        vendor: "nvidia",
        // The credential is the runtime's business; the picker only reads
        // the catalogue.
        requiresCredential: false,
        load: async () => {
          attempts += 1
          if (attempts === 1) throw new Error(finding)
          return OPENAI_MODELS
        },
      },
    }

    act(() => {
      usePromptStore.setState({
        providers: [provider],
        hydrated: true,
        providersError: null,
        starredModels: [],
        selection: null,
        runtime: {
          nvidia: {
            availabilityEpoch: 0,
            connection: { state: "ready", validatedAt: Date.now() },
            catalog: {
              state: "failed",
              error: { kind: "unknown", message: finding },
              retryable: true,
            },
            entitlements: {},
          },
        } as never,
      })
    })
    await render()

    // The picker's own opening event, so the test does not depend on the
    // trigger's pointer plumbing.
    await act(async () => {
      trigger().click()
    })
    await act(async () => {
      tab("NVIDIA NIM")?.click()
    })

    const failed = document.body.textContent ?? ""
    expect(failed).toContain("Couldn't load this provider's models")
    expect(failed).toContain(finding)
    expect(failed).not.toContain("No matches")

    await act(async () => {
      button("Retry")?.click()
    })

    const reloaded = document.body.textContent ?? ""
    expect(reloaded).toContain("GPT-6 Astra")
    expect(reloaded).not.toContain("Couldn't load this provider's models")
    expect(attempts).toBe(2)
  })

  it("says a slot that is still loading with skeletons, not with a claim", async () => {
    const provider: ProviderSpec = {
      id: "nvidia",
      label: "NVIDIA NIM",
      plan: "workspace",
      source: {
        id: "nvidia",
        label: "NVIDIA NIM",
        vendor: "nvidia",
        requiresCredential: false,
        load: () => new Promise<never>(() => {}),
      },
    }
    act(() => {
      usePromptStore.setState({
        providers: [provider],
        hydrated: true,
        providersError: null,
        starredModels: [],
        selection: null,
        runtime: {
          nvidia: {
            availabilityEpoch: 0,
            connection: { state: "ready", validatedAt: Date.now() },
            catalog: { state: "loading" },
            entitlements: {},
          },
        } as never,
      })
    })
    await render()
    await act(async () => {
      trigger().click()
    })
    await act(async () => {
      tab("NVIDIA NIM")?.click()
    })

    const loading = document.body.textContent ?? ""
    expect(loading).not.toContain("No matches")
    expect(
      document.body.querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThan(0)
  })
})
