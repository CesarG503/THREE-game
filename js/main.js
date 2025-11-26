import * as THREE from "three"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { Character } from "./Character.js"
import { CameraController } from "./CameraController.js"
import { NPC } from "./NPC.js"
import { NetworkManager } from "./NetworkManager.js"

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
      this.addChatMessage(playerId, message)
    }

    this.isChatOpen = false

    this.setupSettingsPanel()
    this.setupMultiplayerUI()
    this.setupChatUI()

    this.clock = new THREE.Clock()

    this.animate = this.animate.bind(this)
    requestAnimationFrame(this.animate)
  }

  setupChatUI() {
    const chatContainer = document.createElement("div")
    chatContainer.id = "chat-container"
    chatContainer.innerHTML = `
      <div id="chat-messages"></div>
      <div id="chat-input-container" style="display: none;">
        <input type="text" id="chat-input" placeholder="Escribe un mensaje..." maxlength="150">
      </div>
      <div id="chat-hint">Presiona T para chatear</div>
    `
    document.body.appendChild(chatContainer)

    const style = document.createElement("style")
    style.textContent = `
      #chat-container {
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 350px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
      }
      #chat-messages {
        max-height: 200px;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      #chat-messages::-webkit-scrollbar {
        width: 4px;
      }
      #chat-messages::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
      }
      .chat-message {
        background: rgba(0, 0, 0, 0.7);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 13px;
        color: #fff;
        animation: fadeIn 0.2s ease;
        word-wrap: break-word;
      }
      .chat-message .sender {
        font-weight: bold;
        margin-right: 6px;
      }
      .chat-message.system {
        color: #aaa;
        font-style: italic;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #chat-input-container {
        margin-top: 8px;
      }
      #chat-input {
        width: 100%;
        padding: 10px 12px;
        border: 2px solid #4CAF50;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        font-size: 14px;
        box-sizing: border-box;
        outline: none;
      }
      #chat-input:focus {
        border-color: #66BB6A;
      }
      #chat-hint {
        margin-top: 6px;
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        text-align: center;
      }
      #chat-hint.hidden {
        display: none;
      }
    `
    document.head.appendChild(style)

    const chatInput = document.getElementById("chat-input")
    const chatInputContainer = document.getElementById("chat-input-container")
    const chatHint = document.getElementById("chat-hint")

    // Listen for T key to open chat
    document.addEventListener("keydown", (e) => {
      if (e.key === "t" || e.key === "T") {
        if (!this.isChatOpen && document.activeElement !== chatInput) {
          e.preventDefault()
          this.openChat()
        }
      }
      if (e.key === "Escape" && this.isChatOpen) {
        this.closeChat()
      }
      if (e.key === "Enter" && this.isChatOpen) {
        this.sendChatMessage()
      }
    })

    // Prevent game input while typing
    chatInput.addEventListener("focus", () => {
      this.inputManager.enabled = false
    })
    chatInput.addEventListener("blur", () => {
      this.inputManager.enabled = true
    })
  }

  openChat() {
    this.isChatOpen = true
    const chatInputContainer = document.getElementById("chat-input-container")
    const chatInput = document.getElementById("chat-input")
    const chatHint = document.getElementById("chat-hint")

    chatInputContainer.style.display = "block"
    chatHint.classList.add("hidden")
    chatInput.focus()
  }

  closeChat() {
    this.isChatOpen = false
    const chatInputContainer = document.getElementById("chat-input-container")
    const chatInput = document.getElementById("chat-input")
    const chatHint = document.getElementById("chat-hint")

    chatInputContainer.style.display = "none"
    chatHint.classList.remove("hidden")
    chatInput.value = ""
    chatInput.blur()
  }

  sendChatMessage() {
    const chatInput = document.getElementById("chat-input")
    const message = chatInput.value.trim()

    if (message && this.networkManager.isConnected) {
      this.networkManager.sendChatMessage(message)
    }
    this.closeChat()
  }

  addChatMessage(playerId, message) {
    const chatMessages = document.getElementById("chat-messages")
    const isOwnMessage = playerId === this.networkManager.playerId

    const msgEl = document.createElement("div")
    msgEl.className = "chat-message"

    const shortId = playerId.slice(-4)
    const color = this.getPlayerColor(playerId)

    msgEl.innerHTML = `<span class="sender" style="color: ${color}">${isOwnMessage ? "Tu" : shortId}:</span>${this.escapeHtml(message)}`

    chatMessages.appendChild(msgEl)
    chatMessages.scrollTop = chatMessages.scrollHeight

    // Auto-remove old messages after 30 seconds
    setTimeout(() => {
      if (msgEl.parentNode) {
        msgEl.style.opacity = "0"
        msgEl.style.transition = "opacity 0.5s"
        setTimeout(() => msgEl.remove(), 500)
      }
    }, 30000)
  }

  getPlayerColor(playerId) {
    const colors = ["#4488ff", "#ff4444", "#44ff44", "#ffff44", "#ff44ff", "#44ffff", "#ff8844", "#8844ff"]
    const hash = playerId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
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

    const style = document.createElement("style")
    style.textContent = `
      #multiplayer-panel {
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid #444;
        border-radius: 8px;
        padding: 15px;
        color: white;
        font-family: 'Segoe UI', sans-serif;
        min-width: 200px;
        z-index: 100;
      }
      .mp-header {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 1px solid #444;
        padding-bottom: 8px;
      }
      .mp-status {
        font-size: 14px;
        padding: 6px 10px;
        border-radius: 4px;
        margin-bottom: 10px;
        text-align: center;
      }
      .mp-status.connected {
        background: #2e7d32;
        color: #a5d6a7;
      }
      .mp-status.disconnected {
        background: #c62828;
        color: #ef9a9a;
      }
      #server-url {
        width: 100%;
        padding: 8px;
        border: 1px solid #555;
        border-radius: 4px;
        background: #333;
        color: white;
        margin-bottom: 8px;
        box-sizing: border-box;
      }
      #connect-btn {
        width: 100%;
        padding: 10px;
        background: #4CAF50;
        border: none;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s;
      }
      #connect-btn:hover {
        background: #45a049;
      }
      #connect-btn.disconnect {
        background: #f44336;
      }
      #connect-btn.disconnect:hover {
        background: #d32f2f;
      }
      .mp-players {
        margin-top: 10px;
        font-size: 13px;
        color: #aaa;
        text-align: center;
      }
      /* Styles for checkbox */
      .mp-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        font-size: 13px;
        color: #ccc;
        cursor: pointer;
      }
      .mp-checkbox input {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
    `
    document.head.appendChild(style)

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
