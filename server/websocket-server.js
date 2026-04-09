// WebSocket Server for Multiplayer Game
// Run with: node scripts/websocket-server.js

import { WebSocketServer } from "ws"

const PORT = process.env.PORT || 8080

const wss = new WebSocketServer({ port: PORT })

// Rooms map: Map<roomId, Map<playerId, PlayerData>>
const rooms = new Map()

function generatePlayerId() {
    return "player_" + Math.random().toString(36).substring(2, 9)
}

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map())
    }
    return rooms.get(roomId)
}

function broadcastToRoom(roomId, message, excludeId = null) {
    const messageStr = JSON.stringify(message)
    wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.roomId === roomId) {
            if (client.playerId !== excludeId) {
                client.send(messageStr)
            }
        }
    })
}

console.log(`WebSocket server starting on port ${PORT}...`)

wss.on("connection", (ws) => {
    
    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data)

            if (message.type === "joinRoom") {
                const roomId = message.roomId || "lobby"
                const playerId = generatePlayerId()
                
                ws.playerId = playerId
                ws.roomId = roomId

                const room = getRoom(roomId)

                const spawnPosition = {
                    x: Math.random() * 10 - 5,
                    y: 0,
                    z: Math.random() * 10 - 5,
                }

                const playerName = message.playerName || playerId.slice(-4)

                room.set(playerId, {
                    id: playerId,
                    name: playerName,
                    position: spawnPosition,
                    rotation: 0,
                    state: { 
                        modelType: 'skin', 
                        isMoving: false, 
                        isCrouching: false, 
                        isAttacking: false, 
                        isGrounded: true, 
                        verticalVelocity: 0, 
                        action: "Idle" 
                    },
                })

                console.log(`[Room ${roomId}] Player joined: ${playerId} as ${playerName} (Total: ${room.size})`)

                // Send welcome message
                ws.send(JSON.stringify({
                    type: "welcome",
                    playerId: playerId,
                    playerName: playerName,
                }))

                // Send current game state of the room
                const existingPlayers = Array.from(room.values()).filter((p) => p.id !== playerId)
                if (existingPlayers.length > 0) {
                    ws.send(JSON.stringify({
                        type: "gameState",
                        players: existingPlayers,
                    }))

                    // Solicitar el mapa actual al primer jugador existente para sincronizar al recién llegado
                    const firstPlayerId = existingPlayers[0].id
                    const firstPlayerClient = Array.from(wss.clients).find(c => c.playerId === firstPlayerId && c.roomId === roomId)
                    if (firstPlayerClient && firstPlayerClient.readyState === 1) {
                        firstPlayerClient.send(JSON.stringify({
                            type: "requestMapSync",
                            targetId: playerId
                        }))
                    }
                }

                // Notify others in room
                broadcastToRoom(roomId, {
                    type: "playerJoined",
                    playerId: playerId,
                    name: playerName,
                    position: spawnPosition,
                    rotation: 0,
                }, playerId)
                return
            }

            // Normal messages require authentication/roomId
            if (!ws.roomId || !ws.playerId) return;

            const roomId = ws.roomId
            const playerId = ws.playerId
            const room = getRoom(roomId)

            switch (message.type) {
                case "playerUpdate":
                    const player = room.get(playerId)
                    if (player) {
                        player.position = message.position
                        player.rotation = message.rotation
                        player.state = message.state
                    }

                    broadcastToRoom(roomId, {
                        type: "playerUpdate",
                        playerId: playerId,
                        position: message.position,
                        rotation: message.rotation,
                        state: message.state,
                    }, playerId)
                    break

                case "chat":
                    broadcastToRoom(roomId, {
                        type: "chat",
                        playerId: playerId,
                        playerName: room.get(playerId)?.name || playerId.slice(-4),
                        message: message.text,
                    }, null) // Null to broadcast to everyone including sender
                    break

                // ── Map Sync (Late Joiners) ──────────────────────────────
                case "mapSyncData":
                    if (message.targetId && message.mapData) {
                        const targetClient = Array.from(wss.clients).find(c => c.playerId === message.targetId && c.roomId === roomId)
                        if (targetClient && targetClient.readyState === 1) {
                            targetClient.send(JSON.stringify({
                                type: "mapSyncData",
                                mapData: message.mapData
                            }))
                            console.log(`[Room ${roomId}] Map sync delivered to ${message.targetId}`)
                        }
                    }
                    break

                // ── Shooting Sync ────────────────────────────────────────
                case "playerShoot":
                    broadcastToRoom(roomId, {
                        type: "playerShoot",
                        playerId: playerId,
                        startPos: message.startPos,
                        direction: message.direction,
                        projectileType: message.projectileType,
                        speed: message.speed,
                        damage: message.damage,
                        drop: message.drop,
                        rebote: message.rebote,
                        hasImpactEffect: message.hasImpactEffect,
                        hasTracer: message.hasTracer,
                        hasTrajectoryLine: message.hasTrajectoryLine
                    }, playerId)
                    break

                case "playerAction":
                    broadcastToRoom(roomId, {
                        type: "playerAction",
                        playerId: playerId,
                        actionType: message.actionType,
                        data: message.data
                    }, playerId)
                    break

                // ── Editor Colaborativo ──────────────────────────────────
                case "editorPlace":
                    // Un editor colocó un objeto; retransmitir a todos salvo el emisor
                    if (message.data) {
                        broadcastToRoom(roomId, {
                            type: "editorPlace",
                            playerId: playerId,
                            data: message.data,
                        }, playerId)
                        console.log(`[Room ${roomId}] Editor place by ${playerId}`)
                    }
                    break

                case "editorRemove":
                    // Un editor eliminó un objeto; retransmitir por UUID
                    if (message.uuid) {
                        broadcastToRoom(roomId, {
                            type: "editorRemove",
                            playerId: playerId,
                            uuid: message.uuid,
                        }, playerId)
                        console.log(`[Room ${roomId}] Editor remove ${message.uuid} by ${playerId}`)
                    }
                    break

                case "editorUpdate":
                    // Un editor movió/redimensionó un objeto existente
                    if (message.uuid && message.transform) {
                        broadcastToRoom(roomId, {
                            type: "editorUpdate",
                            playerId: playerId,
                            uuid: message.uuid,
                            transform: message.transform,
                        }, playerId)
                    }
                    break
                    
                case "gameConfigUpdate":
                    // Un editor actualizó la configuración global de la partida (secuencias/servidor)
                    if (message.configData) {
                        broadcastToRoom(roomId, {
                            type: "gameConfigUpdate",
                            playerId: playerId,
                            configData: message.configData,
                        }, playerId)
                        console.log(`[Room ${roomId}] Game config updated by ${playerId}`)
                    }
                    break

                case "simulationControl":
                    broadcastToRoom(roomId, {
                        type: "simulationControl",
                        playerId: playerId,
                        action: message.action,
                        state: message.state
                    }, playerId)
                    console.log(`[Room ${roomId}] Simulation control (${message.action}) by ${playerId}`)
                    break
            }
        } catch (error) {
            console.error("Error parsing message:", error)
        }
    })

    ws.on("close", () => {
        if (ws.playerId && ws.roomId) {
            console.log(`[Room ${ws.roomId}] Player disconnected: ${ws.playerId}`)
            const room = getRoom(ws.roomId)
            room.delete(ws.playerId)

            // If room is empty, officially close it out of memory to avoid leaks
            if (room.size === 0) {
                rooms.delete(ws.roomId)
            } else {
                broadcastToRoom(ws.roomId, {
                    type: "playerLeft",
                    playerId: ws.playerId,
                })
            }
        }
    })

    ws.on("error", (error) => {
        console.error(`WebSocket error:`, error)
    })
})

wss.on("listening", () => {
    console.log(`WebSocket server is running on ws://localhost:${PORT}`)
})
