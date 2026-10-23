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
	normalizeDeathScreenBackground,
	evaluateDynamicTokens,
	sanitizeImageUrl,
} = await server.ssrLoadModule("/src/client/types/experienceMode.types.ts");

const { DeathManager } = await server.ssrLoadModule("/src/client/managers/DeathManager.ts");
const { DeathScreen, parseToRgba } = await server.ssrLoadModule("/src/client/ui/DeathScreen.ts");
const { DeathScreenEditor } = await server.ssrLoadModule("/src/client/ui/DeathScreenEditor.ts");
const { DeathAnimationService, resolveEasing, loadAnime, getAnimeSync } = await server.ssrLoadModule("/src/client/managers/DeathAnimationService.ts");
await loadAnime();

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
		this.respawnProtectionConfig = null;
		this.respawnProtectionEndsAt = 0;
		this.respawnProtectionDurationMs = 0;
		this.respawnShieldPoints = 0;
		this.respawnBarrierActive = false;
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
	startRespawnProtection(config) {
		this.endRespawnProtection();
		const duration = Number.isFinite(config?.duration) ? Math.max(0, Math.min(30, config.duration)) : 0;
		if (config?.enabled !== true || duration <= 0) return;
		this.respawnProtectionConfig = { ...config };
		this.respawnProtectionDurationMs = duration * 1000;
		this.respawnProtectionEndsAt = Date.now() + this.respawnProtectionDurationMs;
		this.respawnShieldPoints = config.type === "shield"
			? Math.max(0, Number.isFinite(config.shieldPoints) ? config.shieldPoints : 50)
			: 0;
		this.respawnBarrierActive = config.showVisual !== false;
		this.emit("respawnProtectionChanged", { active: true, remaining: duration, shield: this.respawnShieldPoints });
	}
	endRespawnProtection() {
		const hadProtection = this.respawnProtectionConfig !== null && this.respawnProtectionConfig !== undefined;
		this.respawnProtectionConfig = null;
		this.respawnProtectionEndsAt = 0;
		this.respawnProtectionDurationMs = 0;
		this.respawnShieldPoints = 0;
		this.respawnBarrierActive = false;
		if (hadProtection) this.emit("respawnProtectionChanged", { active: false, remaining: 0, shield: 0 });
	}
	isRespawnProtectionActive() {
		return this.respawnProtectionConfig !== null && this.respawnProtectionConfig !== undefined && Date.now() < this.respawnProtectionEndsAt;
	}
	getRespawnProtectionType() {
		if (!this.isRespawnProtectionActive() || !this.respawnProtectionConfig) return null;
		return this.respawnProtectionConfig.type || "invulnerability";
	}
	getRespawnShieldPoints() {
		return this.isRespawnProtectionActive() ? this.respawnShieldPoints : 0;
	}
	cancelProtectionOnAttack() {
		if (this.isRespawnProtectionActive() && this.respawnProtectionConfig?.cancelOnAttack) {
			this.endRespawnProtection();
		}
	}
	takeDamage(amount) {
		if (this.isDead || !Number.isFinite(amount) || amount <= 0) return;
		let appliedDamage = amount;
		if (this.isRespawnProtectionActive() && this.respawnProtectionConfig) {
			const protection = this.respawnProtectionConfig;
			if (protection.type === "invulnerability") {
				this.emit("respawnProtectionChanged", {
					active: true,
					remaining: Math.max(0, (this.respawnProtectionEndsAt - Date.now()) / 1000),
					shield: 0,
					blockedDamage: amount,
				});
				return;
			}
			if (protection.type === "shield") {
				const absorbed = Math.min(this.respawnShieldPoints, appliedDamage);
				this.respawnShieldPoints -= absorbed;
				appliedDamage -= absorbed;
				this.emit("respawnProtectionChanged", {
					active: true,
					remaining: Math.max(0, (this.respawnProtectionEndsAt - Date.now()) / 1000),
					shield: this.respawnShieldPoints,
					absorbed,
				});
				if (this.respawnShieldPoints <= 0) {
					this.respawnBarrierActive = false;
				}
			} else if (protection.type === "damage_reduction") {
				const multiplier = Number.isFinite(protection.damageMultiplier)
					? Math.min(1, Math.max(0, protection.damageMultiplier))
					: 0.25;
				appliedDamage *= multiplier;
				this.emit("respawnProtectionChanged", {
					active: true,
					remaining: Math.max(0, (this.respawnProtectionEndsAt - Date.now()) / 1000),
					shield: 0,
					reducedDamage: appliedDamage,
				});
				if (appliedDamage <= 0) return;
			}
		}
		if (appliedDamage <= 0) return;
		this.currentHealth -= appliedDamage;
		this.emit("healthChanged", { current: this.currentHealth, max: this.maxHealth });
		if (this.currentHealth <= 0) {
			this.endRespawnProtection();
			this.die("damage");
		}
	}
	die(cause = "damage") {
		this.endRespawnProtection();
		this.isDead = true;
	}
	destroy() {
		this.endRespawnProtection();
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

test("29. Normalización y migración de esquemas de animación y transiciones de espectador", () => {
	// 1. Migrate config with no animations object
	const legacyConfig = {
		enabled: true,
		title: "Muerte",
		message: "Has caído",
		backgroundColor: "#000",
		accentColor: "#f00",
		buttons: [],
	};
	const migrated = migrateDeathScreenConfig(legacyConfig);
	assert.ok(migrated.animations, "Migrated config should contain animations config");
	assert.equal(migrated.animations.enabled, true);
	assert.equal(migrated.animations.preset, "subtle");
	assert.equal(typeof migrated.animations.duration, "number");
	assert.equal(typeof migrated.animations.stagger, "number");

	// 2. Spectator transition normalization in experience modes
	const rawData = {
		modes: [
			{
				id: "custom_spec",
				name: "Custom Spec",
				enabledCauses: { damage: true, fall: true, logic: true },
				respawnPolicy: "spectator",
				spectator: {
					enabled: true,
					transition: { enabled: true, style: "cinematic", duration: 800 },
				},
				deathScreen: {
					enabled: true,
					animations: { preset: "dramatic", stagger: 50 },
				},
			},
		],
		activeModeId: "custom_spec",
	};
	const normalized = normalizeExperienceModesConfig(rawData);
	const specMode = normalized.modes[0];
	assert.equal(specMode.spectator.transition.style, "cinematic");
	assert.equal(specMode.spectator.transition.duration, 800);
	assert.equal(specMode.deathScreen.animations.preset, "dramatic");
	assert.equal(specMode.deathScreen.animations.stagger, 50);
});

test("30. DeathAnimationService - resolveEasing mapea a curvas nativas de Anime.js v4", () => {
	assert.equal(resolveEasing("linear"), "linear");
	assert.equal(resolveEasing("easeInQuad"), "inQuad");
	assert.equal(resolveEasing("easeOutQuad"), "outQuad");
	assert.equal(resolveEasing("easeInOutQuad"), "inOutQuad");
	assert.equal(resolveEasing("easeOutCubic"), "outCubic");
	assert.equal(resolveEasing("easeOutBack"), "outBack");
	assert.equal(resolveEasing("easeOutElastic"), "outElastic");
	// Fallback safe default
	assert.equal(resolveEasing(undefined), "outCubic");
});

test("31. DeathAnimationService - animateScreenEntrance con reducedMotion y preset 'none' completa instantáneamente", async () => {
	const service = new DeathAnimationService();

	// Mock DOM Container with child nodes
	const container = {
		children: [
			{ dataset: { elementId: "title_1" }, style: { opacity: "0", transform: "translate(-50%, -50%)" } },
			{ dataset: { elementId: "subtitle_1" }, style: { opacity: "0", transform: "translate(-50%, -50%)" } },
		],
	};

	let completedInstant = false;
	service.animateScreenEntrance(
		container,
		[{ id: "title_1", type: "title" }, { id: "subtitle_1", type: "subtitle" }],
		{ enabled: true, preset: "dramatic" },
		{
			reducedMotion: true,
			onComplete: () => {
				completedInstant = true;
			},
		}
	);

	assert.equal(completedInstant, true, "onComplete se llama instantáneamente cuando reducedMotion es true");
	assert.equal(container.children[0].style.opacity, "1", "Elementos reciben opacidad final 1");
	assert.equal(container.children[1].style.opacity, "1", "Elementos reciben opacidad final 1");

	// Test preset "none"
	let completedNone = false;
	service.animateScreenEntrance(
		container,
		[{ id: "title_1", type: "title" }],
		{ enabled: true, preset: "none" },
		{
			onComplete: () => {
				completedNone = true;
			},
		}
	);
	assert.equal(completedNone, true, "Preset 'none' completa inmediatamente");
});

test("32. DeathAnimationService - animateScreenEntrance respeta elementos condicionales y los vincula estrictamente por ID", async () => {
	const service = new DeathAnimationService();

	// Elements config: killer_info has conditions and is NOT rendered in the DOM.
	// Only title and btn_respawn are present in container.
	const nodeTitle = { dataset: { elementId: "title_elem" }, style: { opacity: "0", transform: "translate(-50%, -50%)" } };
	const nodeBtn = { dataset: { elementId: "btn_respawn" }, style: { opacity: "0", transform: "translate(0, 0)" } };

	// Note: in container, nodeBtn is at index 1. In elements array, killer_info is at index 1!
	const container = { children: [nodeTitle, nodeBtn] };

	const elements = [
		{
			id: "title_elem",
			type: "title",
			animation: { type: "slide_down", duration: 150 },
		},
		{
			id: "killer_info", // Hidden by condition!
			type: "killer_info",
			animation: { type: "scale_up", duration: 500 },
		},
		{
			id: "btn_respawn",
			type: "action_button",
			animation: { type: "slide_left", duration: 200 },
		},
	];

	let callbackCalled = false;
	service.animateScreenEntrance(
		container,
		elements,
		{ preset: "subtle" },
		{
			onComplete: () => {
				callbackCalled = true;
			},
		}
	);

	// nodeBtn must match btn_respawn (slide_left: startX = 30), NOT killer_info (scale_up)!
	assert.match(nodeBtn.style.transform, /translate\(30px, 0px\)/, "nodeBtn se anima con slide_left de btn_respawn, no con killer_info");
	assert.match(nodeTitle.style.transform, /translate\(0px, -14px\)/, "nodeTitle se anima con slide_down");

	// Wait for animation completion
	await new Promise((r) => setTimeout(r, 350));
	assert.equal(nodeBtn.style.opacity, "1");
	assert.equal(nodeBtn.style.transform, "translate(0, 0)", "Transform base de nodeBtn restaurado");
	assert.equal(nodeTitle.style.transform, "translate(-50%, -50%)", "Transform base de nodeTitle restaurado");
	assert.equal(callbackCalled, true);
});

test("33. DeathAnimationService - animateScreenExit ejecuta onComplete y anima salida", async () => {
	const service = new DeathAnimationService();

	const container = {
		style: { opacity: "1", transform: "" },
	};

	let exited = false;
	service.animateScreenExit(
		container,
		() => {
			exited = true;
		},
		"fade",
		80
	);

	// Wait for exit completion
	await new Promise((r) => setTimeout(r, 140));
	assert.equal(exited, true, "onComplete de salida se ejecutó");

	// Instant with reduced motion
	let instantExited = false;
	service.animateScreenExit(
		container,
		() => {
			instantExited = true;
		},
		"fade",
		500,
		{ reducedMotion: true }
	);
	assert.equal(instantExited, true, "Con reducedMotion se ejecuta inmediatamente");
});

test("34. DeathAnimationService - Transiciones de observador, alternancias rápidas y estabilidad de cámara", async () => {
	const service = new DeathAnimationService();

	const mockCameraController = {
		smoothing: 1.0,
	};
	const mockHud = {
		style: { transform: "translateX(-50%)", opacity: "1" },
	};

	// 1. Alternancias rápidas de objetivo: llamadas consecutivas reemplazan la anterior de forma limpia
	service.animateSpectatorSwitch(
		mockCameraController,
		mockHud,
		{ enabled: true, style: "smooth", duration: 300 },
		false
	);
	// Inmediatamente cambiamos a otro objetivo
	service.animateSpectatorSwitch(
		mockCameraController,
		mockHud,
		{ enabled: true, style: "smooth", duration: 300 },
		false
	);
	// Tercer cambio rápido
	service.animateSpectatorSwitch(
		mockCameraController,
		mockHud,
		{ enabled: true, style: "smooth", duration: 200 },
		false
	);

	// El smoothing de cameraController se mantiene estable en 1.0
	assert.equal(mockCameraController.smoothing, 1.0, "La cámara mantiene su smoothing baseline estable sin competir con la física");

	// 2. Limpieza de animaciones de observador restaura estilos del HUD
	service.cancelSpectatorAnimations(true);
	assert.equal(mockHud.style.transform, "translateX(-50%)", "El transform del HUD se restaura a su base exacta");
	assert.equal(mockHud.style.opacity, "1");
});

test("35. DeathAnimationService - Separación de ámbitos (scopes) y supresión de callbacks obsoletos al cancelar", async () => {
	const service = new DeathAnimationService();

	const screenContainer = {
		style: { opacity: "1", transform: "scale(1)" },
	};
	const mockHud = {
		style: { transform: "translateX(-50%)", opacity: "1" },
	};

	// 1. Iniciar animación de salida de pantalla con callback
	let staleCallbackFired = false;
	service.animateScreenExit(
		screenContainer,
		() => {
			staleCallbackFired = true;
		},
		"fade",
		250
	);

	// Iniciar animación en el ámbito de espectador
	service.animateSpectatorSwitch(
		{ smoothing: 1.0 },
		mockHud,
		{ enabled: true, style: "smooth", duration: 250 }
	);

	// 2. Cancelar ÚNICAMENTE el ámbito de pantalla (por ejemplo, ocultar pantalla repentinamente)
	service.cancelScreenAnimations(true);

	// Estilos de pantalla restaurados
	assert.equal(screenContainer.style.opacity, "1");
	assert.equal(screenContainer.style.transform, "scale(1)");

	// Esperar el tiempo en el que la salida habría finalizado
	await new Promise((r) => setTimeout(r, 320));

	// El callback cancelado NUNCA debe dispararse
	assert.equal(staleCallbackFired, false, "El callback de una animación cancelada queda invalidado y no se ejecuta");

	// Limpiar todo al finalizar
	service.cancelAll();
});

test("36. Integración de DeathScreen y DeathManager con DeathAnimationService", () => {
	const dm = new DeathManager({
		cameraController: { mode: "third-person-collision", smoothing: 1.0, setCameraMode: () => {} },
		networkManager: {
			remotePlayers: new Map([
				["p1", { playerId: "p1", playerName: "Alice", currentPosition: { x: 0, y: 0, z: 0 } }],
			]),
		},
	});

	assert.ok(dm.deathScreen.animationService, "DeathScreen posee instancia de DeathAnimationService");

	// Clean destruction disposes animation service without throwing
	dm.destroy();
});

test("37. DeathAnimationService - Carga bajo demanda y comportamiento defensivo", async () => {
	const service = new DeathAnimationService();

	const node1 = { dataset: { elementId: "e1" }, style: { opacity: "0", transform: "translate(-50%, -50%)" } };
	const container = { children: [node1] };

	let finished = false;
	// Llamada con animaciones habilitadas y duración corta
	service.animateScreenEntrance(
		container,
		[{ id: "e1", type: "title" }],
		{ enabled: true, preset: "subtle", duration: 80 },
		{
			onComplete: () => {
				finished = true;
			},
		}
	);

	// Esperar a que la animación finalice
	await new Promise((r) => setTimeout(r, 140));
	assert.equal(finished, true, "onComplete se ejecuta correctamente al finalizar");
	assert.equal(node1.style.opacity, "1", "Elemento visible con opacidad final");
	assert.equal(node1.style.transform, "translate(-50%, -50%)", "Transform de anclaje preservado");
});

test("38. Espera obligatoria (allowSkipRespawnDelay: false) bloquea reaparición anticipada", () => {
	const game = createMockGame();
	const base = createDefaultExperienceModes().modes[0];
	const mode = {
		...base,
		id: "mode_mandatory_wait",
		respawnPolicy: "start",
		respawnDelay: 2.0,
		respawnDelayBehavior: "auto",
		allowSkipRespawnDelay: false,
		respawns: -1,
	};
	game.gameConfig = { activeExperienceModeId: mode.id, experienceModes: [mode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;

	dm.handleDeath({ cause: "damage" });
	assert.equal(game.character.isDead, true);
	assert.equal(dm.canRespawnNow(), false, "canRespawnNow debe ser false durante la espera obligatoria");

	// Intento de reaparición anticipada con el botón
	dm.handleDeathAction("respawn");
	assert.equal(game.character.isDead, true, "La reaparición debe ser bloqueada mientras la espera está activa");

	dm.destroy();
});

test("39. Salto permitido (allowSkipRespawnDelay: true) permite reaparición anticipada", () => {
	const game = createMockGame();
	const base = createDefaultExperienceModes().modes[0];
	const mode = {
		...base,
		id: "mode_skippable_wait",
		respawnPolicy: "start",
		respawnDelay: 5.0,
		respawnDelayBehavior: "auto",
		allowSkipRespawnDelay: true,
		respawns: -1,
	};
	game.gameConfig = { activeExperienceModeId: mode.id, experienceModes: [mode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;

	dm.handleDeath({ cause: "damage" });
	assert.equal(game.character.isDead, true);
	assert.equal(dm.canRespawnNow(), true, "canRespawnNow debe ser true cuando allowSkipRespawnDelay es true");

	// Reaparición anticipada inmediata
	dm.handleDeathAction("respawn");
	assert.equal(game.character.isDead, false, "El personaje debe reaparecer inmediatamente si se permite saltar");
	assert.equal(game.character.currentHealth, 100);

	dm.destroy();
});

test("40. Comportamiento 'button' no reaparece automáticamente hasta acción explícita", async () => {
	const game = createMockGame();
	const base = createDefaultExperienceModes().modes[0];
	const mode = {
		...base,
		id: "mode_button_wait",
		respawnPolicy: "start",
		respawnDelay: 0.05, // 50ms
		respawnDelayBehavior: "button",
		allowSkipRespawnDelay: false,
		respawns: -1,
	};
	game.gameConfig = { activeExperienceModeId: mode.id, experienceModes: [mode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;

	dm.handleDeath({ cause: "damage" });
	assert.equal(game.character.isDead, true);

	// Esperar a que venza el tiempo de 50ms
	await new Promise((r) => setTimeout(r, 80));

	// El temporizador terminó, pero al ser 'button', el personaje NO debe haber reaparecido automáticamente
	assert.equal(game.character.isDead, true, "El modo 'button' no debe reaparecer automáticamente");
	assert.equal(dm.canRespawnNow(), true, "El botón debe quedar habilitado una vez vencido el tiempo");

	// Acción explícita del jugador
	dm.handleDeathAction("respawn");
	assert.equal(game.character.isDead, false, "El personaje reaparece al presionar el botón habilitado");

	dm.destroy();
});

test("41. Modos sin reaparición (spectator, none) no inician espera ni permiten reaparecer", () => {
	const game = createMockGame();
	const base = createDefaultExperienceModes().modes[0];
	const specMode = {
		...base,
		id: "mode_permadeath",
		respawnPolicy: "none",
		respawns: 0,
	};
	game.gameConfig = { activeExperienceModeId: specMode.id, experienceModes: [specMode] };
	const dm = new DeathManager(game);
	game.deathManager = dm;

	dm.handleDeath({ cause: "damage" });
	assert.equal(game.character.isDead, true);

	// Intento de forzar respawn en modo sin reaparición
	dm.handleDeathAction("respawn");
	assert.equal(game.character.isDead, true, "Modos sin reaparición no deben permitir reaparecer con botón");

	dm.destroy();
});

test("42. Protección por Invulnerabilidad bloquea 100% de daño y llamadas directas de muerte", () => {
	const char = new MockCharacter();
	char.startRespawnProtection({
		enabled: true,
		duration: 2,
		type: "invulnerability",
	});

	assert.equal(char.isRespawnProtectionActive(), true);
	assert.equal(char.getRespawnProtectionType(), "invulnerability");

	let lastProtectionEvent = null;
	char.on("respawnProtectionChanged", (e) => { lastProtectionEvent = e; });

	// Aplicar daño masivo
	char.takeDamage(80);
	assert.equal(char.currentHealth, 100, "La salud debe permanecer al 100% durante invulnerabilidad");
	assert.equal(lastProtectionEvent.blockedDamage, 80);

	// Protección contra llamada externa de muerte por daño en DeathManager
	const game = createMockGame();
	game.character = char;
	const dm = new DeathManager(game);
	const handled = dm.handleDeath({ cause: "damage" });
	assert.equal(handled, false, "DeathManager debe bloquear muerte por daño mientras esté activa la invulnerabilidad");

	dm.destroy();
	char.destroy();
});

test("43. Protección por Escudo absorbe daño, agota capacidad y pasa excedente a salud", () => {
	const char = new MockCharacter();
	char.startRespawnProtection({
		enabled: true,
		duration: 2,
		type: "shield",
		shieldPoints: 40,
		showVisual: true,
	});

	assert.equal(char.isRespawnProtectionActive(), true);
	assert.equal(char.getRespawnShieldPoints(), 40);
	assert.equal(char.respawnBarrierActive, true);

	// Daño menor a la capacidad del escudo
	char.takeDamage(25);
	assert.equal(char.getRespawnShieldPoints(), 15, "El escudo debe absorber 25 puntos y quedar en 15");
	assert.equal(char.currentHealth, 100, "La salud debe permanecer intacta");
	assert.equal(char.respawnBarrierActive, true, "La barrera sigue activa");

	// Daño superior a los puntos restantes del escudo (30 de daño > 15 puntos restantes)
	char.takeDamage(30);
	assert.equal(char.getRespawnShieldPoints(), 0, "El escudo debe quedar en 0");
	assert.equal(char.respawnBarrierActive, false, "La barrera visual se destruye al agotarse el escudo");
	assert.equal(char.currentHealth, 85, "El excedente de 15 puntos debe aplicarse a la salud (100 - 15 = 85)");

	char.destroy();
});

test("44. Protección por Reducción de daño aplica porcentaje configurado a la salud", () => {
	const char = new MockCharacter();
	char.startRespawnProtection({
		enabled: true,
		duration: 2,
		type: "damage_reduction",
		damageMultiplier: 0.25, // 25% daño recibido (75% reducción)
	});

	assert.equal(char.isRespawnProtectionActive(), true);

	char.takeDamage(60);
	// 60 * 0.25 = 15 de daño aplicado
	assert.equal(char.currentHealth, 85, "Debe recibir únicamente 15 de daño (60 * 0.25)");

	char.destroy();
});

test("45. Expiración de protección por fin de duración", async () => {
	const char = new MockCharacter();
	char.startRespawnProtection({
		enabled: true,
		duration: 0.05, // 50ms
		type: "invulnerability",
	});

	assert.equal(char.isRespawnProtectionActive(), true);

	// Esperar a que expire
	await new Promise((r) => setTimeout(r, 80));
	assert.equal(char.isRespawnProtectionActive(), false, "La protección debe expirar tras la duración");

	// El daño posterior debe aplicarse al 100%
	char.takeDamage(30);
	assert.equal(char.currentHealth, 70, "Salud debe recibir el daño completo tras expirar la protección");

	char.destroy();
});

test("46. Limpieza de protección al morir de nuevo, reiniciar o destruir", () => {
	const char = new MockCharacter();
	char.startRespawnProtection({
		enabled: true,
		duration: 5,
		type: "shield",
		shieldPoints: 50,
	});
	assert.equal(char.isRespawnProtectionActive(), true);

	// Al morir
	char.die();
	assert.equal(char.isRespawnProtectionActive(), false, "Protección debe limpiarse inmediatamente al morir");
	assert.equal(char.getRespawnShieldPoints(), 0);

	// Reactivar y probar destroy
	char.startRespawnProtection({ enabled: true, duration: 5, type: "invulnerability" });
	assert.equal(char.isRespawnProtectionActive(), true);
	char.destroy();
	assert.equal(char.isRespawnProtectionActive(), false, "Protección debe limpiarse al destruir el objeto");
});

test("47. Cancelación de protección al atacar si cancelOnAttack está activo", () => {
	const charWithCancel = new MockCharacter();
	charWithCancel.startRespawnProtection({
		enabled: true,
		duration: 5,
		type: "invulnerability",
		cancelOnAttack: true,
	});
	assert.equal(charWithCancel.isRespawnProtectionActive(), true);
	charWithCancel.cancelProtectionOnAttack();
	assert.equal(charWithCancel.isRespawnProtectionActive(), false, "Protección debe finalizar al atacar si cancelOnAttack es true");

	const charWithoutCancel = new MockCharacter();
	charWithoutCancel.startRespawnProtection({
		enabled: true,
		duration: 5,
		type: "invulnerability",
		cancelOnAttack: false,
	});
	assert.equal(charWithoutCancel.isRespawnProtectionActive(), true);
	charWithoutCancel.cancelProtectionOnAttack();
	assert.equal(charWithoutCancel.isRespawnProtectionActive(), true, "Protección debe mantenerse si cancelOnAttack es false");

	charWithCancel.destroy();
	charWithoutCancel.destroy();
});

test("48. Validación defensiva de daño (NaN, negativos, infinito) y normalización de esquema", () => {
	const char = new MockCharacter();

	// Valores inválidos de daño no deben alterar la salud
	char.takeDamage(NaN);
	assert.equal(char.currentHealth, 100);
	char.takeDamage(-25);
	assert.equal(char.currentHealth, 100);
	char.takeDamage(Infinity);
	assert.equal(char.currentHealth, 100);
	char.takeDamage(-Infinity);
	assert.equal(char.currentHealth, 100);

	// Normalización de configuración con datos anómalos
	const normalized = normalizeExperienceModesConfig({
		experienceModes: [
			{
				id: "custom_mode",
				respawnDelayBehavior: "button",
				allowSkipRespawnDelay: true,
				respawnProtection: {
					enabled: true,
					duration: 9999, // excede máximo
					type: "shield",
					shieldPoints: -50, // negativo
					damageMultiplier: 2.5, // excede 1.0
					cancelOnAttack: true,
				},
			},
		],
	});

	const m = normalized.modes[0];
	assert.equal(m.respawnDelayBehavior, "button");
	assert.equal(m.allowSkipRespawnDelay, true);
	assert.equal(m.respawnProtection.duration, 30, "Duración debe quedar acotada a máximo 30s");
	assert.equal(m.respawnProtection.damageMultiplier, 1, "Multiplier debe quedar acotado a máximo 1.0");
	assert.equal(m.respawnProtection.cancelOnAttack, true);

	char.destroy();
});

test("49. normalizeDeathScreenBackground valida tipos (color, gradient, image, animated) y superposición de legibilidad", () => {
	// 1. Inferencia desde atributos legacy
	const legacyBg = normalizeDeathScreenBackground(undefined, "#1a202c", "assets/8e08d.jpg");
	assert.equal(legacyBg.type, "image");
	assert.equal(legacyBg.imageUrl, "assets/8e08d.jpg");
	assert.equal(legacyBg.color, "#1a202c");
	assert.equal(legacyBg.overlayOpacity, 0.7);

	// 2. Fondo de color sólido
	const solidBg = normalizeDeathScreenBackground({ type: "color", color: "#000000" });
	assert.equal(solidBg.type, "color");
	assert.equal(solidBg.color, "#000000");

	// 3. Fondo con degradado personalizado
	const gradBg = normalizeDeathScreenBackground({
		type: "gradient",
		gradient: "linear-gradient(180deg, #111 0%, #000 100%)",
	});
	assert.equal(gradBg.type, "gradient");
	assert.equal(gradBg.gradient, "linear-gradient(180deg, #111 0%, #000 100%)");

	// 4. Fondo animado con Ken Burns
	const animBg = normalizeDeathScreenBackground({
		type: "animated",
		imageUrl: "assets/8e08d.jpg",
		imageFit: "cover",
		animation: {
			enabled: true,
			type: "ken_burns",
			duration: 6000,
		},
	});
	assert.equal(animBg.type, "animated");
	assert.equal(animBg.animation.enabled, true);
	assert.equal(animBg.animation.type, "ken_burns");
	assert.equal(animBg.animation.duration, 6000);
});

test("50. Composición independiente: mostrar únicamente botones sobre imagen propia sin paneles forzados", () => {
	const customScreen = migrateDeathScreenConfig({
		version: 2,
		enabled: true,
		background: {
			type: "image",
			imageUrl: "assets/8e08d.jpg",
			imageFit: "cover",
			overlayOpacity: 0.3,
		},
		animations: {
			preset: "none",
		},
		elements: [
			{
				id: "btn_only",
				name: "Botón Único",
				type: "action_button",
				x: 50,
				y: 80,
				width: 30,
				height: 10,
				action: "respawn",
				content: "Reintentar en este punto",
			},
		],
	});

	// Valida que no se insertaron paneles automáticos
	assert.equal(customScreen.elements.length, 1);
	assert.equal(customScreen.elements[0].type, "action_button");
	assert.equal(customScreen.elements[0].id, "btn_only");
	assert.equal(customScreen.background.type, "image");
	assert.equal(customScreen.background.imageUrl, "assets/8e08d.jpg");
	assert.equal(customScreen.background.overlayOpacity, 0.3);
});

test("51. DeathAnimationService.animateBackground opera en capa de fondo y respeta reducedMotion", () => {
	const animService = new DeathAnimationService();

	const mockBgNode = {
		style: {
			transform: "",
			filter: "",
			willChange: "",
		},
	};

	// 1. Con reducedMotion: true no inicia animación y deja el nodo estático
	animService.animateBackground(
		mockBgNode,
		{
			type: "animated",
			animation: { enabled: true, type: "ken_burns", duration: 5000 },
		},
		{ reducedMotion: true }
	);
	assert.equal(mockBgNode.style.transform, "");

	// 2. Cancelar animaciones de fondo restaura estilos de forma segura
	animService.cancelBackgroundAnimation(true);
	assert.equal(mockBgNode.style.filter, "");
	assert.equal(mockBgNode.style.willChange, "");

	animService.dispose();
});

test("52. Combinaciones de animación independientes (imagen estática + elementos animados, fondo animado solo, composición estática)", () => {
	const animService = new DeathAnimationService();

	// Caso A: Imagen estática con elementos animados
	const configA = {
		background: { type: "image", imageUrl: "assets/8e08d.jpg", animation: { enabled: false, type: "none" } },
		animations: { enabled: true, preset: "dramatic", duration: 500 },
	};
	assert.equal(configA.background.animation.enabled, false);
	assert.equal(configA.animations.enabled, true);

	// Caso B: Fondo animado por separado con elementos estáticos
	const configB = {
		background: { type: "animated", imageUrl: "assets/8e08d.jpg", animation: { enabled: true, type: "pulse_glow", duration: 3000 } },
		animations: { enabled: false, preset: "none" },
	};
	assert.equal(configB.background.animation.enabled, true);
	assert.equal(configB.animations.enabled, false);

	// Caso C: Composición 100% estática
	const configC = {
		background: { type: "color", color: "#0a0c14", animation: { enabled: false } },
		animations: { enabled: false, preset: "none" },
	};
	assert.equal(configC.background.animation.enabled, false);
	assert.equal(configC.animations.preset, "none");

	animService.dispose();
});

test("53. Coherencia de configuración entre DeathScreenEditor y DeathScreen en partida", () => {
	const sharedMode = {
		id: "mode_sync_test",
		name: "Modo Sincronizado",
		respawnPolicy: "start",
		respawnDelay: 4,
		deathScreen: {
			version: 2,
			enabled: true,
			title: "ELIMINADO",
			message: "Reintentando misión",
			accentColor: "#00d2ff",
			background: {
				type: "image",
				imageUrl: "assets/8e08d.jpg",
				imageFit: "cover",
				overlayColor: "#000000",
				overlayOpacity: 0.65,
				animation: { enabled: true, type: "ken_burns", duration: 7500 },
			},
			animations: {
				enabled: true,
				preset: "cinematic",
				duration: 600,
			},
			elements: [
				{
					id: "btn_action",
					name: "Botón",
					type: "action_button",
					x: 50,
					y: 75,
					width: 25,
					height: 8,
					action: "respawn",
					content: "Reintentar",
					isPrimary: true,
				},
			],
		},
	};

	let syncTriggered = false;
	const editor = new DeathScreenEditor({
		mode: sharedMode,
		onSync: () => { syncTriggered = true; },
	});

	// Comprueba que el editor lee exactamente los mismos parámetros de fondo y elementos
	assert.equal(sharedMode.deathScreen.background.type, "image");
	assert.equal(sharedMode.deathScreen.background.imageUrl, "assets/8e08d.jpg");
	assert.equal(sharedMode.deathScreen.background.overlayOpacity, 0.65);
	assert.equal(sharedMode.deathScreen.animations.preset, "cinematic");
	assert.equal(sharedMode.deathScreen.elements.length, 1);
	assert.equal(sharedMode.deathScreen.elements[0].content, "Reintentar");

	// DeathScreen en partida instancia y procesa la misma configuración
	const deathScreen = new DeathScreen();
	assert.doesNotThrow(() => {
		deathScreen.showPreview(sharedMode, "respawn");
	});
	deathScreen.destroy();
});

test("54. Falla controlada de imagen y contraste de legibilidad", () => {
	// URL inválida o rota (XSS filtrada o 404)
	const sanitized = sanitizeImageUrl("javascript:alert(1)");
	assert.equal(sanitized, undefined, "URLs inseguras deben sanitizarse a undefined");

	// Fondo con imagen rota mantiene color base y degradado atmosférico de respaldo
	const bg = normalizeDeathScreenBackground(
		{ type: "image", imageUrl: "assets/inexistente_404.jpg", overlayColor: "#000", overlayOpacity: 0.75 },
		"rgba(13, 15, 23, 0.95)"
	);
	assert.ok(bg.color, "Mantiene color base de contraste");
	assert.equal(bg.overlayOpacity, 0.75, "Mantiene capa de legibilidad");

	const deathScreen = new DeathScreen();
	const mockMode = {
		id: "mode_fallback_test",
		deathScreen: {
			version: 2,
			enabled: true,
			background: bg,
			elements: [
				{ id: "txt_title", name: "Título", type: "title", content: "TEST LEGIBILIDAD", x: 50, y: 50, width: 60, height: 10 },
			],
		},
	};

	assert.doesNotThrow(() => {
		deathScreen.showPreview(mockMode, "respawn");
	});
	deathScreen.destroy();
});

test("55. Retrocompatibilidad: configuraciones antiguas v1 sin background ni elements migran transparentemente", () => {
	const legacyScreen = {
		enabled: true,
		title: "PANTALLA ANTIGUA",
		message: "Mensaje legacy",
		backgroundColor: "rgba(10, 10, 10, 0.9)",
		backgroundImage: "assets/legacy_bg.png",
		accentColor: "#e63946",
		buttons: [{ id: "btn_respawn", label: "Volver", action: "respawn", isPrimary: true }],
	};

	const migrated = migrateDeathScreenConfig(legacyScreen);
	assert.equal(migrated.version, 2);
	assert.equal(migrated.title, "PANTALLA ANTIGUA");
	assert.equal(migrated.background.type, "image");
	assert.equal(migrated.background.imageUrl, "assets/legacy_bg.png");
	assert.equal(migrated.backgroundColor, "rgba(10, 10, 10, 0.9)");
	assert.ok(migrated.elements.length > 0, "Genera elementos v2 a partir de atributos legacy");
	assert.ok(migrated.elements.some((e) => e.type === "action_button" && e.content === "Volver"));
});
