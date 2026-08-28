import { describe, expect, it } from "bun:test"
import { NAV_ITEMS } from "./nav-config"

describe("nav-config", () => {
  it("contains unique ids and non-empty titles", () => {
    const ids = new Set<string>()
    for (const item of NAV_ITEMS) {
      expect(item.id).toBeTruthy()
      expect(item.title).toBeTruthy()
      expect(item.icon).toBeDefined()
      expect(ids.has(item.id)).toBe(false)
      ids.add(item.id)
    }
  })

  it("has valid route targets for enabled items", () => {
    for (const item of NAV_ITEMS) {
      if (!item.disabled) {
        expect(item.to).toBeDefined()
        expect(item.to?.startsWith("/")).toBe(true)
      }
    }
  })
})
