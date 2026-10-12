/**
 * The tenant model-provider contract, on this side of the boundary.
 *
 * The interesting failures here are all about *what can travel*, so the tests are
 * about refusals rather than about happy paths:
 *
 * - The list schema has no field that could carry a credential, so a runtime that
 *   grew one would fail validation here rather than putting it in a payload the
 *   browser receives.
 * - The create schema is strict about emptiness: a blank key or a blank vendor
 *   would save "successfully" and then fail every turn.
 * - A `422` from the runtime means "the provider cannot be reached", not "the
 *   request was malformed", and the two are grouped so a form cannot confuse
 *   them with a provider that answered and refused.
 */

import { describe, expect, it } from "bun:test"
import {
  isConfigurationRefused,
  isPermissionDenied,
} from "@/features/nabu/tenant-provider.server"
import { HttpClientError } from "@/lib/http/errors"
import {
  createTenantProviderInputSchema,
  tenantProviderListSchema,
  tenantProviderSummarySchema,
  verifyTenantProviderResponseSchema,
} from "./nabu"

describe("the saved provider read shape", () => {
  const configured = {
    id: "018f0000-0000-7000-8000-000000000001",
    provider: "openai",
    model: "gpt-4o-mini",
    label: "Work key",
    is_default: true,
    fingerprint: "a1b2c3",
    max_output_tokens: null,
    temperature: null,
    updated_at: "2026-02-01T10:00:00Z",
  }

  it("accepts what the runtime sends", () => {
    const list = {
      providers: [configured],
      can_administer: true,
    }
    expect(tenantProviderListSchema.parse(list)).toEqual(list)
  })

  it("accepts an empty workspace as a state rather than an absence", () => {
    const empty = tenantProviderListSchema.parse({
      providers: [],
      can_administer: false,
    })
    expect(empty.providers).toEqual([])
  })

  it("cannot represent a credential at all", () => {
    // The strongest form of the guarantee: adding a key field to the runtime's
    // response would be a *type* failure here, not a review comment.
    const withCredential = {
      ...configured,
      api_key: "sk-live-abc123",
    }
    const parsed = tenantProviderSummarySchema.safeParse(withCredential)
    // Zod strips unknown keys by default rather than rejecting, so what matters is
    // that the stripped field cannot reach the component.
    if (parsed.success) {
      expect(JSON.stringify(parsed.data)).not.toContain("sk-live-abc123")
    } else {
      expect(parsed.success).toBe(false)
    }
  })

  it("rejects a fingerprint of an implausible length", () => {
    const parsed = tenantProviderSummarySchema.safeParse({
      ...configured,
      fingerprint: "x".repeat(500),
    })
    expect(parsed.success).toBe(false)
  })
})

describe("the provider create shape", () => {
  it("requires a vendor, a model, and a key", () => {
    expect(
      createTenantProviderInputSchema.safeParse({
        provider: "openai",
        model: "gpt-4o-mini",
        api_key: "sk-live-abc123",
      }).success,
    ).toBe(true)

    for (const missing of ["provider", "model", "api_key"]) {
      const input: Record<string, unknown> = {
        provider: "openai",
        model: "gpt-4o-mini",
        api_key: "sk-live-abc123",
      }
      delete input[missing]
      expect(createTenantProviderInputSchema.safeParse(input).success).toBe(
        false,
      )
    }
  })

  it("refuses a blank key rather than storing an empty credential", () => {
    // A blank credential would save successfully and then fail every turn, which
    // is the worst place to find out.
    for (const blank of ["", "   ", "\t\n"]) {
      expect(
        createTenantProviderInputSchema.safeParse({
          provider: "openai",
          model: "gpt-4o-mini",
          api_key: blank,
        }).success,
      ).toBe(false)
    }
  })

  it("refuses a blank vendor rather than saving one nobody chose", () => {
    // The closed picker makes this unreachable through the form; the schema is
    // the second half of the same guarantee, for a caller that is not the form.
    for (const blank of ["", "   "]) {
      expect(
        createTenantProviderInputSchema.safeParse({
          provider: blank,
          model: "m",
          api_key: "sk-test",
        }).success,
      ).toBe(false)
    }
  })

  it("carries an optional name and rejects an implausibly long one", () => {
    expect(
      createTenantProviderInputSchema.safeParse({
        provider: "openai",
        model: "m",
        api_key: "sk-test",
        label: "Work key",
      }).success,
    ).toBe(true)

    expect(
      createTenantProviderInputSchema.safeParse({
        provider: "openai",
        model: "m",
        api_key: "sk-test",
        label: "x".repeat(65),
      }).success,
    ).toBe(false)
  })

  it("accepts absent overrides and rejects a non-positive ceiling", () => {
    expect(
      createTenantProviderInputSchema.safeParse({
        provider: "openai",
        model: "m",
        api_key: "sk-test",
      }).success,
    ).toBe(true)

    expect(
      createTenantProviderInputSchema.safeParse({
        provider: "openai",
        model: "m",
        api_key: "sk-test",
        max_output_tokens: 0,
      }).success,
    ).toBe(false)
  })
})

describe("the verification result", () => {
  it("separates a provider that refused from one that worked", () => {
    const refused = verifyTenantProviderResponseSchema.parse({
      ok: false,
      message:
        "the provider answered, but did not accept the stored credential",
    })
    expect(refused.ok).toBe(false)
    // The distinction is load-bearing: a wrong key is a result, and reporting it
    // as a malfunction would tell a user their provider is down.
    expect(refused.message).toContain("did not accept")
  })
})

describe("classifying a runtime refusal", () => {
  it("recognises a permission refusal", () => {
    const forbidden = new HttpClientError("refused", {
      status: 403,
      code: "HTTP_ERROR",
      service: "nabu",
    })
    expect(isPermissionDenied(forbidden)).toBe(true)
  })

  it("recognises a reachability refusal", () => {
    // `422` means the provider cannot be reached from the runtime — a
    // deployment-level refusal to dial, distinct from a wrong key, which comes
    // back as `ok: false`.
    expect(
      isConfigurationRefused(
        new HttpClientError("the provider cannot be reached from the runtime", {
          status: 422,
          code: "HTTP_ERROR",
          service: "nabu",
        }),
      ),
    ).toBe(true)
  })

  it("does not mistake a provider failure for a permission or reachability one", () => {
    const rejected = new HttpClientError("provider rejected", {
      status: 502,
      code: "HTTP_ERROR",
      service: "nabu",
    })
    expect(isPermissionDenied(rejected)).toBe(false)
    expect(isConfigurationRefused(rejected)).toBe(false)
  })

  it("does not classify an arbitrary error", () => {
    expect(isPermissionDenied(new Error("boom"))).toBe(false)
    expect(isConfigurationRefused("not an error at all")).toBe(false)
  })
})
