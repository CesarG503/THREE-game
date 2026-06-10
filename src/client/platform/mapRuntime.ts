import { getMap, updateMap, type PlatformMap } from "./api";
export type { PlatformMap } from "./api";

export async function loadPlatformMapForRoom(roomId: string | null | undefined) {
	if (!roomId) return null;
	if (/^[A-Z0-9]{5}$/.test(roomId)) return null;

	try {
		return await getMap(roomId);
	} catch (err) {
		console.info(`[Maps] No saved map found for room "${roomId}"`, err);
		return null;
	}
}

export async function savePlatformMapForRoom(roomId: string | null | undefined, data: unknown) {
	if (!roomId) {
		throw new Error("No hay mapa activo para guardar");
	}

	return updateMap(roomId, {
		data,
		notes: "Guardado desde Editor Studio",
	});
}

export function getMapData(map: PlatformMap | null) {
	return map?.currentVersion?.data ?? null;
}
