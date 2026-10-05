/**
 * When a reply arrived, said plainly.
 *
 * The timestamp used to be shown as the raw ISO string it is stored as, which
 * put a twenty-four character timestamp above every answer. It is now a date
 * and a four digit hour and minute — `5 Oct 0905 hrs`.
 *
 * Every reply carries its date, not just the older ones: a conversation read
 * out of context has to say which day each answer belongs to, and deciding
 * "today" against the reader's clock would leave that to the moment it was
 * read rather than when it was said.
 *
 * Built from the local clock parts rather than a locale format string, so the
 * same input always reads the same way regardless of who is looking.
 */
export function formatTimestamp(iso: string): string {
  const at = new Date(iso)

  // An unparseable timestamp must not become the word "Invalid Date" in the
  // middle of someone's conversation.
  if (Number.isNaN(at.getTime())) {
    return ""
  }

  // Four digits, no separator: `5 Oct 0905 hrs`.
  const time = `${pad(at.getHours())}${pad(at.getMinutes())} hrs`
  const month = at.toLocaleString("en-GB", { month: "short" })

  return `${at.getDate()} ${month} ${time}`
}

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}
