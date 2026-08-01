export type GameMode = "lobby" | "play" | "editor";

export interface Route {
	mode: GameMode;
	roomId: string | null;
}

export interface DayNightProfile {
	id: string;
	name: string;
	isDefault?: boolean;
	timeline: import("../platform/timelineDefaults").TimelineKeyframe[];
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
	enableStarsNight?: boolean;
	enableStarsSkybox?: boolean;
	enableStarsCycle?: boolean;
	sunElevation?: number;
	sunAzimuth?: number;
	solarPathEnabled?: boolean;
	solarPathSunriseTime?: number;
	solarPathSunsetTime?: number;
	solarPathMaxElevation?: number;
	solarPathNightDepth?: number;
	solarPathAzimuthStart?: number;
	solarPathAzimuthEnd?: number;
	enableSolarVisual?: boolean;
	solarVisualSunriseSize?: number;
	solarVisualNoonSize?: number;
	solarVisualSunsetSize?: number;
	solarVisualMoonSize?: number;
	solarVisualSunriseColor?: string;
	solarVisualNoonColor?: string;
	solarVisualSunsetColor?: string;
	solarVisualMoonColor?: string;
	lightMode?: string;
	shadowQuality?: string;
	enableDayNightCycle?: boolean;
	timeOfDay?: number;
	cycleSpeed?: number;
	sunIntensity?: number;
	sunColor?: string;
	ambientIntensity?: number;
	ambientColor?: string;
	enableSunLight?: boolean;
	enableAmbientLight?: boolean;
	environmentIntensity?: number;
	backgroundIntensity?: number;
	backgroundBlurriness?: number;
	skyboxRotation?: number;
	enableSkyboxFog?: boolean;
	enableVisibleSun?: boolean;
	visibleSunSize?: number;
	visibleSunIntensity?: number;
	transitionMode?: "procedural" | "instant";
	fogColor?: string;
	fogNear?: number;
	fogFar?: number;
	fogDensity?: number;
	skyTurbidity?: number;
	skyRayleigh?: number;
	skyMieCoefficient?: number;
	skyMieDirectionalG?: number;
	dayNightTimeline?: import("../platform/timelineDefaults").TimelineKeyframe[];
	dayNightProfiles?: DayNightProfile[];
	activeTimelineProfileId?: string;
	selectedEnvironmentStateId?: string | null;
	isCycleSimulating?: boolean;
}

export interface MainBootstrapOptions {
	mode?: GameMode;
	roomId?: string | null;
}

export interface ClientInitState {
	mode: GameMode;
	roomId: string | null;
}
