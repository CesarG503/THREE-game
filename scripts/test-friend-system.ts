import { prisma } from "../server/db/prisma.js"
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeFriend,
  getFriendsList,
  getPendingRequests,
  SocialError,
} from "../server/services/FriendshipService.js"

async function run() {
  console.log("Iniciando pruebas del sistema de amigos...")

  const timestamp = Date.now()
  const usernameA = `test_user_a_${timestamp}`
  const usernameB = `test_user_b_${timestamp}`
  const usernameC = `test_user_c_${timestamp}`

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

  try {
    // 2. Probar: Enviar solicitud válida
    console.log("Caso 1: Enviar solicitud de A a B")
    const reqAB = await sendRequest(userA.id, usernameB)
    if (reqAB.status !== "PENDING" || reqAB.senderId !== userA.id || reqAB.receiverId !== userB.id) {
      throw new Error("Caso 1 fallido: la solicitud no se creó en estado PENDING")
    }

    // 3. Probar: No agregarse a uno mismo
    console.log("Caso 2: Enviar solicitud a uno mismo")
    try {
      await sendRequest(userA.id, usernameA)
      throw new Error("Caso 2 fallido: se permitió agregarse a uno mismo")
    } catch (err) {
      if (!(err instanceof SocialError) || err.status !== 400) {
        throw err
      }
      console.log(" -> Aprobado: bloqueo de auto-solicitud exitoso")
    }

    // 4. Probar: Evitar solicitudes redundantes
    console.log("Caso 3: Enviar solicitud duplicada")
    try {
      await sendRequest(userA.id, usernameB)
      throw new Error("Caso 3 fallido: se permitió duplicar la solicitud")
    } catch (err) {
      if (!(err instanceof SocialError) || err.status !== 400) {
        throw err
      }
      console.log(" -> Aprobado: bloqueo de duplicación exitoso")
    }

    // 5. Probar: Control de Seguridad en Aceptación (Tercero)
    console.log("Caso 4: Intento de aceptación por usuario no autorizado (Usuario C)")
    try {
      await acceptRequest(userC.id, reqAB.id)
      throw new Error("Caso 4 fallido: un tercero pudo aceptar la solicitud")
    } catch (err) {
      if (!(err instanceof SocialError) || err.status !== 403) {
        throw err
      }
      console.log(" -> Aprobado: control de autorización de aceptación exitoso (403 Forbidden)")
    }

    // 6. Probar: Aceptación Válida
    console.log("Caso 5: Aceptación de solicitud por el receptor legítimo (Usuario B)")
    const acceptRes = await acceptRequest(userB.id, reqAB.id)
    if (!acceptRes.success) {
      throw new Error("Caso 5 fallido: no se pudo aceptar la solicitud")
    }

    // Verificar relaciones en BD
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userA.id },
          { userId: userB.id },
        ],
      },
    })
    // Deben existir exactamente 2 relaciones bidireccionales
    if (friendships.length !== 2) {
      throw new Error(`Caso 5 fallido: se esperaban 2 registros de amistad bidireccional, encontrados ${friendships.length}`)
    }
    console.log(" -> Aprobado: creación de amistad bidireccional exitosa")

    // 7. Probar: Listar amigos
    console.log("Caso 6: Listar amigos de Usuario A")
    const friendsA = await getFriendsList(userA.id)
    if (friendsA.length !== 1 || friendsA[0]?.id !== userB.id) {
      throw new Error("Caso 6 fallido: el listado de amigos es incorrecto")
    }
    console.log(" -> Aprobado: listado de amigos exitoso")

    // 8. Probar: Eliminar amigo
    console.log("Caso 7: Eliminar amigo (A elimina a B)")
    await removeFriend(userA.id, userB.id)
    const friendsAAfter = await getFriendsList(userA.id)
    const friendshipsAfter = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userA.id },
          { userId: userB.id },
        ],
      },
    })
    if (friendsAAfter.length !== 0 || friendshipsAfter.length !== 0) {
      throw new Error("Caso 7 fallido: no se eliminaron las relaciones de amistad")
    }
    console.log(" -> Aprobado: eliminación de amistad exitosa")

    // 9. Probar: Rechazo de solicitud
    console.log("Caso 8: Enviar y rechazar solicitud (B solicita a C, C rechaza)")
    const reqBC = await sendRequest(userB.id, usernameC)
    
    // Intento de rechazo por tercero (A)
    try {
      await rejectRequest(userA.id, reqBC.id)
      throw new Error("Caso 8 fallido: un tercero pudo rechazar la solicitud")
    } catch (err) {
      if (!(err instanceof SocialError) || err.status !== 403) {
        throw err
      }
    }

    // Rechazo legítimo por C
    await rejectRequest(userC.id, reqBC.id)
    const updatedReqBC = await prisma.friendRequest.findUnique({
      where: { id: reqBC.id },
    })
    if (updatedReqBC?.status !== "REJECTED") {
      throw new Error("Caso 8 fallido: el estado de la solicitud no cambió a REJECTED")
    }
    console.log(" -> Aprobado: rechazo y autorización de rechazo exitosos")

    console.log("Todas las pruebas pasaron con éxito.")
  } finally {
    // 10. Limpieza (Teardown)
    console.log("Limpiando datos semilla...")
    await prisma.friendship.deleteMany({
      where: {
        userId: { in: [userA.id, userB.id, userC.id] },
      },
    })
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: [userA.id, userB.id, userC.id] } },
          { receiverId: { in: [userA.id, userB.id, userC.id] } },
        ],
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: { in: [userA.id, userB.id, userC.id] },
      },
    })
    await prisma.$disconnect()
  }
}

run().catch((err) => {
  console.error("Fallo durante la ejecución de las pruebas:", err)
  process.exit(1)
})
