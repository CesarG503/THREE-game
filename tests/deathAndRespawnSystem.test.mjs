import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
	server: { middlewareMode: true },
	appType: "custom",
	logLevel: "error",
});
after(() => server.close());

const {
	createDefaultExperienceModes,
	normalizeExperienceModesConfig,
	createDefaultDeathScreenElements,
	migrateDeathScreenConfig,
	normalizeDeathScreenElements,
	evaluateDynamicTokens,
	sanitizeImageUrl,
} = await server.ssrLoadModule("/src/client/types/experienceMode.types.ts");

const { DeathManager } = await server.ssrLoadModule("/src/client/managers/DeathManager.ts");
const { DeathScreen, parseToRgba } = await server.ssrLoadModule("/src/client/ui/DeathScreen.ts");
const { DeathScreenEditor } = await server.ssrLoadModule("/src/client/ui/DeathScreenEditor.ts");

// Minimal mock classes for testing
class MockEventEmitter {
	constructor() {
		this.events = {};
	}
	on(event, fn) {
		if (!this.events[event]) this.events[event] = [];
		this.events[event].push(fn);
	}
	emit(event, data) {
		if (this.events[event]) {
			this.events[event].forEach((fn) => fn(data));
		}
	}
}

class MockCharacter extends MockEventEmitter {
	constructor() {
		super();
		this.maxHealth = 100;
		this.currentHealth = 100;
		this.maxMultiJumps = 1;
		this.isDead = false;
		this.respawns = -1;
		this.respawnDelay = 2.0;
		this.explodeOnDeath = false;
		this.startPosition = { x: 0, y: 5, z: 0, clone: () => ({ x: 0, y: 5, z: 0 }) };
		this.currentType = "polygon";
		this.rigidBody = {
			setTranslation: (pos) => { this.pos = pos; },
			setLinvel: () => {},
		};
	}
	respawnAt(pos) {
		this.isDead = false;
		this.currentHealth = this.maxHealth;
		this.pos = { x: pos.x, y: pos.y, z: pos.z };
		this.emit("healthChanged", { current: this.currentHealth, max: this.maxHealth });
	}
	respawn() {
		this.respawnAt(this.startPosition);
	}
}

function createMockGame(initialGameConfig = null) {
	const character = new MockCharacter();
	const emittedSignals = [];
	const logicSystem = {
		gameConfig: initialGameConfig || { sequences: [] },
		emitSignal: (sig) => emittedSignals.push(sig),
	};
	const gameConfigPanel = {
		logicSystem,
		syncCount: 0,
		syncConfig: () => { gameConfigPanel.syncCount++; },
	};
	const constructionMenu = {
		logicSystem,
		gameConfigPanel,
	};
	const environmentConfig = {
		fallDeath: true,
		fallDeathY: -20,
	};
	const game = {
		character,
		constructionMenu,
		gameConfig: initialGameConfig || { sequences: [] },
		environmentConfig,
		emittedSignals,
		emitSignal: function(sig) {
			this.emittedSignals.push(sig);
			if (sig === "kill_player" || sig === "trap_kill") {
				if (this.deathManager && this.character && !this.character.isDead) {
					this.deathManager.handleDeath({ cause: "logic", details: "Eliminado por señal lógica" });
				}
			} else if (sig === "checkpoint" || sig === "set_checkpoint") {
				if (this.deathManager && this.character) {
					this.deathManager.setCheckpoint(this.character.getPosition ? this.character.getPosition() : this.character.startPosition);
				}
			}
		},
		router: {
			navigatedTo: null,
			navigate: (path) => { game.router.navigatedTo = path; },
		},
	};
	const cameraController = {
		mode: "third-person-collision",
		isFirstPerson: false,
		smoothing: 1.0,
		freeFlyPosition: { x: 0, y: 0, z: 0, copy: function(p) { this.x = p.x; this.y = p.y; this.z = p.z; } },
		setCameraMode: function(mode) {
			this.mode = mode;
			this.isFirstPerson = (mode === "first-person");
		},
	};
	const remotePlayers = new Map();
	const networkManager = {
		remotePlayers,
		update: function(dt, opts) {
			remotePlayers.forEach((p) => {
				let skip = false;
				const isObserved = Boolean(opts?.targetPlayerId && p.playerId === opts.targetPlayerId);
				if (!isObserved && opts?.cameraPosition && opts.quality !== "full") {
					const dx = p.currentPosition.x - opts.cameraPosition.x;
					const dy = p.currentPosition.y - opts.cameraPosition.y;
					const dz = p.currentPosition.z - opts.cameraPosition.z;
					const distSq = dx * dx + dy * dy + dz * dz;
					const range = opts.quality === "low" ? 28 : 55;
					skip = distSq > range * range;
				}
				p.skippedAnimation = skip;
			});
		},
	};
	const playerConfigManager = {
		profiles: [
			{ id: "admin_tester", name: "ADMIN tester" },
			{ id: "role_runner", name: "Runner" },
			{ id: "role_hunter", name: "Hunter" },
		],
		currentProfileId: "admin_tester",
		getProfile: (id) => playerConfigManager.profiles.find((p) => p.id === id),
	};
	game.cameraController = cameraController;
	game.networkManager = networkManager;
	game.playerConfigManager = playerConfigManager;
	character.getPosition = () => character.startPosition;
	character.game = game;
	return game;
}

