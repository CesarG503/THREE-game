import { prisma } from "../server/db/prisma.js"
import { notificationSystem } from "../server/services/NotificationSystem.js"
import { setUserVisibility, getUserVisibility } from "../server/services/SocialRecommender.js"
import {
  handleUserConnect,
  handleUserDisconnect,
  handleUserVisibilityChange,
} from "../server/services/PresenceService.js"
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
  console.log("Iniciando pruebas de propagación de presencia...")

  // Conectar Redis para pruebas de visibilidad
  await connectRedis()

  const timestamp = Date.now()
  const usernameA = `pres_user_a_${timestamp}`
  const usernameB = `pres_user_b_${timestamp}`
  const usernameC = `pres_user_c_${timestamp}`

  // 1. Setup: Crear usuarios semilla
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

  // Crear amistades explícitas: A <-> B y B <-> C (pero no A <-> C)
  await prisma.friendship.createMany({
    data: [
      { userId: userA.id, friendId: userB.id },
      { userId: userB.id, friendId: userA.id },
      { userId: userB.id, friendId: userC.id },
      { userId: userC.id, friendId: userB.id },
    ],
  })

  try {
    // Asegurar visibilidad inicial por defecto
    await setUserVisibility(userA.id, "ONLINE")
    await setUserVisibility(userB.id, "ONLINE")
    await setUserVisibility(userC.id, "ONLINE")

    // --- Caso 1: A conecta (B está desconectado) ---
    console.log("Caso 1: Conexión de Usuario A")
    const wsA = new MockWebSocket()
    wsA.userId = userA.id
    await handleUserConnect(userA.id, wsA as any)

    const msgsA = wsA.getParsedMessages()
    const initMsgA = msgsA.find((m) => m.type === "friends_status_init")
    if (!initMsgA || initMsgA.friends.length !== 0) {
      throw new Error("Caso 1 fallido: A debió recibir lista vacía de amigos conectados")
    }
    console.log(" -> Aprobado: A conectado con lista vacía de amigos")

    // --- Caso 2: B conecta (A está conectado y es amigo) ---
    console.log("Caso 2: Conexión de Usuario B")
    const wsB = new MockWebSocket()
    wsB.userId = userB.id
    await handleUserConnect(userB.id, wsB as any)

    // B debe recibir la presencia de A en la lista inicial
    const msgsB = wsB.getParsedMessages()
    const initMsgB = msgsB.find((m) => m.type === "friends_status_init")
    if (!initMsgB || initMsgB.friends.length !== 1 || initMsgB.friends[0].id !== userA.id) {
      throw new Error("Caso 2 fallido: B debió ver a A online en la inicialización")
    }

    // A debe recibir notificación en tiempo real de que B se conectó
    const msgsAUpdated = wsA.getParsedMessages()
    const connMsgA = msgsAUpdated.find((m) => m.type === "friend_connected")
    if (!connMsgA || connMsgA.friend.id !== userB.id || connMsgA.friend.status !== "ONLINE") {
      throw new Error("Caso 2 fallido: A no recibió la notificación de conexión de B")
    }
    console.log(" -> Aprobado: propagación bidireccional de conexión exitosa")

    // --- Caso 3: Cambio de visibilidad a DND (B cambia a DND) ---
    console.log("Caso 3: Cambio de visibilidad a DND por B")
    wsA.sentMessages = [] // limpiar
    await handleUserVisibilityChange(userB.id, "DND")

    const msgsAAfterDnd = wsA.getParsedMessages()
    const dndMsgA = msgsAAfterDnd.find((m) => m.type === "friend_connected")
    if (!dndMsgA || dndMsgA.friend.id !== userB.id || dndMsgA.friend.status !== "DND") {
      throw new Error("Caso 3 fallido: A no recibió la actualización DND de B")
    }
    console.log(" -> Aprobado: propagación de cambio de estado a DND exitosa")

    // --- Caso 4: Cambio de visibilidad a INVISIBLE (B cambia a INVISIBLE) ---
    console.log("Caso 4: Cambio de visibilidad a INVISIBLE por B (Bypass de Privacidad)")
    wsA.sentMessages = []
    await handleUserVisibilityChange(userB.id, "INVISIBLE")

    const msgsAAfterInvisible = wsA.getParsedMessages()
    const discMsgA = msgsAAfterInvisible.find((m) => m.type === "friend_disconnected")
    if (!discMsgA || discMsgA.userId !== userB.id) {
      throw new Error("Caso 4 fallido: A debió recibir evento de desconexión cuando B fue invisible")
    }
    console.log(" -> Aprobado: bypass de privacidad (ocultamiento) exitoso")

    // --- Caso 5: Conexión desde estado INVISIBLE (C conecta siendo INVISIBLE) ---
    console.log("Caso 5: Conexión de Usuario C en estado INVISIBLE")
    await setUserVisibility(userC.id, "INVISIBLE")
    const wsC = new MockWebSocket()
    wsC.userId = userC.id

    wsB.sentMessages = [] // limpiar socket de B (B es amigo de C)
    await handleUserConnect(userC.id, wsC as any)

    const msgsBAfterC = wsB.getParsedMessages()
    const connMsgC = msgsBAfterC.find((m) => m.type === "friend_connected" && m.friend.id === userC.id)
    if (connMsgC) {
      throw new Error("Caso 5 fallido: B no debió recibir notificación de conexión de C porque C es INVISIBLE")
    }
    console.log(" -> Aprobado: conexión invisible no se propaga a los amigos")

    // --- Caso 6: Desconexión de usuario ---
    console.log("Caso 6: Desconexión de Usuario A")
    wsB.sentMessages = [] // limpiar B
    await handleUserDisconnect(userA.id, wsA as any)

    const msgsBAfterADisc = wsB.getParsedMessages()
    const discMsgB = msgsBAfterADisc.find((m) => m.type === "friend_disconnected" && m.userId === userA.id)
    if (!discMsgB) {
      throw new Error("Caso 6 fallido: B debió recibir evento de desconexión de A")
    }
    console.log(" -> Aprobado: propagación de desconexión exitosa")

    // --- Caso 7: Control de Seguridad - Spoofing de Sockets ---
    console.log("Caso 7: Intento de spoofing de presencia de B usando socket de C")
    const router = new MessageRouter()
    registerHandlers(router)

    // C intenta cambiar la presencia de B a DND
    const mockContext = {
      ws: wsC,
      roomId: "lobby",
      playerId: "player_c",
      room: {
        getRoomSize: () => 1,
      },
    }

    await router.dispatch(mockContext as any, {
      type: "changePresence",
      userId: userB.id, // ID ajeno
      status: "DND",
    })

    // La visibilidad de B no debe haber cambiado a DND
    const visB = await getUserVisibility(userB.id)
    if (visB === "DND") {
      throw new Error("Caso 7 fallido: el intento de spoofing cambió la visibilidad del usuario B")
    }
    console.log(" -> Aprobado: bloqueo de spoofing de presencia en socket exitoso")

    console.log("Todas las pruebas de presencia pasaron con éxito.")
  } finally {
    // Limpieza (Teardown)
    console.log("Limpiando datos semilla de presencia...")
    notificationSystem.clearRegistry()
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
  console.error("Fallo durante la ejecución de las pruebas de presencia:", err)
  process.exit(1)
})
