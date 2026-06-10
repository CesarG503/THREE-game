import * as THREE from "three";
import { RemotePlayer } from "./RemotePlayer";
import { randomPlayerNames } from "../data/playerNames";

export class NetworkManager {
    scene: any;
    world: any;
    roomId: any;
    socket: any;
    playerId: any;
    playerName: any;
    remotePlayers: Map<any, any>;
    onConnected: any;
    isConnected: boolean;
    serverUrl: any;
    updateRate: number;
    lastUpdateTime: number;
    onChatMessage: any;
    showPlayerNames: boolean;
    onEditorPlace: any;
    onEditorRemove: any;
    onEditorUpdate: any;
    collaborativeMode: boolean;
    onGameConfigUpdate: any;
    onPlayerConfigUpdate: any;
    onSimulationControl: any;
    onRequestMapSync: any;
    onMapSyncData: any;
    onPlayerShoot: any;
    onPlayerAction: any;
    onGroundItemsSync: any;
    particleSystem: any;
    reconnectEnabled: boolean;

    constructor(scene: any, world: any, roomId: any, onConnected?: any) {
        this.scene = scene;
        this.world = world;
        this.roomId = roomId;
        this.socket = null;
        this.playerId = null;
        this.remotePlayers = new Map();
        this.onConnected = onConnected;
        this.isConnected = false;
        this.serverUrl = null;

        this.updateRate = 1000 / 20;
        this.lastUpdateTime = 0;

        this.onChatMessage = null;
        this.showPlayerNames = true;

        this.onEditorPlace = null;
        this.onEditorRemove = null;
        this.onEditorUpdate = null;
        this.collaborativeMode = false;

        this.onGameConfigUpdate = null;
        this.onPlayerConfigUpdate = null;
        this.onSimulationControl = null;

        this.onRequestMapSync = null;
        this.onMapSyncData = null;

        this.onPlayerShoot = null;
        this.onPlayerAction = null;
        this.onGroundItemsSync = null;
        this.reconnectEnabled = false;
    }

    connect(serverUrl: string) {
        this.serverUrl = serverUrl;
        this.reconnectEnabled = true;

        try {
            this.socket = new WebSocket(serverUrl);

            this.socket.onopen = () => {
                console.log(`[Network] Connected to server. Joining room: ${this.roomId}`);
                this.isConnected = true;
                if (this.roomId) {
                    let playerName = localStorage.getItem("playerName") || sessionStorage.getItem("tempPlayerName");
                    if (!playerName) {
                        const randomIndex = Math.floor(Math.random() * randomPlayerNames.length);
                        playerName = randomPlayerNames[randomIndex];
                        sessionStorage.setItem("tempPlayerName", playerName);
                    }
                    this.socket.send(JSON.stringify({ type: "joinRoom", roomId: this.roomId, playerName: playerName }));
                }
            };

            this.socket.onmessage = (event: MessageEvent) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.socket.onclose = () => {
                console.log("[Network] Disconnected from server");
                this.isConnected = false;
                this.playerId = null;

                this.remotePlayers.forEach((player) => {
                    player.dispose();
                });
                this.remotePlayers.clear();

                setTimeout(() => {
                    if (this.reconnectEnabled && this.serverUrl) {
                        console.log("[Network] Attempting to reconnect...");
                        this.connect(this.serverUrl);
                    }
                }, 3000);
            };

            this.socket.onerror = (error: Event) => {
                console.error("[Network] WebSocket error:", error);
            };
        } catch (error) {
            console.error("[Network] Failed to connect:", error);
        }
    }

