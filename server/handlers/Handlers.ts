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
  NotificationClickMessage,
} from "../types.js"
import { logger } from "../utils/Logger.js"
import { eventBuffer } from "../analytics/eventBuffer.js"
import crypto from "node:crypto"

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
    const data = msg.data as any

    if (msg.actionType === "dropItem" && data?.dropId && data?.itemData && data?.position && data?.direction) {
      const stored = room.addGroundItem(roomId, {
        dropId: data.dropId,
        itemUid: data.itemData.uid,
        itemData: data.itemData,
        position: data.position,
        direction: data.direction,
        torque: data.torque,
        ownerId: playerId,
        createdAt: Date.now(),
      })

      if (!stored) {
        logger.warn(`Room:${roomId}`, `Duplicate drop ignored: ${data.dropId}`)
        return
      }

      room.broadcast(roomId, {
        type:       "playerAction",
        playerId,
        actionType: msg.actionType,
        data:       data,
      }, playerId)
      return
    }

    if (msg.actionType === "pickupItem" && data?.dropId) {
      const groundItem = room.getGroundItem(roomId, data.dropId)
      if (!groundItem) {
        logger.warn(`Room:${roomId}`, `Pickup denied for missing drop: ${data.dropId}`)
        room.sendToPlayer(roomId, playerId, {
          type:       "playerAction",
          playerId,
          actionType: "pickupDenied",
          data:       { dropId: data.dropId },
        })
        return
      }

      const removed = room.removeGroundItem(roomId, data.dropId)
      if (!removed) {
        return
      }

      room.broadcast(roomId, {
        type:       "playerAction",
        playerId,
        actionType: msg.actionType,
        data:       {
          dropId: data.dropId,
          pickedBy: playerId,
          itemData: groundItem.itemData,
        },
      }, null)
      return
    }

    if (msg.actionType === "groundItemState" && Array.isArray(data?.updates)) {
      const acceptedUpdates = data.updates.filter((update: any) => {
        if (!update?.dropId || !update.position) return false
        return room.updateGroundItemState(roomId, update.dropId, update, playerId)
      })

      if (acceptedUpdates.length === 0) return

      room.broadcast(roomId, {
        type:       "playerAction",
        playerId,
        actionType: msg.actionType,
        data:       { updates: acceptedUpdates },
      }, playerId)
      return
    }

    room.broadcast(roomId, {
      type:       "playerAction",
      playerId,
      actionType: msg.actionType,
      data:       data,
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

  // ── Retention / Notifications ──────────────────────────────────────────

  router.register<NotificationClickMessage>("notificationClick", ({ ws }, msg) => {
    if (!ws.userId) return
    logger.info("NotificationClick", `User ${ws.userId} clicked notification ${msg.notificationId} (variant ${msg.variant})`)

    // Record CTR Telemetry click event
    eventBuffer.push({
      id: crypto.randomUUID(),
      eventType: "NotificationClick",
      userId: ws.userId,
      timestamp: new Date(),
      payload: {
        notificationId: msg.notificationId,
        campaignName: msg.campaignName,
        variant: msg.variant,
      },
    })
  })
}
