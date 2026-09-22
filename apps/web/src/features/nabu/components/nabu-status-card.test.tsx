import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { NabuStatusCard } from "@/features/nabu"

describe("NabuStatusCard Component", () => {
  it("renders status card with title and action buttons without importing serverEnv", () => {
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
    expect(html).toContain("Test Reconciliation")
    expect(html).toContain("Dispatch Task")
    expect(html).toContain("Ping")
  })
})
