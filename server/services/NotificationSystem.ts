import type { ExtendedWebSocket } from "../types.js";
import { abSdk } from "../analytics/experiments/ab_sdk.js";
import { eventBuffer } from "../analytics/eventBuffer.js";
import { logger } from "../utils/Logger.js";
import crypto from "node:crypto";
import { WebSocket } from "ws";

export class NotificationSystem {
  private activeSockets: Map<string, ExtendedWebSocket[]> = new Map();
  private notificationHistory: Map<string, number[]> = new Map(); // userId -> timestamps

  /**
   * Registers a WebSocket connection for an authenticated user.
   */
  public registerSocket(userId: string, ws: ExtendedWebSocket): void {
    const list = this.activeSockets.get(userId) || [];
    if (!list.includes(ws)) {
      list.push(ws);
      this.activeSockets.set(userId, list);
      logger.info("NotificationSystem", `Registered socket for user ${userId}. Total sockets: ${list.length}`);
    }
  }

  /**
   * Unregisters a WebSocket connection.
   */
  public unregisterSocket(userId: string, ws: ExtendedWebSocket): void {
    let list = this.activeSockets.get(userId) || [];
    list = list.filter((s) => s !== ws);
    if (list.length > 0) {
      this.activeSockets.set(userId, list);
    } else {
      this.activeSockets.delete(userId);
    }
    logger.info("NotificationSystem", `Unregistered socket for user ${userId}. Remaining sockets: ${list.length}`);
  }

  /**
   * Checks if a user is currently connected.
   */
  public isUserActive(userId: string): boolean {
    const list = this.activeSockets.get(userId);
    return !!list && list.some((ws) => ws.readyState === WebSocket.OPEN);
  }

  /**
   * Evaluates the hourly rate limit of max 2 notifications.
   * Cleans up history window older than 1 hour.
   */
  private checkAndRecordRateLimit(userId: string): boolean {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    let timestamps = this.notificationHistory.get(userId) || [];
    timestamps = timestamps.filter((ts) => ts >= oneHourAgo);

    if (timestamps.length >= 2) {
      logger.warn("NotificationSystem", `Rate limit hit: Dropping notification for user ${userId} (already sent ${timestamps.length} within past hour).`);
      return false;
    }

    timestamps.push(now);
    this.notificationHistory.set(userId, timestamps);
    return true;
  }

  /**
   * Main notification trigger function.
   * Assigns variants and checks rate limits.
   */
  public sendNotification(
    recipientUserId: string,
    type: "friend_online" | "map_milestone",
    data: Record<string, string | number>
  ): boolean {
    const sockets = this.activeSockets.get(recipientUserId) || [];
    const openSockets = sockets.filter((ws) => ws.readyState === WebSocket.OPEN);

    if (openSockets.length === 0) {
      logger.debug("NotificationSystem", `Recipient user ${recipientUserId} is not active online. Notification skipped.`);
      return false;
    }

    // Apply frequency guard check
    if (!this.checkAndRecordRateLimit(recipientUserId)) {
      return false;
    }

    // Retrieve A/B Variant
    const campaignName = "notification_copy_experiment";
    const variant = abSdk.getVariant(recipientUserId, campaignName);

    let title = "";
    let body = "";

    if (type === "friend_online") {
      title = "¡Alerta de Amigo!";
      const friendName = data.friendName || "Un amigo";
      if (variant === "A") {
        body = `¡${friendName} está jugando ahora! Únete a la partida.`;
      } else {
        body = `🔥 ¡Tu amigo favorito ${friendName} acaba de entrar a la arena! ¿Te lo vas a perder?`;
      }
    } else if (type === "map_milestone") {
      title = "¡Hito de Mapa!";
      const mapName = data.mapName || "tu mapa";
      const visits = data.visits || 0;
      if (variant === "A") {
        body = `Tu mapa ${mapName} ha alcanzado las ${visits} visitas.`;
      } else {
        body = `🎉 ¡Felicidades! Tu mapa ${mapName} es un éxito total y ya superó las ${visits} visitas. ¡Sigue creando!`;
      }
    }

    const notificationId = crypto.randomUUID();
    const payloadMessage = {
      type: "notification",
      id: notificationId,
      title,
      body,
      campaignName,
      variant,
    };

    // Dispatch message to all active tabs
    for (const ws of openSockets) {
      ws.send(JSON.stringify(payloadMessage));
    }

    logger.info("NotificationSystem", `Dispatched notification ${notificationId} (Variant ${variant}) to user ${recipientUserId}`);

    // Push Telemetry outbound event
    eventBuffer.push({
      id: crypto.randomUUID(),
      eventType: "NotificationSent",
      userId: recipientUserId,
      timestamp: new Date(),
      payload: {
        notificationId,
        campaignName,
        variant,
        type,
        title,
        body,
      },
    });

    return true;
  }

  /**
   * Resets rate-limiting logs for testing.
   */
  public clearHistory(): void {
    this.notificationHistory.clear();
  }

  /**
   * Clears active connections map.
   */
  public clearRegistry(): void {
    this.activeSockets.clear();
  }
}

// Singleton Instance
export const notificationSystem = new NotificationSystem();
