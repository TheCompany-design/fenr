/**
 * Nabu Server HTTP Client Adapter.
 *
 * SERVER-ONLY: Communicates from Fenr server runtime (TanStack Start BFF)
 * to the thebookofnabu agent runtime using the central typed HTTP transport.
 * All requests automatically carry a Better Auth-signed JWT with audience "nabu".
 */

import {
  type ExecuteRequestOptions,
  executeRequest,
  HttpClientError,
  nabuEndpoints,
} from "@/lib/http"
import type {
  AgentTaskResult,
  CreateAgentTaskInput,
  NabuSystemStatus,
  ReconciliationMatchInput,
  ReconciliationMatchResult,
} from "@/lib/schemas/nabu"

export class NabuClientError extends HttpClientError {
  constructor(
    message: string,
    status = 500,
    code = "NABU_ERROR",
    details?: unknown,
  ) {
    super(message, {
      status,
      code:
        code === "NABU_TIMEOUT" || code === "TIMEOUT"
          ? "TIMEOUT"
          : code === "NABU_UNREACHABLE" || code === "SERVICE_UNREACHABLE"
            ? "SERVICE_UNREACHABLE"
            : code === "NABU_VALIDATION_ERROR" || code === "VALIDATION_ERROR"
              ? "VALIDATION_ERROR"
              : code === "NABU_MALFORMED_RESPONSE" ||
                  code === "MALFORMED_RESPONSE"
                ? "MALFORMED_RESPONSE"
                : "HTTP_ERROR",
      service: "nabu",
      details,
    })
    this.name = "NabuClientError"
  }
}

async function runNabuRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof HttpClientError) {
      throw new NabuClientError(err.message, err.status, err.code, err.details)
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
