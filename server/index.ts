// WebSocket Server – Multiplayer Game
// Run with: node dist/index.js  (or: tsx src/index.ts)

import { WebSocketServer } from "ws"
import type { ExtendedWebSocket, IncomingMessage } from "./types.js"
import { RoomManager }    from "./managers/RoomManager.js"
import { MessageRouter }  from "./handlers/MessageRouter.js"
import { registerHandlers } from "./handlers/Handlers.js"
import { handleJoinRoom } from "./handlers/Joinroom.js"
import { buildContext }   from "./middleware/Session.js"
import { logger }         from "./utils/Logger.js"

// ── Bootstrap ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 8080

const roomManager = new RoomManager()

const router = new MessageRouter()
registerHandlers(router)

logger.info("Server", `Registered handlers: ${router.registeredTypes().join(", ")}`)

// ── WebSocket Server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT })

wss.on("listening", () => {
  logger.info("Server", `WebSocket server running on ws://localhost:${PORT}`)
})

wss.on("connection", (ws: ExtendedWebSocket) => {

  ws.on("message", async (data) => {
    let message: IncomingMessage

    // ── Parse ────────────────────────────────────────────────────────────
    try {
      message = JSON.parse(data.toString()) as IncomingMessage
    } catch {
      logger.warn("Server", "Malformed JSON received — dropped")
      return
    }

    // ── joinRoom bypasses session middleware ──────────────────────────────
    if (message.type === "joinRoom") {
      handleJoinRoom(ws, message, roomManager)
      return
    }

    // ── All other messages go through session guard + router ─────────────
    const ctx = buildContext(ws, message, roomManager)
    if (!ctx) return

    await router.dispatch(ctx, message)
  })

  ws.on("close", () => {
    const { playerId, roomId } = ws
    if (!playerId || !roomId) return

    logger.info(`Room:${roomId}`, `Player disconnected: ${playerId}`)

    const roomDeleted = roomManager.removePlayer(roomId, playerId)

    if (!roomDeleted) {
      roomManager.broadcast(roomId, { type: "playerLeft", playerId })
    }
  })

  ws.on("error", (err) => {
    logger.error("Server", "WebSocket error", err)
  })
})

// ── Optional: periodic stats ───────────────────────────────────────────────
if (process.env.LOG_STATS === "true") {
  setInterval(() => {
    logger.debug("Stats", "Server stats", roomManager.stats())
  }, 30_000)
}