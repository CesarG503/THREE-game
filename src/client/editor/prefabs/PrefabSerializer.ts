/**
 * PrefabSerializer.ts
 * VIPER IO — Serializador, validador de seguridad y exportador/importador JSON de prefabs.
 */

import type { PrefabDataPayload, PrefabExportPackage } from "./PrefabTypes";

export class PrefabSerializer {
	/**
	 * Valida exhaustivamente un objeto o JSON importado antes de permitir su uso en el editor.
	 */
	static validateAndParse(raw: unknown): { valid: boolean; error?: string; data?: PrefabDataPayload } {
		let parsed: any = raw;

		if (typeof raw === "string") {
			try {
				parsed = JSON.parse(raw);
			} catch (e: any) {
				return { valid: false, error: `JSON malformado: ${e.message}` };
			}
		}

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { valid: false, error: "El contenido del prefab debe ser un objeto JSON válido" };
		}

		// Si viene envuelto en paquete de exportación
		let prefabData: any = parsed;
		if (parsed.format === "viper-prefab-package") {
			if (!parsed.prefab || typeof parsed.prefab !== "object") {
				return { valid: false, error: "Paquete de prefab inválido: falta campo 'prefab'" };
			}
			prefabData = parsed.prefab;
		}

		// Validar campos obligatorios
		if (prefabData.format !== "viper-prefab") {
			return { valid: false, error: `Formato no reconocido: se esperaba 'viper-prefab', recibido '${prefabData.format}'` };
		}

		if (typeof prefabData.schemaVersion !== "string" || !prefabData.schemaVersion.startsWith("1.")) {
			return { valid: false, error: `Versión de esquema incompatible: '${prefabData.schemaVersion}'` };
		}

		if (typeof prefabData.name !== "string" || !prefabData.name.trim()) {
			return { valid: false, error: "El prefab debe contener un nombre no vacío" };
		}

		// Prevenir nombres excesivamente largos o caracteres peligrosos
		if (prefabData.name.length > 100) {
			return { valid: false, error: "El nombre del prefab excede el límite permitido (100 caracteres)" };
		}

		if (!Array.isArray(prefabData.objects)) {
			return { valid: false, error: "El prefab debe contener un arreglo de 'objects'" };
		}

		if (!Array.isArray(prefabData.hierarchy)) {
			return { valid: false, error: "El prefab debe contener un arreglo de 'hierarchy'" };
		}

		// Seguridad contra prototype pollution y validación de tipos
		for (const obj of prefabData.objects) {
			if (!obj || typeof obj !== "object") {
				return { valid: false, error: "Objeto corrupto detectado en la lista de objetos" };
			}
			if (Object.prototype.hasOwnProperty.call(obj, "__proto__") || Object.prototype.hasOwnProperty.call(obj, "constructor")) {
				return { valid: false, error: "Inyección de propiedades inseguras detectada en prefab" };
			}
			if (typeof obj.type !== "string" || typeof obj.uuid !== "string") {
				return { valid: false, error: "Cada objeto del prefab debe contener 'type' y 'uuid' válidos" };
			}
			if (!obj.pos || typeof obj.pos.x !== "number" || typeof obj.pos.y !== "number" || typeof obj.pos.z !== "number") {
				return { valid: false, error: `Posición numérica requerida para objeto ${obj.uuid}` };
			}
		}

		for (const node of prefabData.hierarchy) {
			if (!node || typeof node !== "object") {
				return { valid: false, error: "Nodo corrupto en la jerarquía del prefab" };
			}
			if (typeof node.id !== "string") {
				return { valid: false, error: "Cada nodo de jerarquía debe tener un 'id' string" };
			}
		}

		const validatedData: PrefabDataPayload = {
			format: "viper-prefab",
			schemaVersion: "1.0",
			name: prefabData.name.trim(),
			description: typeof prefabData.description === "string" ? prefabData.description.trim() : null,
			category: typeof prefabData.category === "string" ? prefabData.category.trim() : "general",
			pivot: prefabData.pivot && typeof prefabData.pivot.x === "number"
				? { x: prefabData.pivot.x, y: prefabData.pivot.y, z: prefabData.pivot.z }
				: { x: 0, y: 0, z: 0 },
			hierarchy: prefabData.hierarchy,
			objects: prefabData.objects,
			dependencies: this.extractDependencies(prefabData.objects),
		};

		return { valid: true, data: validatedData };
	}

	/**
	 * Extrae las dependencias de recursos (texturas, asset IDs) de los objetos del prefab.
	 */
	static extractDependencies(objects: any[]): { textures: string[]; assets: string[] } {
		const textures = new Set<string>();
		const assets = new Set<string>();

		objects.forEach((obj) => {
			if (obj.texturePath && typeof obj.texturePath === "string") {
				textures.add(obj.texturePath);
			}
			if (obj.textureAssetId && typeof obj.textureAssetId === "string") {
				assets.add(obj.textureAssetId);
			}
		});

		return {
			textures: Array.from(textures),
			assets: Array.from(assets),
		};
	}

	/**
	 * Empaqueta un prefab para exportación como JSON descargable.
	 */
	static exportToPackageJson(prefabData: PrefabDataPayload, authorName: string = "Editor"): string {
		const pkg: PrefabExportPackage = {
			format: "viper-prefab-package",
			schemaVersion: "1.0",
			exportedAt: new Date().toISOString(),
			author: authorName,
			prefab: prefabData,
		};
		return JSON.stringify(pkg, null, 2);
	}
}
