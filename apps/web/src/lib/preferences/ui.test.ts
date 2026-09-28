import { describe, expect, it } from "bun:test"
import { getSidebarOpen } from "./ui"

describe("UI Preferences", () => {
  it("exports getSidebarOpen server function", () => {
    expect(getSidebarOpen).toBeDefined()
    expect(typeof getSidebarOpen).toBe("function")
  })
})
