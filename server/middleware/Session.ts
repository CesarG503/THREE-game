import type { RoomManager } from "../managers/RoomManager.js"
import type { ExtendedWebSocket, IncomingMessage } from "../types.js"
import type { HandlerContext } from "../handlers/MessageRouter.js"
import { logger } from "../utils/Logger.js"

/**
 * Guards: ensures the WebSocket has an authenticated session
 * (playerId + roomId set during joinRoom) before creating a HandlerContext.
 *
 * Returns null if the message should be dropped.
 */
export function buildContext(
  ws: ExtendedWebSocket,
  message: IncomingMessage,
  roomManager: RoomManager,
): HandlerContext | null {
  const { playerId, roomId } = ws

  if (!playerId || !roomId) {
    logger.warn("Middleware", `Unauthenticated message type "${message.type}" dropped`)
    return null
  }

  // Ensure the room still exists (could have been cleaned up)
  if (roomManager.getRoomSize(roomId) === 0 && message.type !== "joinRoom") {
    logger.warn("Middleware", `Room "${roomId}" not found for player ${playerId}`)
    return null
  }

  return { ws, roomId, playerId, room: roomManager }
}