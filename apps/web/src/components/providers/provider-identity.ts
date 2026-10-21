import { logoUrl } from "@/lib/brand/logos"

interface VendorMark {
  readonly id: string

  readonly displayName: string

  readonly logoUrl: string

  readonly monochrome: boolean
}

const VENDOR_MARKS = [
  {
    id: "openai",
    displayName: "OpenAI",
    logoUrl: logoUrl("openai"),
    monochrome: true,
  },
  {
    id: "openrouter",
    displayName: "OpenRouter",
    logoUrl: logoUrl("openrouter"),
    monochrome: true,
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    logoUrl: logoUrl("anthropic"),
    monochrome: true,
  },
  {
    id: "google",
    displayName: "Google Gemini",

    logoUrl: logoUrl("google-antigravity"),
    monochrome: false,
  },
  {
    id: "nvidia",
    displayName: "NVIDIA NIM",

    logoUrl: logoUrl("nvidia"),
    monochrome: false,
  },
] as const satisfies readonly VendorMark[]

export type VendorId = (typeof VENDOR_MARKS)[number]["id"]

function markFor(provider: string): VendorMark | undefined {
  return VENDOR_MARKS.find((mark) => mark.id === provider)
}

export const VENDORS: readonly {
  readonly id: VendorId
  readonly displayName: string
}[] = VENDOR_MARKS.map(({ id, displayName }) => ({ id, displayName }))

export function providerDisplayName(provider: string): string {
  return markFor(provider)?.displayName ?? provider
}

export function providerLogoUrl(provider: string): string | null {
  return markFor(provider)?.logoUrl ?? null
}

export function providerMarkIsMonochrome(provider: string): boolean {
  return markFor(provider)?.monochrome ?? false
}
