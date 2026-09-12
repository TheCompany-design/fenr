import { describe, expect, it } from "bun:test"
import {
  AnimatedDropdown,
  clamp,
  collapsedClip,
  MORPH_DURATION,
  VIEWPORT_PADDING,
} from "./animated-dropdown"

describe("AnimatedDropdown component & clip math", () => {
  it("clamp respects min and max boundaries defensively", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it("collapsedClip calculates correct inset round values from origin and size", () => {
    const origin = { x: 50, y: 50 }
    const size = { width: 200, height: 100 }
    const clip = collapsedClip(origin, size)
    expect(clip).toBe("inset(42px 142px 42px 42px round 12px)")
  })

  it("collapsedClip clamps to bounds when origin is near edges", () => {
    const origin = { x: 2, y: 2 }
    const size = { width: 200, height: 100 }
    const clip = collapsedClip(origin, size)
    expect(clip).toBe("inset(0px 190px 90px 0px round 12px)")
  })

  it("exports all expected components and constants", () => {
    expect(AnimatedDropdown).toBeDefined()
    expect(MORPH_DURATION).toBe(0.28)
    expect(VIEWPORT_PADDING).toBe(8)
  })
})
