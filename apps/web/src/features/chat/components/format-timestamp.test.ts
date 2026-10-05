import { describe, expect, it } from "bun:test"
import { formatTimestamp } from "./format-timestamp"

describe("formatTimestamp", () => {
  const reference = new Date("2026-10-05T23:02:43.721Z")

  it("gives a plain time for a reply from today", () => {
    const today = new Date()
    today.setHours(9, 5, 0, 0)
    const stamp = new Date(today).toISOString()

    expect(formatTimestamp(stamp, today)).toBe("09:05")
  })

  it("gives a date with the time for an older reply", () => {
    const stamp = new Date("2026-10-05T09:15:00.000Z").toISOString()
    const later = new Date("2026-11-20T12:00:00.000Z")

    const formatted = formatTimestamp(stamp, later)
    expect(formatted).toMatch(/^\d{1,2} [A-Za-z]{3}, \d{2}:\d{2}$/)
  })

  it("pads the hours and minutes", () => {
    const morning = new Date()
    morning.setHours(4, 7, 0, 0)

    expect(formatTimestamp(morning.toISOString(), morning)).toBe("04:07")
  })

  it("never renders an unparseable timestamp", () => {
    // The alternative is the words "Invalid Date" in the middle of a reply.
    expect(formatTimestamp("not a date")).toBe("")
    expect(formatTimestamp("")).toBe("")
  })
})
