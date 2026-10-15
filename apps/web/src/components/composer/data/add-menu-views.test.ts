import { describe, expect, it } from "bun:test"
import type { ResolvedCaps } from "../catalog/capabilities"
import { ATTACH_FILES_ID, buildAddMenuView } from "./add-menu-views"

/**
 * A capability record with only what a test cares about set. Anything left out
 * resolves as unsupported, which is the state most of fenr's models are in.
 */
function caps(overrides: Partial<ResolvedCaps> = {}): ResolvedCaps {
  return {
    model: null,
    modelAccess: { kind: "unknown" },
    vision: { access: { kind: "denied", reason: "no" }, capability: null },
    files: { access: { kind: "denied", reason: "no" }, capability: null },
    reasoning: { access: { kind: "denied", reason: "no" }, capability: null },
    tools: { access: { kind: "denied", reason: "no" }, capability: null },
    native: { access: { kind: "denied", reason: "no" }, capability: null },
    search: { access: { kind: "denied", reason: "no" }, capability: null },
    ...overrides,
  }
}

function view(input: {
  caps?: ResolvedCaps
  toolIds?: string[]
  search?: boolean
  runtimeTools?: { id: string; label: string; hint?: string }[]
}) {
  return buildAddMenuView({
    caps: input.caps ?? caps(),
    toolIds: input.toolIds ?? [],
    search: input.search ?? false,
    runtimeTools: input.runtimeTools ?? [],
  })
}

const sectionIds = (built: ReturnType<typeof view>) =>
  built.sections.map((section) => section.id)

