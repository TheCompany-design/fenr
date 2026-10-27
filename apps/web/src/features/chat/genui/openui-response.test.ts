import { describe, expect, it } from "bun:test"
import { createOpenUiFollowUp, extractOpenUiProgram } from "./openui-response"

describe("extractOpenUiProgram", () => {
  it("extracts a streamed or complete OpenUI Lang fence", () => {
    expect(
      extractOpenUiProgram("Here\n```openui-lang\nroot = Card([])\n```"),
    ).toBe("root = Card([])")
    expect(extractOpenUiProgram("```openui-lang\nroot = Card([])")).toBe(
      "root = Card([])",
    )
  })

  it("recognizes a bare OpenUI root program", () => {
    expect(
      extractOpenUiProgram('root = Card([heading])\nheading = Text("Hi")'),
    ).toContain("root = Card")
  })

  it("does not mistake ordinary prose or unrelated code fences for UI", () => {
    expect(extractOpenUiProgram("Here is the answer.")).toBeNull()
    expect(extractOpenUiProgram("```tsx\nroot = Card([])\n```")).toBeNull()
    expect(extractOpenUiProgram("root = ")).toBeNull()
  })
})

describe("createOpenUiFollowUp", () => {
  it("includes small submitted form state", () => {
    expect(createOpenUiFollowUp("Continue", { range: "30 days" })).toBe(
      'Continue\n\nInterface values: {"range":"30 days"}',
    )
  })

  it("rejects empty messages and omits oversized state", () => {
    expect(createOpenUiFollowUp("  ", { a: 1 })).toBeNull()
    expect(createOpenUiFollowUp("Continue", { value: "x".repeat(8_001) })).toBe(
      "Continue",
    )
  })
})