    handleMessage(message: any) {
        switch (message.type) {
            case "welcome":
                this.playerId = message.playerId;
                this.playerName = message.playerName;
                console.log(`[Network] Assigned player ID: ${this.playerId}, Name: ${this.playerName}`);
                if (this.onConnected) {
                    this.onConnected(this.playerId);
                }
                break;

            case "playerJoined":
                if (message.playerId !== this.playerId) {
                    this.addRemotePlayer(message.playerId, message.name, message.position, message.rotation);
                    console.log(`[Network] Player ${message.name || message.playerId} joined`);
                }
                break;

            case "playerLeft":
                this.removeRemotePlayer(message.playerId);
                console.log(`[Network] Player ${message.playerId} left`);
                break;

            case "playerUpdate":
                if (message.playerId !== this.playerId) {
                    this.updateRemotePlayer(message.playerId, message.position, message.rotation, message.state);
                }
                break;

            case "gameState":
                message.players.forEach((playerData: any) => {
                    if (playerData.id !== this.playerId) {
                        if (!this.remotePlayers.has(playerData.id)) {
                            this.addRemotePlayer(playerData.id, playerData.name, playerData.position, playerData.rotation);
                        } else {
                            this.updateRemotePlayer(playerData.id, playerData.position, playerData.rotation, playerData.state);
                        }
                    }
                });
                break;

            case "chat":
                if (this.onChatMessage) {
                    this.onChatMessage(message.playerId, message.playerName, message.message);
                }
                break;

            case "editorPlace":
                if (this.onEditorPlace && message.data) {
                    this.onEditorPlace(message.data);
                }
                break;

            case "editorRemove":
                if (this.onEditorRemove && message.uuid) {
                    this.onEditorRemove(message.uuid);
                }
                break;

            case "editorUpdate":
                if (this.onEditorUpdate && message.uuid && message.transform) {
                    this.onEditorUpdate(message.uuid, message.transform);
                }
                break;

            case "gameConfigUpdate":
                if (this.onGameConfigUpdate && message.configData) {
                    this.onGameConfigUpdate(message.configData);
                }
                break;

            case "playerConfigUpdate":
                if (this.onPlayerConfigUpdate && message.configData) {
                    this.onPlayerConfigUpdate(message.configData);
                }
                break;

            case "simulationControl":
                if (this.onSimulationControl && message.action) {
                    this.onSimulationControl(message.action, message.state);
                }
                break;

            case "requestMapSync":
                if (this.onRequestMapSync) {
                    this.onRequestMapSync(message.targetId);
                }
                break;

            case "mapSyncData":
                if (this.onMapSyncData && message.mapData) {
                    this.onMapSyncData(message.mapData);
                }
                break;

            case "broadcastMapSync":
                if (this.onMapSyncData && message.mapData) {
                    console.log("[Network] Map sync data received via broadcast");
                    this.onMapSyncData(message.mapData);
                }
                break;

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
                        message.hasTrajectoryLine,
                        message.customTracerVFX,
                        message.customImpactVFX,
                        message.tracerDestroyOnCollision,
                        message.tracerStayForever,
                        message.tracerCollisionVFX
                    );
                }
                break;

            case "playerAction":
                if (
                    this.onPlayerAction &&
                    (message.playerId !== this.playerId || message.actionType === "pickupItem" || message.actionType === "pickupDenied")
                ) {
                    this.onPlayerAction(message.playerId, message.actionType, message.data);
                }
                break;