describe("buildAddMenuView", () => {
  it("always offers files, because attaching one is always allowed", () => {
    const built = view({})
    expect(sectionIds(built)).toEqual(["files"])
    expect(built.sections[0]?.items[0]).toMatchObject({
      id: ATTACH_FILES_ID,
      kind: "action",
      label: "Files",
    })
  })

  it("says nothing about files when the model takes none", () => {
    // A hint is only honest when there is something true behind it.
    expect(view({}).sections[0]?.items[0]?.hint).toBeUndefined()
  })

  it("states the file rules the model actually has", () => {
    const built = view({
      caps: caps({
        files: {
          access: { kind: "available" },
          capability: { kinds: ["text", "pdf"], maxFiles: 8, maxSizeMb: 0.05 },
        },
      }),
    })
    // 51, not 50: 0.05 MB is 51.2 KiB, and the number here comes from the same
    // formatter the blocker uses. One figure for both is the point — a hint that
    // rounds a ceiling the error message does not is a hint that lies by 2%.
    expect(built.sections[0]?.items[0]?.hint).toBe(
      "Text, PDFs up to 51 KB · 8 per message",
    )
  })

  it("offers web search only when the model has it", () => {
    expect(sectionIds(view({}))).not.toContain("search")
    expect(
      sectionIds(
        view({
          caps: caps({
            search: { access: { kind: "available" }, capability: true },
          }),
        }),
      ),
    ).toContain("search")
  })

  it("says a gated search needs a key rather than promising it works", () => {
    const built = view({
      caps: caps({
        search: {
          access: {
            kind: "gated",
            gate: { kind: "connect", providerId: "p", providerLabel: "P" },
          },
          capability: true,
        },
      }),
    })
    expect(built.sections[1]?.items[0]?.hint).toBe("Needs a connected key")
  })

  it("counts search as a switch only while it is on", () => {
    const withSearch = caps({
      search: { access: { kind: "available" }, capability: true },
    })
    expect(view({ caps: withSearch }).enabledCount).toBe(0)
    expect(view({ caps: withSearch, search: true }).enabledCount).toBe(1)
    expect(
      view({ caps: withSearch, search: true, toolIds: ["shell:Bash"] })
        .enabledCount,
    ).toBe(2)
  })

  it("lists only the tools the model supports, as switches", () => {
    const built = view({
      caps: caps({
        tools: {
          access: { kind: "available" },
          capability: { max: 4, kinds: ["shell", "fs_read"] },
        },
      }),
      toolIds: ["shell:Bash"],
    })
    const tools = built.sections.find((section) => section.id === "tools")
    expect(tools?.items.map((item) => item.label)).toEqual([
      "Run commands",
      "Read files",
    ])
    expect(tools?.items[0]).toMatchObject({ kind: "toggle", checked: true })
    expect(tools?.items[1]).toMatchObject({ kind: "toggle", checked: false })
  })

  it("shows the ceiling only when some tools are available", () => {
    // fenr's catalogue supports no tools at all, and five rows saying so is
    // noise rather than a ceiling.
    const none = view({
      caps: caps({
        tools: { access: { kind: "denied", reason: "no" }, capability: null },
      }),
    })
    expect(sectionIds(none)).not.toContain("unsupported")

    const some = view({
      caps: caps({
        tools: {
          access: { kind: "available" },
          capability: { max: 4, kinds: ["shell"] },
        },
      }),
    })
    expect(sectionIds(some)).toContain("unsupported")
    expect(
      some.sections.find((section) => section.id === "unsupported")?.items,
    ).toHaveLength(4)
  })

  it("never lists a ceiling row as something the user can switch", () => {
    const built = view({
      caps: caps({
        tools: {
          access: { kind: "available" },
          capability: { max: 4, kinds: ["shell"] },
        },
      }),
    })
    const ceiling = built.sections.find(
      (section) => section.id === "unsupported",
    )
    expect(ceiling?.items.every((item) => item.kind === "fact")).toBe(true)
  })

  it("omits the ceiling when the model supports every tool there is", () => {
    const built = view({
      caps: caps({
        tools: {
          access: { kind: "available" },
          capability: {
            max: 8,
            kinds: ["shell", "fs_read", "fs_write", "http", "db", "browser"],
          },
        },
      }),
    })
    expect(sectionIds(built)).not.toContain("unsupported")
  })

  it("reports the runtime's own tools as facts, with their own names", () => {
    const built = view({
      runtimeTools: [
        { id: "web_search", label: "Web search", hint: "Runs on the provider" },
      ],
    })
    const runtime = built.sections.find(
      (section) => section.id === "runtime-tools",
    )
    expect(runtime?.label).toBe("Managed by the agent runtime")
    expect(runtime?.items[0]).toMatchObject({
      kind: "fact",
      label: "Web search",
    })
  })

  it("tolerates a runtime tool that does not explain itself", () => {
    const built = view({ runtimeTools: [{ id: "echo", label: "Echo" }] })
    expect(
      built.sections.find((section) => section.id === "runtime-tools")
        ?.items[0],
    ).toMatchObject({ label: "Echo", hint: undefined })
  })

  it("keeps the provider's tools separate from the user's", () => {
    const built = view({
      caps: caps({
        native: {
          access: { kind: "available" },
          capability: { kinds: ["web_search"] },
        },
      }),
      toolIds: [],
    })
    const provider = built.sections.find(
      (section) => section.id === "provider-tools",
    )
    expect(provider?.label).toBe("Run by the provider")
    expect(provider?.items[0]).toMatchObject({ kind: "fact" })
    expect(sectionIds(built)).not.toContain("tools")
  })

  it("says when the provider's tools exist but this key cannot run them", () => {
    const locked = view({
      caps: caps({
        native: {
          access: {
            kind: "gated",
            gate: { kind: "connect", providerId: "p", providerLabel: "P" },
          },
          capability: { kinds: ["web_search"] },
        },
      }),
    })
    expect(locked.nativeLocked).toBe(true)
    // The rows are still listed: a capability that is hidden is a problem that
    // is invisible.
    expect(sectionIds(locked)).toContain("provider-tools")

    expect(view({}).nativeLocked).toBe(false)
  })
})
