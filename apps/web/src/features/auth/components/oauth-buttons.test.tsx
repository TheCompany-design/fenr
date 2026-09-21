import { beforeEach, describe, expect, it, mock } from "bun:test"
import { GlobalWindow } from "happy-dom"

if (typeof window === "undefined") {
  const win = new GlobalWindow({ url: "http://localhost:3000" })
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    navigator: win.navigator,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    HTMLButtonElement: win.HTMLButtonElement,
    Node: win.Node,
    Event: win.Event,
    UIEvent: win.UIEvent,
    MouseEvent: win.MouseEvent,
    customElements: win.customElements,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  })
}

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { renderToStaticMarkup } = await import("react-dom/server")

const mockSocial = mock(
  async (_opts: {
    provider: string
    callbackURL?: string
  }): Promise<{
    data: { url: string; redirect: boolean } | null
    error: { message?: string; status?: number } | null
  }> => ({
    data: {
      url: "https://accounts.google.com/o/oauth2/v2/auth",
      redirect: true,
    },
    error: null,
  }),
)

const actualAuthClient = await import("@/lib/auth-client")
mock.module("@/lib/auth-client", () => ({
  ...actualAuthClient,
  authClient: new Proxy(actualAuthClient.authClient, {
    get(target, prop, receiver) {
      if (prop === "signIn") {
        const orig = target.signIn
        return new Proxy(orig, {
          get(fnTarget, fnProp, fnReceiver) {
            if (fnProp === "social") return mockSocial
            return Reflect.get(fnTarget, fnProp, fnReceiver)
          },
        })
      }
      return Reflect.get(target, prop, receiver)
    },
  }),
}))

const mockToastError = mock((_title: string, _opts?: unknown) => {})
mock.module("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mock(() => {}),
    info: mock(() => {}),
  },
}))

const { OAuthButtons, SOCIAL_PROVIDERS } = await import("./oauth-buttons")

