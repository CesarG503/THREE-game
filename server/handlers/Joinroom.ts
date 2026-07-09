import type { RoomManager } from "../managers/RoomManager.js"
import type { ExtendedWebSocket, JoinRoomMessage } from "../types.js"
import { logger } from "../utils/Logger.js"
import { eventBuffer } from "../analytics/eventBuffer.js"
import crypto from "node:crypto"
import { notificationSystem } from "../services/NotificationSystem.js"
import { analyticsPrisma } from "../db/analyticsPrisma.js"

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

export async function handleJoinRoom(
  ws: ExtendedWebSocket,
  message: JoinRoomMessage,
  room: RoomManager,
): Promise<void> {
  const roomId    = message.roomId ?? "lobby"
  const playerId  = generatePlayerId()
  const playerName = message.playerName ?? playerId.slice(-4)
  const position  = randomSpawn()

  ws.playerId = playerId
  ws.roomId   = roomId
  ws.connectedAt = Date.now()
  ws.userId = null

  if (message.token) {
    try {
      const { getUserBySessionToken } = await import("../services/AuthService.js")
      const user = await getUserBySessionToken(message.token)
      if (user) {
        ws.userId = user.id
        logger.info(`Room:${roomId}`, `Authenticated player ${playerId} as user ${user.id}`)

        // Register connection in notification registry
        notificationSystem.registerSocket(user.id, ws)

        // Trigger online notification to high affinity friends
        void (async () => {
          try {
            const affinities = await analyticsPrisma.socialAffinity.findMany({
              where: {
                OR: [
                  { userId1: user.id },
                  { userId2: user.id },
                ],
                affinity: { gt: 0.5 },
              },
            })

            for (const aff of affinities) {
              const friendId = aff.userId1 === user.id ? aff.userId2 : aff.userId1
              if (notificationSystem.isUserActive(friendId)) {
                notificationSystem.sendNotification(friendId, "friend_online", {
                  friendName: user.displayName || user.username,
                })
              }
            }
          } catch (err) {
            logger.error("JoinRoomTrigger", "Failed to trigger friend online notifications", err)
          }
        })()
      }
    } catch (err) {
      logger.warn(`Room:${roomId}`, `Token verification failed for player ${playerId}:`, err)
    }
  }

  // Push MatchJoin telemetry
  eventBuffer.push({
    id: crypto.randomUUID(),
    eventType: "MatchJoin",
    userId: ws.userId,
    timestamp: new Date(),
    payload: {
      roomId,
      mapId: null, // Resolvable when Map/Game Modes are strictly enforced
      playerRole: "player"
    }
  })

  // Snapshot existing players BEFORE adding the new one
  const existingPlayers = room.getRoomPlayers(roomId)
  const groundItems = room.getGroundItems(roomId)

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

  if (groundItems.length > 0) {
    room.send(ws, { type: "groundItemsSync", items: groundItems })
    logger.info(`Room:${roomId}`, `Ground item sync sent to ${playerId} (${groundItems.length})`)
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
