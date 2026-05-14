import { Router } from "./routing/Router";
import { Game } from "./Game";
import { renderLobby } from "./ui/LobbyScreen";
import type { GameMode } from "./types";

const router = new Router();
let game: Game | null = null;
let cleanupLobby: (() => void) | null = null;

const startGame = () => {
	if (game) return;
	if (cleanupLobby) {
		cleanupLobby();
		cleanupLobby = null;
	}
	game = new Game(router);
};

const generateRoomId = () => Math.random().toString(36).substring(2, 7).toUpperCase();

const handleRoute = (mode: GameMode) => {
	if (mode === "lobby") {
		if (!cleanupLobby) cleanupLobby = renderLobby(router);
		return;
	}
	if (!router.getRoomId()) {
		router.navigate(mode, generateRoomId());
		return;
	}
	startGame();
};

handleRoute(router.getMode());
router.onChange((route) => handleRoute(route.mode));
