/**
 * When a reply arrived, said plainly.
 *
 * The timestamp used to be shown as the raw ISO string it is stored as, which
 * put a twenty-four character timestamp above every answer. It is now a date
 * and a four digit hour and minute — `6 Oct 1432 hrs`.
 *
 * Older replies are named by weekday: `Monday, 1 Oct 0900 hrs`. Today and
 * yesterday are left unnamed, because everyone already knows which day those are
 * and the name only adds width. A weekday the reader has to count back to is the
 * one worth printing.
 *
 * Built from the local clock parts rather than a locale format string, so the
 * same input always reads the same way regardless of who is looking.
 */
export function formatTimestamp(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)

  // An unparseable timestamp must not become the word "Invalid Date" in the
  // middle of someone's conversation.
  if (Number.isNaN(at.getTime())) {
    return ""
  }

  // Four digits, no separator: `1432 hrs`.
  const time = `${pad(at.getHours())}${pad(at.getMinutes())} hrs`
  const date = `${at.getDate()} ${at.toLocaleString("en-GB", { month: "short" })}`

  if (isToday(at, now) || isYesterday(at, now)) {
    return `${date} ${time}`
  }

  const weekday = at.toLocaleString("en-GB", { weekday: "long" })
  return `${weekday}, ${date} ${time}`
}

function isToday(at: Date, now: Date): boolean {
  return at.toDateString() === now.toDateString()
}

function isYesterday(at: Date, now: Date): boolean {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return at.toDateString() === yesterday.toDateString()
}

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}
