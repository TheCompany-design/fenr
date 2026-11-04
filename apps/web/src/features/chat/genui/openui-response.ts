const OPENUI_FENCE = /```openui-lang\s*([\s\S]*?)(?:```|$)/i

/** Return only explicitly opted-in OpenUI Lang, never arbitrary markdown/code. */
export function extractOpenUiProgram(content: string): string | null {
  const fenced = OPENUI_FENCE.exec(content)
  if (fenced) return fenced[1]?.trim() || null

  const trimmed = content.trimStart()
  if (/^root\s*=\s*\S/.test(trimmed)) return trimmed
  return null
}

/** Add bounded, readable form data to a follow-up without trusting its shape. */
export function createOpenUiFollowUp(
  message: string,
  formState: Record<string, unknown> | undefined,
): string | null {
  const prompt = message.trim()
  if (!prompt) return null
  if (!formState || Object.keys(formState).length === 0) return prompt

  let serialized: string
  try {
    serialized = JSON.stringify(formState)
  } catch {
    return prompt
  }
  if (serialized.length > 8_000) return prompt
  return `${prompt}\n\nInterface values: ${serialized}`
}
