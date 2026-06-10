import type { IncomingMessage as HttpIncomingMessage, ServerResponse } from "node:http"
import { AuthError, getUserBySessionToken, loginUser, registerUser, requireUserBySessionToken, type AuthInput } from "../services/AuthService.js"
import { createMap, deleteMap, getMap, listMaps, updateMap, type MapWriteInput } from "../services/MapService.js"
import { logger } from "../utils/Logger.js"

const MAX_BODY_BYTES = 1024 * 1024 * 2

export async function handleHttpRequest(
  req: HttpIncomingMessage,
  res: ServerResponse,
): Promise<void> {
  setCorsHeaders(req, res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    return withJsonBody(req, res, async (body) => {
      const result = await registerUser(body as AuthInput)
      sendJson(res, 201, result)
    })
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    return withJsonBody(req, res, async (body) => {
      const result = await loginUser(body as AuthInput)
      sendJson(res, 200, result)
    })
  }

  if (req.method === "GET" && url.pathname === "/api/maps") {
    return withApiError(res, async () => {
      const user = await getOptionalRequestUser(req)
      const result = await listMaps(url.searchParams.get("scope"), user?.id ?? null)
      sendJson(res, 200, { maps: result })
    })
  }

  if (req.method === "POST" && url.pathname === "/api/maps") {
    return withJsonBody(req, res, async (body) => {
      const user = await getRequiredRequestUser(req)
      const result = await createMap(body as MapWriteInput, user.id)
      sendJson(res, 201, result)
    })
  }

  const mapMatch = /^\/api\/maps\/([^/]+)$/.exec(url.pathname)
  if (mapMatch) {
    const identifier = decodeURIComponent(mapMatch[1] ?? "")

    if (req.method === "GET") {
      return withApiError(res, async () => {
        const user = await getOptionalRequestUser(req)
        const result = await getMap(identifier, user?.id ?? null)
        sendJson(res, 200, result)
      })
    }

    if (req.method === "PUT") {
      return withJsonBody(req, res, async (body) => {
        const user = await getRequiredRequestUser(req)
        const result = await updateMap(identifier, body as MapWriteInput, user.id)
        sendJson(res, 200, result)
      })
    }

    if (req.method === "DELETE") {
      return withApiError(res, async () => {
        const user = await getRequiredRequestUser(req)
        const result = await deleteMap(identifier, user.id)
        sendJson(res, 200, result)
      })
    }
  }

  sendJson(res, 404, { error: "Not found" })
}

async function withApiError(
  res: ServerResponse,
  handler: () => Promise<void>,
): Promise<void> {
  try {
    await handler()
  } catch (err) {
    handleApiError(res, err)
  }
}

async function withJsonBody(
  req: HttpIncomingMessage,
  res: ServerResponse,
  handler: (body: unknown) => Promise<void>,
): Promise<void> {
  try {
    const body = await readJson(req)
    await handler(body)
  } catch (err) {
    handleApiError(res, err)
  }
}

function readJson(req: HttpIncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ""

    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8")
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new AuthError(413, "Payload demasiado grande"))
        req.destroy()
      }
    })

    req.on("end", () => {
      if (!body.trim()) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new AuthError(400, "JSON invalido"))
      }
    })

    req.on("error", reject)
  })
}

function handleApiError(res: ServerResponse, err: unknown): void {
  if (res.headersSent) return

  if (err instanceof AuthError) {
    sendJson(res, err.status, { error: err.message })
    return
  }

  if (isDatabaseConnectionError(err)) {
    logger.error("HTTP", "Database connection unavailable", err)
    sendJson(res, 503, { error: "Base de datos no disponible" })
    return
  }

  logger.error("HTTP", "Unhandled API error", err)
  sendJson(res, 500, { error: "Error interno del servidor" })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}

function setCorsHeaders(req: HttpIncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  res.setHeader("Access-Control-Allow-Origin", typeof origin === "string" ? origin : "*")
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

async function getOptionalRequestUser(req: HttpIncomingMessage) {
  const token = getBearerToken(req)
  if (!token) return null
  return getUserBySessionToken(token)
}

async function getRequiredRequestUser(req: HttpIncomingMessage) {
  const token = getBearerToken(req)
  if (!token) throw new AuthError(401, "Sesion requerida")
  return requireUserBySessionToken(token)
}

function getBearerToken(req: HttpIncomingMessage) {
  const header = req.headers.authorization
  if (typeof header !== "string") return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

function isDatabaseConnectionError(err: unknown) {
  if (!err || typeof err !== "object") return false
  const code = "code" in err ? String(err.code) : ""
  const message = err instanceof Error ? err.message : ""
  return code === "ECONNREFUSED" || message.includes("ECONNREFUSED")
}