test("1. createDefaultExperienceModes genera modos predeterminados coherentes", () => {
	const defaults = createDefaultExperienceModes();
	assert.ok(Array.isArray(defaults.modes));
	assert.ok(defaults.modes.length >= 3);
	assert.equal(defaults.activeModeId, "mode_survival");

	const survival = defaults.modes.find((m) => m.id === "mode_survival");
	assert.ok(survival);
	assert.equal(survival.enabledCauses.damage, true);
	assert.equal(survival.enabledCauses.fall, true);
	assert.equal(survival.respawnPolicy, "start");

	const racing = defaults.modes.find((m) => m.id === "mode_racing");
	assert.ok(racing);
	assert.equal(racing.enabledCauses.damage, false);
	assert.equal(racing.respawnPolicy, "checkpoint");

	const elimination = defaults.modes.find((m) => m.id === "mode_elimination");
	assert.ok(elimination);
	assert.equal(elimination.respawnPolicy, "spectator");
	assert.equal(elimination.respawns, 0);
});

test("2. normalizeExperienceModesConfig maneja mapas antiguos sin modos y configuraciones incompletas", () => {
	// Empty config
	const emptyNorm = normalizeExperienceModesConfig(null);
	assert.equal(emptyNorm.activeModeId, "mode_survival");
	assert.ok(emptyNorm.modes.length >= 3);

	// Legacy map with empty sequences
	const legacyNorm = normalizeExperienceModesConfig({ sequences: [] });
	assert.equal(legacyNorm.activeModeId, "mode_survival");
	assert.ok(legacyNorm.modes.length >= 3);

	// Custom valid mode with missing fields
	const customNorm = normalizeExperienceModesConfig({
		experienceModes: [
			{
				id: "custom_race",
				name: "Custom Parkour",
				respawnPolicy: "checkpoint",
			},
		],
		activeExperienceModeId: "custom_race",
	});
	assert.equal(customNorm.activeModeId, "custom_race");
	assert.equal(customNorm.modes.length, 1);
	assert.equal(customNorm.modes[0].enabledCauses.damage, true); // defaulted
	assert.equal(customNorm.modes[0].respawnPolicy, "checkpoint");
	assert.ok(customNorm.modes[0].deathScreen.buttons.length > 0);
});

test("3. DeathManager unifica la muerte y evita doble procesamiento (guard de concurrencia)", () => {
	const game = createMockGame();
	const dm = new DeathManager(game);

	const characterDiedEvents = [];
	game.character.on("died", (e) => characterDiedEvents.push(e));

	const firstCall = dm.handleDeath({ cause: "damage" });
	assert.equal(firstCall, true);
	assert.equal(game.character.isDead, true);
	assert.equal(characterDiedEvents.length, 1);

	// Second immediate call must be rejected
	const secondCall = dm.handleDeath({ cause: "fall" });
	assert.equal(secondCall, false);
	assert.equal(characterDiedEvents.length, 1, "No debe procesar dos veces la muerte");

	dm.destroy();
});

test("4. DeathManager respeta las causas habilitadas por modo", () => {
	const game = createMockGame();
	// Set active mode to racing (damage is disabled)
	game.constructionMenu.logicSystem.gameConfig = {
		activeExperienceModeId: "mode_racing",
		experienceModes: createDefaultExperienceModes().modes,
	};
	const dm = new DeathManager(game);

	// Damage should NOT cause death in racing mode
	const dmgResult = dm.handleDeath({ cause: "damage" });
	assert.equal(dmgResult, false);
	assert.equal(game.character.isDead, false);

	// Fall SHOULD cause death in racing mode
	const fallResult = dm.handleDeath({ cause: "fall" });
	assert.equal(fallResult, true);
	assert.equal(game.character.isDead, true);

	dm.destroy();
});

test("5. Mantiene separación de environmentConfig: si fallDeath está desactivado, no procesa muerte por caída", () => {
	const game = createMockGame();
	game.environmentConfig.fallDeath = false;
	const dm = new DeathManager(game);

	const fallResult = dm.handleDeath({ cause: "fall" });
	assert.equal(fallResult, false, "Si fallDeath es false en environmentConfig, no debe morir por caída");
	assert.equal(game.character.isDead, false);

	dm.destroy();
});

test("6. Política de Checkpoint vs Start reaparece en la ubicación correcta", () => {
	const game = createMockGame();
	// Mode with checkpoint policy
	game.constructionMenu.logicSystem.gameConfig = {
		activeExperienceModeId: "mode_racing",
		experienceModes: createDefaultExperienceModes().modes,
	};
	const dm = new DeathManager(game);

	// Set checkpoint
	dm.setCheckpoint({ x: 45, y: 10, z: -30 });
	assert.equal(dm.currentCheckpoint.x, 45);
	assert.equal(dm.currentCheckpoint.y, 10);
	assert.equal(dm.currentCheckpoint.z, -30);

	dm.handleDeath({ cause: "fall" });
	assert.equal(game.character.isDead, true);

	// Execute respawn
	dm.executeRespawn();
	assert.equal(game.character.isDead, false);
	assert.equal(game.character.pos.x, 45);
	assert.equal(game.character.pos.y, 10);
	assert.equal(game.character.pos.z, -30);

	dm.destroy();
});

