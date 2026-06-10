import { setStoredAuth, type StoredAuthSession } from "../platform/auth";
import { submitAuth } from "../platform/api";
import { injectPlatformStyles } from "./platform/styles";
export { clearStoredAuth, getStoredAuth } from "../platform/auth";

export interface AuthScreenOptions {
	subtitle?: string;
	cancelText?: string;
	onCancel?: () => void;
}

const HIDDEN_GAME_IDS = [
	"loading",
	"crosshair",
	"inventory-container",
	"settings-panel",
	"overlay",
	"fuego-counter",
	"interaction-prompt",
	"button-interaction-prompt",
	"move-prompt-container",
];

export function renderAuthScreen(
	onAuthenticated: (auth: StoredAuthSession) => void,
	options: AuthScreenOptions = {},
): () => void {
	injectPlatformStyles();
	let mode: "login" | "register" = "login";
	const hiddenStates = new Map<string, string | null>();

	HIDDEN_GAME_IDS.forEach((id) => {
		const el = document.getElementById(id);
		if (!el) return;
		hiddenStates.set(id, el.style.display || "");
		el.style.display = "none";
	});

	const container = document.createElement("div");
	container.id = "auth-screen";
	container.style.cssText = `
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background:
			radial-gradient(circle at 74% 18%, rgba(139, 92, 246, 0.24), transparent 32%),
			radial-gradient(circle at 18% 86%, rgba(8, 217, 255, 0.16), transparent 30%),
			#05070d;
		color: #f8fafc;
		font-family: var(--vp-font);
		z-index: 4000;
		padding: 24px;
	`;

	const panel = document.createElement("form");
	panel.style.cssText = `
		width: min(420px, 100%);
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 28px;
		background: rgba(17, 19, 27, 0.94);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: var(--vp-radius);
		box-shadow: 0 24px 70px rgba(0,0,0,0.38);
		backdrop-filter: blur(14px);
	`;

	const title = document.createElement("h1");
	title.style.cssText = "margin: 0; font-size: 30px; line-height: 1.1;";

	const subtitle = document.createElement("p");
	subtitle.style.cssText = "margin: 0 0 6px; color: #94a3b8; font-size: 14px;";

	const username = createInput("Usuario", "text", "username");
	username.autocomplete = "username";
	username.style.display = "none";

	const email = createInput("Email", "email", "email");
	email.autocomplete = "email";

	const password = createInput("Contrasena", "password", "password");
	password.autocomplete = "current-password";

	const status = document.createElement("div");
	status.style.cssText = "min-height: 20px; color: #fbbf24; font-size: 13px;";

	const submit = document.createElement("button");
	submit.type = "submit";
	submit.style.cssText = buttonStyles("#2563eb");

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.style.cssText = `
		background: transparent;
		color: #93c5fd;
		border: 1px solid #334155;
		padding: 10px 14px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
	`;

	const updateMode = () => {
		const isRegister = mode === "register";
		title.textContent = isRegister ? "Crear cuenta VIPERIO" : "Entrar a VIPERIO";
		subtitle.textContent = options.subtitle || (isRegister
			? "Registro preliminar para empezar a guardar datos del juego."
			: "Usa tu cuenta de prueba para continuar.");
		username.style.display = isRegister ? "block" : "none";
		username.required = isRegister;
		email.type = isRegister ? "email" : "text";
		email.placeholder = isRegister ? "Email" : "Email o usuario";
		password.autocomplete = isRegister ? "new-password" : "current-password";
		submit.textContent = isRegister ? "Registrarme" : "Entrar";
		toggle.textContent = isRegister ? "Ya tengo cuenta" : "Crear cuenta nueva";
		status.textContent = "";
	};

	toggle.onclick = () => {
		mode = mode === "login" ? "register" : "login";
		updateMode();
	};

	panel.onsubmit = async (event) => {
		event.preventDefault();
		status.style.color = "#fbbf24";
		status.textContent = "Conectando...";
		submit.disabled = true;

		try {
			const auth = await submitAuth(mode, {
				email: email.value,
				username: username.value,
				password: password.value,
			});
			setStoredAuth(auth);
			onAuthenticated(auth);
		} catch (err) {
			status.style.color = "#f87171";
			status.textContent = err instanceof Error ? err.message : "No se pudo autenticar";
		} finally {
			submit.disabled = false;
		}
	};

	panel.appendChild(title);
	panel.appendChild(subtitle);
	panel.appendChild(username);
	panel.appendChild(email);
	panel.appendChild(password);
	panel.appendChild(status);
	panel.appendChild(submit);
	panel.appendChild(toggle);

	if (options.onCancel) {
		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.textContent = options.cancelText || "Volver";
		cancel.style.cssText = `
			background: transparent;
			color: #cbd5e1;
			border: none;
			padding: 8px 12px;
			cursor: pointer;
			font-size: 14px;
		`;
		cancel.onclick = options.onCancel;
		panel.appendChild(cancel);
	}

	container.appendChild(panel);
	document.body.appendChild(container);
	updateMode();

	return () => {
		container.remove();
		hiddenStates.forEach((display, id) => {
			const el = document.getElementById(id);
			if (el) el.style.display = display ?? "";
		});
	};
}

function createInput(placeholder: string, type: string, name: string) {
	const input = document.createElement("input");
	input.name = name;
	input.type = type;
	input.placeholder = placeholder;
	input.required = true;
	input.style.cssText = `
		width: 100%;
		box-sizing: border-box;
		background: #0f172a;
		color: #f8fafc;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: var(--vp-radius);
		padding: 12px 14px;
		font-size: 15px;
		outline: none;
	`;
	return input;
}

function buttonStyles(color: string) {
	return `
		background: ${color === "#2563eb" ? "var(--vp-purple)" : color};
		color: white;
		border: none;
		padding: 12px 16px;
		border-radius: var(--vp-radius);
		cursor: pointer;
		font-size: 16px;
		font-weight: 700;
		box-shadow: 0 0 24px rgba(139, 92, 246, 0.32);
	`;
}
