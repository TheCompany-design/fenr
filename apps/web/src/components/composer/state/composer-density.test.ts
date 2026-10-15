import { describe, expect, it } from "bun:test"
import {
  DENSITY_OVERFLOW_TOLERANCE_PX,
  isOverflowing,
  resolveDensity,
} from "./composer-density"

describe("resolveDensity", () => {
  it("collapses to a pill when nothing needs the room", () => {
    expect(resolveDensity({ overflowing: false, hasAttachments: false })).toBe(
      "pill",
    )
  })

  it("takes the panel when the draft outgrows one line", () => {
    expect(resolveDensity({ overflowing: true, hasAttachments: false })).toBe(
      "panel",
    )
  })

  it("takes the panel when files are staged, however short the draft is", () => {
    expect(resolveDensity({ overflowing: false, hasAttachments: true })).toBe(
      "panel",
    )
  })

  it("takes the panel when both hold, rather than resolving one first", () => {
    expect(resolveDensity({ overflowing: true, hasAttachments: true })).toBe(
      "panel",
    )
  })

  it("returns to the pill when the draft is deleted and the files are gone", () => {
    // The morph is symmetric: the same inputs in reverse must collapse again,
    // or the box would latch open for the rest of the session.
    expect(resolveDensity({ overflowing: true, hasAttachments: false })).toBe(
      "panel",
    )
    expect(resolveDensity({ overflowing: false, hasAttachments: false })).toBe(
      "pill",
    )
  })
})

describe("isOverflowing", () => {
  it("is false when the content fits exactly", () => {
    expect(isOverflowing({ scrollHeight: 48, clientHeight: 48 })).toBe(false)
  })

  it("is false for sub-pixel overflow, which is not a second line", () => {
    expect(isOverflowing({ scrollHeight: 48.4, clientHeight: 48 })).toBe(false)
  })

  it("is true once the content is a whole line past the clamp", () => {
    expect(isOverflowing({ scrollHeight: 74, clientHeight: 48 })).toBe(true)
  })

  it("honours an explicit tolerance", () => {
    expect(
      isOverflowing({ scrollHeight: 60, clientHeight: 48, tolerance: 12 }),
    ).toBe(false)
    expect(
      isOverflowing({ scrollHeight: 61, clientHeight: 48, tolerance: 12 }),
    ).toBe(true)
  })

  it("tolerates exactly the slack it declares and no more", () => {
    expect(
      isOverflowing({
        scrollHeight: 48 + DENSITY_OVERFLOW_TOLERANCE_PX,
        clientHeight: 48,
      }),
    ).toBe(false)
  })
})
