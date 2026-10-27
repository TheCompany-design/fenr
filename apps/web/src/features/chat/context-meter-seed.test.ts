import { describe, expect, it } from "bun:test"
import { usageReportSchema } from "@/lib/schemas/agent-stream"
import { contextMeterSeedTokens } from "./context-meter-seed"

describe("contextMeterSeedTokens", () => {
  it("uses final-step prompt and completion counts, not cumulative turn totals", () => {
    const usage = usageReportSchema.parse({
      prompt_tokens: 52_000,
      completion_tokens: 2_400,
      total_tokens: 54_400,
      last_step_prompt_tokens: 16_000,
      last_step_completion_tokens: 400,
    })

    expect(contextMeterSeedTokens(usage)).toBe(16_400)
  })

  it("preserves explicit zero counts in the final-step footprint", () => {
    const usage = usageReportSchema.parse({
      prompt_tokens: 12,
      completion_tokens: 3,
      total_tokens: 15,
      last_step_prompt_tokens: 0,
      last_step_completion_tokens: 0,
    })

    expect(contextMeterSeedTokens(usage)).toBe(0)
  })

  it("keeps compatibility with older usage reports without final-step fields", () => {
    const usage = usageReportSchema.parse({
      prompt_tokens: 52_000,
      completion_tokens: 2_400,
      total_tokens: 54_400,
    })

    expect(contextMeterSeedTokens(usage)).toBe(52_000)
  })

  it("does not combine an incomplete final-step pair with cumulative usage", () => {
    const usage = usageReportSchema.parse({
      prompt_tokens: 52_000,
      completion_tokens: 2_400,
      total_tokens: 54_400,
      last_step_prompt_tokens: 16_000,
    })

    expect(contextMeterSeedTokens(usage)).toBe(52_000)
  })
})
