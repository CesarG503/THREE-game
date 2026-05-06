import type { RoomManager } from "../managers/RoomManager.js"
import type { ExtendedWebSocket, JoinRoomMessage } from "../types.js"
import { logger } from "../utils/Logger.js"

function generatePlayerId(): string {
  return "player_" + Math.random().toString(36).substring(2, 9)
}

function randomSpawn() {
  return {
    x: Math.random() * 10 - 5,
    y: 0,
    z: Math.random() * 10 - 5,
  }
}

export function handleJoinRoom(
  ws: ExtendedWebSocket,
  message: JoinRoomMessage,
  room: RoomManager,
): void {
  const roomId    = message.roomId ?? "lobby"
  const playerId  = generatePlayerId()
  const playerName = message.playerName ?? playerId.slice(-4)
  const position  = randomSpawn()

  ws.playerId = playerId
  ws.roomId   = roomId

  // Snapshot existing players BEFORE adding the new one
  const existingPlayers = room.getRoomPlayers(roomId)

  room.addPlayer(roomId, playerId, playerName, position, ws)

  // 1. Welcome the newcomer
  room.send(ws, { type: "welcome", playerId, playerName })

  // 2. Send them the current game state
  if (existingPlayers.length > 0) {
    room.send(ws, { type: "gameState", players: existingPlayers })

    // 3. Ask first peer to sync the map to the newcomer
    const firstPeerId = existingPlayers[0]!.id
    const sent = room.sendToPlayer(roomId, firstPeerId, {
      type:     "requestMapSync",
      targetId: playerId,
    })
    if (sent) logger.info(`Room:${roomId}`, `Map sync requested from ${firstPeerId} for ${playerId}`)
  }

  // 4. Notify everyone else
  room.broadcast(roomId, {
    type:     "playerJoined",
    playerId,
    name:     playerName,
    position,
    rotation: 0,
  }, playerId)

  logger.info(`Room:${roomId}`, `Room size: ${room.getRoomSize(roomId)}`)
}