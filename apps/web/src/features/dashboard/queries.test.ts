import { afterEach, describe, expect, it, mock } from "bun:test"
import { fetchDashboardPosts } from "./server"

describe("fetchDashboardPosts", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("fetches posts via public endpoint without Authorization header", async () => {
    let capturedAuth: string | null = null
    let capturedUrl: string | null = null

    globalThis.fetch = mock(async (url, init) => {
      capturedUrl = String(url)
      const headers = new Headers(init?.headers)
      capturedAuth = headers.get("Authorization")

      return Response.json([
        { id: 1, title: "First Sample Post" },
        { id: 2, title: "Second Sample Post" },
      ])
    }) as unknown as typeof fetch

    const result = await fetchDashboardPosts()

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe("First Sample Post")
    expect(String(capturedUrl)).toContain("jsonplaceholder.typicode.com/posts")
    expect(capturedAuth).toBeNull() // Strictly public: NO Authorization header
  })
})
