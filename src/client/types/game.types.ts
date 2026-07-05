export type GameMode = "lobby" | "play" | "editor";

export interface Route {
	mode: GameMode;
	roomId: string | null;
}

export interface EnvironmentConfig {
	shapeType?: "rect" | "circle" | "custom";
	mapSizeX?: number;
	mapSizeZ?: number;
	customGrid?: string[];
	customCellSize?: number;
	invisibleWalls?: boolean;
	fallDeath?: boolean;
	fallDeathY?: number;
	skyType?: string;
	groundTexturePath?: string | null;
	groundTextureAssetId?: string | null;
	groundTextureSettings?: any;
	groundGroups?: any[];
	customGridGroups?: { [key: string]: string };
	customGridShapes?: { [key: string]: string };
	invisibleWallsAdvanced?: boolean;
	invisibleWallsGroups?: any[];
	customGridWallGroups?: { [key: string]: string };
	ceilingGroups?: any[];
	customGridCeilingGroups?: { [key: string]: string };
	customGridCeilingShapes?: { [key: string]: string };
}

export interface MainBootstrapOptions {
	mode?: GameMode;
	roomId?: string | null;
}

export interface ClientInitState {
	mode: GameMode;
	roomId: string | null;
}
