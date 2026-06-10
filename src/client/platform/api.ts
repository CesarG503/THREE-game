import { getStoredAuth, type StoredAuthSession } from "./auth";

export interface MapOwner {
	id: string;
	username: string;
	displayName?: string | null;
}

export interface PlatformMap {
	id: string;
	slug: string;
	name: string;
	description?: string | null;
	isPublished: boolean;
	ownerId?: string | null;
	owner?: MapOwner | null;
	createdAt: string;
	updatedAt: string;
	currentVersionId?: string | null;
	version: number;
	objectCount: number;
	matchCount: number;
	versionCount: number;
	currentVersion?: {
		id: string;
		version: number;
		notes?: string | null;
		createdAt: string;
		data?: unknown;
	} | null;
}

export interface MapWritePayload {
	name?: string;
	description?: string | null;
	isPublished?: boolean;
	data?: unknown;
	notes?: string;
}

export async function submitAuth(
	mode: "login" | "register",
	body: { email: string; username: string; password: string },
): Promise<StoredAuthSession> {
	return apiFetch<StoredAuthSession>(`/auth/${mode}`, {
		method: "POST",
		body: JSON.stringify(body),
		auth: false,
	});
}

export async function listMaps(scope: "public" | "mine" | "all" = "public") {
	const query = scope === "public" ? "" : `?scope=${encodeURIComponent(scope)}`;
	const payload = await apiFetch<{ maps: PlatformMap[] }>(`/maps${query}`);
	return payload.maps;
}

export function getMap(identifier: string) {
	return apiFetch<PlatformMap>(`/maps/${encodeURIComponent(identifier)}`);
}

export function createMap(payload: Required<Pick<MapWritePayload, "name" | "data">> & MapWritePayload) {
	return apiFetch<PlatformMap>("/maps", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function updateMap(identifier: string, payload: MapWritePayload) {
	return apiFetch<PlatformMap>(`/maps/${encodeURIComponent(identifier)}`, {
		method: "PUT",
		body: JSON.stringify(payload),
	});
}

export function deleteMap(identifier: string) {
	return apiFetch<{ ok: boolean }>(`/maps/${encodeURIComponent(identifier)}`, {
		method: "DELETE",
	});
}

export async function apiFetch<T>(
	path: string,
	options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
	const headers = new Headers(options.headers);
	if (options.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	if (options.auth !== false) {
		const token = getStoredAuth()?.session.token;
		if (token) headers.set("Authorization", `Bearer ${token}`);
	}

	const response = await fetch(`${getApiBaseUrl()}${path}`, {
		...options,
		headers,
	});

	const payload = await response.json().catch(() => null) as { error?: string } | T | null;
	if (!response.ok) {
		throw new Error(payload && "error" in payload && payload.error ? payload.error : "Error de API");
	}

	return payload as T;
}

export function getApiBaseUrl() {
	const protocol = window.location.protocol === "https:" ? "https:" : "http:";
	const hostname = window.location.hostname || "localhost";
	return `${protocol}//${hostname}:8080/api`;
}

