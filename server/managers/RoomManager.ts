import { WebSocket } from "ws"
import type { ExtendedWebSocket, OutgoingMessage, PlayerData, Vector3 } from "../types.js"
import { logger } from "../utils/Logger.js"

/**
 * RoomManager centralizes all mutable state:
 *  - rooms:       roomId → (playerId → PlayerData)
 *  - roomSockets: roomId → (playerId → ExtendedWebSocket)
 *
 * All operations go through this class so no raw Maps
 * are ever touched outside of it.
 */
export class RoomManager {
  private rooms       = new Map<string, Map<string, PlayerData>>()
  private roomSockets = new Map<string, Map<string, ExtendedWebSocket>>()

  // ── Getters (lazy-init) ────────────────────────────────────────────────

  private getOrCreateRoom(roomId: string): Map<string, PlayerData> {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map())
    return this.rooms.get(roomId)!
  }

  private getOrCreateSockets(roomId: string): Map<string, ExtendedWebSocket> {
    if (!this.roomSockets.has(roomId)) this.roomSockets.set(roomId, new Map())
    return this.roomSockets.get(roomId)!
  }

  getPlayer(roomId: string, playerId: string): PlayerData | undefined {
    return this.rooms.get(roomId)?.get(playerId)
  }

  getSocket(roomId: string, playerId: string): ExtendedWebSocket | undefined {
    return this.roomSockets.get(roomId)?.get(playerId)
  }

  getRoomPlayers(roomId: string): PlayerData[] {
    return Array.from(this.rooms.get(roomId)?.values() ?? [])
  }

  getRoomSize(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0
  }

  // ── Join / Leave ───────────────────────────────────────────────────────

  addPlayer(
    roomId: string,
    playerId: string,
    playerName: string,
    position: Vector3,
    ws: ExtendedWebSocket,
  ): void {
    const room    = this.getOrCreateRoom(roomId)
    const sockets = this.getOrCreateSockets(roomId)

    room.set(playerId, {
      id: playerId,
      name: playerName,
      position,
      rotation: 0,
      state: {
        modelType: "skin",
        isMoving: false,
        isCrouching: false,
        isAttacking: false,
        isGrounded: true,
        verticalVelocity: 0,
        action: "Idle",
      },
    })

    sockets.set(playerId, ws)
    logger.info(`Room:${roomId}`, `Player added: ${playerId} as "${playerName}" (total: ${room.size})`)
  }

  /**
   * Returns true if the room was deleted (was empty after removal).
   */
  removePlayer(roomId: string, playerId: string): boolean {
    const room    = this.rooms.get(roomId)
    const sockets = this.roomSockets.get(roomId)

    room?.delete(playerId)
    sockets?.delete(playerId)

    if (room?.size === 0) {
      this.rooms.delete(roomId)
      this.roomSockets.delete(roomId)
      logger.info(`Room:${roomId}`, "Room closed (empty)")
      return true
    }

    return false
  }

  updatePlayer(
    roomId: string,
    playerId: string,
    patch: Partial<Pick<PlayerData, "position" | "rotation" | "state">>,
  ): boolean {
    const player = this.rooms.get(roomId)?.get(playerId)
    if (!player) return false
    Object.assign(player, patch)
    return true
  }

  // ── Messaging ──────────────────────────────────────────────────────────

  send(ws: ExtendedWebSocket, message: OutgoingMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(message))
  }

  sendToPlayer(roomId: string, playerId: string, message: OutgoingMessage): boolean {
    const ws = this.getSocket(roomId, playerId)
    if (!ws) return false
    this.send(ws, message)
    return true
  }

  broadcast(
    roomId: string,
    message: OutgoingMessage,
    excludeId: string | null = null,
  ): void {
    const sockets = this.roomSockets.get(roomId)
    if (!sockets) return

    const payload = JSON.stringify(message)
    for (const [id, client] of sockets) {
      if (id !== excludeId && client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }

  // ── Diagnostics ────────────────────────────────────────────────────────

  stats(): { rooms: number; players: number } {
    let players = 0
    for (const room of this.rooms.values()) players += room.size
    return { rooms: this.rooms.size, players }
  }
}