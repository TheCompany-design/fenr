import type { CitationItem } from "@workspace/ui/components/citations"

/**
 * Parses citations and sources out of an agent message.
 *
 * Supports:
 * 1. Explicit message citations (if attached to the message object).
 * 2. Markdown reference-style links or trailing sources section:
 *    `[1]: https://example.com "Title"` or `[1](https://example.com)`
 * 3. Footnote definitions:
 *    `[^1]: https://example.com` or `[^1]: [Title](https://example.com)`
 * 4. Extracted URLs / markdown links from text when citations are present.
 */

const CITATION_REF_REGEX =
  /^\s*\[(\d+|\w+)\]:\s*(https?:\/\/[^\s]+)(?:\s+["'(](.*?)["')])?\s*$/gm
const FOOTNOTE_REGEX =
  /^\s*\[\^(\d+|\w+)\]:\s*(?:\[(.*?)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)(?:\s+["'(](.*?)["')])?)\s*$/gm

export function extractCitationsFromMarkdown(content: string): CitationItem[] {
  if (!content) return []

  const citations: CitationItem[] = []
  const seenIds = new Set<string>()

  // 1. Footnote style: [^1]: https://... or [^1]: [Title](url)
  FOOTNOTE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FOOTNOTE_REGEX.exec(content)) !== null) {
    const id = match[1]
    const title = match[2] || match[5] || ""
    const url = match[3] || match[4] || ""
    if (id && url && !seenIds.has(id)) {
      seenIds.add(id)
      citations.push({
        id,
        title: title || domainFromUrl(url) || url,
        domain: domainFromUrl(url),
        url,
      })
    }
  }

  // 2. Reference style links: [1]: https://... "Title"
  CITATION_REF_REGEX.lastIndex = 0
  while ((match = CITATION_REF_REGEX.exec(content)) !== null) {
    const id = match[1]
    const url = match[2]
    const title = match[3]
    if (id && url && !seenIds.has(id)) {
      seenIds.add(id)
      citations.push({
        id,
        title: title || domainFromUrl(url) || url,
        domain: domainFromUrl(url),
        url,
      })
    }
  }

  return citations
}

function domainFromUrl(urlStr: string): string | undefined {
  try {
    const parsed = new URL(urlStr)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}
