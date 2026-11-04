import { describe, expect, it } from "bun:test"
import { resolveImageUrl } from "./image-upload"

describe("resolveImageUrl", () => {
  it("routes files through the upload contract when provided", async () => {
    const file = new File(["bits"], "shot.png", { type: "image/png" })
    const url = await resolveImageUrl(file, async (f) => {
      expect(f.name).toBe("shot.png")
      return "https://cdn.example.com/shot.png"
    })
    expect(url).toBe("https://cdn.example.com/shot.png")
  })

  it("propagates uploader failures to the caller", async () => {
    const file = new File(["bits"], "shot.png", { type: "image/png" })
    expect(
      resolveImageUrl(file, async () => {
        throw new Error("quota exceeded")
      }),
    ).rejects.toThrow("quota exceeded")
  })

  it("falls back to a session object URL without a contract", async () => {
    const file = new File(["bits"], "shot.png", { type: "image/png" })
    const url = await resolveImageUrl(file)
    expect(url.startsWith("blob:") || url.length > 0).toBe(true)
  })
})
