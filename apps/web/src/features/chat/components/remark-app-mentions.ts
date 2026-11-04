import type { AppMentionApp } from "./app-mention-pill"

/**
 * A remark plugin that turns `@Name` tokens naming a known integration into
 * span pills the markdown renderer styles.
 *
 * The sent prompt carries no mention spans — the runtime receives the
 * flattened text — so the message renderer recovers them by matching `@`
 * tokens against the workspace's toolkit catalog. That makes the pills work
 * for every historical message too, at the cost of matching by name: a draft
 * that merely says `@GitHub` in prose gets pillified as well, which is the
 * cosmetic failure mode every name-matching mention renderer shares.
 *
 * Code blocks and inline code are skipped — an `@Name` there is code, not an
 * app. The plugin emits custom nodes carrying `data.hName`/`hProperties`,
 * the extension point `mdast-util-to-hast` already honors for directives, so
 * no serializer needs to learn a new node type.
 */
export function remarkAppMentions({
  apps,
}: {
  apps: readonly AppMentionApp[]
}) {
  // Longest names first, so `Google Calendar` is tried before `Google` and
  // the shorter name cannot amputate the longer one's match.
  const sorted = [...apps].sort((a, b) => b.name.length - a.name.length)
  const byName = new Map(sorted.map((app) => [app.name.toLowerCase(), app]))
  const pattern =
    sorted.length > 0
      ? new RegExp(
          `(^|[^\\w@])@(${sorted.map((app) => escapeRegExp(app.name)).join("|")})(?=$|[^\\w])`,
          "gi",
        )
      : null

  return (tree: unknown): void => {
    if (!pattern) return
    walk(tree)
  }

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return
    const current = node as { type?: string; children?: unknown[] }
    // An `@Name` inside code is code, not an app.
    if (current.type === "code" || current.type === "inlineCode") return
    const children = current.children
    if (!Array.isArray(children)) return

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]
      if (isTextNode(child)) {
        const replacement = splitText(child.value)
        if (replacement) {
          children.splice(index, 1, ...replacement)
          index += replacement.length - 1
        }
        continue
      }
      walk(child)
    }
  }

  function splitText(value: string): unknown[] | null {
    if (!pattern) return null
    pattern.lastIndex = 0
    if (!pattern.test(value)) return null

    const out: unknown[] = []
    let cursor = 0
    pattern.lastIndex = 0
    for (let match = pattern.exec(value); match !== null; ) {
      if (match.index > cursor) {
        out.push({ type: "text", value: value.slice(cursor, match.index) })
      }
      // The guard character stays plain text; it is not part of the pill.
      if (match[1]) {
        out.push({ type: "text", value: match[1] })
      }
      const app = byName.get(match[2].toLowerCase())
      if (app) {
        out.push(mentionNode(app))
      }
      cursor = match.index + match[0].length
      // A zero-length match would loop forever; the pattern cannot produce
      // one, but the guard costs nothing.
      pattern.lastIndex = match.index + match[0].length
      match = pattern.exec(value)
    }
    if (cursor < value.length) {
      out.push({ type: "text", value: value.slice(cursor) })
    }
    return out
  }

  function mentionNode(app: AppMentionApp): unknown {
    return {
      type: "appMention",
      data: {
        hName: "span",
        hProperties: {
          "data-app-mention": app.slug,
          "data-app-name": app.name,
          "data-app-logo": app.logoUrl,
          "data-app-accent": app.accentHex ?? "",
          "data-app-monochrome": app.monochrome ? "true" : "false",
        },
        hChildren: [{ type: "text", value: app.name }],
      },
    }
  }
}

function isTextNode(node: unknown): node is { type: "text"; value: string } {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type?: unknown }).type === "text" &&
    typeof (node as { value?: unknown }).value === "string"
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
