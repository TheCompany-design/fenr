import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import appCss from "@workspace/ui/globals.css?url"

import { ThemeSync } from "@/components/theme-sync"

/**
 * Pre-hydration theme script (FOUC prevention).
 *
 * Runs blocking before first paint: reads the persisted Zustand theme store
 * from localStorage (key `fenr.theme`, shape `{ state: { mode }, version }`),
 * resolves "system" against prefers-color-scheme, and toggles the `dark`
 * class on <html> imperatively. React never owns that class as state, so it
 * will not "correct" this during hydration — zero flash of wrong theme.
 *
 * Keep the storage key and persist shape in sync with
 * src/lib/stores/theme-store.ts. Everything is try/catch-wrapped so blocked/
 * unavailable localStorage (privacy modes) degrades to light theme silently.
 */
const themeInitScript = `
(function(){try{var m="system";var r=localStorage.getItem("fenr.theme");if(r){var p=JSON.parse(r);var v=p&&p.state&&p.state.mode;if(v==="light"||v==="dark"||v==="system")m=v;}
var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);}catch(e){}})();
`

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        name: "theme-color",
        content: "#ffffff",
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-hydration theme script must be a blocking inline script; content is a compile-time constant with no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <ThemeSync />
        <Toaster richColors />
        <Scripts />
      </body>
    </html>
  )
}
