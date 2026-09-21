/**
 * Central Outbound HTTP Transport.
 *
 * Implements:
 * - Strict auth token injection for authenticated services
 * - Complete protection against caller-supplied Authorization headers
 * - Absolute omission of tokens on public endpoints
 * - Request ID propagation (X-Request-Id)
 * - Composed timeout and AbortSignal cancellation with explicit timer cleanup
 * - Structured Pino wide event logging (redacted, no tokens/secrets)
 * - Non-leaky error classification (HttpClientError)
 * - Safe handling of HTTP 204 No Content / empty responses
 * - Zod request input and response payload validation
 */

import { serverEnv } from "@/lib/env"
import { moduleLogger } from "@/lib/logger"
import { HttpClientError } from "./errors"
import { SERVICES } from "./registry"
import { acquireOutboundJwt } from "./token.server"
import type {
  EndpointAuth,
  EndpointDefinition,
  ExecuteRequestOptions,
} from "./types"

const log = moduleLogger("http")

function getServiceBaseUrl(service: string): string {
  if (service === SERVICES.NABU) {
    return serverEnv.NABU_SERVER_URL
  }
  throw new HttpClientError(
    `Unknown service "${service}" in endpoint registry`,
    {
      code: "CLIENT_CONFIGURATION_ERROR",
      service,
    },
  )
}

/**
 * Resolves the absolute URL for a given service and endpoint definition.
 */
function resolveEndpointUrl<TInput>(
  endpoint: EndpointDefinition<TInput, unknown>,
  input?: TInput,
): string {
  const resolvedPath =
    typeof endpoint.path === "function"
      ? endpoint.path(input as TInput)
      : endpoint.path

  const isAbsolute =
    resolvedPath.startsWith("http://") || resolvedPath.startsWith("https://")

  if (endpoint.auth.type === "authenticated") {
    const baseUrl = getServiceBaseUrl(endpoint.service)
    const expectedOrigin = new URL(baseUrl).origin

    if (isAbsolute) {
      const resolvedOrigin = new URL(resolvedPath).origin
      if (resolvedOrigin !== expectedOrigin) {
        throw new HttpClientError(
          `Security violation: authenticated request to ${endpoint.service} attempted to send credentials to unauthorized origin: ${resolvedOrigin}`,
          {
            code: "CLIENT_CONFIGURATION_ERROR",
            service: endpoint.service,
            path: resolvedPath,
          },
        )
      }
      return resolvedPath
    }

    const cleanBase = baseUrl.replace(/\/+$/, "")
    const cleanPath = resolvedPath.startsWith("/")
      ? resolvedPath
      : `/${resolvedPath}`
    return `${cleanBase}${cleanPath}`
  }

  // Public endpoints may specify arbitrary absolute URLs (e.g. third-party APIs)
  if (isAbsolute) {
    return resolvedPath
  }

  const baseUrl = getServiceBaseUrl(endpoint.service)
  const cleanBase = baseUrl.replace(/\/+$/, "")
  const cleanPath = resolvedPath.startsWith("/")
    ? resolvedPath
    : `/${resolvedPath}`
  return `${cleanBase}${cleanPath}`
}

/**
 * Executes an outbound request to an endpoint definition.
 */
export async function executeRequest<
  TInput = void,
  TOutput = unknown,
  TAuth extends EndpointAuth = EndpointAuth,
