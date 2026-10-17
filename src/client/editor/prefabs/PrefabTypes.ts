/**
 * PrefabTypes.ts
 * VIPER IO — Tipos y esquemas para el sistema de prefabs reutilizables.
 */

import type { SerializedHierarchyNode } from "../hierarchy/EditorHierarchyModel";
import type { SerializedMapObjectData } from "../clipboard/EditorClipboard";

export interface PrefabDataPayload {
	format: "viper-prefab";
	schemaVersion: "1.0";
	name: string;
	description?: string | null;
	category: string;
	pivot: { x: number; y: number; z: number };
	hierarchy: SerializedHierarchyNode[];
	objects: SerializedMapObjectData[];
	dependencies?: {
		textures?: string[];
		models?: string[];
		assets?: string[];
	};
}

export interface PrefabVersionDto {
	id: string;
	version: number;
	notes?: string | null;
	createdAt: string;
	data?: PrefabDataPayload;
}

export interface PlatformPrefabDto {
	id: string;
	slug: string;
	name: string;
	description?: string | null;
	category: string;
	isPublished: boolean;
	ownerId?: string | null;
	owner?: {
		id: string;
		username: string;
		displayName?: string | null;
	} | null;
	createdAt: string;
	updatedAt: string;
	currentVersionId?: string | null;
	version: number;
	versionCount: number;
	currentVersion?: PrefabVersionDto | null;
}

export interface PrefabExportPackage {
	format: "viper-prefab-package";
	schemaVersion: "1.0";
	exportedAt: string;
	author?: string;
	prefab: PrefabDataPayload;
}

export interface PrefabInstanceRecord {
	instanceId: string;
	prefabId: string;
	prefabVersion: number;
	rootNodeId: string;
	overrides: Record<string, Record<string, any>>; // uuid -> { propName: value }
}
