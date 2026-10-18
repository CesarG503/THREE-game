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
	 * Lista unificada de prefabs (servidor + local) diferenciando procedencia y evitando duplicados.
	 */
	static async listPrefabs(
		scope: "public" | "mine" | "all" = "all",
		category?: string
	): Promise<PlatformPrefabDto[]> {
		const localList = this.getLocalPrefabs(scope, category);
		try {
			const params = new URLSearchParams();
			if (scope !== "all") params.set("scope", scope);
			if (category) params.set("category", category);
			const qs = params.toString() ? `?${params.toString()}` : "";

			const response = await apiFetch<{ prefabs: PlatformPrefabDto[] }>(`/prefabs${qs}`);
			const serverPrefabs = response.prefabs.map((p) => ({
				...p,
				data: p.data || p.currentVersion?.data,
				storageStatus: "server" as const,
			}));

			// Actualizar caché local de los prefabs remotos
			serverPrefabs.forEach((sp) => this.saveLocalPrefab(sp));

			// Combinar con los prefabs locales que no están en el servidor
			const serverIds = new Set(serverPrefabs.map((p) => p.id));
			const serverSlugs = new Set(serverPrefabs.map((p) => p.slug));

			const uniqueLocals = localList.filter(
				(lp) => !serverIds.has(lp.id) && !serverSlugs.has(lp.slug)
			);

			return [...serverPrefabs, ...uniqueLocals];
		} catch (err) {
			console.warn("[PrefabService] Servidor inaccesible. Usando biblioteca local offline:", err);
			return localList;
		}
	}

	/**
	 * Obtiene un prefab por ID o slug con su versión específica o actual.
	 */
	static async getPrefab(identifier: string, version?: number): Promise<PlatformPrefabDto> {
		try {
			const qs = version ? `?version=${version}` : "";
			const prefab = await apiFetch<PlatformPrefabDto>(`/prefabs/${encodeURIComponent(identifier)}${qs}`);
			prefab.storageStatus = "server";
			return prefab;
		} catch (err) {
			console.warn(`[PrefabService] Buscando prefab '${identifier}' en almacenamiento local:`, err);
			const local = this.getLocalPrefab(identifier);
			if (local) return local;
			throw err;
		}
	}

	/**
	 * Crea un nuevo prefab persistente en PostgreSQL con versión inicial inmutable v1.
	 * Diferencia estrictamente errores de autenticación, validación y conexión.
	 */
	static async createPrefab(
		name: string,
		data: PrefabDataPayload,
		options: { description?: string; category?: string; isPublished?: boolean; notes?: string } = {}
	): Promise<PlatformPrefabDto> {
		if (!data || data.format !== "viper-prefab") {
			throw new Error("Formato de datos no reconocido (se requiere 'viper-prefab')");
		}

		const payload = {
			name,
			description: options.description ?? null,
			category: options.category ?? data.category ?? "general",
			isPublished: options.isPublished ?? false,
			data,
			notes: options.notes ?? "Versión inicial",
		};

		try {
			const created = await apiFetch<PlatformPrefabDto>("/prefabs", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			created.storageStatus = "server";
			this.saveLocalPrefab(created);
			return created;
		} catch (err: any) {
			const errMsg = err?.message || String(err);
			const normErr = errMsg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
			const isAuth = normErr.includes("sesion no autenticada") || normErr.includes("sesion requerida") || normErr.includes("permiso") || normErr.includes("401") || normErr.includes("403");
			const isValidation = normErr.includes("invalid") || normErr.includes("esquema") || normErr.includes("formato no reconocido") || normErr.includes("400");

			if (isValidation) {
				// Errores de validación se lanzan directamente para no engañar al usuario
				throw new Error(`Validación rechazada por el servidor: ${errMsg}`);
			}

			if (isAuth) {
				const local = this.createLocalPrefab(name, data, options);
				local.storageStatus = "auth_error";
				local.syncError = "No autenticado en el servidor. Guardado solo en este navegador.";
				this.saveLocalPrefab(local);
				return local;
			}

			// Error de conexión o servidor no disponible
			console.warn("[PrefabService] Servidor inaccesible. Guardando prefab localmente como pendiente:", err);
			const localPrefab = this.createLocalPrefab(name, data, options);
			localPrefab.storageStatus = "pending_sync";
			localPrefab.syncError = "Pendiente de sincronización con el servidor.";
			this.saveLocalPrefab(localPrefab);
			return localPrefab;
		}
	}

	/**
	 * Sincroniza explícitamente un prefab local con el servidor PostgreSQL.
	 */
	static async syncPrefabToServer(identifier: string): Promise<PlatformPrefabDto> {
		const local = this.getLocalPrefab(identifier);
		if (!local) throw new Error("Prefab no encontrado en el almacenamiento local");
		const data = local.currentVersion?.data;
		if (!data) throw new Error("El prefab local no contiene datos de objetos válidos");

		const payload = {
			name: local.name,
			description: local.description,
			category: local.category,
			isPublished: local.isPublished,
			data,
			notes: local.currentVersion?.notes || "Sincronizado desde navegador",
		};

		const created = await apiFetch<PlatformPrefabDto>("/prefabs", {
			method: "POST",
			body: JSON.stringify(payload),
		});

		created.storageStatus = "server";
		if (created.id !== local.id) {
			this.removeLocalPrefab(local.id);
		}
		this.saveLocalPrefab(created);
		return created;
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

			updated.storageStatus = "server";
			this.saveLocalPrefab(updated);
			return updated;
		} catch (err: any) {
			console.warn("[PrefabService] Servidor no disponible. Actualizando prefab localmente:", err);
			return this.updateLocalPrefab(identifier, options);
		}
	}

	/**
	 * Elimina un prefab tanto del servidor como del almacenamiento local.
	 */
	static async deletePrefab(identifier: string): Promise<{ ok: boolean; id: string }> {
		try {
			await apiFetch<{ ok: boolean; id: string }>(`/prefabs/${encodeURIComponent(identifier)}`, {
				method: "DELETE",
			});
		} catch (err) {
			console.warn("[PrefabService] Servidor no disponible o prefab solo local:", err);
		}
		this.removeLocalPrefab(identifier);
		return { ok: true, id: identifier };
	}

	// ── Almacenamiento local (Fallback Offline / Standalone) ──────────────────────

	private static inMemoryStore: Record<string, PlatformPrefabDto> = {};

	private static getRawLocalStore(): Record<string, PlatformPrefabDto> {
		try {
			if (typeof localStorage !== "undefined") {
				const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
				return raw ? JSON.parse(raw) : {};
			}
			return this.inMemoryStore;
		} catch {
			return this.inMemoryStore;
		}
	}

	private static setRawLocalStore(store: Record<string, PlatformPrefabDto>) {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
			} else {
				this.inMemoryStore = store;
			}
		} catch (e) {
			console.error("[PrefabService] Error escribiendo localStorage:", e);
		}
	}

	private static getLocalPrefabs(scope: string, category?: string): PlatformPrefabDto[] {
		const store = this.getRawLocalStore();
		let list = Object.values(store).map((p) => ({
			...p,
			data: p.data || p.currentVersion?.data,
		}));
		if (category) {
			list = list.filter((p) => p.category === category);
		}
		return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}

	private static getLocalPrefab(identifier: string): PlatformPrefabDto | null {
		const store = this.getRawLocalStore();
		let prefab = store[identifier];
		if (!prefab) {
			prefab = Object.values(store).find((p) => p.slug === identifier) || null as any;
		}
		if (prefab) {
			return {
				...prefab,
				data: prefab.data || prefab.currentVersion?.data,
			};
		}
		return null;
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
			storageStatus: "local",
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
			data,
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
