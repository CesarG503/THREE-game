import * as THREE from "three";
import { DeathScreen } from "../ui/DeathScreen";
import {
	type DeathContext,
	type DeathState,
	type ExperienceModeProfile,
	type ExperienceModesData,
	type DeathActionButtonType,
	createDefaultExperienceModes,
	normalizeExperienceModesConfig,
} from "../types/experienceMode.types";

export class DeathManager {
	public game: any;
	public deathScreen: DeathScreen;
	public isProcessingDeath = false;
	public currentCheckpoint: THREE.Vector3 | null = null;
	public remainingLives: number | null = null;
	public isSpectator = false;
	public spectatorTargetId: string | null = null;
	public currentSpectatorPerspective: "first_person" | "third_person" = "third_person";
	private previousCameraMode: any = null;
	private previousIsFirstPerson: boolean | null = null;
	private previousCameraControllerSmoothing: number | null = null;
	private spectatorHud: HTMLElement | null = null;
	private spectatorMode: ExperienceModeProfile | null = null;
	private spectatorKeyHandler = (event: KeyboardEvent) => {
		if (!this.isSpectator || event.repeat) return;
		const targetEl = event.target as HTMLElement | null;
		if (targetEl && (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement || (targetEl as any).isContentEditable)) return;

		const mode = this.spectatorMode || this.getBaseActiveMode();
		const spectator = mode.spectator || {};
		if (spectator.allowFollow !== false) {
			const peers = this.getAvailableSpectatorPeers(mode);
			if (peers.length > 1) {
				if (event.key === "ArrowRight" || event.key.toLowerCase() === "e") {
					event.preventDefault();
					this.cycleSpectatorTarget(1);
				} else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "q") {
					event.preventDefault();
					this.cycleSpectatorTarget(-1);
				}
			}
		}
		if (spectator.perspective === "switchable") {
			if (event.key.toLowerCase() === "v") {
				event.preventDefault();
				event.stopPropagation();
				this.toggleSpectatorPerspective();
			}
		}
	};

	private respawnTimer: number | null = null;

	constructor(game: any) {
		this.game = game;
		this.deathScreen = new DeathScreen((action) => this.handleDeathAction(action));
	}

	/**
	 * Returns the base/root active experience mode of the match or experience.
	 */
	public getBaseActiveMode(): ExperienceModeProfile {
		const editorConfig = this.game?.constructionMenu?.logicSystem?.gameConfig;
		const rootConfig = this.game?.gameConfig;
		const gameConfig = (editorConfig?.experienceModes?.length || editorConfig?.activeExperienceModeId)
			? editorConfig
			: (rootConfig?.experienceModes?.length || rootConfig?.activeExperienceModeId)
				? rootConfig
				: (rootConfig || editorConfig);
		const modesData: ExperienceModesData = normalizeExperienceModesConfig(gameConfig);
		return modesData.modes.find((m) => m.id === modesData.activeModeId) || modesData.modes[0];
	}

	/**
	 * Retrieves the active experience mode from gameConfig with backwards-compatible defaults.
	 * If a roleId has an assigned death mode, that mode is returned; otherwise the base active mode.
	 */
	public getActiveMode(roleId?: string): ExperienceModeProfile {
		const editorConfig = this.game?.constructionMenu?.logicSystem?.gameConfig;
		const rootConfig = this.game?.gameConfig;
		const gameConfig = (editorConfig?.experienceModes?.length || editorConfig?.activeExperienceModeId)
			? editorConfig
			: (rootConfig?.experienceModes?.length || rootConfig?.activeExperienceModeId)
				? rootConfig
				: (rootConfig || editorConfig);
		const modesData: ExperienceModesData = normalizeExperienceModesConfig(gameConfig);

		const baseActiveMode = modesData.modes.find((m) => m.id === modesData.activeModeId) || modesData.modes[0];
		const effectiveRoleId = roleId !== undefined
			? roleId
			: (this.game?.character?.activeRoleId || this.game?.playerConfigManager?.currentProfileId || this.game?.playerConfigManager?.assignments?.defaultProfileId);
		const roleModeId = effectiveRoleId ? baseActiveMode.roleModeAssignments?.[effectiveRoleId] : null;
		return (roleModeId && modesData.modes.find((m) => m.id === roleModeId)) || baseActiveMode;
	}

	/**
	 * Centralized entry point for all player death routes.
	 * Returns true if death was handled, false if prevented or ignored.
	 */
	public handleDeath(context: DeathContext): boolean {
		const character = this.game?.character;
		if (!character) return false;

		// Guard: Prevent double-death processing
		if (this.isProcessingDeath || character.isDead) {
			return false;
		}

		const mode = this.getActiveMode();

		// Check if cause is enabled in the active experience mode
		if (context.cause === "damage" && !mode.enabledCauses.damage) {
			return false;
		}

		if (context.cause === "fall") {
			// Environment config also governs fall death enablement
			if (this.game.environmentConfig && this.game.environmentConfig.fallDeath === false) {
				return false;
			}
			if (!mode.enabledCauses.fall) {
				return false;
			}
		}

		if (context.cause === "logic" && !mode.enabledCauses.logic) {
			return false;
		}

		this.isProcessingDeath = true;
		character.isDead = true;
		character.currentHealth = 0;
		character.emit("healthChanged", { current: 0, max: character.maxHealth });

		// Dismount vehicle if mounted
		if (this.game.vehicleSystem && this.game.vehicleSystem.mounted) {
			this.game.vehicleSystem.dismount(true);
		}

		// Body parts explosion: mode explicit override (true/false) takes precedence over player profile
		let shouldExplode: boolean;
		if (typeof mode.explodeOnDeath === "boolean") {
			shouldExplode = mode.explodeOnDeath;
		} else {
			shouldExplode = Boolean(character.explodeOnDeath);
		}

		if (shouldExplode) {
			const duration = character.bodyPartsDuration !== undefined ? character.bodyPartsDuration : 5;
			if (character.currentType === "skin" && character.polygonModelSkin) {
				character.polygonModelSkin.explodeBodyParts(duration);
			}
		}

		// Calculate remaining lives: mode override or inherit from player profile/character
		if (this.remainingLives === null || this.remainingLives === undefined) {
			if (typeof mode.respawns === "number" && !isNaN(mode.respawns)) {
				this.remainingLives = mode.respawns;
			} else if (character.respawns !== undefined && character.respawns !== null) {
				this.remainingLives = character.respawns;
			} else {
				this.remainingLives = -1;
			}
		}

		let willRespawn = true;
		if (mode.respawnPolicy === "none" || mode.respawnPolicy === "spectator") {
			willRespawn = false;
		} else if (this.remainingLives === 0) {
			willRespawn = false;
		} else if (this.remainingLives > 0) {
			this.remainingLives--;
		}

		// Emit events to game and logic systems
		character.emit("died", {
			cause: context.cause,
			remainingLives: this.remainingLives,
			willRespawn,
			context,
		});

		// Avoid double emission of player_death signal
		if (typeof this.game.emitSignal === "function") {
			this.game.emitSignal("player_death");
		} else if (this.game.constructionMenu?.logicSystem?.emitSignal) {
			this.game.constructionMenu.logicSystem.emitSignal("player_death");
		}

		const delay = (typeof mode.respawnDelay === "number" && !isNaN(mode.respawnDelay))
			? Math.max(0, mode.respawnDelay)
			: (typeof character.respawnDelay === "number" && !isNaN(character.respawnDelay))
				? Math.max(0, character.respawnDelay)
				: 2.0;

		const deathState: DeathState = {
			cause: context.cause,
			willRespawn,
			respawnDelay: delay,
			remainingRespawns: this.remainingLives,
			activeMode: mode,
			context,
		};

		// Show custom death screen
		this.deathScreen.show(deathState);

		// Schedule respawn if applicable
		this.clearTimer();
		if (willRespawn) {
			if (delay > 0) {
				this.respawnTimer = setTimeout(() => {
					this.executeRespawn();
				}, delay * 1000) as any;
			} else {
				// Immediate respawn (no delay): execute immediately so player doesn't get stuck
				this.executeRespawn();
			}
		} else if (!willRespawn && mode.respawnPolicy === "spectator") {
			// Auto transition to spectator after short moment if desired
			this.enterSpectator();
		}

		return true;
	}

	/**
	 * Handles actions triggered by the death screen buttons.
	 */
	public handleDeathAction(action: DeathActionButtonType) {
		switch (action) {
			case "respawn":
				this.executeRespawn();
				break;
			case "spectate":
				this.enterSpectator();
				this.deathScreen.hide();
				break;
			case "restart":
				const mode = this.getActiveMode();
				this.remainingLives = mode.respawns;
				this.executeRespawn({ forceStart: true });
				break;
			case "lobby":
				this.deathScreen.hide();
				if (this.game.router) {
					this.game.router.navigate("/");
				} else {
					window.location.reload();
				}
				break;
		}
	}

	/**
	 * Respawns the player according to policy and checkpoint.
	 */
	public executeRespawn(options?: { forceStart?: boolean }) {
		this.clearTimer();
		const character = this.game?.character;
		if (!character) return;

		const mode = this.getBaseActiveMode();

		let targetPos: THREE.Vector3;
		if (options?.forceStart || mode.respawnPolicy === "start") {
			targetPos = character.startPosition.clone();
		} else if (mode.respawnPolicy === "checkpoint") {
			targetPos = (this.currentCheckpoint || character.startPosition).clone();
		} else {
			targetPos = character.startPosition.clone();
		}

		// Respawn character at determined coordinates
		if (typeof character.respawnAt === "function") {
			character.respawnAt(targetPos);
		} else {
			character.isDead = false;
			character.currentHealth = character.maxHealth;
			character.emit("healthChanged", { current: character.currentHealth, max: character.maxHealth });
			character.emit("jumpChanged", { current: character.maxMultiJumps, max: character.maxMultiJumps });

			if (character.rigidBody) {
				character.rigidBody.setTranslation({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, true);
				character.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
			}
		}

		this.cleanupSpectator();
		this.isProcessingDeath = false;
		this.deathScreen.hide();
	}

	/**
	 * Enters spectator mode.
	 */
	public enterSpectator() {
		const character = this.game?.character;
		if (!character) return;
		const mode = this.spectatorMode || this.getBaseActiveMode();
		const spectator = mode.spectator || {};
		if (spectator.enabled === false) return;
		this.isSpectator = true;
		this.spectatorMode = mode;

		// Hide local active models
		if (character.glbModel) character.glbModel.setVisible(false);
		if (character.polygonModel) character.polygonModel.setVisible(false);
		if (character.polygonModelSkin) character.polygonModelSkin.setVisible(false);

		// Initialize perspective from mode setting
		const configuredPerspective = spectator.perspective || "third_person";
		if (configuredPerspective === "first_person") {
			this.currentSpectatorPerspective = "first_person";
		} else {
			this.currentSpectatorPerspective = "third_person";
		}

		if (this.game.cameraController) {
			this.previousCameraMode = this.game.cameraController.mode;
			this.previousIsFirstPerson = this.game.cameraController.isFirstPerson;
			this.previousCameraControllerSmoothing = this.game.cameraController.smoothing;
			if (spectator.allowFollow === false) {
				this.game.cameraController.setCameraMode("free-fly", false);
				this.game.cameraController.freeFlyPosition.copy(character.getPosition());
			} else {
				this.applySpectatorPerspective();
			}
			this.game.cameraController.canRotate = true;
		}

		this.spectatorTargetId = null;
		this.ensureSpectatorHud();
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", this.spectatorKeyHandler);
			window.addEventListener("keydown", this.spectatorKeyHandler);
		}
		this.cycleSpectatorTarget(1);
	}

	/**
	 * Toggles between first-person and third-person spectator if the active mode allows it.
	 */
	public toggleSpectatorPerspective() {
		const mode = this.spectatorMode || this.getBaseActiveMode();
		if (mode.spectator?.perspective !== "switchable") return;
		this.currentSpectatorPerspective = this.currentSpectatorPerspective === "first_person" ? "third_person" : "first_person";
		this.applySpectatorPerspective();
		this.updateSpectatorHud();
	}

	/**
	 * Applies the spectator camera mode to CameraController without altering standard gameplay preferences.
	 */
	public applySpectatorPerspective() {
		if (!this.game?.cameraController) return;
		const mode = this.spectatorMode || this.getBaseActiveMode();
		if (mode.spectator?.allowFollow === false) return;

		if (this.currentSpectatorPerspective === "first_person") {
			this.game.cameraController.setCameraMode("first-person", false);
		} else {
			this.game.cameraController.setCameraMode("third-person-collision", false);
		}
	}

	/**
	 * Returns the list of currently alive and role-permitted peer players that can be observed.
	 */
	public getAvailableSpectatorPeers(mode?: ExperienceModeProfile): any[] {
		const activeMode = mode || this.spectatorMode || this.getBaseActiveMode();
		if (activeMode.spectator?.allowFollow === false) return [];
		const allowedRoles = activeMode.spectator?.allowedRoleIds || [];
		const peers: any[] = [];
		this.game?.networkManager?.remotePlayers?.forEach((player: any) => {
			const roleId = player.state?.roleId || player.roleId;
			if (allowedRoles.length > 0 && (!roleId || !allowedRoles.includes(roleId))) return;
			if (player.state?.isDead || player.isDead) return;
			peers.push(player);
		});
		return peers;
	}

	public getSpectatorTarget(): any | null {
		if (!this.isSpectator || !this.game?.networkManager?.remotePlayers) return null;
		const mode = this.spectatorMode || this.getBaseActiveMode();
		if (mode.spectator?.allowFollow === false) return null;

		const peers = this.getAvailableSpectatorPeers(mode);
		if (!peers.length) {
			if (this.spectatorTargetId !== null) {
				this.spectatorTargetId = null;
				this.updateSpectatorHud();
			}
			return null;
		}

		let target = this.spectatorTargetId ? this.game.networkManager.remotePlayers.get(this.spectatorTargetId) : null;
		const isPeerValid = (p: any) => p && peers.some((validPeer) => validPeer.playerId === p.playerId);

		if (!isPeerValid(target)) {
			this.cycleSpectatorTarget(1);
			target = this.spectatorTargetId ? this.game.networkManager.remotePlayers.get(this.spectatorTargetId) : null;
			if (!isPeerValid(target)) {
				this.spectatorTargetId = null;
				this.updateSpectatorHud();
				return null;
			}
		}

		return target || null;
	}

	public cycleSpectatorTarget(direction = 1) {
		const mode = this.spectatorMode || this.getBaseActiveMode();
		if (mode.spectator?.allowFollow === false) {
			this.spectatorTargetId = null;
			this.updateSpectatorHud();
			return;
		}

		const peers = this.getAvailableSpectatorPeers(mode);

		if (!peers.length) {
			this.spectatorTargetId = null;
			this.updateSpectatorHud();
			return;
		}

		let index = peers.findIndex((player) => player.playerId === this.spectatorTargetId);
		if (index === -1) {
			index = direction >= 0 ? 0 : peers.length - 1;
		} else {
			index = (index + direction + peers.length) % peers.length;
		}
		this.spectatorTargetId = peers[index].playerId;
		this.updateSpectatorHud();
	}

	public getSpectatorQuality(): "full" | "balanced" | "low" {
		return this.spectatorMode?.spectator?.quality || "balanced";
	}

	private ensureSpectatorHud() {
		if (typeof document === "undefined" || this.spectatorHud) return;
		const hud = document.createElement("div");
		hud.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:10001;padding:10px 16px;border-radius:10px;background:rgba(8,12,20,.82);color:#fff;font:600 13px system-ui;pointer-events:none;text-align:center;backdrop-filter:blur(8px);";
		hud.setAttribute("aria-live", "polite");
		document.body.appendChild(hud);
		this.spectatorHud = hud;
		this.updateSpectatorHud();
	}

	private updateSpectatorHud() {
		if (!this.spectatorHud) return;
		const mode = this.spectatorMode || this.getBaseActiveMode();
		const spectator = mode.spectator || {};

		if (spectator.allowFollow === false) {
			this.spectatorHud.textContent = "Modo observador (Cámara libre)  ·  WASD / Espacio para desplazarse";
			return;
		}

		const peers = this.getAvailableSpectatorPeers(mode);
		const target = this.spectatorTargetId ? this.game?.networkManager?.remotePlayers?.get(this.spectatorTargetId) : null;
		if (!target || peers.length === 0) {
			this.spectatorHud.textContent = "Modo observador  ·  No hay jugadores disponibles para observar";
			return;
		}

		const perspectiveLabel = this.currentSpectatorPerspective === "first_person" ? "1ª persona" : "3ª persona";
		const cyclePrompt = peers.length > 1 ? "  ·  Q/E o ←/→ para cambiar objetivo" : "";
		const switchPrompt = spectator.perspective === "switchable" ? "  ·  V: Cambiar vista" : "";
		this.spectatorHud.textContent = `Observando a ${target.playerName || "Jugador"} (${perspectiveLabel})${cyclePrompt}${switchPrompt}`;
	}

	private cleanupSpectator() {
		this.isSpectator = false;
		this.spectatorMode = null;
		this.spectatorTargetId = null;
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", this.spectatorKeyHandler);
		}
		if (this.spectatorHud) {
			this.spectatorHud.remove();
			this.spectatorHud = null;
		}

		// Restore original camera mode & smoothing
		if (this.game?.cameraController) {
			const originalMode = this.previousCameraMode || (this.previousIsFirstPerson ? "first-person" : "third-person-collision");
			this.game.cameraController.setCameraMode(originalMode, false);
			if (this.previousCameraControllerSmoothing !== null) {
				this.game.cameraController.smoothing = this.previousCameraControllerSmoothing;
			}
		}
		this.previousCameraMode = null;
		this.previousIsFirstPerson = null;
		this.previousCameraControllerSmoothing = null;

		// Restore local character model visibility
		const character = this.game?.character;
		if (character) {
			if (typeof character.setModelType === "function") {
				character.setModelType(character.currentType);
			}
			if (character.glbModel) character.glbModel.setVisible(character.currentType === "glb");
			if (character.polygonModel) character.polygonModel.setVisible(character.currentType === "polygon");
			if (character.polygonModelSkin) character.polygonModelSkin.setVisible(character.currentType === "skin");
		}
	}

	/**
	 * Records a checkpoint position for the player.
	 */
	public setCheckpoint(pos: THREE.Vector3 | { x: number; y: number; z: number }) {
		this.currentCheckpoint = new THREE.Vector3(pos.x, pos.y, pos.z);
		console.log("[DeathManager] Checkpoint establecido en:", this.currentCheckpoint);

		if (this.game.floatingTextManager) {
			this.game.floatingTextManager.spawnText("¡Punto de control!", this.currentCheckpoint, 0x00d2ff);
		}
	}

	/**
	 * Resets lives and state on round or mode reset.
	 */
	public reset() {
		this.clearTimer();
		this.isProcessingDeath = false;
		this.cleanupSpectator();
		const mode = this.getActiveMode();
		this.remainingLives = (typeof mode?.respawns === "number") ? mode.respawns : null;
		this.currentCheckpoint = null;
		this.deathScreen.hide();
	}

	public destroy() {
		this.clearTimer();
		this.cleanupSpectator();
		this.deathScreen.destroy();
	}

	private clearTimer() {
		if (this.respawnTimer !== null) {
			clearTimeout(this.respawnTimer);
			this.respawnTimer = null;
		}
	}
}
