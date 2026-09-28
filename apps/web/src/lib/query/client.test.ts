import { describe, expect, it } from "bun:test"
import { createQueryClient } from "./client"

describe("Query Client Factory", () => {
  it("creates a QueryClient with configured Fenr defaults", () => {
    const client = createQueryClient()
    expect(client).toBeDefined()
    const defaultOptions = client.getDefaultOptions()
    expect(defaultOptions.queries?.staleTime).toBe(30_000)
    expect(defaultOptions.queries?.retry).toBe(1)
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false)
  })
})