describe("OAuthButtons Component", () => {
  beforeEach(() => {
    mockSocial.mockClear()
    mockToastError.mockClear()
  })

  describe("SSR Static Markup", () => {
    it("renders all social providers in horizontal group markup", () => {
      const html = renderToStaticMarkup(createElement(OAuthButtons))
      expect(html).toContain("Google")
      expect(html).toContain("Apple")
      expect(html).toContain("GitHub")
    })

    it("marks disabled providers with disabled attribute in SSR", () => {
      const html = renderToStaticMarkup(createElement(OAuthButtons))
      expect(html).toContain("Continue with Apple")
      expect(html).toContain("Apple sign-in is coming soon")
      expect(html).toContain("GitHub sign-in is coming soon")
    })
  })

  describe("Client-side Interactive DOM", () => {
    let container: HTMLDivElement

    beforeEach(() => {
      container = document.createElement("div")
      document.body.appendChild(container)
    })

    const mount = (props: Parameters<typeof OAuthButtons>[0] = {}) => {
      const root = createRoot(container)
      act(() => {
        root.render(createElement(OAuthButtons, props))
      })
      return {
        root,
        getButtons: () => Array.from(container.querySelectorAll("button")),
        getButton: (name: string) =>
          Array.from(container.querySelectorAll("button")).find(
            (btn) =>
              btn.textContent?.includes(name) ||
              btn.getAttribute("aria-label")?.includes(name),
          ),
      }
    }

    it("renders Google enabled and Apple/GitHub disabled by default", () => {
      const { getButton } = mount()
      const googleBtn = getButton("Google")
      const appleBtn = getButton("Apple")
      const githubBtn = getButton("GitHub")

      expect(googleBtn).toBeDefined()
      expect(googleBtn?.hasAttribute("disabled")).toBe(false)
      expect(googleBtn?.getAttribute("aria-label")).toBe("Continue with Google")

      expect(appleBtn).toBeDefined()
      expect(appleBtn?.hasAttribute("disabled")).toBe(true)
      expect(appleBtn?.getAttribute("title")).toBe(
        "Apple sign-in is coming soon",
      )

      expect(githubBtn).toBeDefined()
      expect(githubBtn?.hasAttribute("disabled")).toBe(true)
      expect(githubBtn?.getAttribute("title")).toBe(
        "GitHub sign-in is coming soon",
      )
    })

    it("invokes authClient.signIn.social with google provider and default callbackURL", async () => {
      const { getButton } = mount()
      const googleBtn = getButton("Google")
      expect(googleBtn).toBeDefined()

      await act(async () => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockSocial).toHaveBeenCalledTimes(1)
      const callArgs = mockSocial.mock.calls[0][0]
      expect(callArgs.provider).toBe("google")
      expect(callArgs.callbackURL).toBe("/")
    })

    it("passes validated redirect target to callbackURL", async () => {
      const { getButton } = mount({ redirectTo: "/dashboard/settings" })
      const googleBtn = getButton("Google")

      await act(async () => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockSocial).toHaveBeenCalledTimes(1)
      const callArgs = mockSocial.mock.calls[0][0]
      expect(callArgs.callbackURL).toBe("/dashboard/settings")
    })

    it("sanitizes open-redirect targets to safe fallback /", async () => {
      const { getButton } = mount({ redirectTo: "https://malicious.com" })
      const googleBtn = getButton("Google")

      await act(async () => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockSocial).toHaveBeenCalledTimes(1)
      const callArgs = mockSocial.mock.calls[0][0]
      expect(callArgs.callbackURL).toBe("/")
    })

    it("prevents double-click concurrency race while in-flight", async () => {
      type SocialResult = Awaited<ReturnType<typeof mockSocial>>
      let resolvePromise: (val: SocialResult) => void = () => {}
      mockSocial.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      )

      const { getButton } = mount()
      const googleBtn = getButton("Google")

      // First click: triggers in-flight request
      act(() => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockSocial).toHaveBeenCalledTimes(1)
      expect(googleBtn?.textContent).toContain("Connecting…")
      expect(googleBtn?.hasAttribute("disabled")).toBe(true)

      // Second click while in-flight: must be ignored
      act(() => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockSocial).toHaveBeenCalledTimes(1)

      // Resolve the in-flight promise
      await act(async () => {
        resolvePromise({
          data: { url: "https://accounts.google.com", redirect: true },
          error: null,
        })
      })
    })

    it("does not trigger sign-in when clicking disabled Apple or GitHub buttons", async () => {
      const { getButton } = mount()
      const appleBtn = getButton("Apple")
      const githubBtn = getButton("GitHub")

      await act(async () => {
        appleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
        githubBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockSocial).toHaveBeenCalledTimes(0)
    })

    it("surfaces user-facing toast error when sign-in returns an error", async () => {
      mockSocial.mockResolvedValueOnce({
        data: null,
        error: { message: "Access denied by user", status: 403 },
      })

      const { getButton } = mount()
      const googleBtn = getButton("Google")

      await act(async () => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockToastError).toHaveBeenCalledTimes(1)
      expect(mockToastError.mock.calls[0][0]).toBe("Sign in failed")
      expect(mockToastError.mock.calls[0][1]).toEqual({
        description: "Access denied by user",
      })

      // Button should be re-enabled after error
      expect(googleBtn?.hasAttribute("disabled")).toBe(false)
      expect(googleBtn?.textContent).toContain("Google")
    })

    it("surfaces network error toast when sign-in throws an exception", async () => {
      mockSocial.mockRejectedValueOnce(new Error("Network disconnect"))

      const { getButton } = mount()
      const googleBtn = getButton("Google")

      await act(async () => {
        googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })

      expect(mockToastError).toHaveBeenCalledTimes(1)
      expect(mockToastError.mock.calls[0][0]).toBe("Network error")
      expect(googleBtn?.hasAttribute("disabled")).toBe(false)
    })

    it("supports custom providers via registry prop", () => {
      const customProviders = [
        ...SOCIAL_PROVIDERS.map((p) =>
          p.id === "github"
            ? { ...p, enabled: true, disabledReason: undefined }
            : p,
        ),
      ]

      const { getButton } = mount({ providers: customProviders })
      const githubBtn = getButton("GitHub")
      expect(githubBtn?.hasAttribute("disabled")).toBe(false)
    })
  })
})
