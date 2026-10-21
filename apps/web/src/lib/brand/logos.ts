const SERVICE = "https://logos.lndev.me/logos"

export function logoUrl(markId: string): string {
  return `${SERVICE}/${markId}.svg`
}
