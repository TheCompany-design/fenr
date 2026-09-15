import { describe, expect, it } from "bun:test"

import { getAuthErrorMessage } from "./error-messages"

describe("getAuthErrorMessage", () => {
  it("returns expected copy for access_resolution_failed", () => {
    const result = getAuthErrorMessage("access_resolution_failed")
    expect(result.title).toBe("Unable to load workspace")
    expect(result.description).toBe(
      "We couldn't verify your organization access. Please sign in again or check your network connection.",
    )
  })

  it("returns expected copy for session_expired", () => {
    const result = getAuthErrorMessage("session_expired")
    expect(result.title).toBe("Session Expired")
    expect(result.description).toBe(
      "Your session has expired. Please sign in to resume your work.",
    )
  })

  it("returns expected copy for invalid_token and magic_link_invalid", () => {
    for (const code of [
      "invalid_token",
      "magic_link_invalid",
      "token_expired",
    ]) {
      const result = getAuthErrorMessage(code)
      expect(result.title).toBe("Sign-in link expired or invalid")
      expect(result.description).toContain(
        "The sign-in link you clicked has expired",
      )
    }
  })

  it("returns expected fallback copy for unknown errors", () => {
    const result = getAuthErrorMessage("unrecognized_code_xyz")
    expect(result.title).toBe("Sign-in Link Issue")
    expect(result.description).toBe(
      "Your sign-in link has expired, was already used, or is invalid. Please enter your email below to receive a fresh link.",
    )
  })

  it("returns default copy when error is null or undefined", () => {
    const nullResult = getAuthErrorMessage(null)
    expect(nullResult.title).toBe("Sign-in Issue")

    const undefinedResult = getAuthErrorMessage(undefined)
    expect(undefinedResult.title).toBe("Sign-in Issue")
  })
})
