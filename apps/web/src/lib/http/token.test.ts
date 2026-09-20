import { afterEach, describe, expect, it, mock } from "bun:test"
import { auth } from "@/lib/auth"
import { HttpClientError } from "./errors"
import { acquireOutboundJwt } from "./token"

describe("Outbound JWT Token Provider (acquireOutboundJwt)", () => {
  const originalGetSession = auth.api.getSession

  afterEach(() => {
    auth.api.getSession = originalGetSession
  })

  const mockAuthContract = {
    type: "authenticated" as const,
    service: "nabu",
    audience: "nabu",
  }

  it("returns explicit token when provided", async () => {
    const token = await acquireOutboundJwt(mockAuthContract, {
      token: "explicit-test-token",
    })
    expect(token).toBe("explicit-test-token")
  })

  it("calls custom tokenProvider when provided", async () => {
    const provider = mock(async () => "custom-provider-token")
    const token = await acquireOutboundJwt(mockAuthContract, {
      tokenProvider: provider,
    })
    expect(token).toBe("custom-provider-token")
    expect(provider).toHaveBeenCalled()
  })

  it("throws HttpClientError with UNAUTHENTICATED when custom provider throws", async () => {
    const failingProvider = mock(async () => {
      throw new Error("Provider network failure")
    })

    await expect(
      acquireOutboundJwt(mockAuthContract, {
        tokenProvider: failingProvider,
      }),
    ).rejects.toThrow(HttpClientError)
  })

  it("throws HttpClientError with UNAUTHENTICATED when headers have no active session", async () => {
    const emptyHeaders = new Headers()
    await expect(
      acquireOutboundJwt(mockAuthContract, {
        headersSource: emptyHeaders,
      }),
    ).rejects.toThrow(HttpClientError)

    try {
      await acquireOutboundJwt(mockAuthContract, {
        headersSource: emptyHeaders,
      })
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("UNAUTHENTICATED")
      expect(httpErr.status).toBe(401)
      expect(httpErr.getUserMessage()).toContain("Authentication required")
    }
  })

  it("mints signed JWT with active user claims, tenant activeOrganizationId, and target audience", async () => {
    // Mock active session
    auth.api.getSession = mock(async () => ({
      user: {
        id: "user_tenant_999",
        email: "finance@tenant.dev",
        name: "Finance Bot",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess_tenant_999",
        userId: "user_tenant_999",
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        token: "tok_xyz",
        activeOrganizationId: "org_acme_corp",
        ipAddress: null,
        userAgent: null,
      },
    })) as unknown as typeof auth.api.getSession

    const customAudienceContract = {
      type: "authenticated" as const,
      service: "nabu",
      audience: "nabu",
    }

    const testHeaders = new Headers({
      cookie: "better-auth.session_token=test",
    })
    const token = await acquireOutboundJwt(customAudienceContract, {
      headersSource: testHeaders,
    })

    expect(token).toBeDefined()
    expect(typeof token).toBe("string")

    // Verify token claims and signature using Better Auth verifyJWT
    const verified = await auth.api.verifyJWT({
      body: {
        token,
      },
    })

    expect(verified?.payload).toBeDefined()
    expect(verified?.payload?.sub).toBe("user_tenant_999")
    expect(verified?.payload?.email).toBe("finance@tenant.dev")
    expect(
      (verified?.payload as { activeOrganizationId?: string })
        ?.activeOrganizationId,
    ).toBe("org_acme_corp")
    expect(verified?.payload?.aud).toBe("nabu")
  })

  it("rejects immediately if signal is already aborted prior to acquisition", async () => {
    const controller = new AbortController()
    controller.abort(new Error("Pre-aborted token acquisition"))

    expect(
      acquireOutboundJwt(mockAuthContract, {
        signal: controller.signal,
      }),
    ).rejects.toThrow(HttpClientError)
  })
})
