import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { NabuStatusCard } from "@/features/nabu"

describe("NabuStatusCard Component", () => {
  it("renders the engine's identity without importing serverEnv", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(NabuStatusCard),
      ),
    )

    expect(html).toContain("thebookofnabu Engine")
    // The buttons this card used to offer drove endpoints the runtime does not
    // serve: a reconciliation match and an agent task dispatch. It is worth
    // asserting they are gone, because they only ever failed at click time.
    expect(html).not.toContain("Test Reconciliation")
    expect(html).not.toContain("Dispatch Task")
  })
})
