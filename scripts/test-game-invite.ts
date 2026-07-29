import { prisma } from "../server/db/prisma.js"
import { notificationSystem } from "../server/services/NotificationSystem.js"
import { roomManager } from "../server/managers/RoomManager.js"
import { getGameInvite } from "../server/services/GameInviteService.js"
import { MessageRouter } from "../server/handlers/MessageRouter.js"
import { registerHandlers } from "../server/handlers/Handlers.js"
import { connectRedis, disconnectRedis } from "../server/cache/redis.js"

class MockWebSocket {
  userId?: string | null
  playerId?: string
  roomId?: string
  readyState: number = 1 // OPEN
  sentMessages: string[] = []

  send(data: string) {
    this.sentMessages.push(data)
  }

  getParsedMessages() {
    return this.sentMessages.map((m) => JSON.parse(m))
  }
}

async function run() {
  console.log("Iniciando pruebas de invitaciones de juego...")

  await connectRedis()

  const timestamp = Date.now()
  const usernameA = `invite_user_a_${timestamp}`
  const usernameB = `invite_user_b_${timestamp}`
  const usernameC = `invite_user_c_${timestamp}`

  // 1. Crear usuarios semilla
  const userA = await prisma.user.create({
    data: {
      email: `${usernameA}@test.local`,
      username: usernameA,
      displayName: "Usuario A",
      passwordHash: "dummyhash",
    },
  })

  const userB = await prisma.user.create({
    data: {
      email: `${usernameB}@test.local`,
      username: usernameB,
      displayName: "Usuario B",
      passwordHash: "dummyhash",
    },
  })

  const userC = await prisma.user.create({
    data: {
      email: `${usernameC}@test.local`,
      username: usernameC,
      displayName: "Usuario C",
      passwordHash: "dummyhash",
    },
  })

  // Amistad: A <-> B (pero no C)
  await prisma.friendship.createMany({
    data: [
      { userId: userA.id, friendId: userB.id },
      { userId: userB.id, friendId: userA.id },
    ],
  })

  // Registrar sockets
  const wsA = new MockWebSocket()
  wsA.userId = userA.id
  notificationSystem.registerSocket(userA.id, wsA as any)

  const wsB = new MockWebSocket()
  wsB.userId = userB.id
  notificationSystem.registerSocket(userB.id, wsB as any)

  const wsC = new MockWebSocket()
  wsC.userId = userC.id
  notificationSystem.registerSocket(userC.id, wsC as any)

  // Crear sala activa
  const roomId = "room_active_123"
  roomManager.addPlayer(roomId, "player_a", "Usuario A", { x: 0, y: 0, z: 0 }, wsA as any)

  const router = new MessageRouter()
  registerHandlers(router)

  try {
    // --- Caso 1: Envío exitoso entre amigos ---
    console.log("Caso 1: Enviar invitación legítima (A -> B)")
    const contextA = { ws: wsA, roomId, playerId: "player_a", room: roomManager }
    await router.dispatch(contextA as any, {
      type: "sendGameInvite",
      targetUserId: userB.id,
      roomId,
    })

    const msgsB = wsB.getParsedMessages()
    const inviteMsg = msgsB.find((m) => m.type === "game_invite_received")
    if (!inviteMsg || inviteMsg.senderId !== userA.id || inviteMsg.roomId !== roomId) {
      throw new Error("Caso 1 fallido: B no recibió la invitación o los datos son incorrectos")
    }
    const inviteId = inviteMsg.inviteId
    console.log(` -> Aprobado: Invitación recibida con ID ${inviteId}`)

    // --- Caso 2: Bloqueo de invitaciones a no amigos ---
    console.log("Caso 2: Enviar invitación a un no-amigo (A -> C)")
    wsA.sentMessages = []
    await router.dispatch(contextA as any, {
      type: "sendGameInvite",
      targetUserId: userC.id,
      roomId,
    })

    const msgsA = wsA.getParsedMessages()
    const errMsgC = msgsA.find((m) => m.type === "game_invite_error")
    if (!errMsgC || !errMsgC.message.includes("Solo puedes invitar")) {
      throw new Error("Caso 2 fallido: Se permitió invitar a un no-amigo o no se devolvió el error adecuado")
    }
    console.log(" -> Aprobado: Bloqueo de invitación a no-amigos exitoso")

    // --- Caso 3: Bloqueo a salas inexistentes o vacías ---
    console.log("Caso 3: Enviar invitación a una sala inexistente")
    wsA.sentMessages = []
    await router.dispatch(contextA as any, {
      type: "sendGameInvite",
      targetUserId: userB.id,
      roomId: "room_non_existent",
    })

    const msgsA2 = wsA.getParsedMessages()
    const errMsgRoom = msgsA2.find((m) => m.type === "game_invite_error")
    if (!errMsgRoom || !errMsgRoom.message.includes("no existe o no tiene jugadores")) {
      throw new Error("Caso 3 fallido: Se permitió invitar a una sala vacía")
    }
    console.log(" -> Aprobado: Bloqueo de invitación a sala vacía exitoso")

    // --- Caso 4: Control de Seguridad (Aceptación por Tercero / Spoofing) ---
    console.log("Caso 4: Intento de aceptación por un tercero (C intenta aceptar invitación A -> B)")
    const contextC = { ws: wsC, roomId: "lobby", playerId: "player_c", room: roomManager }
    wsC.sentMessages = []
    await router.dispatch(contextC as any, {
      type: "acceptGameInvite",
      inviteId,
    })

    const msgsC = wsC.getParsedMessages()
    const errMsgAuth = msgsC.find((m) => m.type === "game_invite_error")
    if (!errMsgAuth || !errMsgAuth.message.includes("No tienes autorización")) {
      throw new Error("Caso 4 fallido: Se permitió que un tercero aceptara la invitación")
    }

    // Verificar que la invitación aún exista
    const activeInvite = await getGameInvite(inviteId)
    if (!activeInvite) {
      throw new Error("Caso 4 fallido: La invitación fue eliminada de forma inapropiada")
    }
    console.log(" -> Aprobado: Bloqueo de interceptación de invitación exitoso")

    // --- Caso 5: Aceptación exitosa por el destinatario legítimo ---
    console.log("Caso 5: Aceptación legítima de invitación (B acepta)")
    const contextB = { ws: wsB, roomId: "lobby", playerId: "player_b", room: roomManager }
    wsB.sentMessages = []
    await router.dispatch(contextB as any, {
      type: "acceptGameInvite",
      inviteId,
    })

    const msgsB2 = wsB.getParsedMessages()
    const acceptMsg = msgsB2.find((m) => m.type === "game_invite_accepted")
    if (!acceptMsg || acceptMsg.roomId !== roomId) {
      throw new Error("Caso 5 fallido: B no pudo aceptar la invitación correctamente")
    }

    // Verificar que la invitación fue consumida y ya no existe
    const consumedInvite = await getGameInvite(inviteId)
    if (consumedInvite) {
      throw new Error("Caso 5 fallido: La invitación no fue eliminada después de ser consumida")
    }
    console.log(" -> Aprobado: Aceptación y consumo de invitación exitoso")

    console.log("Todas las pruebas de invitaciones de juego pasaron con éxito.")
  } finally {
    // Teardown
    console.log("Limpiando datos semilla de invitaciones...")
    notificationSystem.clearRegistry()
    roomManager.removePlayer(roomId, "player_a")
    await prisma.friendship.deleteMany({
      where: {
        userId: { in: [userA.id, userB.id, userC.id] },
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: { in: [userA.id, userB.id, userC.id] },
      },
    })
    await disconnectRedis()
    await prisma.$disconnect()
  }
}

run().catch((err) => {
  console.error("Fallo durante la ejecución de las pruebas de invitaciones:", err)
  process.exit(1)
})
