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

export const AUTH_STORAGE_KEY = "veta.auth";

export function getStoredAuth(): StoredAuthSession | null {
	const raw = localStorage.getItem(AUTH_STORAGE_KEY);
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

export function setStoredAuth(auth: StoredAuthSession) {
	localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
	localStorage.setItem("playerName", auth.user.displayName || auth.user.username);
}

export function clearStoredAuth() {
	localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthDisplayName(auth: StoredAuthSession | null) {
	return auth?.user.displayName || auth?.user.username || "Invitado";
}

