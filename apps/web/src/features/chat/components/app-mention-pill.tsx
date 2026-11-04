import { cn } from "@workspace/ui/lib/utils"
import type { CSSProperties } from "react"

/**
 * One app the workspace can mention, as the markdown renderer hands it to
 * the pill: the catalog row flattened to what drawing needs.
 */
export interface AppMentionApp {
  readonly slug: string
  readonly name: string
  readonly logoUrl: string
  readonly accentHex: string | null
  readonly monochrome: boolean
}

export type AppMentionPillProps = {
  "data-app-mention"?: string
  "data-app-name"?: string
  "data-app-logo"?: string
  "data-app-accent"?: string
  "data-app-monochrome"?: string
  children?: React.ReactNode
}

/**
 * The pill a sent message shows where its draft said `@App` — the same
 * accent-tinted styling the composer paints while typing (see the
 * composer's `PromptMentionLayer`), minus the glyph-alignment tricks a
 * textarea forces: here the mark and the name are a normal inline-flex row.
 *
 * The accent rides in a variable so the dark theme can lighten it; brand
 * hexes like Notion's near-black would be unreadable on a dark surface if
 * taken literally.
 */
export function AppMentionPill(props: AppMentionPillProps) {
  const {
    "data-app-mention": slug,
    "data-app-name": name,
    "data-app-logo": logoUrl,
    "data-app-accent": accentHex,
    "data-app-monochrome": monochrome,
    children,
  } = props
  const accent =
    accentHex && /^#[\da-f]{3,4}$|^#[\da-f]{6}$|^#[\da-f]{8}$/i.test(accentHex)
      ? accentHex
      : undefined

  return (
    <span
      data-slot="app-mention-pill"
      data-app-mention={slug}
      data-app-name={name}
      data-app-logo={logoUrl}
      data-app-accent={accentHex ?? undefined}
      data-app-monochrome={monochrome}
      className={cn(
        "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-px align-middle font-medium",
        accent
          ? "bg-[color:color-mix(in_oklab,var(--mention-accent)_14%,transparent)] text-[color:var(--mention-accent)] dark:bg-[color:color-mix(in_oklab,var(--mention-accent)_25%,transparent)] dark:text-[color:color-mix(in_oklab,var(--mention-accent)_45%,white)]"
          : "bg-muted text-foreground",
      )}
      style={
        accent ? ({ "--mention-accent": accent } as CSSProperties) : undefined
      }
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={cn(
            "size-[1em] shrink-0",
            monochrome === "true" && "dark:invert",
          )}
        />
      ) : null}
      <span className="truncate">{name ?? children}</span>
    </span>
  )
}
