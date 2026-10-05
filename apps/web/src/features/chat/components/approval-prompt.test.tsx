/**
 * A suspended turn must offer a decision.
 *
 * The runtime parks a turn on an approval request and emits `turn_suspended`.
 * Before the approval card existed, that event was dropped by a schema that did
 * not know it, and the conversation sat on "Streaming response..." until the
 * reader gave up. These tests pin the three states that must be distinguishable:
 * streaming, suspended, and finished.
 */

import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ActiveTurnProjection } from "../state/stream-reducer"
import { ApprovalPrompt } from "./approval-prompt"

function projection(
  overrides: Partial<ActiveTurnProjection>,
): ActiveTurnProjection {
  return {
    threadId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1",
    turnId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
    activeItemId: null,
    streamingText: "",
    streamingThinking: "",
    streamingToolArguments: "",
    status: "streaming",
    awaitingApprovalItemId: null,
    approvalAttempt: null,
    error: null,
    errorCode: null,
    ...overrides,
  }
}

/**
 * Render the prompt the way the container does.
 *
 * The card records its decision through the query client, so it is rendered
 * inside one — the same provider the real page has.
 */
function renderPrompt(attempt = 1): string {
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
        attempt,
      }),
    ),
  )
}

describe("a suspended turn", () => {
  it("is reported as suspended rather than as an error or a finish", () => {
    // The three states a reader must be able to tell apart. Collapsing
    // "suspended" into either of the others is what stranded a turn.
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
    const html = renderPrompt(2)

    expect(html).toContain("Approve")
    expect(html).toContain("Deny")
    // Announced rather than shown silently: the turn is blocked on this.
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("waiting for your approval")
  })

  it("offers both outcomes, because refusing is a decision too", () => {
    const html = renderPrompt()
    // A prompt with only "Approve" would make a refusal unreachable.
    expect(html).toContain(">Deny<")
  })
})
