import type { MessageRouter } from "./MessageRouter.js"
import type {
  PlayerUpdateMessage,
  ChatMessage,
  MapSyncDataMessage,
  BroadcastMapSyncMessage,
  PlayerShootMessage,
  PlayerActionMessage,
  EditorPlaceMessage,
  EditorRemoveMessage,
  EditorUpdateMessage,
  GameConfigUpdateMessage,
  PlayerConfigUpdateMessage,
  SimulationControlMessage,
} from "../types.js"
import { logger } from "../utils/Logger.js"

/**
 * Registers all message handlers on the router.
 * To add a new message type, add its handler here and
 * declare its interface in types.ts.
 */
export function registerHandlers(router: MessageRouter): void {

  // ── Player ─────────────────────────────────────────────────────────────

  router.register<PlayerUpdateMessage>("playerUpdate", ({ ws, roomId, playerId, room }, msg) => {
    room.updatePlayer(roomId, playerId, {
      position: msg.position,
      rotation: msg.rotation,
      state:    msg.state,
    })

    room.broadcast(roomId, {
      type:     "playerUpdate",
      playerId,
      position: msg.position,
      rotation: msg.rotation,
      state:    msg.state,
    }, playerId)
  })

  // ── Chat ───────────────────────────────────────────────────────────────

  router.register<ChatMessage>("chat", ({ roomId, playerId, room }, msg) => {
    const playerName = room.getPlayer(roomId, playerId)?.name ?? playerId.slice(-4)
    room.broadcast(roomId, {
      type: "chat",
      playerId,
      playerName,
      message: msg.text ?? msg.message ?? "",
    }, null) // null = include sender
  })

  // ── Map Sync ───────────────────────────────────────────────────────────

  router.register<MapSyncDataMessage>("mapSyncData", ({ roomId, room }, msg) => {
    if (!msg.targetId || !msg.mapData) return
    const sent = room.sendToPlayer(roomId, msg.targetId, {
      type:    "mapSyncData",
      targetId: msg.targetId,
      mapData:  msg.mapData,
    })
    if (sent) logger.info(`Room:${roomId}`, `Map sync delivered to ${msg.targetId}`)
  })

  router.register<BroadcastMapSyncMessage>("broadcastMapSync", ({ roomId, playerId, room }, msg) => {
    room.broadcast(roomId, {
      type:    "broadcastMapSync",
      mapData: msg.mapData,
    }, playerId)
    logger.info(`Room:${roomId}`, `Map sync broadcast by ${playerId}`)
  })

  // ── Shooting ───────────────────────────────────────────────────────────

  router.register<PlayerShootMessage>("playerShoot", ({ roomId, playerId, room }, msg) => {
    room.broadcast(roomId, {
      type:                    "playerShoot",
      playerId,
      startPos:                msg.startPos,
      direction:               msg.direction,
      projectileType:          msg.projectileType,
      speed:                   msg.speed,
      damage:                  msg.damage,
      drop:                    msg.drop,
      rebote:                  msg.rebote,
      hasImpactEffect:         msg.hasImpactEffect,
      hasTracer:               msg.hasTracer,
      hasTrajectoryLine:       msg.hasTrajectoryLine,
      customTracerVFX:         msg.customTracerVFX,
      customImpactVFX:         msg.customImpactVFX,
      tracerDestroyOnCollision: msg.tracerDestroyOnCollision,
      tracerStayForever:       msg.tracerStayForever,
      tracerCollisionVFX:      msg.tracerCollisionVFX,
    }, playerId)
  })

  router.register<PlayerActionMessage>("playerAction", ({ roomId, playerId, room }, msg) => {
    room.broadcast(roomId, {
      type:       "playerAction",
      playerId,
      actionType: msg.actionType,
      data:       msg.data,
    }, playerId)
  })

  // ── Editor ─────────────────────────────────────────────────────────────

  router.register<EditorPlaceMessage>("editorPlace", ({ roomId, playerId, room }, msg) => {
    if (!msg.data) return
    room.broadcast(roomId, { type: "editorPlace", playerId, data: msg.data }, playerId)
    logger.info(`Room:${roomId}`, `Editor place by ${playerId}`)
  })

  router.register<EditorRemoveMessage>("editorRemove", ({ roomId, playerId, room }, msg) => {
    if (!msg.uuid) return
    room.broadcast(roomId, { type: "editorRemove", playerId, uuid: msg.uuid }, playerId)
    logger.info(`Room:${roomId}`, `Editor remove ${msg.uuid} by ${playerId}`)
  })

  router.register<EditorUpdateMessage>("editorUpdate", ({ roomId, playerId, room }, msg) => {
    if (!msg.uuid || !msg.transform) return
    room.broadcast(roomId, {
      type:      "editorUpdate",
      playerId,
      uuid:      msg.uuid,
      transform: msg.transform,
    }, playerId)
  })

  // ── Game Config ────────────────────────────────────────────────────────

  router.register<GameConfigUpdateMessage>("gameConfigUpdate", ({ roomId, playerId, room }, msg) => {
    if (!msg.configData) return
    room.broadcast(roomId, { type: "gameConfigUpdate", playerId, configData: msg.configData }, playerId)
    logger.info(`Room:${roomId}`, `Game config updated by ${playerId}`)
  })

  router.register<PlayerConfigUpdateMessage>("playerConfigUpdate", ({ roomId, playerId, room }, msg) => {
    if (!msg.configData) return
    room.broadcast(roomId, { type: "playerConfigUpdate", playerId, configData: msg.configData }, playerId)
    logger.info(`Room:${roomId}`, `Player config updated by ${playerId}`)
  })

  // ── Simulation ─────────────────────────────────────────────────────────

  router.register<SimulationControlMessage>("simulationControl", ({ roomId, playerId, room }, msg) => {
    room.broadcast(roomId, {
      type:     "simulationControl",
      playerId,
      action:   msg.action,
      state:    msg.state,
    }, playerId)
    logger.info(`Room:${roomId}`, `Simulation control (${msg.action}) by ${playerId}`)
  })
}
