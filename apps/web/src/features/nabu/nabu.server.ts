/**
 * Nabu Server HTTP Client Adapter.
 *
 * SERVER-ONLY: Communicates from Fenr server runtime (TanStack Start BFF)
 * to thebookofnabu agent runtime using the central typed HTTP transport.
 * All requests automatically carry a Better Auth-signed JWT with audience "nabu".
 */

import {
  HttpClientError,
  type HttpClientErrorCode,
  nabuEndpoints,
} from "@/lib/http"
import { executeRequest } from "@/lib/http/client.server"
import type { ExecuteRequestOptions } from "@/lib/http/types"
import type { ApprovalDecision } from "@/lib/schemas/agent-stream"
import type {
  NabuCapabilities,
  NabuSystemStatus,
  TurnItemsResponse,
} from "@/lib/schemas/nabu"

export class OrganizationRequiredError extends Error {
  constructor(message = "Active organization required") {
    super(message)
    this.name = "OrganizationRequiredError"
  }
}

export interface NabuClientErrorContext {
  status?: number
  code?: string
  details?: unknown
  requestId?: string
  path?: string
  cause?: unknown
}

function mapToHttpClientErrorCode(
  code: string | undefined,
): HttpClientErrorCode {
  if (!code) return "HTTP_ERROR"
  if (
    code === "UNAUTHENTICATED" ||
    code === "TIMEOUT" ||
    code === "SERVICE_UNREACHABLE" ||
    code === "HTTP_ERROR" ||
    code === "MALFORMED_RESPONSE" ||
    code === "VALIDATION_ERROR" ||
    code === "CANCELLED" ||
    code === "CLIENT_CONFIGURATION_ERROR"
  ) {
    return code
  }
  if (code === "NABU_TIMEOUT") return "TIMEOUT"
  if (code === "NABU_UNREACHABLE") return "SERVICE_UNREACHABLE"
  if (code === "NABU_VALIDATION_ERROR") return "VALIDATION_ERROR"
  if (code === "NABU_MALFORMED_RESPONSE") return "MALFORMED_RESPONSE"
  return "HTTP_ERROR"
}

export class NabuClientError extends HttpClientError {
  constructor(
    message: string,
    statusOrContext: number | NabuClientErrorContext = 500,
    code = "NABU_ERROR",
    details?: unknown,
  ) {
    const context: NabuClientErrorContext =
      typeof statusOrContext === "object" && statusOrContext !== null
        ? statusOrContext
        : { status: statusOrContext, code, details }

    super(message, {
      status: context.status ?? 500,
      code: mapToHttpClientErrorCode(context.code),
      service: "nabu",
      path: context.path,
      requestId: context.requestId,
      details: context.details,
      cause: context.cause,
    })
    this.name = "NabuClientError"
  }
}

async function runNabuRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof NabuClientError) {
      throw err
    }
    if (err instanceof HttpClientError) {
      throw new NabuClientError(err.message, {
        status: err.status,
        code: err.code,
        details: err.details,
        path: err.path,
        requestId: err.requestId,
        cause: err.cause,
      })
    }
    throw err
  }
}

/**
 * Retrieves the current system and engine status from thebookofnabu.
 */
export async function getNabuSystemStatus(
  options?: ExecuteRequestOptions<void>,
): Promise<NabuSystemStatus> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.systemStatus, options),
  )
}

/**
 * Retrieves what a turn may do in this deployment.
 */
export async function getNabuCapabilities(
  options?: ExecuteRequestOptions<void>,
): Promise<NabuCapabilities> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.capabilities, options),
  )
}

/**
 * Reads a turn's completed transcript items, oldest first.
 */
export async function getTurnItems(
  input: { turnId: string; after?: string; limit?: number },
  options?: Omit<
    ExecuteRequestOptions<{ turnId: string; after?: string; limit?: number }>,
    "input"
  >,
): Promise<TurnItemsResponse> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.turnItems, { ...options, input }),
  )
}

/**
 * Records a human decision on an approval request.
 *
 * A decision is what resumes a suspended turn, so this is the call that ends the
 * wait — not a local state change. The runtime refuses a second decision, so a
 * retry after an ambiguous failure must carry the same answer rather than a new
 * one.
 */
export async function decideApproval(
  input: { turnId: string; itemId: string; decision: ApprovalDecision },
  options?: Omit<
    ExecuteRequestOptions<{
      turnId: string
      itemId: string
      decision: ApprovalDecision
    }>,
    "input"
  >,
): Promise<void> {
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.decideApproval, {
      ...options,
      input: {
        turnId: input.turnId,
        item_id: input.itemId,
        decision: input.decision,
      },
    }),
  )
}

/**
 * Cancels a running or suspended turn.
 */
export async function cancelTurn(
  input: { turnId: string },
  options?: Omit<ExecuteRequestOptions<{ turnId: string }>, "input">,
): Promise<void> {
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.cancelTurn, { ...options, input }),
  )
}

/**
 * Resumes a suspended turn once a decision has been recorded.
 */
export async function resumeTurn(
  input: { turnId: string },
  options?: Omit<ExecuteRequestOptions<{ turnId: string }>, "input">,
): Promise<void> {
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.resumeTurn, { ...options, input }),
  )
}
