import * as THREE from "three"
import { RemotePlayer } from "./RemotePlayer.js"
import { randomPlayerNames } from "./playerNames.js"

export class NetworkManager {
    constructor(scene, world, roomId, onConnected) {
        this.scene = scene
        this.world = world
        this.roomId = roomId
        this.socket = null
        this.playerId = null
        this.remotePlayers = new Map() // Map<playerId, RemotePlayer>
        this.onConnected = onConnected
        this.isConnected = false
        this.serverUrl = null

        // Interpolation settings
        this.updateRate = 1000 / 20 // 20 updates per second
        this.lastUpdateTime = 0

        this.onChatMessage = null
        this.showPlayerNames = true

        // ── Callbacks colaborativos del editor ────────────────────────
        this.onEditorPlace = null   // (data) => void
        this.onEditorRemove = null  // (uuid) => void
        this.onEditorUpdate = null  // (uuid, transform) => void
        this.collaborativeMode = false
        
        this.onGameConfigUpdate = null // (configData) => void
        this.onSimulationControl = null // (action, state) => void
    }

    connect(serverUrl) {
        this.serverUrl = serverUrl

        try {
            this.socket = new WebSocket(serverUrl)

            this.socket.onopen = () => {
                console.log(`[Network] Connected to server. Joining room: ${this.roomId}`)
                this.isConnected = true
                if (this.roomId) {
                    let playerName = localStorage.getItem("playerName") || sessionStorage.getItem("tempPlayerName");
                    if (!playerName) {
                        const randomIndex = Math.floor(Math.random() * randomPlayerNames.length);
                        playerName = randomPlayerNames[randomIndex];
                        sessionStorage.setItem("tempPlayerName", playerName);
                    }
                    this.socket.send(JSON.stringify({ type: "joinRoom", roomId: this.roomId, playerName: playerName }))
                }
            }

            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data)
                this.handleMessage(message)
            }

            this.socket.onclose = () => {
                console.log("[Network] Disconnected from server")
                this.isConnected = false
                this.playerId = null

                // Clean up remote players
                this.remotePlayers.forEach((player) => {
                    player.dispose()
                })
                this.remotePlayers.clear()

                // Try to reconnect after 3 seconds
                setTimeout(() => {
                    if (this.serverUrl) {
                        console.log("[Network] Attempting to reconnect...")
                        this.connect(this.serverUrl)
                    }
                }, 3000)
            }

