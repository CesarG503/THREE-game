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
	skyType?: "day" | "night" | "sunset";
}

export interface MainBootstrapOptions {
	mode?: GameMode;
	roomId?: string | null;
}

export interface ClientInitState {
	mode: GameMode;
	roomId: string | null;
}
