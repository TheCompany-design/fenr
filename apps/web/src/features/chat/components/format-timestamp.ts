export function formatTimestamp(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)

  if (Number.isNaN(at.getTime())) {
    return ""
  }

  const time = `${pad(at.getHours())}${pad(at.getMinutes())} hrs`
  const date = `${at.getDate()} ${at.toLocaleString("en-GB", { month: "short" })}`

  const day = dayName(at, now)
  return `${day}, ${date} ${time}`
}

/**
 * How the day is named: `Today`, `Yesterday`, or the weekday it fell on.
 */
function dayName(at: Date, now: Date): string {
  if (isToday(at, now)) {
    return "Today"
  }
  if (isYesterday(at, now)) {
    return "Yesterday"
  }
  return at.toLocaleString("en-GB", { weekday: "long" })
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