            this.socket.onerror = (error) => {
                console.error("[Network] WebSocket error:", error)
            }
        } catch (error) {
            console.error("[Network] Failed to connect:", error)
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case "welcome":
                // Server assigned us an ID
                this.playerId = message.playerId
                this.playerName = message.playerName
                console.log(`[Network] Assigned player ID: ${this.playerId}, Name: ${this.playerName}`)
                if (this.onConnected) {
                    this.onConnected(this.playerId)
                }
                break

            case "playerJoined":
                // A new player joined
                if (message.playerId !== this.playerId) {
                    this.addRemotePlayer(message.playerId, message.name, message.position, message.rotation)
                    console.log(`[Network] Player ${message.name || message.playerId} joined`)
                }
                break

            case "playerLeft":
                // A player left
                this.removeRemotePlayer(message.playerId)
                console.log(`[Network] Player ${message.playerId} left`)
                break

            case "playerUpdate":
                // Update remote player position
                if (message.playerId !== this.playerId) {
                    this.updateRemotePlayer(message.playerId, message.position, message.rotation, message.state)
                }
                break

            case "gameState":
                // Full game state (all current players)
                message.players.forEach((playerData) => {
                    if (playerData.id !== this.playerId) {
                        if (!this.remotePlayers.has(playerData.id)) {
                            this.addRemotePlayer(playerData.id, playerData.name, playerData.position, playerData.rotation)
                        } else {
                            this.updateRemotePlayer(playerData.id, playerData.position, playerData.rotation, playerData.state)
                        }
                    }
                })
                break

            case "chat":
                if (this.onChatMessage) {
                    this.onChatMessage(message.playerId, message.playerName, message.message)
                }
                break

            // ── Editor Colaborativo ───────────────────────────────────
            case "editorPlace":
                if (this.onEditorPlace && message.data) {
                    this.onEditorPlace(message.data)
                }
                break

            case "editorRemove":
                if (this.onEditorRemove && message.uuid) {
                    this.onEditorRemove(message.uuid)
                }
                break

            case "editorUpdate":
                if (this.onEditorUpdate && message.uuid && message.transform) {
                    this.onEditorUpdate(message.uuid, message.transform)
                }
                break
                
            case "gameConfigUpdate":
                if (this.onGameConfigUpdate && message.configData) {
                    this.onGameConfigUpdate(message.configData)
                }
                break

            case "simulationControl":
                if (this.onSimulationControl && message.action) {
                    this.onSimulationControl(message.action, message.state)
                }
                break

            // ── Map Sync (Late Joiners) ───────────────────────────────
            case "requestMapSync":
                if (this.onRequestMapSync) {
                    this.onRequestMapSync(message.targetId)
                }
                break

            case "mapSyncData":
                if (this.onMapSyncData && message.mapData) {
                    this.onMapSyncData(message.mapData)
                }
                break

            // ── Shooting Sync ────────────────────────────────────────
            case "playerShoot":
                if (this.onPlayerShoot && message.playerId !== this.playerId) {
                    this.onPlayerShoot(
                        message.playerId, 
                        message.startPos, 
                        message.direction, 
                        message.projectileType, 
                        message.speed, 
                        message.damage, 
                        message.drop, 
                        message.rebote, 
                        message.hasImpactEffect,
                        message.hasTracer,
                        message.hasTrajectoryLine
                    )
                }
                break
                
            case "playerAction":
                if (this.onPlayerAction && message.playerId !== this.playerId) {
                    this.onPlayerAction(message.playerId, message.actionType, message.data)
                }
                break
        }
    }

    addRemotePlayer(playerId, playerName, position, rotation) {
        if (this.remotePlayers.has(playerId)) return

        const spawnPosition = new THREE.Vector3(
            position?.x || Math.random() * 10 - 5,
            position?.y || 0,
            position?.z || Math.random() * 10 - 5,
        )

        const remotePlayer = new RemotePlayer(this.scene, this.world, playerId, playerName, spawnPosition)
        if (rotation !== undefined) {
            remotePlayer.setRotation(rotation)
        }
        remotePlayer.setLabelVisibility(this.showPlayerNames)
        this.remotePlayers.set(playerId, remotePlayer)
    }

    removeRemotePlayer(playerId) {
        const player = this.remotePlayers.get(playerId)
        if (player) {
            player.dispose()
            this.remotePlayers.delete(playerId)
        }
    }

    updateRemotePlayer(playerId, position, rotation, state) {
        let player = this.remotePlayers.get(playerId)

        if (!player) {
            // Player doesn't exist yet, create them with fallback name
            this.addRemotePlayer(playerId, playerId.slice(-4), position, rotation)
            player = this.remotePlayers.get(playerId)
        }

        if (player) {
            player.setTargetPosition(position.x, position.y, position.z)
            player.setRotation(rotation)
            if (state) {
                player.setState(state)
            }
        }
    }

    sendPlayerUpdate(position, rotation, state) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return false

        const now = Date.now()
        if (now - this.lastUpdateTime < this.updateRate) return false
        this.lastUpdateTime = now

        const message = {
            type: "playerUpdate",
            position: {
                x: position.x,
                y: position.y,
                z: position.z,
            },
            rotation: rotation,
            state: state,
        }

        this.socket.send(JSON.stringify(message))
        return true;
    }

    update(dt) {
        // Update all remote players (interpolation)
        this.remotePlayers.forEach((player) => {
            player.update(dt)
        })
    }

    getPlayerCount() {
        return this.remotePlayers.size + (this.isConnected ? 1 : 0)
    }

    disconnect() {
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }
        this.isConnected = false
        this.serverUrl = null
    }

    sendChatMessage(text) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return

        const message = {
            type: "chat",
            text: text,
        }
        this.socket.send(JSON.stringify(message))
    }

    // ── Métodos colaborativos del editor ─────────────────────────────
    sendEditorPlace(objectData) {
        if (!this.isConnected || !this.collaborativeMode) return
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({ type: "editorPlace", data: objectData }))
    }

    sendEditorRemove(uuid) {
        if (!this.isConnected || !this.collaborativeMode) return
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({ type: "editorRemove", uuid }))
    }

    sendEditorUpdate(uuid, transform) {
        if (!this.isConnected || !this.collaborativeMode) return
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({ type: "editorUpdate", uuid, transform }))
    }
    
    sendGameConfigUpdate(configData) {
        if (!this.isConnected || !this.collaborativeMode) return
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({
            type: "gameConfigUpdate",
            configData: configData
        }))
    }

    sendSimulationControl(action, state = null) {
        if (!this.isConnected || !this.collaborativeMode) return
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({
            type: "simulationControl",
            action: action,
            state: state
        }))
    }

    sendMapSyncData(targetId, mapData) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({
            type: "mapSyncData",
            targetId: targetId,
            mapData: mapData
        }))
    }

    sendPlayerShoot(startPos, direction, type, speed, damage, drop, rebote, hasImpactEffect, hasTracer = false, hasTrajectoryLine = false) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({
            type: "playerShoot",
            startPos: { x: startPos.x, y: startPos.y, z: startPos.z },
            direction: { x: direction.x, y: direction.y, z: direction.z },
            projectileType: type,
            speed: speed,
            damage: damage,
            drop: drop,
            rebote: rebote,
            hasImpactEffect: hasImpactEffect,
            hasTracer: hasTracer,
            hasTrajectoryLine: hasTrajectoryLine
        }))
    }

    sendPlayerAction(actionType, data) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
        this.socket.send(JSON.stringify({
            type: "playerAction",
            actionType: actionType,
            data: data
        }))
    }

    setShowPlayerNames(show) {
        this.showPlayerNames = show
        this.remotePlayers.forEach((player) => {
            player.setLabelVisibility(show)
        })
    }
}
