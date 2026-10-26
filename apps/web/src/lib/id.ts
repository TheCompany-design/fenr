let lastTimestamp = -1
let sequenceCounter = 0

export function resetUuidV7State(): void {
  lastTimestamp = -1
  sequenceCounter = 0
}

export function generateUuidV7(timestampMs?: number): string {
  const isExplicitTimestamp = timestampMs !== undefined
  const now = timestampMs ?? Date.now()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  const byte6 = bytes[6] ?? 0
  const byte7 = bytes[7] ?? 0
  const byte8 = bytes[8] ?? 0

  if (isExplicitTimestamp) {
    sequenceCounter = ((byte6 & 0x0f) << 8) | byte7
  } else if (now > lastTimestamp) {
    lastTimestamp = now

    sequenceCounter = ((byte6 & 0x0f) << 8) | byte7
  } else {
    sequenceCounter = (sequenceCounter + 1) & 0x0fff
    if (sequenceCounter === 0) {
      lastTimestamp += 1
    }
  }

  const effectiveTimestamp = isExplicitTimestamp
    ? now
    : Math.max(now, lastTimestamp)
  const ts = BigInt(effectiveTimestamp)

  bytes[0] = Number((ts >> 40n) & 0xffn)
  bytes[1] = Number((ts >> 32n) & 0xffn)
  bytes[2] = Number((ts >> 24n) & 0xffn)
  bytes[3] = Number((ts >> 16n) & 0xffn)
  bytes[4] = Number((ts >> 8n) & 0xffn)
  bytes[5] = Number(ts & 0xffn)

  bytes[6] = 0x70 | ((sequenceCounter >>> 8) & 0x0f)
  bytes[7] = sequenceCounter & 0xff

  bytes[8] = (byte8 & 0x3f) | 0x80

  let hex = ""
  for (let i = 0; i < 16; i++) {
    const b = bytes[i] ?? 0
    hex += (b < 16 ? "0" : "") + b.toString(16)
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuidV7(id: string): boolean {
  return UUID_V7_REGEX.test(id)
}
