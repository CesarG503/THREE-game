import { WebSocket } from "ws"
import type { ExtendedWebSocket, GroundItemRecord, OutgoingMessage, PlayerData, Vector3 } from "../types.js"
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
  private roomGroundItems = new Map<string, Map<string, GroundItemRecord>>()
  private roomGroundItemUids = new Map<string, Set<string>>()

  // ── Getters (lazy-init) ────────────────────────────────────────────────

  private getOrCreateRoom(roomId: string): Map<string, PlayerData> {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map())
    return this.rooms.get(roomId)!
  }

  private getOrCreateSockets(roomId: string): Map<string, ExtendedWebSocket> {
    if (!this.roomSockets.has(roomId)) this.roomSockets.set(roomId, new Map())
    return this.roomSockets.get(roomId)!
  }

  private getOrCreateGroundItems(roomId: string): Map<string, GroundItemRecord> {
    if (!this.roomGroundItems.has(roomId)) this.roomGroundItems.set(roomId, new Map())
    return this.roomGroundItems.get(roomId)!
  }

  private getOrCreateGroundItemUids(roomId: string): Set<string> {
    if (!this.roomGroundItemUids.has(roomId)) this.roomGroundItemUids.set(roomId, new Set())
    return this.roomGroundItemUids.get(roomId)!
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

  getGroundItems(roomId: string): GroundItemRecord[] {
    return Array.from(this.roomGroundItems.get(roomId)?.values() ?? [])
  }

  getGroundItem(roomId: string, dropId: string): GroundItemRecord | undefined {
    return this.roomGroundItems.get(roomId)?.get(dropId)
  }

  addGroundItem(roomId: string, item: GroundItemRecord): boolean {
    const drops = this.getOrCreateGroundItems(roomId)
    const itemUids = this.getOrCreateGroundItemUids(roomId)

    if (drops.has(item.dropId)) return false
    if (item.itemUid && itemUids.has(item.itemUid)) return false

    drops.set(item.dropId, item)
    if (item.itemUid) itemUids.add(item.itemUid)
    return true
  }

  removeGroundItem(roomId: string, dropId: string): boolean {
    const drops = this.roomGroundItems.get(roomId)
    if (!drops) return false

    const item = drops.get(dropId)
    if (!item) return false

    drops.delete(dropId)
    if (item.itemUid) this.roomGroundItemUids.get(roomId)?.delete(item.itemUid)
    return true
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
      this.roomGroundItems.delete(roomId)
      this.roomGroundItemUids.delete(roomId)
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