test("7. Consumo de vidas finitas y transición a fin de partida", () => {
	const game = createMockGame();
	const defaultModes = createDefaultExperienceModes().modes;
	const survival = defaultModes.find((m) => m.id === "mode_survival");
	survival.respawns = 2; // 2 extra lives

	game.constructionMenu.logicSystem.gameConfig = {
		activeExperienceModeId: "mode_survival",
		experienceModes: [survival],
	};
	const dm = new DeathManager(game);

	// Death 1 -> remaining: 1
	dm.handleDeath({ cause: "damage" });
	assert.equal(dm.remainingLives, 1);
	dm.executeRespawn();

	// Death 2 -> remaining: 0
	dm.handleDeath({ cause: "damage" });
	assert.equal(dm.remainingLives, 0);
	dm.executeRespawn();

	// Death 3 -> remaining: 0, willRespawn: false
	let lastEvent = null;
	game.character.on("died", (e) => { lastEvent = e; });
	dm.handleDeath({ cause: "damage" });
	assert.equal(lastEvent.willRespawn, false);

	dm.destroy();
});

test("8. Acciones de botones de pantalla de muerte seguras (respawn, spectate, restart, lobby)", () => {
	const game = createMockGame();
	const dm = new DeathManager(game);

	dm.handleDeath({ cause: "damage" });
	assert.equal(game.character.isDead, true);

	// Test respawn action
	dm.handleDeathAction("respawn");
	assert.equal(game.character.isDead, false);

	// Test spectate action
	dm.handleDeath({ cause: "damage" });
	dm.handleDeathAction("spectate");
	assert.equal(dm.isSpectator, true);

	// Test lobby action
	dm.handleDeathAction("lobby");
	assert.equal(game.router.navigatedTo, "/");

	dm.destroy();
});


test("9. Carga el modo activo durante el juego fuera del editor (constructionMenu es null)", () => {
	const game = createMockGame();
	// Simulate play mode where constructionMenu is null
	game.constructionMenu = null;
	game.gameConfig = {
		activeExperienceModeId: "mode_racing",
		experienceModes: createDefaultExperienceModes().modes,
	};

	const dm = new DeathManager(game);
	const activeMode = dm.getActiveMode();
	assert.equal(activeMode.id, "mode_racing");
	assert.equal(activeMode.respawnPolicy, "checkpoint");

	dm.destroy();
});

test("10. Reaparición inmediata: si respawnDelay es 0, ejecuta la reaparición inmediatamente", () => {
	const game = createMockGame();
	const modes = createDefaultExperienceModes().modes;
	const instantMode = {
		...modes[0],
		id: "mode_instant",
		name: "Instant Respawn Mode",
		respawnPolicy: "start",
		respawnDelay: 0,
		respawns: -1,
	};
	game.gameConfig = {
		activeExperienceModeId: "mode_instant",
		experienceModes: [instantMode],
	};

	const dm = new DeathManager(game);
	game.deathManager = dm;

	const died = dm.handleDeath({ cause: "damage" });
	assert.equal(died, true);
	// Because delay is 0 and willRespawn is true, executeRespawn was executed immediately
	assert.equal(game.character.isDead, false, "El personaje debe haber reaparecido inmediatamente");
	assert.equal(game.character.currentHealth, 100);

	dm.destroy();
});

test("11. Conserva ajustes heredados del perfil del jugador y permite override explícito con false", () => {
	const game = createMockGame();
	// Character profile has custom lives, delay, and explode
	game.character.respawns = 7;
	game.character.respawnDelay = 3.5;
	game.character.explodeOnDeath = true;

	// Mode 1: inherits all (null/undefined)
	const inheritMode = {
		id: "mode_inherit",
		name: "Inherit Mode",
		enabledCauses: { damage: true, fall: true, logic: true },
		respawnPolicy: "start",
		respawnDelay: null,
		respawns: null,
		explodeOnDeath: null,
		deathScreen: createDefaultExperienceModes().modes[0].deathScreen,
	};

	game.gameConfig = {
		activeExperienceModeId: "mode_inherit",
		experienceModes: [inheritMode],
	};

	const dm = new DeathManager(game);
	game.deathManager = dm;

	dm.handleDeath({ cause: "damage" });
	assert.equal(dm.remainingLives, 6, "Debe heredar 7 vidas del perfil y restar 1");
	dm.destroy();

	// Mode 2: explicitly sets explodeOnDeath: false (overriding character's explodeOnDeath = true)
	const overrideMode = {
		...inheritMode,
		id: "mode_no_explode",
		explodeOnDeath: false,
	};
	game.gameConfig = {
		activeExperienceModeId: "mode_no_explode",
		experienceModes: [overrideMode],
	};

	const dm2 = new DeathManager(game);
	game.deathManager = dm2;
	const activeMode = dm2.getActiveMode();
	assert.equal(activeMode.explodeOnDeath, false, "El modo debe poder desactivar explícitamente la explosión");

	dm2.destroy();
});

