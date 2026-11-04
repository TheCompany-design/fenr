import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ApprovalToolMetadata } from "@/features/integrations/api/integrations.functions"
import type { ActiveTurnProjection } from "../state/stream-reducer"
import {
  ApprovalPrompt,
  type ApprovalPromptProps,
  buildToolApprovalParameters,
} from "./approval-prompt"

function projection(
  overrides: Partial<ActiveTurnProjection>,
): ActiveTurnProjection {
  return {
    threadId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1",
    turnId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
    activeItemId: null,
    streamingText: "",
    streamingThinking: "",
    streamingThinkingBlockId: null,
    streamingToolArguments: "",
    status: "streaming",
    awaitingApprovalItemId: null,
    approvalAttempt: null,
    error: null,
    errorCode: null,
    usage: null,
    modelCalls: [],
    liveTelemetry: null,
    ...overrides,
  }
}

function renderPrompt(overrides: Partial<ApprovalPromptProps> = {}): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApprovalPrompt, {
        turnId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
        itemId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3",
        attempt: 1,
        ...overrides,
      }),
    ),
  )
}

describe("a suspended turn", () => {
  it("is reported as suspended rather than as an error or a finish", () => {
    const suspended = projection({
      status: "suspended",
      awaitingApprovalItemId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3",
      approvalAttempt: 1,
    })
    expect(suspended.status).toBe("suspended")
    expect(suspended.awaitingApprovalItemId).not.toBeNull()
    expect(suspended.status === "error").toBe(false)
  })

  it("offers a decision that names the turn and the request", () => {
    const html = renderPrompt({ attempt: 2 })

    expect(html).toContain('data-slot="tool-approval"')
    expect(html).toContain("Approve")
    expect(html).toContain("Deny")
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("waiting for your approval")
  })

  it("offers both outcomes, because refusing is a decision too", () => {
    const html = renderPrompt()

    expect(html).toContain(">Deny<")
  })

  it("renders ToolApproval with parameters and Always allow when tool metadata includes a Composio toolSlug", () => {
    const metadata: ApprovalToolMetadata = {
      tool: "composio-github_create_issue",
      callId: "call_123",
      toolSlug: "GITHUB_CREATE_ISSUE",
      toolkitSlug: "github",
      displayName: "GitHub Create Issue",
      description: "Creates a new issue in the repository",
      capabilityClass: "write",
      arguments: {
        repo: "nabu/atelier",
        title: "Wire HITL approvals",
      },
    }

    const html = renderPrompt({ initialToolMetadata: metadata })

    expect(html).toContain('data-slot="tool-approval"')
    expect(html).toContain("composio-github_create_issue")
    expect(html).toContain("GitHub Create Issue")
    expect(html).toContain("Always allow this action")
    expect(html).toContain("nabu/atelier")
  })

  it("renders ApprovalCard when mode='approval-card' or structured HITL questions are present", () => {
    const html = renderPrompt({
      mode: "approval-card",
      questions: [
        {
          id: "deploy-target",
          title: "Which environment should this migration target?",
          options: [
            { value: "staging", label: "Staging" },
            { value: "production", label: "Production" },
          ],
        },
      ],
    })

    expect(html).toContain('data-slot="approval-card"')
    expect(html).toContain("Which environment should this migration target?")
    expect(html).toContain("Staging")
    expect(html).toContain("Production")
  })

  it("formats scalar and structured tool arguments into ToolApprovalParameter entries", () => {
    const params = buildToolApprovalParameters({
      count: 3,
      dryRun: false,
      query: "SELECT 1",
      payload: { nested: true },
    })

    expect(params).toHaveLength(4)
    expect(params[0]).toEqual({ id: "count", label: "count", value: "3" })
    expect(params[1]).toEqual({ id: "dryRun", label: "dryRun", value: "false" })
    expect(params[2]).toEqual({
      id: "query",
      label: "query",
      value: "SELECT 1",
    })
    expect(params[3]?.id).toBe("payload")
  })
})
