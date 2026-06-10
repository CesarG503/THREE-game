import { Router } from "./routing/Router";
import { Game } from "./Game";
import { renderLobby } from "./ui/LobbyScreen";
import { getStoredAuth, renderAuthScreen } from "./ui/AuthScreen";
import type { GameMode } from "./types";

const router = new Router();
let game: Game | null = null;
let activeGameKey: string | null = null;
let cleanupAuth: (() => void) | null = null;
let cleanupLobby: (() => void) | null = null;

const cleanupLobbyScreen = () => {
	if (cleanupLobby) {
		cleanupLobby();
		cleanupLobby = null;
	}
	document.getElementById("lobby-screen")?.remove();
};

const getGameKey = () => `${router.getMode()}:${router.getRoomId() || ""}`;

const stopGame = () => {
	if (game) {
		game.dispose();
		game = null;
	}
	activeGameKey = null;
};

const startGame = () => {
	cleanupLobbyScreen();
	const nextGameKey = getGameKey();
	if (game && activeGameKey === nextGameKey) return;

	stopGame();
	activeGameKey = nextGameKey;
	game = new Game(router);
};

const generateRoomId = () => Math.random().toString(36).substring(2, 7).toUpperCase();

const handleRoute = (mode: GameMode) => {
	if (cleanupAuth && mode !== "editor") {
		cleanupAuth();
		cleanupAuth = null;
	}

	if (mode === "lobby") {
		stopGame();
		if (!cleanupLobby) cleanupLobby = renderLobby(router);
		return;
	}

	cleanupLobbyScreen();

	if (mode === "editor" && !getStoredAuth()) {
		stopGame();
		if (!cleanupAuth) {
			cleanupAuth = renderAuthScreen(() => {
				if (cleanupAuth) {
					cleanupAuth();
					cleanupAuth = null;
				}
				handleRoute(router.getMode());
			}, {
				subtitle: "Necesitas una cuenta para crear y guardar mapas. Puedes jugar sin cuenta.",
				cancelText: "Jugar sin cuenta",
				onCancel: () => {
					if (cleanupAuth) {
						cleanupAuth();
						cleanupAuth = null;
					}
					router.navigate("play");
				},
			});
		}
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
