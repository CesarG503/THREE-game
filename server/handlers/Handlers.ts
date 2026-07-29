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
  ChangePresenceMessage,
  SendGameInviteMessage,
  AcceptGameInviteMessage,
  NotificationClickMessage,
} from "../types.js"
import { setUserVisibility } from "../services/SocialRecommender.js"
import { handleUserVisibilityChange, sendToUser } from "../services/PresenceService.js"
import { prisma } from "../db/prisma.js"
import { notificationSystem } from "../services/NotificationSystem.js"
import { createGameInvite, getGameInvite, deleteGameInvite } from "../services/GameInviteService.js"
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

  // ── Presence Propagation (Fase 3) ──────────────────────────────────────

  router.register<ChangePresenceMessage>("changePresence", async ({ ws }, msg) => {
    if (!ws.userId) {
      logger.warn("Handlers", "changePresence received from unauthenticated socket — dropped")
      return
    }

    // CONTROL DE SEGURIDAD (Spoofing de Sockets)
    if (msg.userId && msg.userId !== ws.userId) {
      logger.warn("Security", `User ${ws.userId} tried to spoof presence change for user ${msg.userId}`)
      return
    }

    if (!["ONLINE", "INVISIBLE", "DND"].includes(msg.status)) {
      logger.warn("Handlers", `Invalid presence status received: ${msg.status}`)
      return
    }

    await setUserVisibility(ws.userId, msg.status)
    await handleUserVisibilityChange(ws.userId, msg.status)
  })

  // ── Game Invitations (Fase 4) ──────────────────────────────────────────

  router.register<SendGameInviteMessage>("sendGameInvite", async ({ ws, room }, msg) => {
    if (!ws.userId) {
      logger.warn("Handlers", "sendGameInvite received from unauthenticated socket — dropped")
      return
    }

    const { targetUserId, roomId } = msg
    if (!targetUserId || !roomId) {
      logger.warn("Handlers", "sendGameInvite missing targetUserId or roomId")
      return
    }

    // 1. VALIDACIÓN DE DESTINO: Comprobar que la sala exista y tenga jugadores
    if (room.getRoomSize(roomId) === 0) {
      ws.send(JSON.stringify({
        type: "game_invite_error",
        message: "La sala especificada no existe o no tiene jugadores activos."
      }))
      return
    }

    // 2. VALIDACIÓN DE AMISTAD (Relación de Confianza): Validar que sean amigos con estado ACCEPTED
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId: ws.userId,
        friendId: targetUserId
      }
    })

    if (!friendship) {
      logger.warn("Security", `User ${ws.userId} tried to invite non-friend ${targetUserId} to room ${roomId}`)
      ws.send(JSON.stringify({
        type: "game_invite_error",
        message: "Solo puedes invitar a tus amigos aceptados."
      }))
      return
    }

    // 3. VALIDACIÓN DE ESTADO ONLINE: Verificar que el receptor esté en línea
    if (!notificationSystem.isUserActive(targetUserId)) {
      ws.send(JSON.stringify({
        type: "game_invite_error",
        message: "El usuario objetivo no se encuentra en línea."
      }))
      return
    }

    // 4. Obtener datos del emisor
    const sender = await prisma.user.findUnique({
      where: { id: ws.userId },
      select: { username: true, displayName: true }
    })
    if (!sender) return

    const senderName = sender.displayName || sender.username

    // 5. Resolver nombre del mapa
    let mapName: string | null = null
    try {
      const match = await prisma.match.findFirst({
        where: {
          roomId: roomId,
          status: { in: ["RUNNING", "WAITING"] }
        },
        include: { map: true }
      })
      mapName = match?.map?.name || "Partida de Viper IO"
    } catch (err) {
      logger.error("Handlers", `Error resolving map name for room ${roomId}`, err)
    }

    // 6. Crear invitación con TTL 30s
    const invite = await createGameInvite(ws.userId, targetUserId, roomId)

    // 7. Enviar evento al receptor
    sendToUser(targetUserId, {
      type: "game_invite_received",
      inviteId: invite.id,
      senderId: ws.userId,
      senderName,
      roomId,
      mapName
    })

    // Emit GameInviteSent telemetry
    eventBuffer.push({
      id: crypto.randomUUID(),
      eventType: "GameInviteSent",
      userId: ws.userId,
      timestamp: new Date(),
      payload: {
        receiverId: targetUserId,
        roomId: roomId
      }
    })

    logger.info("Handlers", `Game invite sent from ${ws.userId} to ${targetUserId} for room ${roomId}`)
  })

  router.register<AcceptGameInviteMessage>("acceptGameInvite", async ({ ws, room }, msg) => {
    if (!ws.userId) {
      logger.warn("Handlers", "acceptGameInvite received from unauthenticated socket — dropped")
      return
    }

    const { inviteId } = msg
    if (!inviteId) {
      logger.warn("Handlers", "acceptGameInvite missing inviteId")
      return
    }

    // 1. Recuperar invitación
    const invite = await getGameInvite(inviteId)
    if (!invite) {
      ws.send(JSON.stringify({
        type: "game_invite_error",
        message: "La invitación ha expirado o no es válida."
      }))
      return
    }

    // 2. CONTROL DE SEGURIDAD: Verificar propiedad (solo el targetUserId legítimo puede aceptarla)
    if (invite.targetUserId !== ws.userId) {
      logger.warn("Security", `User ${ws.userId} tried to accept invitation ${inviteId} intended for ${invite.targetUserId}`)
      ws.send(JSON.stringify({
        type: "game_invite_error",
        message: "No tienes autorización para aceptar esta invitación."
      }))
      return
    }

    // 3. Validar que la sala de destino siga existiendo
    if (room.getRoomSize(invite.roomId) === 0) {
      ws.send(JSON.stringify({
        type: "game_invite_error",
        message: "La sala ya no existe o se ha cerrado."
      }))
      await deleteGameInvite(inviteId)
      return
    }

    // 4. Consumir invitación
    await deleteGameInvite(inviteId)

    // 5. Retornar éxito al socket solicitante para que se una
    ws.send(JSON.stringify({
      type: "game_invite_accepted",
      inviteId,
      roomId: invite.roomId
    }))

    // Emit GameInviteAccepted telemetry
    eventBuffer.push({
      id: crypto.randomUUID(),
      eventType: "GameInviteAccepted",
      userId: ws.userId,
      timestamp: new Date(),
      payload: {
        inviteId,
        senderId: invite.senderId,
        roomId: invite.roomId
      }
    })

    logger.info("Handlers", `User ${ws.userId} accepted game invite ${inviteId} for room ${invite.roomId}`)
  })
}
