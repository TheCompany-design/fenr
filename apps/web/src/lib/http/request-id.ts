import { generateUuidV7 } from "@/lib/id"

export const REQUEST_ID_HEADER = "x-request-id"
export const MAX_REQUEST_ID_LEN = 128

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
