/**
 * Outbound HTTP client errors.
 *
 * Provides structured error classification and safe user-facing messaging
 * without leaking tokens, internal URLs, or raw downstream trace data.
 */

export type HttpClientErrorCode =
  | "UNAUTHENTICATED"
  | "TIMEOUT"
  | "SERVICE_UNREACHABLE"
  | "HTTP_ERROR"
  | "MALFORMED_RESPONSE"
  | "VALIDATION_ERROR"
  | "CANCELLED"
  | "CLIENT_CONFIGURATION_ERROR"

export interface HttpClientErrorContext {
  readonly service?: string
  readonly path?: string
  readonly status?: number
  readonly code: HttpClientErrorCode
  readonly requestId?: string
  readonly details?: unknown
  readonly cause?: unknown
}

export class HttpClientError extends Error {
  readonly status: number
  readonly code: HttpClientErrorCode
  readonly service?: string
  readonly path?: string
  readonly requestId?: string
  readonly details?: unknown
  readonly isOperational = true

  constructor(
    message: string,
    context: {
      status?: number
      code: HttpClientErrorCode
      service?: string
      path?: string
      requestId?: string
      details?: unknown
      cause?: unknown
    },
  ) {
    super(message, { cause: context.cause })
    this.name = "HttpClientError"
    this.status = context.status ?? 500
    this.code = context.code
    this.service = context.service
    this.path = context.path
    this.requestId = context.requestId
    this.details = context.details
  }

  /**
   * Returns safe, actionable copy suitable for user-facing toasts (<Sonner />).
   */
  getUserMessage(): string {
    const serviceName = this.service
      ? `${this.service} service`
      : "External service"

    switch (this.code) {
      case "UNAUTHENTICATED":
        return "Authentication required. Please refresh or sign in again to continue."
      case "TIMEOUT":
        return `${serviceName} took too long to respond. Please try again.`
      case "SERVICE_UNREACHABLE":
        return `Unable to reach ${serviceName}. Please check your connection or try again later.`
      case "HTTP_ERROR":
        if (this.status === 404) return "The requested resource was not found."
        if (this.status === 403)
          return "You do not have permission to perform this action."
        if (this.status >= 500)
          return `${serviceName} encountered a temporary issue. Please try again.`
        return `${serviceName} rejected the request.`
      case "MALFORMED_RESPONSE":
      case "VALIDATION_ERROR":
        return "Received an unexpected response from the service. Please try again."
      case "CANCELLED":
        return "Request was cancelled."
      default:
        return "An unexpected service error occurred. Please try again."
    }
  }
}
