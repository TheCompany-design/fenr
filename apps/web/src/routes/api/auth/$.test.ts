import { afterEach, describe, expect, it, spyOn } from "bun:test"
import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { handleAuthRequest } from "./$"

describe("handleAuthRequest (API Auth Wide Event)", () => {
  afterEach(() => {
    // Restore any active spies
  })

  it("handles GET request and logs wide event to logger.info with success outcome", async () => {
    const handlerSpy = spyOn(auth, "handler").mockImplementation(async () => {
      return new Response(JSON.stringify({ session: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      const request = new Request(
        "http://localhost:3000/api/auth/get-session",
        {
          method: "GET",
        },
      )

      const response = await handleAuthRequest(request)
      expect(response.status).toBe(200)

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).not.toHaveBeenCalled()

      const [event, message] = infoSpy.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ]
      expect(message).toBe("[api.auth] /api/auth/get-session completed")
      expect(event.service).toBe("fenr")
      expect(event.mod).toBe("api.auth")
      expect(event.action).toBe("/api/auth/get-session")
      expect(event.method).toBe("GET")
      expect(event.status_code).toBe(200)
      expect(event.outcome).toBe("success")
      expect(typeof event.requestId).toBe("string")
      expect(typeof event.timestamp).toBe("string")
      expect(typeof event.duration_ms).toBe("number")
    } finally {
      handlerSpy.mockRestore()
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("handles POST request and logs wide event with 401 client error to logger.info", async () => {
    const handlerSpy = spyOn(auth, "handler").mockImplementation(async () => {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    })
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      const request = new Request(
        "http://localhost:3000/api/auth/sign-in/email",
        {
          method: "POST",
        },
      )

      const response = await handleAuthRequest(request)
      expect(response.status).toBe(401)

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).not.toHaveBeenCalled()

      const [event, message] = infoSpy.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ]
      expect(message).toBe("[api.auth] /api/auth/sign-in/email failed")
      expect(event.service).toBe("fenr")
      expect(event.mod).toBe("api.auth")
      expect(event.action).toBe("/api/auth/sign-in/email")
      expect(event.method).toBe("POST")
      expect(event.status_code).toBe(401)
      expect(event.outcome).toBe("error")
    } finally {
      handlerSpy.mockRestore()
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("handles unexpected error by returning 500 and logging wide event to logger.error with stack", async () => {
    const handlerSpy = spyOn(auth, "handler").mockImplementation(async () => {
      throw new Error("Database connection dropped")
    })
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger)

    try {
      const request = new Request("http://localhost:3000/api/auth/callback", {
        method: "POST",
      })

      const response = await handleAuthRequest(request)
      expect(response.status).toBe(500)

      const body = (await response.json()) as { message: string }
      expect(body.message).toBe("Internal Server Error")

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(infoSpy).not.toHaveBeenCalled()

      const [event, message] = errorSpy.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ]
      expect(message).toBe("[api.auth] /api/auth/callback failed")
      expect(event.service).toBe("fenr")
      expect(event.mod).toBe("api.auth")
      expect(event.action).toBe("/api/auth/callback")
      expect(event.method).toBe("POST")
      expect(event.status_code).toBe(500)
      expect(event.outcome).toBe("error")
      expect(event.error).toBeDefined()
      const err = event.error as {
        name: string
        message: string
        stack?: string
      }
      expect(err.name).toBe("Error")
      expect(err.message).toBe("Database connection dropped")
      expect(typeof err.stack).toBe("string")
    } finally {
      handlerSpy.mockRestore()
      infoSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it("propagates x-request-id header when present on request", async () => {
    const handlerSpy = spyOn(auth, "handler").mockImplementation(async () => {
      return new Response(null, { status: 204 })
    })
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger)

    try {
      const request = new Request("http://localhost:3000/api/auth/sign-out", {
        method: "POST",
        headers: {
          "x-request-id": "client-trace-id-12345",
        },
      })

      const response = await handleAuthRequest(request)
      expect(response.status).toBe(204)

      expect(infoSpy).toHaveBeenCalledTimes(1)
      const [event] = infoSpy.mock.calls[0] as [Record<string, unknown>]
      expect(event.requestId).toBe("client-trace-id-12345")
    } finally {
      handlerSpy.mockRestore()
      infoSpy.mockRestore()
    }
  })
})
