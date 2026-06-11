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
	coverAssetId?: string | null;
	coverAsset?: PlatformAssetPreview | null;
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
	coverAssetId?: string | null;
	data?: unknown;
	notes?: string;
}

export type AssetKind = "MAP_IMAGE" | "TEXTURE" | "CHARACTER_SKIN" | "SOUND" | "MODEL" | "VFX" | "OTHER";
export type AssetVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export interface PlatformAssetPreview {
	id: string;
	kind: AssetKind;
	mimeType: string;
	width?: number | null;
	height?: number | null;
	publicUrl?: string | null;
	fileUrl: string;
}

export interface PlatformAsset extends PlatformAssetPreview {
	ownerId?: string | null;
	owner?: MapOwner | null;
	visibility: AssetVisibility;
	name: string;
	description?: string | null;
	sizeBytes: number;
	durationMs?: number | null;
	storageProvider: string;
	metadata?: unknown;
	createdAt: string;
	updatedAt: string;
}

export interface AssetUploadOptions {
	kind: AssetKind;
	visibility?: AssetVisibility;
	name?: string;
	description?: string;
	metadata?: unknown;
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
	return payload.maps.map(normalizeMapUrls);
}

export function getMap(identifier: string) {
	return apiFetch<PlatformMap>(`/maps/${encodeURIComponent(identifier)}`).then(normalizeMapUrls);
}

export function createMap(payload: Required<Pick<MapWritePayload, "name" | "data">> & MapWritePayload) {
	return apiFetch<PlatformMap>("/maps", {
		method: "POST",
		body: JSON.stringify(payload),
	}).then(normalizeMapUrls);
}

export function updateMap(identifier: string, payload: MapWritePayload) {
	return apiFetch<PlatformMap>(`/maps/${encodeURIComponent(identifier)}`, {
		method: "PUT",
		body: JSON.stringify(payload),
	}).then(normalizeMapUrls);
}

export function deleteMap(identifier: string) {
	return apiFetch<{ ok: boolean }>(`/maps/${encodeURIComponent(identifier)}`, {
		method: "DELETE",
	});
}

export async function listAssets(scope: "public" | "mine" | "all" = "public", kind?: AssetKind) {
	const params = new URLSearchParams();
	if (scope !== "public") params.set("scope", scope);
	if (kind) params.set("kind", kind);
	const query = params.toString() ? `?${params}` : "";
	const payload = await apiFetch<{ assets: PlatformAsset[] }>(`/assets${query}`);
	return payload.assets.map(normalizeAssetUrls);
}

export async function uploadAsset(file: File, options: AssetUploadOptions) {
	const form = new FormData();
	form.set("file", file);
	form.set("kind", options.kind);
	form.set("visibility", options.visibility || "UNLISTED");
	form.set("name", options.name || file.name);
	if (options.description) form.set("description", options.description);
	if (options.metadata !== undefined) form.set("metadata", JSON.stringify(options.metadata));

	const asset = await apiFetch<PlatformAsset>("/assets", {
		method: "POST",
		body: form,
	});
	return normalizeAssetUrls(asset);
}

export function getAssetFileUrl(assetId: string) {
	return `${getApiBaseUrl()}/assets/${encodeURIComponent(assetId)}/file`;
}

export async function apiFetch<T>(
	path: string,
	options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
	const headers = new Headers(options.headers);
	const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
	if (options.body && !isFormData && !headers.has("Content-Type")) {
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

function normalizeAssetUrls<T extends { fileUrl: string; publicUrl?: string | null }>(asset: T): T {
	return {
		...asset,
		fileUrl: normalizeAssetUrl(asset.fileUrl),
		publicUrl: asset.publicUrl ? normalizeAssetUrl(asset.publicUrl) : asset.publicUrl,
	};
}

function normalizeMapUrls<T extends PlatformMap>(map: T): T {
	return {
		...map,
		coverAsset: map.coverAsset ? normalizeAssetUrls(map.coverAsset) : map.coverAsset,
	};
}

function normalizeAssetUrl(url: string) {
	if (/^https?:\/\//i.test(url)) return url;
	if (url.startsWith("/api/")) return `${getApiBaseUrl().replace(/\/api$/, "")}${url}`;
	if (url.startsWith("/")) return `${window.location.origin}${url}`;
	return url;
}
