import { Router } from "./routing/Router";
import { Game } from "./Game";
import { renderLobby } from "./ui/LobbyScreen";
import { getStoredAuth, renderAuthScreen } from "./ui/AuthScreen";
import type { GameMode } from "./types";

const router = new Router();
let game: Game | null = null;
let isAuthenticated = Boolean(getStoredAuth());
let cleanupAuth: (() => void) | null = null;
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
	if (!isAuthenticated) {
		if (!cleanupAuth) {
			cleanupAuth = renderAuthScreen(() => {
				isAuthenticated = true;
				if (cleanupAuth) {
					cleanupAuth();
					cleanupAuth = null;
				}
				handleRoute(router.getMode());
			});
		}
		return;
	}

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
