import type { ReactNode } from "react"

interface AuthShellProps {
  eyebrow?: string

  quoteEyebrow?: string

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
        {}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 auth-grid-pattern opacity-30"
        />

        {}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/4 -left-1/4 size-[150%] rounded-full bg-radial from-primary/5 via-transparent to-transparent blur-3xl"
        />

        {}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 auth-radial-glow"
        />

        {}
        <div className="relative z-10 flex items-center gap-2 font-mono text-sm tracking-[0.2em]">
          <span aria-hidden className="size-2 rounded-full bg-foreground" />
          <span className="uppercase">{eyebrow}</span>
        </div>

        {}
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
          {}
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