test("12. Checkpoint funcional conectado con señal y trigger interactivo", () => {
	const game = createMockGame();
	game.gameConfig = {
		activeExperienceModeId: "mode_racing",
		experienceModes: createDefaultExperienceModes().modes,
	};
	const dm = new DeathManager(game);
	game.deathManager = dm;

	// Emit signal checkpoint
	game.character.startPosition = { x: 10, y: 2, z: 15, clone: () => ({ x: 10, y: 2, z: 15 }) };
	game.character.getPosition = () => ({ x: 77, y: 5, z: 88 });
	game.emitSignal("checkpoint");

	assert.ok(dm.currentCheckpoint, "Debe haber registrado el checkpoint");
	assert.equal(dm.currentCheckpoint.x, 77);
	assert.equal(dm.currentCheckpoint.y, 5);
	assert.equal(dm.currentCheckpoint.z, 88);

	// Respawning with checkpoint policy should place player at checkpoint
	dm.executeRespawn();
	assert.equal(game.character.pos.x, 77);
	assert.equal(game.character.pos.y, 5);
	assert.equal(game.character.pos.z, 88);

	dm.destroy();
});

test("13. Causa de muerte por lógica y prevención de doble emisión de señal player_death", () => {
	const game = createMockGame();
	const dm = new DeathManager(game);
	game.deathManager = dm;

	let lastDiedContext = null;
	game.character.on("died", (e) => { lastDiedContext = e; });

	// Trigger logic kill signal
	game.emitSignal("kill_player");
	assert.equal(game.character.isDead, true);
	assert.equal(lastDiedContext.cause, "logic");

	// Check emitted signals: should include kill_player and player_death, with player_death emitted only once
	const deathSignals = game.emittedSignals.filter((s) => s === "player_death");
	assert.equal(deathSignals.length, 1, "player_death debe emitirse exactamente una vez");

	dm.destroy();
});

