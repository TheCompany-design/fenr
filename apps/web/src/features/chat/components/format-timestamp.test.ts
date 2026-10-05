import { describe, expect, it } from "bun:test"
import { formatTimestamp } from "./format-timestamp"

function at(hours: number, minutes: number, day = 5, month = 9): Date {
  // Built in local time so the assertions read in the same clock the formatter
  // uses, whatever timezone the suite runs in.
  const when = new Date()
  when.setFullYear(2026, month, day)
  when.setHours(hours, minutes, 0, 0)
  return when
}

describe("formatTimestamp", () => {
  it("gives a date and a four digit time", () => {
    expect(formatTimestamp(at(9, 5).toISOString())).toBe("5 Oct 0905 hrs")
  })

  it("gives a date and a time for every reply, not only older ones", () => {
    // A conversation read out of context has to say which day each answer
    // belongs to, whichever day it happens to be read.
    expect(formatTimestamp(at(23, 2).toISOString())).toBe("5 Oct 2302 hrs")
  })

  it("pads the hours and minutes", () => {
    expect(formatTimestamp(at(4, 7).toISOString())).toBe("5 Oct 0407 hrs")
    expect(formatTimestamp(at(0, 0).toISOString())).toBe("5 Oct 0000 hrs")
  })

  it("keeps the day and the month", () => {
    const formatted = formatTimestamp(at(14, 32, 28, 1).toISOString())
    expect(formatted).toBe("28 Feb 1432 hrs")
  })

  it("never renders an unparseable timestamp", () => {
    // The alternative is the words "Invalid Date" in the middle of a reply.
    expect(formatTimestamp("not a date")).toBe("")
    expect(formatTimestamp("")).toBe("")
  })
})
