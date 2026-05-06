import type { RoomManager } from "../managers/RoomManager.js"
import type { ExtendedWebSocket, IncomingMessage } from "../types.js"
import { logger } from "../utils/Logger.js"

export interface HandlerContext {
  ws: ExtendedWebSocket
  roomId: string
  playerId: string
  room: RoomManager
}

export type MessageHandler<T extends IncomingMessage = IncomingMessage> = (
  ctx: HandlerContext,
  message: T,
) => void | Promise<void>

/**
 * MessageRouter maps message types to handler functions.
 * Adding a new message type = one new handler file + one register() call.
 */
export class MessageRouter {
  private handlers = new Map<string, MessageHandler<IncomingMessage>>()

  register<T extends IncomingMessage>(type: T["type"], handler: MessageHandler<T>): this {
    this.handlers.set(type, handler as MessageHandler<IncomingMessage>)
    return this
  }

  async dispatch(ctx: HandlerContext, message: IncomingMessage): Promise<void> {
    const handler = this.handlers.get(message.type)
    if (!handler) {
      logger.warn("Router", `Unhandled message type: "${message.type}"`)
      return
    }
    try {
      await handler(ctx, message)
    } catch (err) {
      logger.error("Router", `Error in handler "${message.type}"`, err)
    }
  }

  registeredTypes(): string[] {
    return Array.from(this.handlers.keys())
  }
}