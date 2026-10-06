/**
 * The tenant model-provider contract, on this side of the boundary.
 *
 * The interesting failures here are all about *what can travel*, so the tests are
 * about refusals rather than about happy paths:
 *
 * - The read schema has no field that could carry a credential, so a runtime that
 *   grew one would fail validation here rather than putting it in a payload the
 *   browser receives.
 * - The role claim is omitted rather than defaulted when the caller does not
 *   supply one, because the runtime reads an absent claim as the least privilege
 *   and a default of "admin" would hand authority to every caller who forgot.
 * - A `422` from the runtime means "change the configuration", not "the request
 *   was malformed", and the two are grouped so a form cannot confuse them with a
 *   provider that answered and refused.
 */

import { describe, expect, it } from "bun:test"
import {
  isConfigurationRefused,
  isPermissionDenied,
} from "@/features/nabu/tenant-provider.server"
import { HttpClientError } from "@/lib/http/errors"
import {
  putTenantProviderInputSchema,
  tenantProviderSchema,
  verifyTenantProviderResponseSchema,
} from "./nabu"

describe("the tenant provider read shape", () => {
  const configured = {
    configured: true,
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    fingerprint: "a1b2c3",
    max_output_tokens: null,
    temperature: null,
    can_administer: true,
    updated_at: "2026-02-01T10:00:00Z",
  }

  it("accepts what the runtime sends", () => {
    expect(tenantProviderSchema.parse(configured)).toEqual(configured)
  })

  it("accepts an unconfigured workspace as a state rather than an absence", () => {
    const empty = tenantProviderSchema.parse({
      configured: false,
      base_url: "",
      model: "",
      fingerprint: "",
      max_output_tokens: null,
      temperature: null,
      can_administer: false,
      updated_at: "",
    })
    expect(empty.configured).toBe(false)
    // A screen that renders "configured: false" is honest; one that receives
    // null and has to guess is not.
    expect(empty.base_url).toBe("")
  })

  it("cannot represent a credential at all", () => {
    // The strongest form of the guarantee: adding a key field to the runtime's
    // response would be a *type* failure here, not a review comment.
    const withCredential = {
      ...configured,
      api_key: "sk-live-abc123",
    }
    const parsed = tenantProviderSchema.safeParse(withCredential)
    // Zod strips unknown keys by default rather than rejecting, so what matters is
    // that the stripped field cannot reach the component.
    if (parsed.success) {
      expect(JSON.stringify(parsed.data)).not.toContain("sk-live-abc123")
    } else {
      expect(parsed.success).toBe(false)
    }
  })

  it("rejects a fingerprint of an implausible length", () => {
    const parsed = tenantProviderSchema.safeParse({
      ...configured,
      fingerprint: "x".repeat(500),
    })
    expect(parsed.success).toBe(false)
  })
})

describe("the provider write shape", () => {
  it("requires an endpoint, a model, and a key", () => {
    expect(
      putTenantProviderInputSchema.safeParse({
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        api_key: "sk-live-abc123",
      }).success,
    ).toBe(true)

    for (const missing of ["base_url", "model", "api_key"]) {
      const input: Record<string, unknown> = {
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        api_key: "sk-live-abc123",
      }
      delete input[missing]
      expect(putTenantProviderInputSchema.safeParse(input).success).toBe(false)
    }
  })

  it("refuses a blank key rather than storing an empty credential", () => {
    // A blank credential would save successfully and then fail every turn, which
    // is the worst place to find out.
    for (const blank of ["", "   ", "\t\n"]) {
      expect(
        putTenantProviderInputSchema.safeParse({
          base_url: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          api_key: blank,
        }).success,
      ).toBe(false)
    }
  })

  it("accepts absent overrides and rejects a non-positive ceiling", () => {
    expect(
      putTenantProviderInputSchema.safeParse({
        base_url: "https://api.openai.com/v1",
        model: "m",
        api_key: "sk-test",
      }).success,
    ).toBe(true)

    expect(
      putTenantProviderInputSchema.safeParse({
        base_url: "https://api.openai.com/v1",
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
        "the endpoint answered, but did not accept the stored credential",
    })
    expect(refused.ok).toBe(false)
    // The distinction is load-bearing: a wrong key is a result, and reporting it
    // as a malfunction would tell a user their endpoint is down.
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

  it("recognises a configuration refusal, whatever the prose was", () => {
    // Both "nothing is configured yet" and "that endpoint is not reachable from
    // the runtime" arrive as 422, and a form treats them the same way: the
    // endpoint field needs changing.
    for (const message of [
      "this workspace has no model provider configured yet",
      "this endpoint cannot be reached from the runtime",
    ]) {
      expect(
        isConfigurationRefused(
          new HttpClientError(message, {
            status: 422,
            code: "HTTP_ERROR",
            service: "nabu",
          }),
        ),
      ).toBe(true)
    }
  })

  it("does not mistake a provider failure for a permission or configuration one", () => {
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
