import type { WebSocket } from "ws"

// ── Vector Types ──────────────────────────────────
export interface Vector3 {
  x: number
  y: number
  z: number
}

// ── Player State ──────────────────────────────────
export interface PlayerState {
  modelType: "skin" | "glb"
  isMoving: boolean
  isCrouching: boolean
  isAttacking: boolean
  isGrounded: boolean
  verticalVelocity: number
  action: string
}

export interface PlayerData {
  id: string
  name: string
  position: Vector3
  rotation: number
  state: PlayerState
}

// ── Extended WebSocket ────────────────────────────
export interface ExtendedWebSocket extends WebSocket {
  playerId?: string
  roomId?: string
}

// ── Incoming Messages ─────────────────────────────
export interface BaseMessage {
  type: string
}

export interface JoinRoomMessage extends BaseMessage {
  type: "joinRoom"
  roomId?: string
  playerName?: string
}

export interface PlayerUpdateMessage extends BaseMessage {
  type: "playerUpdate"
  playerId?: string
  position: Vector3
  rotation: number
  state: PlayerState
}

export interface ChatMessage extends BaseMessage {
  type: "chat"
  playerId?: string
  playerName?: string
  text?: string
  message?: string
}

export interface MapSyncDataMessage extends BaseMessage {
  type: "mapSyncData"
  targetId: string
  mapData: unknown
}

export interface BroadcastMapSyncMessage extends BaseMessage {
  type: "broadcastMapSync"
  mapData: unknown
}

export interface PlayerShootMessage extends BaseMessage {
  type: "playerShoot"
  playerId?: string
  startPos: Vector3
  direction: Vector3
  projectileType: string
  speed: number
  damage: number
  drop: number
  rebote: number
  hasImpactEffect: boolean
  hasTracer: boolean
  hasTrajectoryLine: boolean
  customTracerVFX?: string
  customImpactVFX?: string
  tracerDestroyOnCollision: boolean
}

export interface PlayerActionMessage extends BaseMessage {
  type: "playerAction"
  playerId?: string
  actionType: string
  data: unknown
}

export interface EditorPlaceMessage extends BaseMessage {
  type: "editorPlace"
  playerId?: string
  data: unknown
}

export interface EditorRemoveMessage extends BaseMessage {
  type: "editorRemove"
  playerId?: string
  uuid: string
}

export interface EditorUpdateMessage extends BaseMessage {
  type: "editorUpdate"
  playerId?: string
  uuid: string
  transform: unknown
}

export interface GameConfigUpdateMessage extends BaseMessage {
  type: "gameConfigUpdate"
  playerId?: string
  configData: unknown
}

export interface PlayerConfigUpdateMessage extends BaseMessage {
  type: "playerConfigUpdate"
  playerId?: string
  configData: unknown
}

export interface SimulationControlMessage extends BaseMessage {
  type: "simulationControl"
  playerId?: string
  action: string
  state: unknown
}

export type IncomingMessage =
  | JoinRoomMessage
  | PlayerUpdateMessage
  | ChatMessage
  | MapSyncDataMessage
  | BroadcastMapSyncMessage
  | PlayerShootMessage
  | PlayerActionMessage
  | EditorPlaceMessage
  | EditorRemoveMessage
  | EditorUpdateMessage
  | GameConfigUpdateMessage
  | PlayerConfigUpdateMessage
  | SimulationControlMessage

// ── Outgoing Messages ─────────────────────────────
export interface WelcomeMessage extends BaseMessage {
  type: "welcome"
  playerId: string
  playerName: string
}

export interface GameStateMessage extends BaseMessage {
  type: "gameState"
  players: PlayerData[]
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: "playerJoined"
  playerId: string
  name: string
  position: Vector3
  rotation: number
}

export interface PlayerLeftMessage extends BaseMessage {
  type: "playerLeft"
  playerId: string
}

export interface RequestMapSyncMessage extends BaseMessage {
  type: "requestMapSync"
  targetId: string
}

export type OutgoingMessage =
  | WelcomeMessage
  | GameStateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | RequestMapSyncMessage
  | PlayerUpdateMessage
  | ChatMessage
  | MapSyncDataMessage
  | BroadcastMapSyncMessage
  | PlayerShootMessage
  | PlayerActionMessage
  | EditorPlaceMessage
  | EditorRemoveMessage
  | EditorUpdateMessage
  | GameConfigUpdateMessage
  | PlayerConfigUpdateMessage
  | SimulationControlMessage