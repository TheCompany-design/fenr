/**
 * Nabu Server HTTP Client.
 *
 * SERVER-ONLY: Communicates from Fenr server runtime (TanStack Start BFF)
 * to the thebookofnabu agent runtime.
 */

import { serverEnv } from "@/lib/env"
import {
  type AgentTaskResult,
  agentTaskResultSchema,
  type CreateAgentTaskInput,
  createAgentTaskInputSchema,
  type NabuSystemStatus,
  nabuSystemStatusSchema,
  type ReconciliationMatchInput,
  type ReconciliationMatchResult,
  reconciliationMatchInputSchema,
  reconciliationMatchResultSchema,
} from "@/lib/schemas/nabu"

export class NabuClientError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(
    message: string,
    status = 500,
    code = "NABU_ERROR",
    details?: unknown,
  ) {
    super(message)
    this.name = "NabuClientError"
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number
  requestId?: string
}

async function requestNabu<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = serverEnv.NABU_SERVER_URL.replace(/\/+$/, "")
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
  const timeoutMs = options.timeoutMs ?? 10_000

  const headers = new Headers(options.headers)
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (options.requestId && !headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", options.requestId)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new NabuClientError(
        `Nabu service timed out after ${timeoutMs}ms`,
        504,
        "NABU_TIMEOUT",
      )
    }
    throw new NabuClientError(
      `Unable to reach Nabu service at ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      503,
      "NABU_UNREACHABLE",
      error,
    )
  }

  if (!response.ok) {
    let errorPayload: unknown
    try {
      errorPayload = await response.json()
    } catch {
      errorPayload = await response.text().catch(() => null)
    }

    throw new NabuClientError(
      `Nabu service returned HTTP ${response.status}`,
      response.status,
      "NABU_HTTP_ERROR",
      errorPayload,
    )
  }

  try {
    return (await response.json()) as T
  } catch (err) {
    throw new NabuClientError(
      "Failed to parse response JSON from Nabu service",
      502,
      "NABU_MALFORMED_RESPONSE",
      err,
    )
  }
}

/**
 * Retrieves the current system and engine status from thebookofnabu.
 */
export async function getNabuSystemStatus(options?: {
  requestId?: string
}): Promise<NabuSystemStatus> {
  const raw = await requestNabu<unknown>("/api/v1/system/status", {
    method: "GET",
    requestId: options?.requestId,
  })

  const parsed = nabuSystemStatusSchema.safeParse(raw)
  if (!parsed.success) {
    throw new NabuClientError(
      "Nabu system status response failed validation",
      502,
      "NABU_VALIDATION_ERROR",
      parsed.error.issues,
    )
  }

  return parsed.data
}

/**
 * Submits an inflow payment transaction for deterministic reconciliation matching.
 */
export async function matchInflowReconciliation(
  input: ReconciliationMatchInput,
  options?: { requestId?: string },
): Promise<ReconciliationMatchResult> {
  const validatedInput = reconciliationMatchInputSchema.parse(input)

  const raw = await requestNabu<unknown>("/api/v1/reconciliation/match", {
    method: "POST",
    body: JSON.stringify(validatedInput),
    requestId: options?.requestId,
  })

  const parsed = reconciliationMatchResultSchema.safeParse(raw)
  if (!parsed.success) {
    throw new NabuClientError(
      "Nabu reconciliation match response failed validation",
      502,
      "NABU_VALIDATION_ERROR",
      parsed.error.issues,
    )
  }

  return parsed.data
}

/**
 * Dispatches an operational agent task turn to thebookofnabu.
 */
export async function dispatchAgentTask(
  input: CreateAgentTaskInput,
  options?: { requestId?: string },
): Promise<AgentTaskResult> {
  const validatedInput = createAgentTaskInputSchema.parse(input)

  const raw = await requestNabu<unknown>("/api/v1/agent/tasks", {
    method: "POST",
    body: JSON.stringify(validatedInput),
    requestId: options?.requestId,
  })

  const parsed = agentTaskResultSchema.safeParse(raw)
  if (!parsed.success) {
    throw new NabuClientError(
      "Nabu agent task response failed validation",
      502,
      "NABU_VALIDATION_ERROR",
      parsed.error.issues,
    )
  }

  return parsed.data
}
