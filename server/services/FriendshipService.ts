import { prisma } from "../db/prisma.js"

export class SocialError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  createdAt: true,
} as const

/**
 * Envía una solicitud de amistad a un usuario por su username.
 */
export async function sendRequest(senderId: string, receiverUsername: string) {
  const normalizedUsername = receiverUsername.trim()
  if (!normalizedUsername) {
    throw new SocialError(400, "Nombre de usuario requerido")
  }

  // Buscar el destinatario
  const receiver = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  })

  if (!receiver) {
    throw new SocialError(404, "Usuario no encontrado")
  }

  const receiverId = receiver.id

  if (senderId === receiverId) {
    throw new SocialError(400, "No puedes enviarte una solicitud de amistad a ti mismo")
  }

  // Verificar si ya son amigos
  const existingFriendship = await prisma.friendship.findUnique({
    where: {
      userId_friendId: {
        userId: senderId,
        friendId: receiverId,
      },
    },
  })

  if (existingFriendship) {
    throw new SocialError(400, "Ya eres amigo de este usuario")
  }

  // Verificar si ya existe una solicitud activa
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
  })

  if (existingRequest) {
    if (existingRequest.status === "PENDING") {
      if (existingRequest.senderId === senderId) {
        throw new SocialError(400, "Ya has enviado una solicitud de amistad a este usuario")
      } else {
        throw new SocialError(400, "Este usuario ya te envió una solicitud de amistad. Por favor, acéptala.")
      }
    }

    // Si fue rechazada anteriormente, la reactivamos actualizándola a PENDING
    if (existingRequest.status === "REJECTED" && existingRequest.senderId === senderId) {
      return prisma.friendRequest.update({
        where: { id: existingRequest.id },
        data: { status: "PENDING" },
      })
    }
  }

  // Crear nueva solicitud de amistad
  return prisma.friendRequest.create({
    data: {
      senderId,
      receiverId,
      status: "PENDING",
    },
  })
}

/**
 * Acepta una solicitud de amistad.
 */
export async function acceptRequest(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    throw new SocialError(404, "Solicitud de amistad no encontrada")
  }

  if (request.status !== "PENDING") {
    throw new SocialError(400, "La solicitud ya no está pendiente")
  }

  // CONTROL DE SEGURIDAD: Solo el receptor legítimo puede aceptar la solicitud
  if (request.receiverId !== userId) {
    throw new SocialError(403, "No estás autorizado para aceptar esta solicitud de amistad")
  }

  // Crear amistad bidireccional y actualizar estado de la solicitud en transacción
  return prisma.$transaction(async (tx) => {
    // 1. Actualizar estado de solicitud
    await tx.friendRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    })

    // 2. Crear relación de amistad para ambos lados
    await tx.friendship.createMany({
      data: [
        { userId: request.senderId, friendId: request.receiverId },
        { userId: request.receiverId, friendId: request.senderId },
      ],
      skipDuplicates: true,
    })

    return { success: true }
  })
}

/**
 * Rechaza una solicitud de amistad.
 */
export async function rejectRequest(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    throw new SocialError(404, "Solicitud de amistad no encontrada")
  }

  if (request.status !== "PENDING") {
    throw new SocialError(400, "La solicitud ya no está pendiente")
  }

  // CONTROL DE SEGURIDAD: Solo el receptor legítimo puede rechazar la solicitud
  if (request.receiverId !== userId) {
    throw new SocialError(403, "No estás autorizado para rechazar esta solicitud de amistad")
  }

  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  })
}

/**
 * Elimina una amistad existente.
 */
export async function removeFriend(userId: string, friendId: string) {
  // Eliminar relación de amistad de ambos lados
  return prisma.$transaction(async (tx) => {
    // Eliminar relaciones
    const delete1 = tx.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    })

    // Eliminar o marcar como rechazadas solicitudes históricas para que puedan volver a solicitarse
    const deleteRequests = tx.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    })

    await Promise.all([delete1, deleteRequests])
    return { success: true }
  })
}

/**
 * Obtiene el listado de amigos del usuario.
 */
export async function getFriendsList(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { userId },
    include: {
      friend: {
        select: publicUserSelect,
      },
    },
  })

  return friendships.map((f) => f.friend)
}

/**
 * Obtiene las solicitudes de amistad pendientes recibidas.
 */
export async function getPendingRequests(userId: string) {
  return prisma.friendRequest.findMany({
    where: {
      receiverId: userId,
      status: "PENDING",
    },
    include: {
      sender: {
        select: publicUserSelect,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}
