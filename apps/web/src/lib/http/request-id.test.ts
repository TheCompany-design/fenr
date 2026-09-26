import { describe, expect, it } from "bun:test"
import { isValidUuidV7 } from "@/lib/id"
import {
  extractOrGenerateRequestId,
  isValidRequestId,
  MAX_REQUEST_ID_LEN,
  REQUEST_ID_HEADER,
} from "./request-id"

describe("isValidRequestId", () => {
  it("accepts valid ASCII non-space strings within bounds", () => {
    expect(isValidRequestId("req-1234-abcd")).toBe(true)
    expect(isValidRequestId("a")).toBe(true)
    expect(isValidRequestId("0195c100-demo-trace-0001")).toBe(true)
    expect(isValidRequestId("a".repeat(MAX_REQUEST_ID_LEN))).toBe(true)
  })

  it("rejects empty or whitespace-only strings", () => {
    expect(isValidRequestId("")).toBe(false)
    expect(isValidRequestId("   ")).toBe(false)
    expect(isValidRequestId("\t\n")).toBe(false)
  })

  it("rejects strings containing spaces or control characters", () => {
    expect(isValidRequestId("has space")).toBe(false)
    expect(isValidRequestId("has\nnewline")).toBe(false)
    expect(isValidRequestId("has\rcarriage")).toBe(false)
    expect(isValidRequestId("has\tcontrol")).toBe(false)
    expect(isValidRequestId("null\0byte")).toBe(false)
  })

  it("rejects strings exceeding MAX_REQUEST_ID_LEN (128 chars)", () => {
    const tooLong = "a".repeat(MAX_REQUEST_ID_LEN + 1)
    expect(isValidRequestId(tooLong)).toBe(false)
  })

  it("rejects non-string values", () => {
    expect(isValidRequestId(null)).toBe(false)
    expect(isValidRequestId(undefined)).toBe(false)
    // @ts-expect-error testing runtime defensive behavior
    expect(isValidRequestId(12345)).toBe(false)
  })
})

describe("extractOrGenerateRequestId", () => {
  it("adopts valid x-request-id from Headers", () => {
    const headers = new Headers()
    headers.set(REQUEST_ID_HEADER, "custom-trace-999")

    const result = extractOrGenerateRequestId(headers)
    expect(result.requestId).toBe("custom-trace-999")
    expect(result.isAdopted).toBe(true)
  })

  it("generates UUIDv7 when header is missing from Headers", () => {
    const headers = new Headers()
    const result = extractOrGenerateRequestId(headers)

    expect(isValidUuidV7(result.requestId)).toBe(true)
    expect(result.isAdopted).toBe(false)
  })

  it("generates UUIDv7 when header in Headers is invalid or malicious", () => {
    const headers = new Headers()
    headers.set(REQUEST_ID_HEADER, "invalid id with spaces")

    const result = extractOrGenerateRequestId(headers)
    expect(isValidUuidV7(result.requestId)).toBe(true)
    expect(result.isAdopted).toBe(false)
  })

  it("handles case-insensitive header lookup in record object", () => {
    const record = {
      "X-REQUEST-ID": "record-trace-id-1",
    }
    const result = extractOrGenerateRequestId(record)
    expect(result.requestId).toBe("record-trace-id-1")
    expect(result.isAdopted).toBe(true)
  })

  it("handles array values in record object", () => {
    const record = {
      "x-request-id": ["array-trace-id-2"],
    }
    const result = extractOrGenerateRequestId(record)
    expect(result.requestId).toBe("array-trace-id-2")
    expect(result.isAdopted).toBe(true)
  })

  it("safely generates UUIDv7 when headers argument is undefined or null", () => {
    const resultUndefined = extractOrGenerateRequestId(undefined)
    expect(isValidUuidV7(resultUndefined.requestId)).toBe(true)
    expect(resultUndefined.isAdopted).toBe(false)

    const resultNull = extractOrGenerateRequestId(null)
    expect(isValidUuidV7(resultNull.requestId)).toBe(true)
    expect(resultNull.isAdopted).toBe(false)
  })
})
