import { describe, expect, it } from "bun:test"
import {
  EASE_DRAWER,
  EASE_OUT,
  EASE_OUT_CSS,
  LABEL_ENTER_TRANSITION,
  LABEL_EXIT_TRANSITION,
  REDUCED_TRANSITION,
  SIDEBAR_MORPH_TRANSITION,
  SPRING_LAYOUT,
  SPRING_PRESS,
} from "./ease"

describe("animation ease and spring configurations", () => {
  it("exports valid cubic bezier curves", () => {
    expect(EASE_OUT).toHaveLength(4)
    expect(EASE_DRAWER).toHaveLength(4)
    expect(EASE_OUT_CSS).toBe("cubic-bezier(0.16, 1, 0.3, 1)")
  })

  it("exports properly damped spring physics configs", () => {
    expect(SPRING_LAYOUT.type).toBe("spring")
    expect(SPRING_LAYOUT.stiffness).toBeGreaterThan(0)
    expect(SPRING_LAYOUT.damping).toBeGreaterThan(0)

    expect(SPRING_PRESS.type).toBe("spring")
    expect(SPRING_PRESS.stiffness).toBeGreaterThan(0)

    expect(SIDEBAR_MORPH_TRANSITION.type).toBe("spring")
    expect(SIDEBAR_MORPH_TRANSITION.damping).toBeGreaterThan(0)
  })

  it("exports label enter and exit timing configs", () => {
    expect(LABEL_ENTER_TRANSITION.duration).toBeGreaterThan(0)
    expect(LABEL_EXIT_TRANSITION.duration).toBeGreaterThan(0)
    expect(REDUCED_TRANSITION.duration).toBeGreaterThan(0)
  })
})
