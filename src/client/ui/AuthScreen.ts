export interface StoredAuthSession {
	user: {
		id: string;
		email: string;
		username: string;
		displayName?: string | null;
		createdAt: string;
	};
	session: {
		token: string;
		expiresAt: string;
	};
}

const STORAGE_KEY = "veta.auth";

export function getStoredAuth(): StoredAuthSession | null {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;

	try {
		const auth = JSON.parse(raw) as StoredAuthSession;
		if (!auth.session?.token || new Date(auth.session.expiresAt).getTime() <= Date.now()) {
			clearStoredAuth();
			return null;
		}
		return auth;
	} catch {
		clearStoredAuth();
		return null;
	}
}

export function clearStoredAuth() {
	localStorage.removeItem(STORAGE_KEY);
}

export function renderAuthScreen(onAuthenticated: (auth: StoredAuthSession) => void): () => void {
	let mode: "login" | "register" = "login";

	const container = document.createElement("div");
	container.id = "auth-screen";
	container.style.cssText = `
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: linear-gradient(135deg, #111827 0%, #0f172a 48%, #111111 100%);
		color: #f8fafc;
		font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
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
		background: rgba(12, 17, 25, 0.92);
		border: 1px solid #334155;
		border-radius: 8px;
		box-shadow: 0 24px 70px rgba(0,0,0,0.38);
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
		title.textContent = isRegister ? "Crear cuenta" : "Entrar a Veta";
		subtitle.textContent = isRegister
			? "Registro preliminar para empezar a guardar datos del juego."
			: "Usa tu cuenta de prueba para continuar.";
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
			localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
			localStorage.setItem("playerName", auth.user.displayName || auth.user.username);
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
	container.appendChild(panel);
	document.body.appendChild(container);
	updateMode();

	return () => container.remove();
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
		border: 1px solid #334155;
		border-radius: 8px;
		padding: 12px 14px;
		font-size: 15px;
		outline: none;
	`;
	return input;
}

async function submitAuth(
	mode: "login" | "register",
	body: { email: string; username: string; password: string },
): Promise<StoredAuthSession> {
	const response = await fetch(`${getApiBaseUrl()}/auth/${mode}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	const payload = await response.json().catch(() => null) as { error?: string } | StoredAuthSession | null;
	if (!response.ok) {
		throw new Error(payload && "error" in payload && payload.error ? payload.error : "Error de autenticacion");
	}

	return payload as StoredAuthSession;
}

function getApiBaseUrl() {
	const protocol = window.location.protocol === "https:" ? "https:" : "http:";
	const hostname = window.location.hostname || "localhost";
	return `${protocol}//${hostname}:8080/api`;
}

function buttonStyles(color: string) {
	return `
		background: ${color};
		color: white;
		border: none;
		padding: 12px 16px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 700;
	`;
}
