import { describe, expect, it } from "bun:test"
import { generateUuidV7, isValidUuidV7, UUID_V7_REGEX } from "./id"

describe("generateUuidV7", () => {
  it("generates a valid UUIDv7 string according to RFC 9562", () => {
    const id = generateUuidV7()
    expect(id).toMatch(UUID_V7_REGEX)
    expect(isValidUuidV7(id)).toBe(true)

    // Check version field (character 14, 0-indexed position 14)
    expect(id.charAt(14)).toBe("7")

    // Check variant field (character 19, 0-indexed position 19)
    const variantChar = id.charAt(19).toLowerCase()
    expect(["8", "9", "a", "b"]).toContain(variantChar)
  })

  it("produces strictly monotonically increasing values across rapid iterations", () => {
    const count = 1000
    const ids: string[] = []

    for (let i = 0; i < count; i++) {
      ids.push(generateUuidV7())
    }

    for (let i = 1; i < count; i++) {
      const prev = ids[i - 1]
      const curr = ids[i]
      expect(prev).toBeDefined()
      expect(curr).toBeDefined()
      if (prev && curr) {
        expect(curr > prev).toBe(true)
      }
    }
  })

  it("correctly embeds custom timestamp", () => {
    // 2026-09-26T12:00:00.000Z in ms
    const timestamp = 1790424000000
    const id = generateUuidV7(timestamp)
    expect(isValidUuidV7(id)).toBe(true)

    // Extract first 48 bits (12 hex characters)
    const timeHex = id.slice(0, 8) + id.slice(9, 13)
    const extractedTime = Number.parseInt(timeHex, 16)
    expect(extractedTime).toBe(timestamp)
  })
})

describe("isValidUuidV7", () => {
  it("accepts valid UUIDv7 strings", () => {
    expect(isValidUuidV7("01923456-789a-7def-8123-456789abcdef")).toBe(true)
    expect(isValidUuidV7("01923456-789a-7def-9123-456789abcdef")).toBe(true)
    expect(isValidUuidV7("01923456-789a-7def-a123-456789abcdef")).toBe(true)
    expect(isValidUuidV7("01923456-789a-7def-b123-456789abcdef")).toBe(true)
  })

  it("rejects UUIDv4 strings (version is 4 instead of 7)", () => {
    expect(isValidUuidV7("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(false)
  })

  it("rejects invalid formats, empty strings, and strings with whitespace", () => {
    expect(isValidUuidV7("")).toBe(false)
    expect(isValidUuidV7("not-a-uuid")).toBe(false)
    expect(isValidUuidV7(" 01923456-789a-7def-8123-456789abcdef ")).toBe(false)
    expect(isValidUuidV7("01923456-789a-7def-c123-456789abcdef")).toBe(false) // variant 'c' is invalid
  })
})
