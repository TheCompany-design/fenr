import { describe, expect, it } from "bun:test"
import { formatTimestamp } from "./format-timestamp"

/** A local wall-clock time `days` before `from`. */
function before(from: Date, days: number, hours = 9, minutes = 5): Date {
  const when = new Date(from)
  when.setDate(when.getDate() - days)
  when.setHours(hours, minutes, 0, 0)
  return when
}

describe("formatTimestamp", () => {
  // Tuesday 6 October 2026.
  const now = new Date(2026, 9, 6, 12, 0, 0)

  it("leaves today's reply unnamed", () => {
    // Everyone already knows which day today is.
    expect(formatTimestamp(before(now, 0, 14, 32).toISOString(), now)).toBe(
      "6 Oct 1432 hrs",
    )
  })

  it("leaves yesterday's reply unnamed", () => {
    // As with today: the reader knows what yesterday was.
    expect(formatTimestamp(before(now, 1, 9, 12).toISOString(), now)).toBe(
      "5 Oct 0912 hrs",
    )
  })

  it("names the weekday on anything older", () => {
    // Four days back from Tuesday is Friday.
    expect(formatTimestamp(before(now, 4, 8, 30).toISOString(), now)).toBe(
      "Friday, 2 Oct 0830 hrs",
    )
  })

  it("names the weekday across a year boundary", () => {
    const newYear = new Date(2027, 0, 2, 12, 0, 0)
    const stamp = new Date(2026, 11, 28, 23, 59, 0)

    expect(formatTimestamp(stamp.toISOString(), newYear)).toBe(
      "Monday, 28 Dec 2359 hrs",
    )
  })

  it("pads the hours and minutes", () => {
    expect(formatTimestamp(before(now, 0, 4, 7).toISOString(), now)).toBe(
      "6 Oct 0407 hrs",
    )
    expect(formatTimestamp(before(now, 0, 0, 0).toISOString(), now)).toBe(
      "6 Oct 0000 hrs",
    )
  })

  it("never renders an unparseable timestamp", () => {
    // The alternative is the words "Invalid Date" in the middle of a reply.
    expect(formatTimestamp("not a date")).toBe("")
    expect(formatTimestamp("")).toBe("")
  })
})
