/**
 * Auth shell — rebuilt from the devl.dev login block raw material.
 *
 * The original block shipped a particle-field decoration that depends on PNG
 * assets not included in its registry payload; this rebuild keeps the
 * split-layout aesthetic (decorative brand panel left, centered form right)
 * using only Fenr design tokens.
 */
import type { ReactNode } from "react"

interface AuthShellProps {
  /** Eyebrow label rendered above the heading on the brand panel. */
  eyebrow?: string
  /** Short statement shown on the brand panel. */
  tagline: string
  children: ReactNode
}

export function AuthShell({
  eyebrow = "Fenr",
  tagline,
  children,
}: AuthShellProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_620px]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-muted p-12 lg:flex">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span aria-hidden className="size-2 rounded-full bg-foreground" />
          <span className="tracking-[0.2em] uppercase">{eyebrow}</span>
        </div>
        <p className="max-w-md font-heading text-xl leading-snug md:text-2xl">
          {tagline}
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg">
          {/* Mobile-only brand mark */}
          <div className="mb-10 flex items-center gap-2 font-mono text-sm lg:hidden">
            <span aria-hidden className="size-2 rounded-full bg-foreground" />
            <span className="tracking-[0.2em] uppercase">{eyebrow}</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Standard header block used by both auth forms. */
export function AuthHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="mb-8">
      <h1 className="font-heading text-3xl leading-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground text-sm">{description}</p>
    </header>
  )
}
