import { describe, expect, it } from "bun:test"
import {
  AnimatedDropdown,
  initialsOf,
  UsageWidget,
  UserCard,
  UserMenu,
  UserMenuItems,
} from "./user-menu"

describe("user-menu component & helpers", () => {
  it("initialsOf extracts valid uppercase initials defensively", () => {
    expect(initialsOf({ name: "Jamie Vance", email: "jamie@orbit.dev" })).toBe(
      "JV",
    )
    expect(initialsOf({ name: "Jamie", email: "jamie@orbit.dev" })).toBe("J")
    expect(initialsOf({ name: "  alexander   the   great  ", email: "" })).toBe(
      "AT",
    )
    expect(initialsOf({ name: "", email: "jamie@orbit.dev" })).toBe("J")
    expect(initialsOf({ name: "", email: "" })).toBe("?")
    expect(initialsOf(null)).toBe("?")
    expect(initialsOf(undefined)).toBe("?")
  })

  it("exports all expected components and widgets", () => {
    expect(UserCard).toBeDefined()
    expect(UserMenu).toBeDefined()
    expect(UserMenuItems).toBeDefined()
    expect(UsageWidget).toBeDefined()
    expect(AnimatedDropdown).toBeDefined()
  })
})
