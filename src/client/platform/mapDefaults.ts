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
		},
		playerConfig: {
			roles: [],
			assignments: {},
		},
	};
}

