import { prisma } from "../db/prisma.js"
import { notificationSystem } from "./NotificationSystem.js"
import { getUserVisibility } from "./SocialRecommender.js"
import type { ExtendedWebSocket } from "../types.js"
import { logger } from "../utils/Logger.js"

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  createdAt: true,
} as const

/**
 * Helper to dispatch a WebSocket message to all active sockets of a user.
 */
export function sendToUser(userId: string, message: unknown): void {
  const sockets = (notificationSystem as any).activeSockets.get(userId) || []
  const payload = JSON.stringify(message)
  for (const ws of sockets) {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(payload)
    }
  }
}

function getUserActiveRoomId(userId: string): string | null {
  const sockets = (notificationSystem as any).activeSockets.get(userId) || []
  for (const ws of sockets) {
    if (ws.roomId && ws.roomId !== "lobby") {
      return ws.roomId
    }
  }
  return null
}

/**
 * Handles the registration of a new socket for a user, initialization of their friends' state,
 * and broadcasting their online presence to friends (respecting privacy).
 */
export async function handleUserConnect(userId: string, ws: ExtendedWebSocket): Promise<void> {
  const wasActive = notificationSystem.isUserActive(userId)
  
  // Register socket in NotificationSystem
  notificationSystem.registerSocket(userId, ws)

  try {
    // 1. Fetch visibility status of user
    const visibility = await getUserVisibility(userId)

    // 2. Fetch list of friends
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: {
          select: publicUserSelect,
        },
      },
    })

    // 3. Compile list of currently online friends to send to the connecting user
    const onlineFriends = []
    for (const f of friendships) {
      const friendId = f.friend.id
      if (notificationSystem.isUserActive(friendId)) {
        const friendVisibility = await getUserVisibility(friendId)
        if (friendVisibility !== "INVISIBLE") {
          onlineFriends.push({
            id: friendId,
            username: f.friend.username,
            displayName: f.friend.displayName,
            status: friendVisibility,
            roomId: getUserActiveRoomId(friendId),
          })
        }
      }
    }

    // Send connecting user their initial social presence state
    ws.send(JSON.stringify({
      type: "friends_status_init",
      friends: onlineFriends,
    }))

    // 4. If user is invisible, do not broadcast connection event to friends
    if (visibility === "INVISIBLE") {
      logger.info("PresenceService", `User ${userId} connected as INVISIBLE. Skipping connection broadcast.`)
      return
    }

    // 5. If this is the user's first active connection, notify their active friends
    if (!wasActive) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
      })

      if (user) {
        const broadcastPayload = {
          type: "friend_connected",
          friend: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            status: visibility,
            roomId: getUserActiveRoomId(userId),
          },
        }

        for (const f of friendships) {
          const friendId = f.friend.id
          if (notificationSystem.isUserActive(friendId)) {
            sendToUser(friendId, broadcastPayload)
          }
        }
      }
    }
  } catch (err) {
    logger.error("PresenceService", `Error during connection handling for user ${userId}`, err)
  }
}

/**
 * Handles socket disconnection, removing registry entries, and notifying friends if the user went completely offline.
 */
export async function handleUserDisconnect(userId: string, ws: ExtendedWebSocket): Promise<void> {
  // Unregister socket in NotificationSystem
  notificationSystem.unregisterSocket(userId, ws)

  try {
    const isStillActive = notificationSystem.isUserActive(userId)

    // If no active connections remain for this user, broadcast disconnect
    if (!isStillActive) {
      const visibility = await getUserVisibility(userId)
      
      // If user was invisible, friends already perceived them as offline, so skip event
      if (visibility === "INVISIBLE") {
        logger.info("PresenceService", `User ${userId} disconnected from INVISIBLE state. Skipping broadcast.`)
        return
      }

      const friendships = await prisma.friendship.findMany({
        where: { userId },
        select: {
          friendId: true,
        },
      })

      const broadcastPayload = {
        type: "friend_disconnected",
        userId,
      }

      for (const f of friendships) {
        if (notificationSystem.isUserActive(f.friendId)) {
          sendToUser(f.friendId, broadcastPayload)
        }
      }
    }
  } catch (err) {
    logger.error("PresenceService", `Error during disconnection handling for user ${userId}`, err)
  }
}

/**
 * Propagates user visibility change events in real-time to active friends.
 */
export async function handleUserVisibilityChange(
  userId: string,
  newVisibility: "ONLINE" | "INVISIBLE" | "DND"
): Promise<void> {
  try {
    const isActive = notificationSystem.isUserActive(userId)
    if (!isActive) return // If they aren't online/active, no active presence updates to propagate

    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: {
          select: { id: true },
        },
      },
    })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    })

    if (!user) return

    for (const f of friendships) {
      const friendId = f.friend.id
      if (notificationSystem.isUserActive(friendId)) {
        if (newVisibility === "INVISIBLE") {
          // If going invisible, friends should perceive them as disconnected
          sendToUser(friendId, {
            type: "friend_disconnected",
            userId,
          })
        } else {
          // If going online/DND, friends should see them as connected/updated
          sendToUser(friendId, {
            type: "friend_connected",
            friend: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              status: newVisibility,
              roomId: getUserActiveRoomId(userId),
            },
          })
        }
      }
    }
  } catch (err) {
    logger.error("PresenceService", `Error handling visibility change for user ${userId}`, err)
  }
}
