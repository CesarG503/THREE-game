/**
 * PrefabService.ts
 * VIPER IO — Servicio de cliente para la persistencia de prefabs en PostgreSQL/Prisma
 * con adaptador de fallback offline transparente.
 */

import { apiFetch } from "../../platform/api";
import type { PlatformPrefabDto, PrefabDataPayload } from "./PrefabTypes";

const LOCAL_STORAGE_KEY = "viper_prefabs_offline_store";

export class PrefabService {
	/**
	 * Lista los prefabs disponibles según el alcance (public, mine, all) y categoría.
	 */
	static async listPrefabs(
		scope: "public" | "mine" | "all" = "all",
		category?: string
	): Promise<PlatformPrefabDto[]> {
		try {
			const params = new URLSearchParams();
			if (scope !== "all") params.set("scope", scope);
			if (category) params.set("category", category);
			const qs = params.toString() ? `?${params.toString()}` : "";

			const response = await apiFetch<{ prefabs: PlatformPrefabDto[] }>(`/prefabs${qs}`);
			return response.prefabs;
		} catch (err) {
			console.warn("[PrefabService] Servidor inaccesible. Usando almacenamiento local:", err);
			return this.getLocalPrefabs(scope, category);
		}
	}

	/**
	 * Obtiene un prefab por ID o slug con su versión específica o actual.
	 */
	static async getPrefab(identifier: string, version?: number): Promise<PlatformPrefabDto> {
		try {
			const qs = version ? `?version=${version}` : "";
			return await apiFetch<PlatformPrefabDto>(`/prefabs/${encodeURIComponent(identifier)}${qs}`);
		} catch (err) {
			console.warn(`[PrefabService] Error obteniendo prefab '${identifier}' del servidor. Buscando local:`, err);
			const local = this.getLocalPrefab(identifier);
			if (local) return local;
			throw err;
		}
	}

	/**
	 * Crea un nuevo prefab persistente en la base de datos (con versión inicial inmutable v1).
	 */
	static async createPrefab(
		name: string,
		data: PrefabDataPayload,
		options: { description?: string; category?: string; isPublished?: boolean; notes?: string } = {}
	): Promise<PlatformPrefabDto> {
		try {
			const payload = {
				name,
				description: options.description ?? null,
				category: options.category ?? data.category ?? "general",
				isPublished: options.isPublished ?? false,
				data,
				notes: options.notes ?? "Versión inicial",
			};

			const created = await apiFetch<PlatformPrefabDto>("/prefabs", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			this.saveLocalPrefab(created);
			return created;
		} catch (err) {
			console.warn("[PrefabService] Servidor no disponible. Guardando prefab localmente:", err);
			const localPrefab = this.createLocalPrefab(name, data, options);
			return localPrefab;
		}
	}

	/**
	 * Actualiza un prefab o publica una nueva versión inmutable.
	 */
	static async updatePrefab(
		identifier: string,
		options: {
			name?: string;
			description?: string;
			category?: string;
			isPublished?: boolean;
			data?: PrefabDataPayload;
			notes?: string;
		}
	): Promise<PlatformPrefabDto> {
		try {
			const updated = await apiFetch<PlatformPrefabDto>(`/prefabs/${encodeURIComponent(identifier)}`, {
				method: "PUT",
				body: JSON.stringify(options),
			});

			this.saveLocalPrefab(updated);
			return updated;
		} catch (err) {
			console.warn("[PrefabService] Servidor no disponible. Actualizando prefab localmente:", err);
			return this.updateLocalPrefab(identifier, options);
		}
	}

	/**
	 * Elimina un prefab.
	 */
	static async deletePrefab(identifier: string): Promise<{ ok: boolean; id: string }> {
		try {
			await apiFetch<{ ok: boolean; id: string }>(`/prefabs/${encodeURIComponent(identifier)}`, {
				method: "DELETE",
			});
		} catch (err) {
			console.warn("[PrefabService] Eliminando prefab solo localmente:", err);
		}
		this.removeLocalPrefab(identifier);
		return { ok: true, id: identifier };
	}

	// ── Almacenamiento local (Fallback Offline / Standalone) ──────────────────────

	private static getRawLocalStore(): Record<string, PlatformPrefabDto> {
		try {
			const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
			return raw ? JSON.parse(raw) : {};
		} catch {
			return {};
		}
	}

	private static setRawLocalStore(store: Record<string, PlatformPrefabDto>) {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
			}
		} catch (e) {
			console.error("[PrefabService] Error escribiendo localStorage:", e);
		}
	}

	private static getLocalPrefabs(scope: string, category?: string): PlatformPrefabDto[] {
		const store = this.getRawLocalStore();
		let list = Object.values(store);
		if (category) {
			list = list.filter((p) => p.category === category);
		}
		return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}

	private static getLocalPrefab(identifier: string): PlatformPrefabDto | null {
		const store = this.getRawLocalStore();
		if (store[identifier]) return store[identifier];
		const bySlug = Object.values(store).find((p) => p.slug === identifier);
		return bySlug || null;
	}

	private static saveLocalPrefab(prefab: PlatformPrefabDto) {
		const store = this.getRawLocalStore();
		store[prefab.id] = prefab;
		this.setRawLocalStore(store);
	}

	private static removeLocalPrefab(identifier: string) {
		const store = this.getRawLocalStore();
		delete store[identifier];
		for (const key of Object.keys(store)) {
			if (store[key].slug === identifier) {
				delete store[key];
			}
		}
		this.setRawLocalStore(store);
	}

	private static createLocalPrefab(
		name: string,
		data: PrefabDataPayload,
		options: { description?: string; category?: string; isPublished?: boolean; notes?: string }
	): PlatformPrefabDto {
		const id = `local_prefab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const now = new Date().toISOString();

		const prefabDto: PlatformPrefabDto = {
			id,
			slug,
			name,
			description: options.description || null,
			category: options.category || data.category || "general",
			isPublished: options.isPublished || false,
			ownerId: "local_user",
			owner: { id: "local_user", username: "LocalUser", displayName: "Local User" },
			createdAt: now,
			updatedAt: now,
			currentVersionId: `${id}_v1`,
			version: 1,
			versionCount: 1,
			currentVersion: {
				id: `${id}_v1`,
				version: 1,
				notes: options.notes || "Versión inicial local",
				createdAt: now,
				data,
			},
		};

		this.saveLocalPrefab(prefabDto);
		return prefabDto;
	}

	private static updateLocalPrefab(
		identifier: string,
		options: {
			name?: string;
			description?: string;
			category?: string;
			isPublished?: boolean;
			data?: PrefabDataPayload;
			notes?: string;
		}
	): PlatformPrefabDto {
		const existing = this.getLocalPrefab(identifier);
		if (!existing) {
			throw new Error("Prefab local no encontrado");
		}

		const now = new Date().toISOString();
		if (options.name) existing.name = options.name;
		if (options.description !== undefined) existing.description = options.description;
		if (options.category) existing.category = options.category;
		if (options.isPublished !== undefined) existing.isPublished = options.isPublished;
		existing.updatedAt = now;

		if (options.data) {
			const nextVersion = existing.version + 1;
			existing.version = nextVersion;
			existing.versionCount += 1;
			existing.currentVersionId = `${existing.id}_v${nextVersion}`;
			existing.currentVersion = {
				id: existing.currentVersionId,
				version: nextVersion,
				notes: options.notes || `Versión ${nextVersion}`,
				createdAt: now,
				data: options.data,
			};
		}

		this.saveLocalPrefab(existing);
		return existing;
	}
}
