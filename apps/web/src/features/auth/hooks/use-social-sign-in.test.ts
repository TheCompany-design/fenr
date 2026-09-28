import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { GlobalWindow } from "happy-dom"

if (typeof window === "undefined") {
  const win = new GlobalWindow({ url: "http://localhost:3000" })
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    navigator: win.navigator,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    customElements: win.customElements,
  })
}

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

notifyManager.setScheduler((cb) => act(cb))

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

const actualAuthClient = await import("@/lib/auth/client")
mock.module("@/lib/auth/client", () => ({
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

const { SocialAuthError, useSocialSignIn } = await import(
  "./use-social-sign-in"
)

describe("useSocialSignIn hook", () => {
  let queryClient: QueryClient
  let container: HTMLDivElement
  let mountedRoot: ReturnType<typeof createRoot> | undefined

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    mockSocial.mockClear()
    mockToastError.mockClear()
  })

  afterEach(() => {
    if (mountedRoot) {
      act(() => {
        mountedRoot?.unmount()
      })
      mountedRoot = undefined
    }
    container.remove()
    queryClient.clear()
  })

  const renderHookHelper = () => {
    let currentHook!: ReturnType<typeof useSocialSignIn>
    function HookConsumer() {
      currentHook = useSocialSignIn()
      return null
    }

    mountedRoot = createRoot(container)
    act(() => {
      mountedRoot?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookConsumer),
        ),
      )
    })

    return {
      getHook: () => currentHook,
    }
  }

  it("calls authClient.signIn.social with validated redirect and provider", async () => {
    const { getHook } = renderHookHelper()

    let response: unknown
    await act(async () => {
      response = await getHook().mutateAsync({
        provider: "google",
        redirectTo: "/dashboard",
      })
    })

    expect(mockSocial).toHaveBeenCalledTimes(1)
    expect(mockSocial.mock.calls[0][0]).toEqual({
      provider: "google",
      callbackURL: "/dashboard",
    })
    expect((response as { data?: { url?: string } })?.data?.url).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    )
  })

  it("sanitizes open-redirect targets in mutation", async () => {
    const { getHook } = renderHookHelper()

    await act(async () => {
      await getHook().mutateAsync({
        provider: "google",
        redirectTo: "https://evil.com/phish",
      })
    })

    expect(mockSocial).toHaveBeenCalledTimes(1)
    expect(mockSocial.mock.calls[0][0].callbackURL).toBe("/")
  })

  it("throws SocialAuthError and triggers Sign in failed toast on provider error", async () => {
    mockSocial.mockResolvedValueOnce({
      data: null,
      error: { message: "Account locked", status: 403 },
    })

    const { getHook } = renderHookHelper()

    let caughtError: unknown
    await act(async () => {
      try {
        await getHook().mutateAsync({ provider: "google" })
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeInstanceOf(SocialAuthError)
    expect((caughtError as Error).message).toBe("Account locked")
    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError.mock.calls[0][0]).toBe("Sign in failed")
    expect(mockToastError.mock.calls[0][1]).toEqual({
      description: "Account locked",
    })
  })

  it("triggers Network error toast on unexpected network rejection", async () => {
    mockSocial.mockRejectedValueOnce(new Error("Failed to fetch"))

    const { getHook } = renderHookHelper()

    let caughtError: unknown
    await act(async () => {
      try {
        await getHook().mutateAsync({ provider: "google" })
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError.mock.calls[0][0]).toBe("Network error")
  })

  it("triggers Authentication error toast on unexpected non-network errors", async () => {
    mockSocial.mockRejectedValueOnce(new Error("Internal configuration error"))

    const { getHook } = renderHookHelper()

    let caughtError: unknown
    await act(async () => {
      try {
        await getHook().mutateAsync({ provider: "google" })
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError.mock.calls[0][0]).toBe("Authentication error")
    expect(mockToastError.mock.calls[0][1]).toEqual({
      description:
        "An unexpected error occurred during sign in. Please try again.",
    })
  })

  it("does not trigger error toast when operation is aborted", async () => {
    const abortErr = new DOMException("Request was aborted", "AbortError")
    mockSocial.mockRejectedValueOnce(abortErr)

    const { getHook } = renderHookHelper()

    let caughtError: unknown
    await act(async () => {
      try {
        await getHook().mutateAsync({ provider: "google" })
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBe(abortErr)
    expect(mockToastError).toHaveBeenCalledTimes(0)
  })
})
