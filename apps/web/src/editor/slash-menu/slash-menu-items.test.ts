import { describe, expect, it } from "bun:test"
import {
  filterSlashMenuItems,
  groupSlashMenuItems,
  resolveSlashMenuItems,
  SLASH_MENU_GROUPS,
  SLASH_MENU_ITEMS,
} from "./slash-menu-items"

describe("SLASH_MENU_ITEMS registry", () => {
  it("has unique ids and complete metadata", () => {
    const ids = SLASH_MENU_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const item of SLASH_MENU_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.description.length).toBeGreaterThan(0)
      expect(typeof item.command).toBe("function")
      expect(SLASH_MENU_GROUPS.some((g) => g.id === item.group)).toBe(true)
    }
  })

  it("covers every declared group", () => {
    const usedGroups = new Set(SLASH_MENU_ITEMS.map((item) => item.group))
    for (const group of SLASH_MENU_GROUPS) {
      expect(usedGroups.has(group.id)).toBe(true)
    }
  })
})

describe("resolveSlashMenuItems", () => {
  it("shows everything under the default (opt-out) capabilities", () => {
    expect(resolveSlashMenuItems({})).toEqual(SLASH_MENU_ITEMS)
  })

  it("drops items whose required capabilities are disabled", () => {
    const items = resolveSlashMenuItems({
      tables: false,
      images: false,
      mathematics: false,
    })
    const ids = items.map((item) => item.id)
    expect(ids).not.toContain("table")
    expect(ids).not.toContain("image")
    expect(ids).not.toContain("math-block")
    expect(ids).toContain("text")
    expect(ids).toContain("code-block")
  })
})

describe("filterSlashMenuItems", () => {
  const items = resolveSlashMenuItems({})

  it("returns everything for a blank query", () => {
    expect(filterSlashMenuItems(items, "")).toEqual(items)
    expect(filterSlashMenuItems(items, "   ")).toEqual(items)
  })

  it("matches labels case-insensitively", () => {
    const ids = filterSlashMenuItems(items, "HEADING").map((i) => i.id)
    expect(ids).toEqual(["heading-1", "heading-2", "heading-3"])
  })

  it("matches keywords beyond the label", () => {
    const ids = filterSlashMenuItems(items, "todo").map((i) => i.id)
    expect(ids).toContain("to-do-list")
  })

  it("matches descriptions", () => {
    const ids = filterSlashMenuItems(items, "katex").map((i) => i.id)
    expect(ids).toContain("math-block")
  })

  it("returns nothing for unmatched queries", () => {
    expect(filterSlashMenuItems(items, "quantum-entanglement")).toEqual([])
  })
})

describe("groupSlashMenuItems", () => {
  it("returns non-empty sections in canonical group order", () => {
    const sections = groupSlashMenuItems(SLASH_MENU_ITEMS)
    expect(sections.map((s) => s.group.id)).toEqual(
      SLASH_MENU_GROUPS.filter((g) =>
        SLASH_MENU_ITEMS.some((item) => item.group === g.id),
      ).map((g) => g.id),
    )
  })

  it("keeps registry order within each group", () => {
    const sections = groupSlashMenuItems(SLASH_MENU_ITEMS)
    const basics = sections.find((s) => s.group.id === "basics")
    expect(basics?.items.map((i) => i.id)).toEqual([
      "text",
      "heading-1",
      "heading-2",
      "heading-3",
      "bullet-list",
      "numbered-list",
      "to-do-list",
      "quote",
      "code-block",
      "divider",
    ])
  })

  it("skips groups filtered away entirely", () => {
    const items = resolveSlashMenuItems({
      images: false,
      tables: false,
      mathematics: false,
    })
    const sections = groupSlashMenuItems(items)
    expect(sections.some((s) => s.group.id === "media")).toBe(false)
    expect(sections.some((s) => s.group.id === "advanced")).toBe(false)
  })
})
