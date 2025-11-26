import * as THREE from "three"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { Character } from "./Character.js"
import { CameraController } from "./CameraController.js"
import { NPC } from "./NPC.js"
import { NetworkManager } from "./NetworkManager.js"
import { ChatManager } from "./ChatManager.js"

class Game {
  constructor() {
    this.sceneManager = new SceneManager("game-container")
    this.inputManager = new InputManager()
    this.character = new Character(this.sceneManager.scene, this.sceneManager.camera)
    this.npc = new NPC(this.sceneManager.scene, new THREE.Vector3(5, 0, 5))

    this.cameraController = new CameraController(this.sceneManager.camera, this.sceneManager.renderer.domElement)
    this.character.setCameraController(this.cameraController)

    this.networkManager = new NetworkManager(this.sceneManager.scene, (playerId) => {
      console.log(`[Game] Connected as player: ${playerId}`)
      this.updateConnectionStatus(true, playerId)
    })

    this.networkManager.onChatMessage = (playerId, message) => {
      if (this.chatManager) {
        this.chatManager.addChatMessage(playerId, message)
      }
    }

    this.chatManager = new ChatManager(this.networkManager)

    // Listen for chat focus events to disable/enable game input
    document.addEventListener("chatFocus", () => {
      this.inputManager.enabled = false
    })
    document.addEventListener("chatBlur", () => {
      this.inputManager.enabled = true
    })

    this.setupSettingsPanel()
    this.setupMultiplayerUI()

    this.clock = new THREE.Clock()

    this.animate = this.animate.bind(this)
    requestAnimationFrame(this.animate)
  }



  setupMultiplayerUI() {
    const panel = document.createElement("div")
    panel.id = "multiplayer-panel"
    panel.innerHTML = `
      <div class="mp-header">Multijugador</div>
      <div class="mp-status" id="connection-status">Desconectado</div>
      <input type="text" id="server-url" placeholder="ws://localhost:8080" value="ws://localhost:8080">
      <button id="connect-btn">Conectar</button>
      <div class="mp-players" id="player-count">Jugadores: 0</div>
    `
    document.body.appendChild(panel)



    const connectBtn = document.getElementById("connect-btn")
    const serverUrlInput = document.getElementById("server-url")
    const showNamesCheckbox = document.getElementById("show-names")

    connectBtn.addEventListener("click", () => {
      if (this.networkManager.isConnected) {
        this.networkManager.disconnect()
        this.updateConnectionStatus(false)
      } else {
        const url = serverUrlInput.value.trim()
        if (url) {
          this.networkManager.connect(url)
        }
      }
    })

    showNamesCheckbox.addEventListener("change", (e) => {
      this.networkManager.setShowPlayerNames(e.target.checked)
    })
  }

  updateConnectionStatus(connected, playerId = null) {
    const statusEl = document.getElementById("connection-status")
    const connectBtn = document.getElementById("connect-btn")

    if (connected) {
      statusEl.textContent = `Conectado: ${playerId?.slice(-6) || ""}`
      statusEl.className = "mp-status connected"
      connectBtn.textContent = "Desconectar"
      connectBtn.className = "disconnect"
    } else {
      statusEl.textContent = "Desconectado"
      statusEl.className = "mp-status disconnected"
      connectBtn.textContent = "Conectar"
      connectBtn.className = ""
    }
  }

  setupSettingsPanel() {
    const settingsPanel = document.getElementById("settings-panel")
    const overlay = document.getElementById("overlay")
    const resumeBtn = document.getElementById("resume-btn")
    const invertXCheckbox = document.getElementById("invert-x")
    const invertYCheckbox = document.getElementById("invert-y")
    const cameraModeText = document.getElementById("camera-mode-text")

    document.addEventListener("gamePauseChanged", (e) => {
      if (e.detail.isPaused) {
        settingsPanel.style.display = "block"
        overlay.style.display = "block"
        invertXCheckbox.checked = e.detail.invertAxisX
        invertYCheckbox.checked = e.detail.invertAxisY
        cameraModeText.textContent = e.detail.isFirstPerson ? "First Person" : "Third Person"
      } else {
        settingsPanel.style.display = "none"
        overlay.style.display = "none"
      }
    })

    resumeBtn.addEventListener("click", () => {
      this.cameraController.togglePause()
    })

    overlay.addEventListener("click", () => {
      this.cameraController.togglePause()
    })

    invertXCheckbox.addEventListener("change", (e) => {
      this.cameraController.setInvertAxisX(e.target.checked)
    })

    invertYCheckbox.addEventListener("change", (e) => {
      this.cameraController.setInvertAxisY(e.target.checked)
    })
  }

  animate() {
    requestAnimationFrame(this.animate)

    const dt = this.clock.getDelta()

    this.character.update(dt, this.inputManager)
    this.npc.update(dt)

    this.networkManager.update(dt)

    if (this.networkManager.isConnected && this.character.model) {
      const position = this.character.getPosition()
      const rotation = this.character.getRotation()
      const animation = this.character.currentAction === this.character.animations["Run"] ? "Run" : "Idle"
      this.networkManager.sendPlayerUpdate(position, rotation, animation)
    }

    const playerCountEl = document.getElementById("player-count")
    if (playerCountEl) {
      playerCountEl.textContent = `Jugadores: ${this.networkManager.getPlayerCount()}`
    }

    this.cameraController.update(this.character.getPosition(), this.character.getRotation(), dt)

    this.sceneManager.update()
  }
}

new Game()