>(
  endpoint: EndpointDefinition<TInput, TOutput, TAuth>,
  options: ExecuteRequestOptions<TInput> = {},
): Promise<TOutput> {
  const startTime = Date.now()
  const requestId =
    options.requestId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}`)

  // 0. Check cancellation before doing any work
  if (options.signal?.aborted) {
    throw new HttpClientError("Request was cancelled", {
      code: "CANCELLED",
      status: 499,
      service: endpoint.service,
      path: endpoint.id,
      requestId,
      cause: options.signal.reason,
    })
  }

  // 1. Validate Input Schema if defined
  let validatedInput = options.input
  if (endpoint.inputSchema) {
    const inputParse = endpoint.inputSchema.safeParse(options.input)
    if (!inputParse.success) {
      log.warn(
        {
          endpointId: endpoint.id,
          service: endpoint.service,
          issues: inputParse.error.issues,
        },
        "outbound request input validation failed",
      )
      throw new HttpClientError(
        `Invalid input for ${endpoint.id}: ${inputParse.error.message}`,
        {
          code: "VALIDATION_ERROR",
          status: 400,
          service: endpoint.service,
          requestId,
          details: inputParse.error.issues,
        },
      )
    }
    validatedInput = inputParse.data
  }

  // 2. Resolve target URL
  const targetUrl = resolveEndpointUrl(endpoint, validatedInput)

  // 3. Prepare headers
  const headers = new Headers()
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (key.toLowerCase() === "authorization") {
        continue
      }
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const item of value) {
            headers.append(key, item)
          }
        } else {
          headers.set(key, value)
        }
      }
    }
  }

  // Unconditionally ensure no caller-supplied authorization header
  headers.delete("authorization")

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }
  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", requestId)
  }

  // 4. Handle Authentication Policy
  if (endpoint.auth.type === "authenticated") {
    const token = await acquireOutboundJwt(endpoint.auth, {
      headersSource: options.headersSource,
      token: options.token,
      tokenProvider: options.tokenProvider,
      signal: options.signal,
    })
    headers.set("Authorization", `Bearer ${token}`)
  } else {
    // Explicit public endpoint: ensure no Authorization header is ever sent
    headers.delete("authorization")
  }

  // 5. Build body for mutating requests
  let body: BodyInit | undefined
  if (
    validatedInput !== undefined &&
    (endpoint.method === "POST" ||
      endpoint.method === "PUT" ||
      endpoint.method === "PATCH")
  ) {
    try {
      body = JSON.stringify(validatedInput)
    } catch (err) {
      throw new HttpClientError(
        `Failed to serialize request for ${endpoint.service}`,
        {
          code: "VALIDATION_ERROR",
          status: 400,
          service: endpoint.service,
          requestId,
          cause: err,
        },
      )
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  }

  // 6. Timeout and Signal composition with deterministic timer teardown
  const timeoutMs = options.timeoutMs ?? endpoint.timeoutMs ?? 10_000
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(
      new DOMException(
        `Request timed out after ${timeoutMs}ms`,
        "TimeoutError",
      ),
    )
  }, timeoutMs)

  let onCallerAbort: (() => void) | undefined
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer)
      throw new HttpClientError("Request was cancelled", {
        code: "CANCELLED",
        status: 499,
        service: endpoint.service,
        path: targetUrl,
        requestId,
        cause: options.signal.reason,
      })
    }
    onCallerAbort = () => {
      controller.abort(options.signal?.reason)
    }
    options.signal.addEventListener("abort", onCallerAbort, { once: true })
  }

  let response: Response
  let rawText = ""
  try {
    response = await fetch(targetUrl, {
      method: endpoint.method,
      headers,
      body,
      signal: controller.signal,
    })

    // Consume response body within the timeout and cancellation window
    rawText = await response.text()
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime

    if (
      timedOut ||
      (err instanceof DOMException && err.name === "TimeoutError")
    ) {
      log.warn(
        {
          endpointId: endpoint.id,
          service: endpoint.service,
          method: endpoint.method,
          durationMs,
          timeoutMs,
          requestId,
        },
        "outbound request timed out",
      )
      throw new HttpClientError(
        `Request to ${endpoint.service} timed out after ${timeoutMs}ms`,
        {
          code: "TIMEOUT",
          status: 504,
          service: endpoint.service,
          path: targetUrl,
          requestId,
          cause: err,
        },
      )
    }

    if (
      options.signal?.aborted ||
      (err instanceof DOMException && err.name === "AbortError")
    ) {
      log.info(
        {
          endpointId: endpoint.id,
          service: endpoint.service,
          durationMs,
          requestId,
        },
        "outbound request was cancelled",
      )
      throw new HttpClientError("Request was cancelled", {
        code: "CANCELLED",
        status: 499,
        service: endpoint.service,
        path: targetUrl,
        requestId,
        cause: err,
      })
    }

    // Unreachable: keep message non-leaky without exposing internal IP/ports/socket traces
    log.error(
      {
        err:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : String(err),
        endpointId: endpoint.id,
        service: endpoint.service,
        method: endpoint.method,
        targetUrl: "[redacted]",
        durationMs,
        requestId,
      },
      "outbound service unreachable",
    )
    throw new HttpClientError(`Unable to reach ${endpoint.service} service`, {
      code: "SERVICE_UNREACHABLE",
      status: 503,
      service: endpoint.service,
      path: targetUrl,
      requestId,
      cause: err,
    })
  } finally {
    clearTimeout(timer)
    if (options.signal && onCallerAbort) {
      options.signal.removeEventListener("abort", onCallerAbort)
    }
  }

  const durationMs = Date.now() - startTime

  // 7. Non-2xx Response Handling
  if (!response.ok) {
    let errorPayload: unknown = null
    const trimmedErrorText = rawText.trim()
    if (trimmedErrorText.length > 0) {
      try {
        errorPayload = JSON.parse(trimmedErrorText)
      } catch {
        errorPayload = rawText
      }
    }

    const logContext = {
      endpointId: endpoint.id,
      service: endpoint.service,
      method: endpoint.method,
      status: response.status,
      durationMs,
      requestId,
    }
    const logMsg = `outbound request returned HTTP ${response.status}`
    if (response.status >= 500) {
      log.error(logContext, logMsg)
    } else {
      log.warn(logContext, logMsg)
    }

    throw new HttpClientError(
      `${endpoint.service} service returned HTTP ${response.status}`,
      {
        code: "HTTP_ERROR",
        status: response.status,
        service: endpoint.service,
        path: targetUrl,
        requestId,
        details: errorPayload,
      },
    )
  }

  // 8. Parse JSON payload (safely handling 204 No Content / empty bodies)
  let rawData: unknown
  const trimmedText = rawText.trim()
  if (
    response.status === 204 ||
    response.status === 205 ||
    trimmedText.length === 0
  ) {
    rawData = undefined
  } else {
    try {
      rawData = JSON.parse(trimmedText)
    } catch (err) {
      log.error(
        {
          endpointId: endpoint.id,
          service: endpoint.service,
          status: response.status,
          durationMs,
          requestId,
        },
        "failed to parse outbound response JSON",
      )
      throw new HttpClientError(
        `Failed to parse response JSON from ${endpoint.service}`,
        {
          code: "MALFORMED_RESPONSE",
          status: 502,
          service: endpoint.service,
          path: targetUrl,
          requestId,
          cause: err,
        },
      )
    }
  }

  // 9. Validate Response Schema
  const parseResult = endpoint.responseSchema.safeParse(rawData)
  if (!parseResult.success) {
    log.error(
      {
        endpointId: endpoint.id,
        service: endpoint.service,
        issues: parseResult.error.issues,
        durationMs,
        requestId,
      },
      "outbound response failed schema validation",
    )
    throw new HttpClientError(
      `${endpoint.service} response failed schema validation`,
      {
        code: "VALIDATION_ERROR",
        status: 502,
        service: endpoint.service,
        path: targetUrl,
        requestId,
        details: parseResult.error.issues,
      },
    )
  }

  // 10. Log successful wide event (redacted: no sensitive data)
  log.info(
    {
      endpointId: endpoint.id,
      service: endpoint.service,
      method: endpoint.method,
      status: response.status,
      durationMs,
      requestId,
      outcome: "success",
    },
    "outbound request completed successfully",
  )

  return parseResult.data
}
