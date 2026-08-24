/**
 * Fenr production server — pure Bun.
 *
 * Serves pre-built static assets from dist/client and falls back to the
 * TanStack Start SSR handler (dist/server/server.js) for everything else.
 *
 * Environment:
 *   PORT (number)  — server port, default 3000
 *
 * Build first with `bun run build` (vite build), then start with `bun run start`.
 */
import path from "node:path"

import { logger } from "./src/lib/logger"

const SERVER_PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIRECTORY = "./dist/client"
const SERVER_ENTRY_POINT = "./dist/server/server.js"
const MAX_PRELOAD_BYTES = Number(
  process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024,
)

interface ServerHandler {
  fetch: (request: Request) => Response | Promise<Response>
}

const startupLogger = logger.child({ mod: "server" })

async function initializeStaticRoutes(): Promise<{
  routes: Record<string, (req: Request) => Response | Promise<Response>>
}> {
  const routes: Record<string, (req: Request) => Response | Promise<Response>> =
    {}
  const glob = new Bun.Glob("**/*")
  let preloaded = 0

  for await (const relativePath of glob.scan({ cwd: CLIENT_DIRECTORY })) {
    const filepath = path.join(CLIENT_DIRECTORY, relativePath)
    const route = `/${relativePath.split(path.sep).join(path.posix.sep)}`

    const file = Bun.file(filepath)
    if (!(await file.exists()) || file.size === 0) continue

    if (file.size <= MAX_PRELOAD_BYTES) {
      const raw = new Uint8Array(await file.arrayBuffer())
      const type = file.type || "application/octet-stream"
      const etag = `W/"${Bun.hash(raw).toString(16)}-${raw.byteLength.toString()}"`
      preloaded += raw.byteLength

      routes[route] = (req) => {
        const headers: Record<string, string> = {
          "Content-Type": type,
          "Cache-Control": route.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
          ETag: etag,
        }
        if (req.headers.get("if-none-match") === etag) {
          return new Response(null, { status: 304, headers })
        }
        return new Response(raw, { headers })
      }
    } else {
      // Large assets are streamed from disk on demand.
      routes[route] = () => new Response(Bun.file(filepath))
    }
  }

  startupLogger.info(
    { preloadedMb: Number((preloaded / 1024 / 1024).toFixed(2)) },
    "static assets preloaded",
  )
  return { routes }
}

async function initializeServer() {
  startupLogger.info("starting Fenr production server")

  let handler: ServerHandler
  try {
    const serverModule = (await import(SERVER_ENTRY_POINT)) as {
      default: ServerHandler
    }
    handler = serverModule.default
    startupLogger.info("TanStack Start application handler initialized")
  } catch (error) {
    startupLogger.error({ err: error }, "failed to load server handler")
    process.exit(1)
  }

  const { routes } = await initializeStaticRoutes()

  const server = Bun.serve({
    port: SERVER_PORT,
    routes: {
      ...routes,
      // Fallback to TanStack Start handler for all other routes
      "/*": async (req) => {
        try {
          return await handler.fetch(req)
        } catch (error) {
          startupLogger.error(
            { err: error, url: req.url },
            "server handler error",
          )
          return new Response("Internal Server Error", { status: 500 })
        }
      },
    },
    error(error) {
      startupLogger.error(
        { err: error instanceof Error ? error : String(error) },
        "uncaught server error",
      )
      return new Response("Internal Server Error", { status: 500 })
    },
  })

  startupLogger.info({ port: server.port }, "server listening")
}

initializeServer().catch((error: unknown) => {
  startupLogger.error({ err: error }, "failed to start server")
  process.exit(1)
})
