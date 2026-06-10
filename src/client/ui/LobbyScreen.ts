import { Router } from "../routing/Router";
import { clearStoredAuth, getStoredAuth } from "./AuthScreen";

const HIDDEN_IDS = [
	"loading",
	"crosshair",
	"inventory-container",
	"settings-panel",
	"overlay",
	"fuego-counter",
	"interaction-prompt",
	"button-interaction-prompt",
	"move-prompt-container"
];

export function renderLobby(router: Router): () => void {
	const hiddenStates = new Map<string, string | null>();
	HIDDEN_IDS.forEach((id) => {
		const el = document.getElementById(id);
		if (!el) return;
		hiddenStates.set(id, el.style.display || "");
		el.style.display = "none";
	});

	const existing = document.getElementById("lobby-screen");
	if (existing) {
		return () => cleanup(hiddenStates);
	}

	const container = document.createElement("div");
	container.id = "lobby-screen";
	container.style.cssText = `
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at top, #1f2937 0%, #0b0f14 60%, #05070a 100%);
		color: #e5e7eb;
		font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
		z-index: 3000;
	`;

	const panel = document.createElement("div");
	panel.style.cssText = `
		width: min(720px, 90vw);
		padding: 40px;
		background: rgba(10, 12, 16, 0.85);
		border: 1px solid #2f3947;
		border-radius: 8px;
		box-shadow: 0 20px 60px rgba(0,0,0,0.45);
		backdrop-filter: blur(6px);
		display: flex;
		flex-direction: column;
		gap: 20px;
	`;

	const title = document.createElement("div");
	title.textContent = "Veta";
	title.style.cssText = "font-size: 40px; font-weight: 800; letter-spacing: 1px;";

	const subtitle = document.createElement("div");
	subtitle.textContent = "Elige un modo para comenzar";
	subtitle.style.cssText = "color: #9ca3af; font-size: 16px;";

	const account = getStoredAuth();
	const accountRow = document.createElement("div");
	accountRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; color: #cbd5e1; font-size: 14px;";

	const accountName = document.createElement("span");
	accountName.textContent = account ? `Cuenta: ${account.user.displayName || account.user.username}` : "";

	const logoutBtn = document.createElement("button");
	logoutBtn.textContent = "Salir";
	logoutBtn.style.cssText = `
		background: transparent;
		color: #fca5a5;
		border: 1px solid #475569;
		padding: 8px 12px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
	`;
	logoutBtn.onclick = () => {
		clearStoredAuth();
		window.location.reload();
	};

	accountRow.appendChild(accountName);
	accountRow.appendChild(logoutBtn);

	const buttonRow = document.createElement("div");
	buttonRow.style.cssText = "display: flex; gap: 12px; flex-wrap: wrap;";

	const playBtn = document.createElement("button");
	playBtn.textContent = "Jugar";
	playBtn.style.cssText = baseButtonStyles("#2563eb");
	playBtn.onclick = () => router.navigate("play");

	const editorBtn = document.createElement("button");
	editorBtn.textContent = "Crear Mapa";
	editorBtn.style.cssText = baseButtonStyles("#059669");
	editorBtn.onclick = () => router.navigate("editor");

	buttonRow.appendChild(playBtn);
	buttonRow.appendChild(editorBtn);

	panel.appendChild(title);
	panel.appendChild(subtitle);
	panel.appendChild(accountRow);
	panel.appendChild(buttonRow);
	container.appendChild(panel);
	document.body.appendChild(container);

	return () => {
		container.remove();
		cleanup(hiddenStates);
	};
}

function cleanup(hiddenStates: Map<string, string | null>) {
	hiddenStates.forEach((display, id) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.style.display = display ?? "";
	});
}

function baseButtonStyles(accent: string) {
	return `
		background: ${accent};
		color: white;
		border: none;
		padding: 12px 20px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 700;
		box-shadow: 0 10px 20px rgba(0,0,0,0.25);
	`;
}
