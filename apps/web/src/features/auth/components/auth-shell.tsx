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
  /** Eyebrow label rendered above the bottom quote. */
  quoteEyebrow?: string
  /** Short statement shown on the brand panel. */
  tagline: string
  children?: ReactNode
}

export function AuthShell({
  eyebrow = "Fenr",
  quoteEyebrow = "Workspace",
  tagline,
  children,
}: AuthShellProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_620px]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-muted p-12 lg:flex">
        {/* Delicate background grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--border)_45%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_45%,transparent)_1px,transparent_1px)] bg-[size:40px_40px] opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        />

        {/* Atmospheric radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/4 -left-1/4 size-[150%] rounded-full bg-radial from-primary/5 via-transparent to-transparent blur-3xl"
        />

        {/* Subtle radial gradient lighting */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 50% 50%, transparent 45%, color-mix(in srgb, var(--background) 88%, transparent) 92%)",
          }}
        />

        {/* Branding header with dot indicator and monospace uppercase tracking */}
        <div className="relative z-10 flex items-center gap-2 font-mono text-sm tracking-[0.2em]">
          <span aria-hidden className="size-2 rounded-full bg-foreground" />
          <span className="uppercase">{eyebrow}</span>
        </div>

        {/* Bottom quote/tagline with monospace eyebrow */}
        <div className="relative z-10 max-w-md space-y-2">
          <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
            {quoteEyebrow}
          </div>
          <p className="font-heading text-xl leading-snug md:text-2xl">
            {tagline}
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-background p-6 sm:p-8 lg:w-[620px] lg:p-12">
        <div className="w-full max-w-lg">
          {/* Mobile-only brand mark */}
          <div className="mb-10 flex items-center gap-2 font-mono text-sm tracking-[0.2em] lg:hidden">
            <span aria-hidden className="size-2 rounded-full bg-foreground" />
            <span className="uppercase">{eyebrow}</span>
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
