import type { StoredAuthSession } from "./auth";

export const DEFAULT_POLYGON_SKIN_URL =
	"https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/entity/player/wide/steve.png";

const SKIN_STORAGE_KEY = "veta.selectedSkin";

export interface SelectedSkin {
	assetId: string | null;
	url: string;
	name?: string;
}

export function getSelectedSkin(auth: StoredAuthSession | null): SelectedSkin {
	const userId = auth?.user.id || "guest";
	const stored = readStore()[userId];
	if (stored?.url) return stored;
	return {
		assetId: null,
		url: DEFAULT_POLYGON_SKIN_URL,
		name: "Skin base",
	};
}

export function setSelectedSkin(auth: StoredAuthSession | null, skin: SelectedSkin): void {
	const userId = auth?.user.id || "guest";
	const store = readStore();
	store[userId] = {
		assetId: skin.assetId || null,
		url: skin.url || DEFAULT_POLYGON_SKIN_URL,
		name: skin.name || "Skin",
	};
	localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(store));
}

function readStore(): Record<string, SelectedSkin> {
	const raw = localStorage.getItem(SKIN_STORAGE_KEY);
	if (!raw) return {};

	try {
		const parsed = JSON.parse(raw) as Record<string, SelectedSkin>;
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}
