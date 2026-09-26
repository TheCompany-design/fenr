/**
 * RFC 9562 Monotonic UUIDv7 Generator.
 *
 * Generates time-ordered 128-bit UUIDv7 identifiers using standard Web Crypto.
 * Layout:
 * - unix_ts_ms (48 bits): Epoch timestamp in milliseconds
 * - ver (4 bits): 0b0111 (version 7)
 * - rand_a (12 bits): Monotonic sequence counter to guarantee strict ordering within the same millisecond
 * - var (2 bits): 0b10 (RFC 4122 / RFC 9562 variant)
 * - rand_b (62 bits): Cryptographically secure random bits
 */

let lastTimestamp = -1
let sequenceCounter = 0

/**
 * Resets the internal monotonic sequence state (primarily for isolated test fixtures).
 */
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
    // Initialize sequence counter with 12 random bits to avoid predictability
    sequenceCounter = ((byte6 & 0x0f) << 8) | byte7
  } else {
    // Same millisecond (or clock skew backwards): monotonically increment 12-bit counter
    sequenceCounter = (sequenceCounter + 1) & 0x0fff
    if (sequenceCounter === 0) {
      // Counter overflowed within same ms: simulate advancing by 1ms to preserve monotonicity
      lastTimestamp += 1
    }
  }

  const effectiveTimestamp = isExplicitTimestamp
    ? now
    : Math.max(now, lastTimestamp)
  const ts = BigInt(effectiveTimestamp)

  // 1. unix_ts_ms (48 bits / 6 bytes)
  bytes[0] = Number((ts >> 40n) & 0xffn)
  bytes[1] = Number((ts >> 32n) & 0xffn)
  bytes[2] = Number((ts >> 24n) & 0xffn)
  bytes[3] = Number((ts >> 16n) & 0xffn)
  bytes[4] = Number((ts >> 8n) & 0xffn)
  bytes[5] = Number(ts & 0xffn)

  // 2. ver (4 bits) + rand_a (12 bits)
  // Set version to 7: 0b0111_xxxx
  bytes[6] = 0x70 | ((sequenceCounter >>> 8) & 0x0f)
  bytes[7] = sequenceCounter & 0xff

  // 3. var (2 bits) + rand_b (62 bits)
  // Set variant to RFC 9562: 0b10xx_xxxx
  bytes[8] = (byte8 & 0x3f) | 0x80

  // Convert bytes to hex string in 8-4-4-4-12 format
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