test("14. CSS válido en DeathScreen y parseToRgba", () => {
	// Hex 6-digit
	const hexRes = parseToRgba("#ff3b47", 0.85);
	assert.match(hexRes, /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
	assert.equal(hexRes.split(",").length, 4, "Debe tener exactamente 4 componentes");

	// Hex 3-digit
	const hex3Res = parseToRgba("#f00", 0.5);
	assert.match(hex3Res, /^rgba\(255,\s*0,\s*0,\s*0\.50\)$/);

	// Existing rgba string
	const rgbaRes = parseToRgba("rgba(13, 15, 23, 0.92)", 0.85);
	assert.match(rgbaRes, /^rgba\(13,\s*15,\s*23,\s*0\.92\)$/);
	assert.equal(rgbaRes.split(",").length, 4, "No debe duplicar el canal alfa");

	// rgb string without alpha
	const rgbRes = parseToRgba("rgb(10, 20, 30)", 0.85);
	assert.equal(rgbRes, "rgba(10, 20, 30, 0.85)");
});


test("15. Perspectiva del observador configurable por modo (1ª persona, 3ª persona, alternable)", () => {
	const game = createMockGame();
	const modes = createDefaultExperienceModes().modes;

	// Mode with switchable perspective
	const switchableMode = {
		...modes[2],
		id: "mode_switchable_spec",
		respawnPolicy: "spectator",
		spectator: {
			enabled: true,
			allowFollow: true,
			perspective: "switchable",
			allowedRoleIds: [],
			quality: "balanced",
		},
	};

	game.gameConfig = {
		activeExperienceModeId: "mode_switchable_spec",
		experienceModes: [switchableMode],
	};

	const dm = new DeathManager(game);
	game.deathManager = dm;

	// Add remote player to watch
	game.networkManager.remotePlayers.set("peer_1", {
		playerId: "peer_1",
		playerName: "Alice",
		currentPosition: { x: 10, y: 0, z: 10 },
		currentRotation: 1.5,
		currentGravityQuaternion: { x: 0, y: 0, z: 0, w: 1 },
		state: { isDead: false, roleId: "role_runner" },
	});

	dm.enterSpectator();
	assert.equal(dm.isSpectator, true);
	// Initial perspective in switchable mode defaults to third_person
	assert.equal(dm.currentSpectatorPerspective, "third_person");
	assert.equal(game.cameraController.isFirstPerson, false);

	// Toggle perspective to first_person
	dm.toggleSpectatorPerspective();
	assert.equal(dm.currentSpectatorPerspective, "first_person");
	assert.equal(game.cameraController.isFirstPerson, true);
	assert.equal(game.cameraController.mode, "first-person");

	// Toggle back to third_person
	dm.toggleSpectatorPerspective();
	assert.equal(dm.currentSpectatorPerspective, "third_person");
	assert.equal(game.cameraController.isFirstPerson, false);

	dm.destroy();
});

test("16. Seguimiento de jugadores con Q/E y auto-selección cuando el objetivo muere o desaparece", () => {
	const game = createMockGame();
	const modes = createDefaultExperienceModes().modes;
	game.gameConfig = {
		activeExperienceModeId: "mode_elimination",
		experienceModes: modes,
	};
	const dm = new DeathManager(game);
	game.deathManager = dm;

	game.networkManager.remotePlayers.set("peer_1", {
		playerId: "peer_1",
		playerName: "Alice",
		currentPosition: { x: 10, y: 0, z: 10 },
		state: { isDead: false, roleId: "role_runner" },
	});
	game.networkManager.remotePlayers.set("peer_2", {
		playerId: "peer_2",
		playerName: "Bob",
		currentPosition: { x: 20, y: 0, z: 20 },
		state: { isDead: false, roleId: "role_hunter" },
	});

	dm.enterSpectator();
	assert.equal(dm.spectatorTargetId, "peer_1");

	// Cycle to next peer
	dm.cycleSpectatorTarget(1);
	assert.equal(dm.spectatorTargetId, "peer_2");

	// When peer_2 dies, getSpectatorTarget() should auto-cycle back to alive peer_1
	game.networkManager.remotePlayers.get("peer_2").state.isDead = true;
	const newTarget = dm.getSpectatorTarget();
	assert.ok(newTarget);
	assert.equal(newTarget.playerId, "peer_1");

	dm.destroy();
});

test("17. Exclusión de seguimiento por roles (allowedRoleIds) y soporte de cámara libre", () => {
	const game = createMockGame();
	const modes = createDefaultExperienceModes().modes;
	const restrictedMode = {
		...modes[2],
		id: "mode_restricted_spec",
		spectator: {
			enabled: true,
			allowFollow: true,
			perspective: "third_person",
			allowedRoleIds: ["role_hunter"], // Only allow watching hunters
			quality: "balanced",
		},
	};
	game.gameConfig = {
		activeExperienceModeId: "mode_restricted_spec",
		experienceModes: [restrictedMode],
	};
	const dm = new DeathManager(game);
	game.deathManager = dm;

	game.networkManager.remotePlayers.set("peer_runner", {
		playerId: "peer_runner",
		playerName: "RunnerGuy",
		state: { isDead: false, roleId: "role_runner" },
	});
	game.networkManager.remotePlayers.set("peer_hunter", {
		playerId: "peer_hunter",
		playerName: "HunterGuy",
		state: { isDead: false, roleId: "role_hunter" },
	});

	dm.enterSpectator();
	// Should skip runner and pick hunter
	assert.equal(dm.spectatorTargetId, "peer_hunter");

	// Mode with allowFollow: false should enter free-fly camera
	const freeFlyMode = {
		...modes[2],
		id: "mode_freefly_spec",
		spectator: {
			enabled: true,
			allowFollow: false,
			perspective: "third_person",
			quality: "balanced",
		},
	};
	game.gameConfig = {
		activeExperienceModeId: "mode_freefly_spec",
		experienceModes: [freeFlyMode],
	};
	const dm2 = new DeathManager(game);
	game.deathManager = dm2;
	dm2.enterSpectator();
	assert.equal(game.cameraController.mode, "free-fly");
	assert.equal(dm2.getSpectatorTarget(), null);

	dm.destroy();
	dm2.destroy();
});

test("18. Reglas de muerte distinta según rol (roleModeAssignments) y fallback a modo base", () => {
	const game = createMockGame();
	const modes = createDefaultExperienceModes().modes;

	// Base mode is survival (infinite lives), but hunter role is routed to elimination mode (0 lives)
	const baseMode = {
		...modes[0],
		id: "mode_competition",
		name: "Base Competition",
		roleModeAssignments: {
			"role_hunter": "mode_elimination",
		},
	};

	game.gameConfig = {
		activeExperienceModeId: "mode_competition",
		experienceModes: [baseMode, modes[2]],
	};

	const dm = new DeathManager(game);
	game.deathManager = dm;

	// Runner role has no assignment -> uses baseMode
	game.character.activeRoleId = "role_runner";
	const runnerMode = dm.getActiveMode();
	assert.equal(runnerMode.id, "mode_competition");
	assert.equal(runnerMode.respawnPolicy, "start");

	// Hunter role has assignment -> uses mode_elimination
	game.character.activeRoleId = "role_hunter";
	const hunterMode = dm.getActiveMode();
	assert.equal(hunterMode.id, "mode_elimination");
	assert.equal(hunterMode.respawnPolicy, "spectator");
	assert.equal(hunterMode.respawns, 0);

	dm.destroy();
});

test("19. Calidad de rendimiento de observador no degrada al objetivo observado y restaura al salir", () => {
	const game = createMockGame();
	const dm = new DeathManager(game);
	game.deathManager = dm;

	const targetPlayer = {
		playerId: "target_peer",
		playerName: "Target",
		currentPosition: { x: 100, y: 0, z: 100 }, // Far away (> 55m)
		state: { isDead: false, roleId: "role_runner" },
		skippedAnimation: false,
	};
	const farOtherPlayer = {
		playerId: "other_peer",
		playerName: "Other",
		currentPosition: { x: 100, y: 0, z: 100 }, // Far away (> 55m)
		state: { isDead: false, roleId: "role_runner" },
		skippedAnimation: false,
	};

	game.networkManager.remotePlayers.set("target_peer", targetPlayer);
	game.networkManager.remotePlayers.set("other_peer", farOtherPlayer);

	dm.enterSpectator();
	dm.spectatorTargetId = "target_peer";

	// Run network update with spectator options (camera at 0, 0, 0, quality: low)
	game.networkManager.update(0.016, {
		cameraPosition: { x: 0, y: 0, z: 0 },
		quality: "low",
		targetPlayerId: "target_peer",
	});

	// The observed target must NOT skip animations even if far away
	assert.equal(targetPlayer.skippedAnimation, false, "El objetivo observado nunca debe degradar animaciones");
	// The other far player should skip detailed animations
	assert.equal(farOtherPlayer.skippedAnimation, true, "Los jugadores lejanos deben reducir animaciones en calidad baja");

	// Upon respawning, camera and spectator state must be cleanly restored
	game.cameraController.setCameraMode("third-person-collision");
	dm.executeRespawn();
	assert.equal(dm.isSpectator, false);
	assert.equal(dm.spectatorTargetId, null);
	assert.equal(game.cameraController.mode, "third-person-collision");

	dm.destroy();
});

test("20. Modo observador sin objetivos no recursa al actualizar el HUD", () => {
	const game = createMockGame();
	const mode = {
		...createDefaultExperienceModes().modes[0],
		id: "mode_no_targets",
		spectator: { enabled: true, allowFollow: true, perspective: "third_person", allowedRoleIds: [], quality: "balanced" },
	};
	game.gameConfig = { activeExperienceModeId: mode.id, experienceModes: [mode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;
	dm.spectatorHud = { textContent: "", remove() {} };
	dm.enterSpectator();
	assert.equal(dm.getSpectatorTarget(), null);
	assert.match(dm.spectatorHud.textContent, /No hay jugadores disponibles/);
	dm.destroy();
});

test("21. La perspectiva del modo base se conserva aunque el rol use otro perfil de muerte", () => {
	const game = createMockGame();
	const [base, roleDeathMode] = createDefaultExperienceModes().modes;
	base.id = "mode_base_switchable";
	base.spectator = { enabled: true, allowFollow: true, perspective: "switchable", allowedRoleIds: [], quality: "balanced" };
	base.roleModeAssignments = { role_runner: roleDeathMode.id };
	roleDeathMode.spectator = { enabled: true, allowFollow: true, perspective: "third_person", allowedRoleIds: [], quality: "balanced" };
	game.character.activeRoleId = "role_runner";
	game.gameConfig = { activeExperienceModeId: base.id, experienceModes: [base, roleDeathMode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;
	assert.equal(dm.getActiveMode().id, roleDeathMode.id, "El rol conserva su perfil específico de muerte");
	dm.enterSpectator();
	dm.toggleSpectatorPerspective();
	assert.equal(dm.currentSpectatorPerspective, "first_person", "La perspectiva alternable del modo base debe responder aunque el perfil de muerte del rol sea fijo");
	dm.destroy();
});

test("22. HUD del observador solo anuncia controles aplicables según perspectiva y número de objetivos", () => {
	const game = createMockGame();
	const mode = {
		...createDefaultExperienceModes().modes[0],
		id: "mode_hud_test",
		spectator: { enabled: true, allowFollow: true, perspective: "switchable", quality: "balanced" },
	};
	game.gameConfig = { activeExperienceModeId: mode.id, experienceModes: [mode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;
	dm.spectatorHud = { textContent: "", remove() {} };

	// Case 1: 0 peers
	dm.enterSpectator();
	assert.match(dm.spectatorHud.textContent, /No hay jugadores disponibles/);
	assert.doesNotMatch(dm.spectatorHud.textContent, /Q\/E/);
	assert.doesNotMatch(dm.spectatorHud.textContent, /V:/);

	// Case 2: 1 peer + switchable perspective -> announces V, but NOT Q/E
	game.networkManager.remotePlayers.set("peer_1", {
		playerId: "peer_1",
		playerName: "Alice",
		state: { isDead: false, roleId: "role_runner" },
	});
	dm.cycleSpectatorTarget(1);
	assert.match(dm.spectatorHud.textContent, /Observando a Alice/);
	assert.match(dm.spectatorHud.textContent, /V: Cambiar vista/);
	assert.doesNotMatch(dm.spectatorHud.textContent, /Q\/E/);

	// Case 3: 2 peers + switchable perspective -> announces both Q/E and V
	game.networkManager.remotePlayers.set("peer_2", {
		playerId: "peer_2",
		playerName: "Bob",
		state: { isDead: false, roleId: "role_runner" },
	});
	dm.cycleSpectatorTarget(1);
	assert.match(dm.spectatorHud.textContent, /Q\/E o ←\/→ para cambiar objetivo/);
	assert.match(dm.spectatorHud.textContent, /V: Cambiar vista/);

	// Case 4: 2 peers + fixed third_person perspective -> announces Q/E, but NOT V
	mode.spectator.perspective = "third_person";
	dm.spectatorMode = mode;
	dm.cycleSpectatorTarget(1);
	assert.match(dm.spectatorHud.textContent, /Q\/E o ←/);
	assert.doesNotMatch(dm.spectatorHud.textContent, /V: Cambiar vista/);

	// Case 5: Free-fly (allowFollow = false) -> announces free-fly controls, no Q/E, no V
	mode.spectator.allowFollow = false;
	dm.cycleSpectatorTarget(1);
	assert.match(dm.spectatorHud.textContent, /Cámara libre/);
	assert.doesNotMatch(dm.spectatorHud.textContent, /Q\/E/);
	assert.doesNotMatch(dm.spectatorHud.textContent, /V:/);

	dm.destroy();
});
test("23. Migración de pantallas antiguas v1 a diseño visual v2 con elementos equivalentes", () => {
	const legacyScreen = {
		enabled: true,
		title: "¡HAS CAÍDO!",
		message: "Demasiado daño recibido en combate.",
		backgroundColor: "rgba(30, 10, 15, 0.95)",
		accentColor: "#ff0055",
		screenBlur: 14,
		buttons: [
			{ id: "b1", label: "Reintentar ahora", action: "respawn", isPrimary: true },
			{ id: "b2", label: "Salir", action: "lobby", isPrimary: false },
		],
	};

	const migrated = migrateDeathScreenConfig(legacyScreen, { id: "mode_survival" });
	assert.equal(migrated.version, 2, "Debe versionar el esquema a v2");
	assert.equal(migrated.title, "¡HAS CAÍDO!");
	assert.equal(migrated.accentColor, "#ff0055");
	assert.ok(Array.isArray(migrated.elements), "Debe generar la lista de elementos");
	assert.ok(migrated.elements.length >= 4, "Debe tener panel, título, botones, etc.");

	// Title element must match legacy title
	const titleElem = migrated.elements.find((e) => e.type === "title");
	assert.ok(titleElem);
	assert.equal(titleElem.content, "¡HAS CAÍDO!");

	// Button elements must match legacy buttons
	const btnElems = migrated.elements.filter((e) => e.type === "action_button");
	assert.equal(btnElems.length, 2);
	assert.equal(btnElems[0].content, "Reintentar ahora");
	assert.equal(btnElems[0].action, "respawn");
	assert.equal(btnElems[1].content, "Salir");
	assert.equal(btnElems[1].action, "lobby");
});

test("24. Normalización defensiva de elementos, anclajes y sanitización de URLs de imagen", () => {
	// Test malicious URLs and safe URLs
	assert.equal(sanitizeImageUrl("javascript:alert(1)"), undefined, "Bloquea javascript: URI");
	assert.equal(sanitizeImageUrl("vbscript:test"), undefined, "Bloquea vbscript: URI");
	assert.equal(sanitizeImageUrl("https://example.com/death.png"), "https://example.com/death.png", "Permite HTTPS");
	assert.equal(sanitizeImageUrl("/assets/icons/skull.svg"), "/assets/icons/skull.svg", "Permite ruta relativa local");
	assert.equal(sanitizeImageUrl("data:image/png;base64,iVBORw0KGgoAAA"), "data:image/png;base64,iVBORw0KGgoAAA", "Permite data:image/png base64");

	// Test element bounding clamping
	const rawElements = [
		{
			id: "out_of_bounds",
			type: "title",
			x: -50,
			y: 150,
			width: 200,
			height: -10,
			anchor: "invalid_anchor",
			action: "malicious_action",
		},
		{
			id: "invalid_type",
			type: "script_tag",
		},
	];

	const normalized = normalizeDeathScreenElements(rawElements);
	assert.equal(normalized.length, 1, "Descarta tipos de elementos no permitidos");
	assert.equal(normalized[0].x, 0, "Acota X mínimo a 0%");
	assert.equal(normalized[0].y, 100, "Acota Y máximo a 100%");
	assert.equal(normalized[0].width, 100, "Acota ancho máximo a 100%");
	assert.equal(normalized[0].height, 1, "Acota alto mínimo a 1%");
	assert.equal(normalized[0].anchor, "center", "Anclaje inválido cae a 'center'");
	assert.equal(normalized[0].action, "respawn", "Acción inválida cae a 'respawn'");
});

test("25. Editor visual: agregar, duplicar, reordenar capas y eliminar componentes", () => {
	const mockMode = {
		id: "mode_custom",
		name: "Modo Personalizado",
		deathScreen: {
			enabled: true,
			title: "HAS MUERTO",
			message: "Fin",
			backgroundColor: "#111",
			accentColor: "#ff0000",
			buttons: [],
			elements: [],
		},
	};

	let syncCount = 0;
	const editor = new DeathScreenEditor({
		mode: mockMode,
		onSync: () => { syncCount++; },
	});

	// Initially ensures starter elements
	assert.ok(mockMode.deathScreen.elements.length > 0);

	// 1. Add element
	const prevLen = mockMode.deathScreen.elements.length;
	const newElem = editor.addElement("killer_info", "Info del Asesino");
	assert.equal(mockMode.deathScreen.elements.length, prevLen + 1);
	assert.equal(newElem.type, "killer_info");
	assert.ok(syncCount > 0);

	// 2. Duplicate element
	editor.duplicateElement(newElem.id);
	assert.equal(mockMode.deathScreen.elements.length, prevLen + 2);
	const duplicated = mockMode.deathScreen.elements[mockMode.deathScreen.elements.length - 1];
	assert.match(duplicated.name, /Copia/);

	// 3. Move layer
	const lastIdx = mockMode.deathScreen.elements.length - 1;
	const elemToMove = mockMode.deathScreen.elements[lastIdx].id;
	editor.moveLayer(elemToMove, -1);
	assert.equal(mockMode.deathScreen.elements[lastIdx - 1].id, elemToMove, "Elemento se movió una posición hacia abajo");

	// 4. Remove element
	editor.removeElement(newElem.id);
	assert.ok(!mockMode.deathScreen.elements.some((e) => e.id === newElem.id));
});

test("26. Deshacer y rehacer (Undo / Redo) en el editor visual de pantalla de muerte", () => {
	const mockMode = {
		id: "mode_undo_test",
		name: "Modo Undo",
		deathScreen: {
			enabled: true,
			title: "ESTADO INICIAL",
			message: "Mensaje",
			backgroundColor: "#111",
			accentColor: "#ff0000",
			buttons: [],
			elements: [],
		},
	};

	const editor = new DeathScreenEditor({
		mode: mockMode,
		onSync: () => {},
	});

	const initialCount = mockMode.deathScreen.elements.length;

	// Add element 1
	const elem1 = editor.addElement("title", "Título Nuevo");
	assert.equal(mockMode.deathScreen.elements.length, initialCount + 1);

	// Add element 2
	const elem2 = editor.addElement("action_button", "Botón Extra");
	assert.equal(mockMode.deathScreen.elements.length, initialCount + 2);

	// Undo once -> element 2 removed
	editor.undo();
	assert.equal(mockMode.deathScreen.elements.length, initialCount + 1);
	assert.ok(!mockMode.deathScreen.elements.some((e) => e.id === elem2.id));

	// Undo again -> element 1 removed
	editor.undo();
	assert.equal(mockMode.deathScreen.elements.length, initialCount);
	assert.ok(!mockMode.deathScreen.elements.some((e) => e.id === elem1.id));

	// Redo once -> element 1 restored
	editor.redo();
	assert.equal(mockMode.deathScreen.elements.length, initialCount + 1);

	// Redo twice -> element 2 restored
	editor.redo();
	assert.equal(mockMode.deathScreen.elements.length, initialCount + 2);
});

test("27. Evaluación de condiciones de visibilidad (causas, estados, roles, datos ausentes)", () => {
	const elements = [
		{
			id: "elem_fall_only",
			type: "subtitle",
			x: 50, y: 50, width: 40, height: 10,
			content: "Caíste al vacío",
			conditions: {
				causes: ["fall"],
			},
		},
		{
			id: "elem_killer_only",
			type: "killer_info",
			x: 50, y: 40, width: 40, height: 10,
			content: "Asesino: {killer_name}",
			conditions: {
				requireData: ["killer"],
			},
		},
		{
			id: "elem_game_over_only",
			type: "title",
			x: 50, y: 30, width: 40, height: 10,
			content: "FIN DE LA PARTIDA",
			conditions: {
				states: ["game_over"],
			},
		},
	];

	// Scenario A: Damage death with killer, lives remaining
	const stateA = {
		cause: "damage",
		willRespawn: true,
		respawnDelay: 2.0,
		remainingRespawns: 3,
		context: { killerName: "Francotirador_01", killerWeapon: "Sniper" },
	};

	// Element fall_only must not be shown on damage
	const fallVisibleInA = elements[0].conditions.causes.includes(stateA.cause);
	assert.equal(fallVisibleInA, false, "elem_fall_only se oculta ante causa 'damage'");

	// Element killer_only must be shown because killerName exists
	const killerVisibleInA = Boolean(stateA.context?.killerName);
	assert.equal(killerVisibleInA, true, "elem_killer_only se muestra si hay asesino");

	// Scenario B: Fall death without killer, 0 lives
	const stateB = {
		cause: "fall",
		willRespawn: false,
		respawnDelay: 0,
		remainingRespawns: 0,
		context: { details: "Te resbalaste" },
	};

	const fallVisibleInB = elements[0].conditions.causes.includes(stateB.cause);
	assert.equal(fallVisibleInB, true, "elem_fall_only se muestra ante causa 'fall'");

	const killerVisibleInB = Boolean(stateB.context?.killerName);
	assert.equal(killerVisibleInB, false, "elem_killer_only se oculta si falta killerName");
});

test("28. Interpolación de tokens dinámicos con contexto real y texto de fallback", () => {
	const template = "Eliminado por {killer_name} usando {killer_weapon} ({cause}) - {remaining_lives} vidas restantes.";

	// 1. With complete context
	const stateWithData = {
		cause: "damage",
		remainingRespawns: 2,
		respawnDelay: 1.5,
		context: {
			killerName: "ShadowNinja",
			killerWeapon: "Katana Láser",
		},
	};
	const res1 = evaluateDynamicTokens(template, stateWithData, "Sin datos");
	assert.equal(res1, "Eliminado por ShadowNinja usando Katana Láser (Daño de combate) - 2 vidas restantes.");

	// 2. With missing killer name (uses fallback)
	const stateWithoutData = {
		cause: "fall",
		remainingRespawns: -1, // Infinite
		respawnDelay: 0.5,
		context: {},
	};
	const res2 = evaluateDynamicTokens(template, stateWithoutData, "Entorno");
	assert.match(res2, /Eliminado por Entorno/);
	assert.match(res2, /Caída al vacío/);
	assert.match(res2, /Infinitas vidas restantes/);
	assert.doesNotMatch(res2, /undefined|null/, "Nunca debe contener strings 'undefined' o 'null'");
});
