import { afterEach, describe, expect, it, mock } from "bun:test"
import { auth } from "@/lib/auth"
import { HttpClientError } from "./errors"
import { acquireOutboundJwt } from "./token.server"

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

  const mockTenantSession = {
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
  }

  it("rejects explicit token when session is unauthenticated", async () => {
    const emptyHeaders = new Headers()
    await expect(
      acquireOutboundJwt(mockAuthContract, {
        token: "explicit-test-token",
        headersSource: emptyHeaders,
      }),
    ).rejects.toThrow(HttpClientError)
  })

  it("rejects custom tokenProvider when session is unauthenticated", async () => {
    const emptyHeaders = new Headers()
    const provider = mock(async () => "custom-provider-token")
    await expect(
      acquireOutboundJwt(mockAuthContract, {
        tokenProvider: provider,
        headersSource: emptyHeaders,
      }),
    ).rejects.toThrow(HttpClientError)
  })

  it("rejects explicit token when token is invalid or unverified", async () => {
    auth.api.getSession = mock(
      async () => mockTenantSession,
    ) as unknown as typeof auth.api.getSession
    await expect(
      acquireOutboundJwt(mockAuthContract, {
        token: "invalid-unverified-token",
      }),
    ).rejects.toThrow(HttpClientError)
  })

  it("accepts valid explicit token matching active organization and audience", async () => {
    auth.api.getSession = mock(
      async () => mockTenantSession,
    ) as unknown as typeof auth.api.getSession
    const signed = await auth.api.signJWT({
      body: {
        payload: {
          sub: "user_tenant_999",
          activeOrganizationId: "org_acme_corp",
        },
        overrideOptions: {
          jwt: { audience: "nabu" },
        },
      },
    })

    const token = await acquireOutboundJwt(mockAuthContract, {
      token: signed.token,
    })
    expect(token).toBe(signed.token)
  })

  it("rejects explicit token when audience does not match target service", async () => {
    auth.api.getSession = mock(
      async () => mockTenantSession,
    ) as unknown as typeof auth.api.getSession
    const signed = await auth.api.signJWT({
      body: {
        payload: {
          sub: "user_tenant_999",
          activeOrganizationId: "org_acme_corp",
        },
        overrideOptions: {
          jwt: { audience: "other_service" },
        },
      },
    })

    try {
      await acquireOutboundJwt(mockAuthContract, { token: signed.token })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("UNAUTHENTICATED")
      expect(httpErr.status).toBe(401)
    }
  })

  it("rejects explicit token when tenant context does not match active organization", async () => {
    auth.api.getSession = mock(
      async () => mockTenantSession,
    ) as unknown as typeof auth.api.getSession
    const signed = await auth.api.signJWT({
      body: {
        payload: {
          sub: "user_tenant_999",
          activeOrganizationId: "other_tenant_456",
        },
        overrideOptions: {
          jwt: { audience: "nabu" },
        },
      },
    })

    try {
      await acquireOutboundJwt(mockAuthContract, { token: signed.token })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("UNAUTHENTICATED")
      expect(httpErr.message).toContain("tenant context does not match")
    }
  })

  it("calls custom tokenProvider and validates returned token", async () => {
    auth.api.getSession = mock(
      async () => mockTenantSession,
    ) as unknown as typeof auth.api.getSession
    const signed = await auth.api.signJWT({
      body: {
        payload: {
          sub: "user_tenant_999",
          activeOrganizationId: "org_acme_corp",
        },
        overrideOptions: {
          jwt: { audience: "nabu" },
        },
      },
    })

    expect(signed.token).toBeDefined()
    const provider = mock(async () => String(signed.token))
    const token = await acquireOutboundJwt(mockAuthContract, {
      tokenProvider: provider,
    })
    expect(token).toBe(signed.token)
    expect(provider).toHaveBeenCalled()
  })

  it("throws HttpClientError with UNAUTHENTICATED when custom provider throws", async () => {
    auth.api.getSession = mock(
      async () => mockTenantSession,
    ) as unknown as typeof auth.api.getSession
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

    await expect(
      acquireOutboundJwt(mockAuthContract, {
        signal: controller.signal,
      }),
    ).rejects.toThrow(HttpClientError)
  })

  it("rejects token acquisition when session lacks active organization context", async () => {
    auth.api.getSession = mock(async () => ({
      user: {
        id: "user_123",
        email: "user@test.dev",
        name: "User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess_123",
        userId: "user_123",
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        token: "tok_123",
        activeOrganizationId: null,
        ipAddress: null,
        userAgent: null,
      },
    })) as unknown as typeof auth.api.getSession

    const testHeaders = new Headers({
      cookie: "better-auth.session_token=test",
    })
    try {
      await acquireOutboundJwt(mockAuthContract, { headersSource: testHeaders })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("UNAUTHENTICATED")
      expect(httpErr.status).toBe(401)
      expect(httpErr.message).toContain("Tenant context required")
    }
  })

  it("propagates 502 SERVICE_UNREACHABLE when auth getSession fails", async () => {
    auth.api.getSession = mock(async () => {
      throw new Error("PostgreSQL connection refused")
    }) as unknown as typeof auth.api.getSession

    const testHeaders = new Headers({
      cookie: "better-auth.session_token=test",
    })
    try {
      await acquireOutboundJwt(mockAuthContract, { headersSource: testHeaders })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("SERVICE_UNREACHABLE")
      expect(httpErr.status).toBe(502)
      expect(httpErr.cause).toBeDefined()
    }
  })

  it("propagates 502 SERVICE_UNREACHABLE when signJWT fails", async () => {
    auth.api.getSession = mock(async () => ({
      user: {
        id: "user_123",
        email: "user@test.dev",
        name: "User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess_123",
        userId: "user_123",
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        token: "tok_123",
        activeOrganizationId: "org_123",
        ipAddress: null,
        userAgent: null,
      },
    })) as unknown as typeof auth.api.getSession

    const originalSignJWT = auth.api.signJWT
    auth.api.signJWT = mock(async () => {
      throw new Error("Key signing failure")
    }) as unknown as typeof auth.api.signJWT

    const testHeaders = new Headers({
      cookie: "better-auth.session_token=test",
    })
    try {
      await acquireOutboundJwt(mockAuthContract, { headersSource: testHeaders })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("SERVICE_UNREACHABLE")
      expect(httpErr.status).toBe(502)
      expect(httpErr.cause).toBeDefined()
    } finally {
      auth.api.signJWT = originalSignJWT
    }
  })
})
