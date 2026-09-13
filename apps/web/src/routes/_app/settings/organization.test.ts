import { describe, expect, it } from "bun:test"
import { QueryClient } from "@tanstack/react-query"

import { Route } from "./organization"

describe("/settings/organization route", () => {
  it("exports route with correct path and prefetching loader", async () => {
    expect(Route).toBeDefined()
    expect(typeof Route.options.loader).toBe("function")

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockOrg = {
      id: "018f1a1a-0000-7000-8000-000000000001",
      name: "Fenr Labs",
      slug: "fenr-labs",
      logo: null,
      createdAt: new Date(),
    }

    const ensureQueryDataSpy: string[] = []
    queryClient.ensureQueryData = ((options: {
      queryKey: readonly unknown[]
    }) => {
      ensureQueryDataSpy.push(String(options.queryKey[0]))
      return Promise.resolve([])
    }) as typeof queryClient.ensureQueryData

    const loader = Route.options.loader
    if (typeof loader === "function") {
      await (loader as (args: unknown) => Promise<unknown>)({
        context: {
          queryClient,
          activeOrganization: {
            organization: mockOrg,
            role: "owner",
            memberCount: 2,
          },
        },
      })
    }

    expect(ensureQueryDataSpy).toContain("organizations")
    expect(ensureQueryDataSpy.length).toBe(2)
  })

  it("skips invitations prefetching for regular member role", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockOrg = {
      id: "018f1a1a-0000-7000-8000-000000000001",
      name: "Fenr Labs",
      slug: "fenr-labs",
      logo: null,
      createdAt: new Date(),
    }

    const ensureQueryDataSpy: string[] = []
    queryClient.ensureQueryData = ((options: {
      queryKey: readonly unknown[]
    }) => {
      ensureQueryDataSpy.push(String(options.queryKey[1]))
      return Promise.resolve([])
    }) as typeof queryClient.ensureQueryData

    const loader = Route.options.loader
    if (typeof loader === "function") {
      await (loader as (args: unknown) => Promise<unknown>)({
        context: {
          queryClient,
          activeOrganization: {
            organization: mockOrg,
            role: "member",
            memberCount: 2,
          },
        },
      })
    }

    expect(ensureQueryDataSpy.length).toBe(1)
    expect(ensureQueryDataSpy[0]).toBe("members")
  })
})
