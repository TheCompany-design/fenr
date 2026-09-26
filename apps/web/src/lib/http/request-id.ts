/**
 * Defensive request ID extraction, validation, and generation.
 *
 * Implements the cross-service request ID contract shared with thebookofnabu:
 * - Printable ASCII non-space characters (0x21 to 0x7E)
 * - Bounded length (1 to 128 characters)
 * - Safe fallback to RFC 9562 UUIDv7
 */

import { generateUuidV7 } from "@/lib/id"

export const REQUEST_ID_HEADER = "x-request-id"
export const MAX_REQUEST_ID_LEN = 128

/**
 * Validates whether a proposed request ID is bounded and consists exclusively
 * of printable ASCII non-space characters (0x21 to 0x7E).
 */
export function isValidRequestId(id: string | null | undefined): boolean {
  if (typeof id !== "string") {
    return false
  }
  const trimmed = id.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_REQUEST_ID_LEN) {
    return false
  }

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (code < 0x21 || code > 0x7e) {
      return false
    }
  }

  return true
}

export interface ExtractedRequestId {
  readonly requestId: string
  readonly isAdopted: boolean
}

/**
 * Extracts a valid request ID from Headers or a record, or generates a fresh UUIDv7.
 */
export function extractOrGenerateRequestId(
  headers?: Headers | Record<string, string | string[] | undefined> | null,
): ExtractedRequestId {
  let candidate: string | null = null

  if (headers instanceof Headers) {
    candidate = headers.get(REQUEST_ID_HEADER)
  } else if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === REQUEST_ID_HEADER) {
        candidate = Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
        break
      }
    }
  }

  if (candidate && isValidRequestId(candidate)) {
    return {
      requestId: candidate.trim(),
      isAdopted: true,
    }
  }

  return {
    requestId: generateUuidV7(),
    isAdopted: false,
  }
}