            case "groundItemsSync":
                if (this.onGroundItemsSync) {
                    this.onGroundItemsSync(message.items || []);
                }
                break;
        }
    }

    addRemotePlayer(playerId: any, playerName: any, position: any, rotation: any) {
        if (this.remotePlayers.has(playerId)) return;

        const spawnPosition = new THREE.Vector3(
            position?.x || Math.random() * 10 - 5,
            position?.y || 0,
            position?.z || Math.random() * 10 - 5,
        );

        const remotePlayer = new RemotePlayer(this.scene, this.world, playerId, playerName, spawnPosition);
        if (this.particleSystem) {
            remotePlayer.particleSystem = this.particleSystem;
        }
        if (rotation !== undefined) {
            remotePlayer.setRotation(rotation);
        }
        remotePlayer.setLabelVisibility(this.showPlayerNames);
        this.remotePlayers.set(playerId, remotePlayer);
    }

    removeRemotePlayer(playerId: any) {
        const player = this.remotePlayers.get(playerId);
        if (player) {
            player.dispose();
            this.remotePlayers.delete(playerId);
        }
    }

    updateRemotePlayer(playerId: any, position: any, rotation: any, state: any) {
        let player = this.remotePlayers.get(playerId);

        if (!player) {
            this.addRemotePlayer(playerId, playerId.slice(-4), position, rotation);
            player = this.remotePlayers.get(playerId);
        }

        if (player) {
            player.setTargetPosition(position.x, position.y, position.z);
            player.setRotation(rotation);
            if (state) {
                player.setState(state);
            }
        }
    }

    sendPlayerUpdate(position: any, rotation: any, state: any) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateRate) return false;
        this.lastUpdateTime = now;

        const message = {
            type: "playerUpdate",
            position: {
                x: position.x,
                y: position.y,
                z: position.z,
            },
            rotation: rotation,
            state: state,
        };

        this.socket.send(JSON.stringify(message));
        return true;
    }

    update(dt: number) {
        this.remotePlayers.forEach((player) => {
            player.update(dt);
        });
    }

    getPlayerCount() {
        return this.remotePlayers.size + (this.isConnected ? 1 : 0);
    }

    disconnect() {
        this.reconnectEnabled = false;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        this.serverUrl = null;
        this.playerId = null;
        this.remotePlayers.forEach((player) => player.dispose());
        this.remotePlayers.clear();
    }

    sendChatMessage(text: string) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        const message = {
            type: "chat",
            text: text,
        };
        this.socket.send(JSON.stringify(message));
    }

    sendEditorPlace(objectData: any) {
        if (!this.isConnected || !this.collaborativeMode) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({ type: "editorPlace", data: objectData }));
    }

    sendEditorRemove(uuid: any) {
        if (!this.isConnected || !this.collaborativeMode) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({ type: "editorRemove", uuid }));
    }

    sendEditorUpdate(uuid: any, transform: any) {
        if (!this.isConnected || !this.collaborativeMode) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({ type: "editorUpdate", uuid, transform }));
    }

    sendGameConfigUpdate(configData: any) {
        if (!this.isConnected || !this.collaborativeMode) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "gameConfigUpdate",
            configData: configData
        }));
    }

    sendPlayerConfigUpdate(configData: any) {
        if (!this.isConnected || !this.collaborativeMode) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "playerConfigUpdate",
            configData: configData
        }));
    }

    sendSimulationControl(action: any, state: any = null) {
        if (!this.isConnected || !this.collaborativeMode) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "simulationControl",
            action: action,
            state: state
        }));
    }

    sendMapSyncData(targetId: any, mapData: any) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "mapSyncData",
            targetId: targetId,
            mapData: mapData
        }));
    }

    broadcastMapSync(mapData: any) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "broadcastMapSync",
            mapData: mapData
        }));
    }

    sendPlayerShoot(startPos: any, direction: any, type: any, speed: any, damage: any, drop: any, rebote: any, hasImpactEffect: any, hasTracer: any = false, hasTrajectoryLine: any = false, customTracerVFX: any = "Ninguno", customImpactVFX: any = "Ninguno", tracerDestroyOnCollision: any = false, tracerStayForever: any = false, tracerCollisionVFX: any = "Ninguno") {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
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
            hasTrajectoryLine: hasTrajectoryLine,
            customTracerVFX: customTracerVFX,
            customImpactVFX: customImpactVFX,
            tracerDestroyOnCollision: tracerDestroyOnCollision,
            tracerStayForever: tracerStayForever,
            tracerCollisionVFX: tracerCollisionVFX
        }));
    }

    sendPlayerAction(actionType: any, data: any) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: "playerAction",
            actionType: actionType,
            data: data
        }));
    }

    setShowPlayerNames(show: boolean) {
        this.showPlayerNames = show;
        this.remotePlayers.forEach((player) => {
            player.setLabelVisibility(show);
        });
    }
}
