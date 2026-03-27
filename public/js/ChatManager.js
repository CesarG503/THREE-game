export class ChatManager {
    constructor(networkManager) {
        this.networkManager = networkManager;
        this.isChatOpen = false;
        this.setupChatUI();
        this.setupEventListeners();
    }

    setupChatUI() {
        const chatContainer = document.createElement("div");
        chatContainer.id = "chat-container";
        chatContainer.innerHTML = `
      <div id="chat-messages"></div>
      <div id="chat-input-container" style="display: none;">
        <input type="text" id="chat-input" placeholder="Escribe un mensaje..." maxlength="150">
      </div>
      <div id="chat-hint">Presiona T para chatear</div>
    `;
        document.body.appendChild(chatContainer);
    }

    setupEventListeners() {
        const chatInput = document.getElementById("chat-input");

        // Listen for T key to open chat
        document.addEventListener("keydown", (e) => {
            if (e.key === "t" || e.key === "T") {
                if (!this.isChatOpen && document.activeElement !== chatInput) {
                    e.preventDefault();
                    this.openChat();
                }
            }
            if (e.key === "Escape" && this.isChatOpen) {
                this.closeChat();
            }
            if (e.key === "Enter" && this.isChatOpen) {
                this.sendChatMessage();
            }
        });

        // Prevent game input while typing
        // Note: InputManager needs to be handled by the main Game class or passed here.
        // For now, we'll dispatch custom events that the Game class can listen to.
        chatInput.addEventListener("focus", () => {
            document.dispatchEvent(new CustomEvent("chatFocus"));
        });
        chatInput.addEventListener("blur", () => {
            document.dispatchEvent(new CustomEvent("chatBlur"));
        });
    }

    openChat() {
        this.isChatOpen = true;
        const chatInputContainer = document.getElementById("chat-input-container");
        const chatInput = document.getElementById("chat-input");
        const chatHint = document.getElementById("chat-hint");

        chatInputContainer.style.display = "block";
        chatHint.classList.add("hidden");
        chatInput.focus();
    }

    closeChat() {
        this.isChatOpen = false;
        const chatInputContainer = document.getElementById("chat-input-container");
        const chatInput = document.getElementById("chat-input");
        const chatHint = document.getElementById("chat-hint");

        chatInputContainer.style.display = "none";
        chatHint.classList.remove("hidden");
        chatInput.value = "";
        chatInput.blur();
    }

    sendChatMessage() {
        const chatInput = document.getElementById("chat-input");
        const message = chatInput.value.trim();

        if (message && this.networkManager.isConnected) {
            this.networkManager.sendChatMessage(message);
        }
        this.closeChat();
    }

    addChatMessage(playerId, message) {
        const chatMessages = document.getElementById("chat-messages");
        const isOwnMessage = playerId === this.networkManager.playerId;

        const msgEl = document.createElement("div");
        msgEl.className = "chat-message";

        const shortId = playerId.slice(-4);
        const color = this.getPlayerColor(playerId);

        msgEl.innerHTML = `<span class="sender" style="color: ${color}">${isOwnMessage ? "Tu" : shortId}:</span>${this.escapeHtml(message)}`;

        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Auto-remove old messages after 30 seconds
        setTimeout(() => {
            if (msgEl.parentNode) {
                msgEl.style.opacity = "0";
                msgEl.style.transition = "opacity 0.5s";
                setTimeout(() => msgEl.remove(), 500);
            }
        }, 30000);
    }

    getPlayerColor(playerId) {
        const colors = ["#4488ff", "#ff4444", "#44ff44", "#ffff44", "#ff44ff", "#44ffff", "#ff8844", "#8844ff"];
        const hash = playerId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}
