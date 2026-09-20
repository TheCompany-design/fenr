/**
 * Nabu Server HTTP Client Adapter.
 *
 * SERVER-ONLY: Communicates from Fenr server runtime (TanStack Start BFF)
 * to thebookofnabu agent runtime using the central typed HTTP transport.
 * All requests automatically carry a Better Auth-signed JWT with audience "nabu".
 */

import {
  type ExecuteRequestOptions,
  executeRequest,
  HttpClientError,
  type HttpClientErrorCode,
  nabuEndpoints,
} from "@/lib/http"
import type {
  AgentTaskResult,
  CreateAgentTaskInput,
  NabuSystemStatus,
  ReconciliationMatchInput,
  ReconciliationMatchResult,
} from "@/lib/schemas/nabu"

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
 * Submits an inflow payment transaction for deterministic reconciliation matching.
 */
export async function matchInflowReconciliation(
  input: ReconciliationMatchInput,
  options?: Omit<ExecuteRequestOptions<ReconciliationMatchInput>, "input">,
): Promise<ReconciliationMatchResult> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.matchReconciliation, {
      ...options,
      input,
    }),
  )
}

/**
 * Dispatches an operational agent task turn to thebookofnabu.
 */
export async function dispatchAgentTask(
  input: CreateAgentTaskInput,
  options?: Omit<ExecuteRequestOptions<CreateAgentTaskInput>, "input">,
): Promise<AgentTaskResult> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.dispatchTask, {
      ...options,
      input,
    }),
  )
}
