import { describe, expect, it, spyOn } from "bun:test"
import { logger, withWideEvent } from "./logger"

describe("withWideEvent", () => {
  it("success path: emits info log with duration, 200 status, success outcome, action, mod", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      const result = await withWideEvent(
        "test_mod",
        "test_action",
        async () => {
          return "hello world"
        },
      )

      expect(result).toBe("hello world")
      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).not.toHaveBeenCalled()

      const [event, msg] = infoSpy.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ]
      expect(msg).toBe("[test_mod] test_action completed")
      expect(event.service).toBe("fenr")
      expect(event.mod).toBe("test_mod")
      expect(event.action).toBe("test_action")
      expect(event.outcome).toBe("success")
      expect(event.status_code).toBe(200)
      expect(typeof event.requestId).toBe("string")
      expect(typeof event.timestamp).toBe("string")
      expect(typeof event.duration_ms).toBe("number")
      expect((event.duration_ms as number) >= 0).toBe(true)
    } finally {
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("error path: captures error name, message, stack, re-throws, sets outcome to error and maps status code (500)", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      const customErr = new Error("Something broke unexpectedly")
      await expect(
        withWideEvent("test_mod", "fail_action", async () => {
          throw customErr
        }),
      ).rejects.toThrow("Something broke unexpectedly")

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(infoSpy).not.toHaveBeenCalled()

      const [event, msg] = errorSpy.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ]
      expect(msg).toBe("[test_mod] fail_action failed")
      expect(event.service).toBe("fenr")
      expect(event.mod).toBe("test_mod")
      expect(event.action).toBe("fail_action")
      expect(event.outcome).toBe("error")
      expect(event.status_code).toBe(500)
      const err = event.error as {
        name: string
        message: string
        stack?: string
      }
      expect(err.name).toBe("Error")
      expect(err.message).toBe("Something broke unexpectedly")
      expect(typeof err.stack).toBe("string")
      expect(typeof event.duration_ms).toBe("number")
    } finally {
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("error path: maps client error status codes and logs to info with 'failed' message", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      // UnauthorizedError -> 401
      class UnauthorizedError extends Error {
        constructor() {
          super("Unauthorized")
          this.name = "UnauthorizedError"
        }
      }
      await expect(
        withWideEvent("test_mod", "unauthorized_action", async () => {
          throw new UnauthorizedError()
        }),
      ).rejects.toThrow("Unauthorized")

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).not.toHaveBeenCalled()
      let [event, msg] = infoSpy.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ]
      expect(msg).toBe("[test_mod] unauthorized_action failed")
      expect(event.status_code).toBe(401)
      expect(event.outcome).toBe("error")

      // ForbiddenError -> 403
      class ForbiddenError extends Error {
        constructor() {
          super("Forbidden")
          this.name = "ForbiddenError"
        }
      }
      await expect(
        withWideEvent("test_mod", "forbidden_action", async () => {
          throw new ForbiddenError()
        }),
      ).rejects.toThrow("Forbidden")

      expect(infoSpy).toHaveBeenCalledTimes(2)
      ;[event, msg] = infoSpy.mock.calls[1] as [Record<string, unknown>, string]
      expect(msg).toBe("[test_mod] forbidden_action failed")
      expect(event.status_code).toBe(403)
      expect(event.outcome).toBe("error")

      // NotFoundError -> 404
      class NotFoundError extends Error {
        constructor() {
          super("Not Found")
          this.name = "NotFoundError"
        }
      }
      await expect(
        withWideEvent("test_mod", "not_found_action", async () => {
          throw new NotFoundError()
        }),
      ).rejects.toThrow("Not Found")

      expect(infoSpy).toHaveBeenCalledTimes(3)
      ;[event, msg] = infoSpy.mock.calls[2] as [Record<string, unknown>, string]
      expect(msg).toBe("[test_mod] not_found_action failed")
      expect(event.status_code).toBe(404)
      expect(event.outcome).toBe("error")

      // ConflictError -> 409
      class ConflictError extends Error {
        constructor() {
          super("Conflict")
          this.name = "ConflictError"
        }
      }
      await expect(
        withWideEvent("test_mod", "conflict_action", async () => {
          throw new ConflictError()
        }),
      ).rejects.toThrow("Conflict")

      expect(infoSpy).toHaveBeenCalledTimes(4)
      ;[event, msg] = infoSpy.mock.calls[3] as [Record<string, unknown>, string]
      expect(msg).toBe("[test_mod] conflict_action failed")
      expect(event.status_code).toBe(409)
      expect(event.outcome).toBe("error")

      // ZodError -> 400
      class ZodError extends Error {
        issues: unknown[]
        constructor() {
          super("Validation error")
          this.name = "ZodError"
          this.issues = [{ path: ["email"], message: "Invalid email" }]
        }
      }
      await expect(
        withWideEvent("test_mod", "validation_action", async () => {
          throw new ZodError()
        }),
      ).rejects.toThrow("Validation error")

      expect(infoSpy).toHaveBeenCalledTimes(5)
      ;[event, msg] = infoSpy.mock.calls[4] as [Record<string, unknown>, string]
      expect(msg).toBe("[test_mod] validation_action failed")
      expect(event.status_code).toBe(400)
      expect(event.outcome).toBe("error")

      // Generic error with status property -> 422
      class CustomHttpError extends Error {
        status = 422
        constructor() {
          super("Unprocessable")
          this.name = "CustomHttpError"
        }
      }
      await expect(
        withWideEvent("test_mod", "custom_status_action", async () => {
          throw new CustomHttpError()
        }),
      ).rejects.toThrow("Unprocessable")

      expect(infoSpy).toHaveBeenCalledTimes(6)
      ;[event, msg] = infoSpy.mock.calls[5] as [Record<string, unknown>, string]
      expect(msg).toBe("[test_mod] custom_status_action failed")
      expect(event.status_code).toBe(422)
      expect(event.outcome).toBe("error")
    } finally {
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("stale context.status_code safety: ignores 2xx status_code set before an unexpected throw", async () => {
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      await expect(
        withWideEvent("test_mod", "stale_status_action", async (setContext) => {
          setContext({ status_code: 200 })
          throw new Error("Unexpected crash after setting 200")
        }),
      ).rejects.toThrow("Unexpected crash after setting 200")

      expect(errorSpy).toHaveBeenCalledTimes(1)
      const [event] = errorSpy.mock.calls[0] as [Record<string, unknown>]
      expect(event.status_code).toBe(500)
      expect(event.outcome).toBe("error")
    } finally {
      errorSpy.mockRestore()
    }
  })

  it("defensive logging: logger failures do not displace returned results or thrown errors", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => {
      throw new Error("Logging transport failed")
    })
    const errorSpy = spyOn(logger, "error").mockImplementation(() => {
      throw new Error("Logging transport failed")
    })

    try {
      // Success path returns even if logger fails
      const result = await withWideEvent("mod", "action", async () => {
        return "success-value"
      })
      expect(result).toBe("success-value")

      // Error path re-throws original error even if logger fails
      await expect(
        withWideEvent("mod", "action", async () => {
          throw new Error("Original business error")
        }),
      ).rejects.toThrow("Original business error")
    } finally {
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("enrichment via setContext: captures userId, organizationId, custom business context", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)

    try {
      await withWideEvent(
        "organizations",
        "createOrganization",
        async (setContext) => {
          setContext({
            userId: "user-123",
            organizationId: "org-456",
            slug: "acme-corp",
            plan: "pro",
          })
          return { id: "org-456" }
        },
        { initialFlag: true },
      )

      expect(infoSpy).toHaveBeenCalledTimes(1)
      const [event] = infoSpy.mock.calls[0] as [Record<string, unknown>]
      expect(event.mod).toBe("organizations")
      expect(event.action).toBe("createOrganization")
      expect(event.userId).toBe("user-123")
      expect(event.organizationId).toBe("org-456")
      expect(event.slug).toBe("acme-corp")
      expect(event.plan).toBe("pro")
      expect(event.initialFlag).toBe(true)
    } finally {
      infoSpy.mockRestore()
    }
  })

  it("propagates requestId when provided in initialContext", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)

    try {
      await withWideEvent("test_mod", "action", async () => "ok", {
        requestId: "custom-req-id-789",
      })

      expect(infoSpy).toHaveBeenCalledTimes(1)
      const [event] = infoSpy.mock.calls[0] as [Record<string, unknown>]
      expect(event.requestId).toBe("custom-req-id-789")
    } finally {
      infoSpy.mockRestore()
    }
  })

  it("concurrency isolation: executes multiple concurrent operations with isolated contexts and request IDs", async () => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)

    try {
      const concurrencyCount = 10
      const tasks = Array.from({ length: concurrencyCount }, (_, i) => {
        return withWideEvent(
          "concurrency_mod",
          `task_${i}`,
          async (setContext) => {
            // Add a small async delay to simulate parallel interleaved execution
            await new Promise((resolve) => setTimeout(resolve, 5))
            setContext({
              taskIndex: i,
              userId: `user-${i}`,
              organizationId: `org-${i}`,
            })
            return `result_${i}`
          },
          { seed: i },
        )
      })

      const results = await Promise.all(tasks)
      expect(results).toHaveLength(concurrencyCount)
      for (let i = 0; i < concurrencyCount; i++) {
        expect(results[i]).toBe(`result_${i}`)
      }

      expect(infoSpy).toHaveBeenCalledTimes(concurrencyCount)

      // Collect all logged events
      const loggedEvents = infoSpy.mock.calls.map(
        (call) => call[0] as Record<string, unknown>,
      )

      const requestIds = new Set<string>()
      for (let i = 0; i < concurrencyCount; i++) {
        const event = loggedEvents.find((e) => e.taskIndex === i)
        expect(event).toBeDefined()
        expect(event?.action).toBe(`task_${i}`)
        expect(event?.userId).toBe(`user-${i}`)
        expect(event?.organizationId).toBe(`org-${i}`)
        expect(event?.seed).toBe(i)
        expect(typeof event?.requestId).toBe("string")
        requestIds.add(event?.requestId as string)
      }

      // All request IDs must be distinct
      expect(requestIds.size).toBe(concurrencyCount)
    } finally {
      infoSpy.mockRestore()
    }
  })
})
