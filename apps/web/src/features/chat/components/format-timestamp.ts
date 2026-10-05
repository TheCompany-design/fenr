/**
 * When a reply arrived, said plainly.
 *
 * The timestamp used to be shown as the raw ISO string it is stored as, which
 * put a twenty-four character timestamp above every answer. It is now a time
 * for today's replies and a date with the time for older ones, so a long
 * conversation stays readable without losing the order.
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

  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`

  if (at.toDateString() === now.toDateString()) {
    return time
  }

  const month = at.toLocaleString("en-GB", { month: "short" })
  return `${at.getDate()} ${month}, ${time}`
}

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}
