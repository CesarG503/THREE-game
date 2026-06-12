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
		skyType?: "day" | "night" | "sunset";
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
		};
	};
	playerConfig: {
		roles: unknown[];
		assignments: Record<string, unknown>;
	};
}

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
			skyType: "night",
			groundTexturePath: null,
			groundTextureAssetId: null,
			groundTextureSettings: { fitMode: "auto", tileSize: 5, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0 },
		},
		playerConfig: {
			roles: [],
			assignments: {},
		},
	};
}
