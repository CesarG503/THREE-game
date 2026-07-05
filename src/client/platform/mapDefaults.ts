export interface SavedMapData {
	gameVersion: string;
	timestamp: number;
	objects: unknown[];
	gameConfig: {
		sequences: unknown[];
	};
	environmentConfig: {
		mapSizeX: number;
		mapSizeZ: number;
		invisibleWalls: boolean;
		fallDeath: boolean;
		fallDeathY: number;
		skyType?: string;
		groundTexturePath?: string | null;
		groundTextureAssetId?: string | null;
		groundTextureSettings?: {
			fitMode?: "auto" | "stretch";
			tileSize?: number;
			repeatX?: number;
			repeatY?: number;
			offsetX?: number;
			offsetY?: number;
			rotation?: number;
			patternVariation?: boolean;
		};
		shapeType?: "rect" | "circle" | "custom";
		customGrid?: string[];
		customCellSize?: number;
		groundGroups?: any[];
		customGridGroups?: Record<string, string>;
		customGridShapes?: Record<string, string>;
	};
	playerConfig: {
		roles: unknown[];
		assignments: Record<string, unknown>;
	};
}

export const DEFAULT_SKYBOX_TYPE = "skybox:/assets/skybox/Cubemap/Cubemap_Sky_04-512x512.png";

export function createEmptyMapData(): SavedMapData {
	return {
		gameVersion: "1.0",
		timestamp: Date.now(),
		objects: [],
		gameConfig: {
			sequences: [],
		},
		environmentConfig: {
			mapSizeX: 100,
			mapSizeZ: 100,
			invisibleWalls: false,
			fallDeath: true,
			fallDeathY: -20,
			skyType: DEFAULT_SKYBOX_TYPE,
			groundTexturePath: null,
			groundTextureAssetId: null,
			groundTextureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, patternVariation: false },
			groundGroups: [],
			customGridGroups: {},
			customGridShapes: {},
		},
		playerConfig: {
			roles: [],
			assignments: {},
		},
	};
}
