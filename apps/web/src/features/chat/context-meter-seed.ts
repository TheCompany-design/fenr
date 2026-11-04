import type { UsageReport } from "@/lib/schemas/agent-stream"

/**
 * Return the latest model step's token footprint for the next context estimate.
 * Older server responses lack the final-step fields, so retain their previous
 * prompt-token behavior until the server has deployed the richer report.
 */
export function contextMeterSeedTokens(usage: UsageReport): number {
  if (
    usage.last_step_prompt_tokens === undefined ||
    usage.last_step_completion_tokens === undefined
  ) {
    return usage.prompt_tokens
  }

  return usage.last_step_prompt_tokens + usage.last_step_completion_tokens
}
