import type {
	ExperienceModeProfile,
	ExperienceModesData,
	DeathActionButtonType,
	DeathScreenActionButton,
} from "../types/experienceMode.types";
import {
	createDefaultExperienceModes,
	normalizeExperienceModesConfig,
} from "../types/experienceMode.types";
import { DeathScreenEditor } from "./DeathScreenEditor";

export class ExperienceModeEditor {
	private game: any;
	private gameConfigPanel: any;
	private container: HTMLElement | null = null;
	private selectedModeId: string | null = null;
	private previewState: "respawn" | "last_life" | "game_over" | "spectator" = "respawn";
	private visualEditor: DeathScreenEditor | null = null;
	private showVisualEditor = true;

	constructor(game: any, gameConfigPanel: any) {
		this.game = game;
		this.gameConfigPanel = gameConfigPanel;
	}

	private get gameConfig(): any {
		return this.gameConfigPanel?.logicSystem?.gameConfig;
	}

	private ensureModesData(): ExperienceModesData {
		const raw = this.gameConfig;
		const normalized = normalizeExperienceModesConfig(raw);

		if (raw) {
			raw.experienceModes = normalized.modes;
			raw.activeExperienceModeId = normalized.activeModeId;
		}

		if (!this.selectedModeId || !normalized.modes.some((m) => m.id === this.selectedModeId)) {
			this.selectedModeId = normalized.activeModeId;
		}

		return normalized;
	}

	private sync() {
		if (this.gameConfigPanel && typeof this.gameConfigPanel.syncConfig === "function") {
			this.gameConfigPanel.syncConfig();
		}
	}

	public render(container: HTMLElement) {
		this.container = container;
		container.innerHTML = "";

		const modesData = this.ensureModesData();
		const currentMode = modesData.modes.find((m) => m.id === this.selectedModeId) || modesData.modes[0];
		this.selectedModeId = currentMode.id;

		const wrapper = document.createElement("div");
		wrapper.className = "game-config-scroll";
		wrapper.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 16px;
			padding: 12px;
			background: #18191f;
			border: 1px solid #333;
			border-radius: 8px;
			color: #eee;
			font-family: inherit;
			font-size: 13px;
			overflow-y: auto;
			max-height: 100%;
		`;

		// 1. Header & Mode Selection Bar
		wrapper.appendChild(this.createModeSelectorBar(modesData, currentMode));

		// 2. Basic Info (Name, Description)
		wrapper.appendChild(this.createBasicInfoSection(currentMode));

		// 3. Enabled Death Causes
		wrapper.appendChild(this.createCausesSection(currentMode));

		// 4. Respawn Rules & Lives
		wrapper.appendChild(this.createRespawnRulesSection(currentMode));

		// 5. Role-specific death profiles and spectator performance
		wrapper.appendChild(this.createRoleAndSpectatorSection(modesData, currentMode));

		// 6. Death Screen Visuals & Actions
		wrapper.appendChild(this.createDeathScreenSection(currentMode));

		// 7. Interactive Preview Bar
		wrapper.appendChild(this.createPreviewSection(currentMode));

		container.appendChild(wrapper);
	}

	private createModeSelectorBar(modesData: ExperienceModesData, currentMode: ExperienceModeProfile): HTMLElement {
		const bar = document.createElement("div");
		bar.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 10px;
			background: #22242c;
			padding: 12px;
			border-radius: 6px;
			border: 1px solid #3a3d4a;
		`;

		const label = document.createElement("strong");
		label.textContent = "Modo a editar:";
		label.style.color = "#fff";

		const select = document.createElement("select");
		select.style.cssText = "background: #111; color: #fff; border: 1px solid #555; padding: 6px 10px; border-radius: 4px; flex: 1; min-width: 150px;";
		modesData.modes.forEach((mode) => {
			const opt = document.createElement("option");
			opt.value = mode.id;
			opt.textContent = `${mode.name}${mode.id === modesData.activeModeId ? " [★ ACTIVO]" : ""}`;
			if (mode.id === currentMode.id) opt.selected = true;
			select.appendChild(opt);
		});
		select.onchange = () => {
			this.selectedModeId = select.value;
			if (this.container) this.render(this.container);
		};

		// Set as Active button
		const isActive = currentMode.id === modesData.activeModeId;
		const activeBtn = document.createElement("button");
		activeBtn.textContent = isActive ? "★ Modo Activo" : "Establecer como Activo";
		activeBtn.style.cssText = `
			background: ${isActive ? "#2a9d8f" : "#444"};
			color: white;
			border: none;
			padding: 6px 12px;
			border-radius: 4px;
			cursor: ${isActive ? "default" : "pointer"};
			font-weight: 600;
		`;
		if (!isActive) {
			activeBtn.onclick = () => {
				this.gameConfig.activeExperienceModeId = currentMode.id;
				this.sync();
				if (this.container) this.render(this.container);
			};
		}

		// New Mode button
		const newBtn = document.createElement("button");
		newBtn.textContent = "+ Nuevo Modo";
		newBtn.style.cssText = "background: #3a86ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;";
		newBtn.onclick = () => {
			const newId = `mode_${Date.now()}`;
			const newMode: ExperienceModeProfile = {
				id: newId,
				name: `Nuevo Modo ${modesData.modes.length + 1}`,
				description: "Descripción del modo personalizado",
				enabledCauses: { damage: true, fall: true, logic: true },
				respawnPolicy: "start",
				respawnDelay: 2.0,
				respawns: -1,
				explodeOnDeath: false,
				deathScreen: {
					enabled: true,
					title: "HAS MUERTO",
					message: "Reapareciendo...",
					backgroundColor: "rgba(13, 15, 23, 0.92)",
					accentColor: "#ff3b47",
					screenBlur: 12,
					buttons: [{ id: "btn_respawn", label: "Reaparecer", action: "respawn", isPrimary: true }],
				},
			};
			this.gameConfig.experienceModes.push(newMode);
			this.selectedModeId = newId;
			this.sync();
			if (this.container) this.render(this.container);
		};

		// Duplicate button
		const duplicateBtn = document.createElement("button");
		duplicateBtn.textContent = "Duplicar";
		duplicateBtn.style.cssText = "background: #555; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;";
		duplicateBtn.onclick = () => {
			const cloneId = `mode_${Date.now()}`;
			const clone: ExperienceModeProfile = JSON.parse(JSON.stringify(currentMode));
			clone.id = cloneId;
			clone.name = `${currentMode.name} (Copia)`;
			this.gameConfig.experienceModes.push(clone);
			this.selectedModeId = cloneId;
			this.sync();
			if (this.container) this.render(this.container);
		};

		// Delete button
		const deleteBtn = document.createElement("button");
		deleteBtn.textContent = "Eliminar";
		deleteBtn.style.cssText = "background: #8b0000; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;";
		if (modesData.modes.length <= 1) {
			deleteBtn.disabled = true;
			deleteBtn.style.opacity = "0.5";
			deleteBtn.style.cursor = "not-allowed";
		} else {
			deleteBtn.onclick = () => {
				if (confirm(`¿Eliminar el modo "${currentMode.name}"?`)) {
					const idx = this.gameConfig.experienceModes.findIndex((m: any) => m.id === currentMode.id);
					if (idx !== -1) {
						this.gameConfig.experienceModes.splice(idx, 1);
						if (this.gameConfig.activeExperienceModeId === currentMode.id) {
							this.gameConfig.activeExperienceModeId = this.gameConfig.experienceModes[0].id;
						}
						this.selectedModeId = this.gameConfig.experienceModes[0].id;
						this.sync();
						if (this.container) this.render(this.container);
					}
				}
			};
		}

		bar.append(label, select, activeBtn, newBtn, duplicateBtn, deleteBtn);
		return bar;
	}

	private createBasicInfoSection(mode: ExperienceModeProfile): HTMLElement {
		const section = this.createSectionBox("Identificación del Modo");

		const row1 = document.createElement("div");
		row1.style.cssText = "display: flex; gap: 10px; align-items: center;";
		const nameLabel = document.createElement("label");
		nameLabel.textContent = "Nombre:";
		nameLabel.style.width = "70px";
		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.value = mode.name;
		nameInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; flex: 1;";
		nameInput.onchange = () => {
			mode.name = nameInput.value.trim() || "Modo Sin Nombre";
			this.sync();
			if (this.container) this.render(this.container);
		};
		row1.append(nameLabel, nameInput);

		const row2 = document.createElement("div");
		row2.style.cssText = "display: flex; gap: 10px; align-items: center;";
		const descLabel = document.createElement("label");
		descLabel.textContent = "Descripción:";
		descLabel.style.width = "70px";
		const descInput = document.createElement("input");
		descInput.type = "text";
		descInput.value = mode.description || "";
		descInput.placeholder = "Breve explicación de las reglas de este modo...";
		descInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; flex: 1;";
		descInput.onchange = () => {
			mode.description = descInput.value.trim();
			this.sync();
		};
		row2.append(descLabel, descInput);

		section.append(row1, row2);
		return section;
	}

	private createCausesSection(mode: ExperienceModeProfile): HTMLElement {
		const section = this.createSectionBox("Causas de Muerte Habilitadas");

		const grid = document.createElement("div");
		grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;";

		const causes: Array<{ key: "damage" | "fall" | "logic"; label: string; desc: string }> = [
			{ key: "damage", label: "Daño por Ataques / Armas", desc: "El jugador muere al llegar su vida a 0" },
			{ key: "fall", label: "Caída al Vacío", desc: "Muere si cae por debajo del límite de caída" },
			{ key: "logic", label: "Lógica / Trampas", desc: "Triggers y secuencias pueden provocar muerte" },
		];

		causes.forEach(({ key, label, desc }) => {
			const item = document.createElement("label");
			item.style.cssText = "display: flex; align-items: flex-start; gap: 8px; cursor: pointer; background: #22242c; padding: 8px; border-radius: 6px; border: 1px solid #333;";

			const cb = document.createElement("input");
			cb.type = "checkbox";
			cb.checked = mode.enabledCauses[key];
			cb.style.marginTop = "2px";
			cb.onchange = () => {
				mode.enabledCauses[key] = cb.checked;
				this.sync();
			};

			const textWrap = document.createElement("div");
			const title = document.createElement("div");
			title.textContent = label;
			title.style.fontWeight = "600";
			const subtitle = document.createElement("div");
			subtitle.textContent = desc;
			subtitle.style.fontSize = "11px";
			subtitle.style.color = "#888";

			textWrap.append(title, subtitle);
			item.append(cb, textWrap);
			grid.appendChild(item);
		});

		section.appendChild(grid);
		return section;
	}

	private createRespawnRulesSection(mode: ExperienceModeProfile): HTMLElement {
		const section = this.createSectionBox("Reglas de Reaparición y Vidas");

		const grid = document.createElement("div");
		grid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 14px;";

		// Policy
		const policyCol = document.createElement("div");
		policyCol.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
		const policyLabel = document.createElement("label");
		policyLabel.textContent = "Política de Reaparición:";
		policyLabel.style.fontWeight = "bold";

		const policySelect = document.createElement("select");
		policySelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px;";
		const policies: Array<{ v: string; t: string }> = [
			{ v: "start", t: "Punto de Inicio (Spawn original)" },
			{ v: "checkpoint", t: "Último Punto de Control (Checkpoint)" },
			{ v: "spectator", t: "Modo Espectador (Sin reaparición)" },
			{ v: "none", t: "Sin Reaparición (Fin de partida)" },
		];
		policies.forEach((p) => {
			const opt = document.createElement("option");
			opt.value = p.v;
			opt.textContent = p.t;
			if (mode.respawnPolicy === p.v) opt.selected = true;
			policySelect.appendChild(opt);
		});
		policySelect.onchange = () => {
			mode.respawnPolicy = policySelect.value as any;
			this.sync();
		};
		policyCol.append(policyLabel, policySelect);

		// Lives (respawns)
		const livesCol = document.createElement("div");
		livesCol.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
		const livesLabel = document.createElement("label");
		livesLabel.textContent = "Número de Vidas:";
		livesLabel.style.fontWeight = "bold";

		const livesRow = document.createElement("div");
		livesRow.style.cssText = "display: flex; gap: 8px; align-items: center;";

		const livesSelect = document.createElement("select");
		livesSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; flex: 1;";
		const livesOpts = [
			{ v: "inherit", t: "Heredar del perfil del jugador" },
			{ v: "-1", t: "Infinitas" },
			{ v: "0", t: "Muerte Permanente (0 vidas extras)" },
			{ v: "1", t: "1 Vida Extra" },
			{ v: "3", t: "3 Vidas Extras" },
			{ v: "5", t: "5 Vidas Extras" },
			{ v: "custom", t: "Personalizado" },
		];

		const customLivesInput = document.createElement("input");
		customLivesInput.type = "number";
		customLivesInput.min = "0";
		const currentLivesVal = (typeof mode.respawns === "number") ? mode.respawns : 3;
		customLivesInput.value = String(currentLivesVal > 0 ? currentLivesVal : 10);
		customLivesInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; width: 70px; display: none;";

		let isCustomLives = false;
		if (mode.respawns === null || mode.respawns === undefined) {
			livesSelect.value = "inherit";
		} else if (["-1", "0", "1", "3", "5"].includes(String(mode.respawns))) {
			livesSelect.value = String(mode.respawns);
		} else {
			livesSelect.value = "custom";
			isCustomLives = true;
			customLivesInput.style.display = "block";
		}

		livesOpts.forEach((lo) => {
			const opt = document.createElement("option");
			opt.value = lo.v;
			opt.textContent = lo.t;
			if (livesSelect.value === lo.v) opt.selected = true;
			livesSelect.appendChild(opt);
		});

		livesSelect.onchange = () => {
			if (livesSelect.value === "inherit") {
				customLivesInput.style.display = "none";
				mode.respawns = null;
			} else if (livesSelect.value === "custom") {
				customLivesInput.style.display = "block";
				mode.respawns = parseInt(customLivesInput.value, 10) || 10;
			} else {
				customLivesInput.style.display = "none";
				mode.respawns = parseInt(livesSelect.value, 10);
			}
			this.sync();
		};

		customLivesInput.onchange = () => {
			mode.respawns = Math.max(0, parseInt(customLivesInput.value, 10) || 0);
			this.sync();
		};

		livesRow.append(livesSelect, customLivesInput);
		livesCol.append(livesLabel, livesRow);

		// Delay
		const delayCol = document.createElement("div");
		delayCol.style.cssText = "display: flex; flex-direction: column; gap: 6px; grid-column: span 2;";
		const delayRow = document.createElement("div");
		delayRow.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
		const delayLabel = document.createElement("label");
		delayLabel.textContent = "Demora de Reaparición:";
		delayLabel.style.fontWeight = "bold";

		const delayVal = document.createElement("span");
		const isDelayInherited = mode.respawnDelay === null || mode.respawnDelay === undefined;
		delayVal.textContent = isDelayInherited
			? "(Heredado del perfil del jugador)"
			: `${Number(mode.respawnDelay).toFixed(1)} segundos ${mode.respawnDelay === 0 ? "(Inmediata)" : ""}`;
		delayVal.style.color = "#3a86ff";
		delayRow.append(delayLabel, delayVal);

		const delayControlsRow = document.createElement("div");
		delayControlsRow.style.cssText = "display: flex; gap: 10px; align-items: center;";

		const delaySelect = document.createElement("select");
		delaySelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; width: 220px;";
		const delayOpts = [
			{ v: "inherit", t: "Heredar del perfil del jugador" },
			{ v: "custom", t: "Personalizada por este modo" },
		];
		delayOpts.forEach((o) => {
			const opt = document.createElement("option");
			opt.value = o.v;
			opt.textContent = o.t;
			if ((isDelayInherited && o.v === "inherit") || (!isDelayInherited && o.v === "custom")) {
				opt.selected = true;
			}
			delaySelect.appendChild(opt);
		});

		const delaySlider = document.createElement("input");
		delaySlider.type = "range";
		delaySlider.min = "0";
		delaySlider.max = "10";
		delaySlider.step = "0.1";
		delaySlider.value = String(typeof mode.respawnDelay === "number" ? mode.respawnDelay : 2.0);
		delaySlider.style.cssText = `flex: 1; cursor: pointer; display: ${isDelayInherited ? "none" : "block"};`;

		delaySlider.oninput = () => {
			const v = parseFloat(delaySlider.value);
			mode.respawnDelay = v;
			delayVal.textContent = `${v.toFixed(1)} segundos ${v === 0 ? "(Inmediata)" : ""}`;
			this.sync();
		};

		delaySelect.onchange = () => {
			if (delaySelect.value === "inherit") {
				mode.respawnDelay = null;
				delaySlider.style.display = "none";
				delayVal.textContent = "(Heredado del perfil del jugador)";
			} else {
				const v = parseFloat(delaySlider.value) || 2.0;
				mode.respawnDelay = v;
				delaySlider.style.display = "block";
				delayVal.textContent = `${v.toFixed(1)} segundos ${v === 0 ? "(Inmediata)" : ""}`;
			}
			this.sync();
		};

		delayControlsRow.append(delaySelect, delaySlider);
		delayCol.append(delayRow, delayControlsRow);

		// Explode
		const explodeCol = document.createElement("div");
		explodeCol.style.cssText = "display: flex; flex-direction: column; gap: 6px; grid-column: span 2;";
		const explodeLabel = document.createElement("label");
		explodeLabel.textContent = "Explosión de Partes del Cuerpo:";
		explodeLabel.style.fontWeight = "bold";

		const explodeSelect = document.createElement("select");
		explodeSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px;";
		const explodeOpts = [
			{ v: "inherit", t: "Heredar del perfil del jugador" },
			{ v: "true", t: "Activado explícitamente (Siempre explotar partes)" },
			{ v: "false", t: "Desactivado explícitamente (No explotar partes)" },
		];

		const currentExplodeVal = mode.explodeOnDeath === true ? "true" : (mode.explodeOnDeath === false ? "false" : "inherit");
		explodeOpts.forEach((eo) => {
			const opt = document.createElement("option");
			opt.value = eo.v;
			opt.textContent = eo.t;
			if (eo.v === currentExplodeVal) opt.selected = true;
			explodeSelect.appendChild(opt);
		});

		explodeSelect.onchange = () => {
			if (explodeSelect.value === "inherit") {
				mode.explodeOnDeath = null;
			} else if (explodeSelect.value === "true") {
				mode.explodeOnDeath = true;
			} else {
				mode.explodeOnDeath = false;
			}
			this.sync();
		};

		explodeCol.append(explodeLabel, explodeSelect);

		grid.append(policyCol, livesCol, delayCol, explodeCol);
		section.appendChild(grid);
		return section;
	}

	private createRoleAndSpectatorSection(data: ExperienceModesData, mode: ExperienceModeProfile): HTMLElement {
		const section = this.createSectionBox("Reglas por rol y modo observador");
		mode.roleModeAssignments ||= {};
		mode.spectator ||= { enabled: true, allowFollow: true, allowedRoleIds: [], quality: "balanced" };
		const roles: any[] = this.game?.playerConfigManager?.profiles || [];
		const intro = document.createElement("p");
		intro.textContent = "Asigna a cada rol otro perfil de muerte; los roles sin asignación usan este modo. El perfil elegido incluye sus propias vidas, reaparición y pantalla.";
		intro.style.cssText = "margin:0 0 10px;color:#aaa;font-size:11px;";
		section.appendChild(intro);

		if (!roles.length) {
			const empty = document.createElement("div");
			empty.textContent = "Todavía no hay roles/perfiles de jugador definidos.";
			empty.style.color = "#888";
			section.appendChild(empty);
		} else {
			roles.forEach((role) => {
				const row = document.createElement("div");
				row.style.cssText = "display:flex;gap:10px;align-items:center;margin:6px 0;";
				const label = document.createElement("label");
				label.textContent = role.name || role.id;
				label.style.cssText = "flex:1;color:#ddd;";
				const select = document.createElement("select");
				select.style.cssText = "background:#111;color:#fff;border:1px solid #555;padding:6px;border-radius:4px;min-width:190px;";
				const inherit = document.createElement("option");
				inherit.value = "";
				inherit.textContent = "Usar modo seleccionado";
				select.appendChild(inherit);
				data.modes.filter((candidate) => candidate.id !== mode.id).forEach((candidate) => {
					const option = document.createElement("option");
					option.value = candidate.id;
					option.textContent = candidate.name;
					select.appendChild(option);
				});
				select.value = mode.roleModeAssignments[role.id] || "";
				select.onchange = () => {
					if (select.value) mode.roleModeAssignments![role.id] = select.value;
					else delete mode.roleModeAssignments![role.id];
					this.sync();
				};
				row.append(label, select);
				section.appendChild(row);
			});
		}

		const options = document.createElement("div");
		options.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #383b45;";
		const enabledLabel = this.createInlineCheckbox("Permitir modo observador", mode.spectator.enabled !== false, (value) => { mode.spectator!.enabled = value; this.sync(); });
		const followLabel = this.createInlineCheckbox("Seguir jugadores", mode.spectator.allowFollow !== false, (value) => { mode.spectator!.allowFollow = value; this.sync(); });

		const perspectiveSelect = document.createElement("select");
		perspectiveSelect.title = "Perspectiva del observador";
		perspectiveSelect.style.cssText = "background:#111;color:#fff;border:1px solid #555;padding:6px;border-radius:4px;";
		[
			["third_person", "Tercera persona"],
			["first_person", "Primera persona"],
			["switchable", "Alternable (V: 1ª/3ª)"],
		].forEach(([value, label]) => {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = label;
			perspectiveSelect.appendChild(option);
		});
		perspectiveSelect.value = mode.spectator.perspective || "third_person";
		perspectiveSelect.onchange = () => {
			mode.spectator!.perspective = perspectiveSelect.value as any;
			this.sync();
		};

		const quality = document.createElement("select");
		quality.title = "Rendimiento del modo observador";
		quality.style.cssText = "background:#111;color:#fff;border:1px solid #555;padding:6px;border-radius:4px;";
		[["full", "Calidad completa"], ["balanced", "Equilibrado"], ["low", "Máximo rendimiento"]].forEach(([value, label]) => {
			const option = document.createElement("option"); option.value = value; option.textContent = label; quality.appendChild(option);
		});
		quality.value = mode.spectator.quality || "balanced";
		quality.onchange = () => { mode.spectator!.quality = quality.value as "full" | "balanced" | "low"; this.sync(); };
		options.append(enabledLabel, followLabel, perspectiveSelect, quality);
		section.appendChild(options);
		if (roles.length) {
			const filterTitle = document.createElement("div");
			filterTitle.textContent = "Roles que se pueden observar (vacío = todos):";
			filterTitle.style.cssText = "margin-top:10px;color:#bbb;font-weight:600;";
			section.appendChild(filterTitle);
			const roleFilters = document.createElement("div");
			roleFilters.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;";
			roles.forEach((role) => {
				const allowed = mode.spectator!.allowedRoleIds || [];
				roleFilters.appendChild(this.createInlineCheckbox(role.name || role.id, allowed.includes(role.id), (checked) => {
					const next = new Set(mode.spectator!.allowedRoleIds || []);
					if (checked) next.add(role.id); else next.delete(role.id);
					mode.spectator!.allowedRoleIds = Array.from(next);
					this.sync();
				}));
			});
			section.appendChild(roleFilters);
		}
		const hint = document.createElement("small");
		hint.textContent = "En equilibrado y máximo rendimiento se omiten animaciones detalladas de jugadores lejanos; la interpolación y el jugador observado se mantienen.";
		hint.style.cssText = "display:block;margin-top:8px;color:#888;";
		section.appendChild(hint);
		return section;
	}

	private createInlineCheckbox(text: string, checked: boolean, onChange: (value: boolean) => void): HTMLLabelElement {
		const label = document.createElement("label");
		label.style.cssText = "display:flex;gap:6px;align-items:center;color:#ddd;cursor:pointer;";
		const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = checked;
		checkbox.onchange = () => onChange(checkbox.checked);
		label.append(checkbox, document.createTextNode(text));
		return label;
	}

	private createDeathScreenSection(mode: ExperienceModeProfile): HTMLElement {
		const section = this.createSectionBox("Personalización de la Pantalla de Muerte");
		const screen = mode.deathScreen;

		// Enabled toggle
		const toggleRow = document.createElement("label");
		toggleRow.style.cssText = "display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;";
		const enableCb = document.createElement("input");
		enableCb.type = "checkbox";
		enableCb.checked = screen.enabled !== false;
		enableCb.onchange = () => {
			screen.enabled = enableCb.checked;
			this.sync();
			if (this.container) this.render(this.container);
		};
		const toggleText = document.createElement("span");
		toggleText.textContent = "Activar pantalla de muerte para este modo";
		toggleText.style.fontWeight = "bold";
		toggleRow.append(enableCb, toggleText);
		section.appendChild(toggleRow);

		if (!screen.enabled) {
			const disabledNotice = document.createElement("div");
			disabledNotice.textContent = "La pantalla de muerte está desactivada. El jugador reaparecerá directamente según la política.";
			disabledNotice.style.cssText = "color: #888; font-style: italic;";
			section.appendChild(disabledNotice);
			return section;
		}

		// Header for Visual Designer
		const visualHeader = document.createElement("div");
		visualHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin: 4px 0 10px;";
		const visualTitle = document.createElement("strong");
		visualTitle.innerHTML = "🎨 Editor Visual de Diseño, Lienzo y Reglas";
		visualTitle.style.color = "#00d2ff";

		const toggleVisualBtn = document.createElement("button");
		toggleVisualBtn.type = "button";
		toggleVisualBtn.textContent = this.showVisualEditor ? "▲ Ocultar Diseñador Visual" : "▼ Mostrar Diseñador Visual";
		toggleVisualBtn.style.cssText = "background: #232734; border: 1px solid #3d445c; color: #eee; font-size: 11px; padding: 4px 10px; border-radius: 4px; cursor: pointer;";
		toggleVisualBtn.onclick = () => {
			this.showVisualEditor = !this.showVisualEditor;
			if (this.container) this.render(this.container);
		};
		visualHeader.append(visualTitle, toggleVisualBtn);
		section.appendChild(visualHeader);

		if (this.showVisualEditor) {
			const editorContainer = document.createElement("div");
			editorContainer.style.cssText = "margin-bottom: 12px;";
			this.visualEditor = new DeathScreenEditor({
				mode,
				onSync: () => {
					// Synchronize primary title and action buttons
					const titleElem = mode.deathScreen.elements?.find((e) => e.type === "title");
					if (titleElem && titleElem.content) {
						mode.deathScreen.title = titleElem.content;
					}
					const btnElems = mode.deathScreen.elements?.filter((e) => e.type === "action_button") || [];
					if (btnElems.length > 0) {
						mode.deathScreen.buttons = btnElems.map((b, idx) => ({
							id: b.id || `btn_${idx}`,
							label: b.content || "Aceptar",
							action: b.action || "respawn",
							isPrimary: b.isPrimary,
						}));
					}
					this.sync();
				},
				onPreviewFullscreen: (previewState) => {
					if (this.game?.deathManager?.deathScreen) {
						this.game.deathManager.deathScreen.showPreview(mode, previewState);
					}
				},
			});
			this.visualEditor.render(editorContainer);
			section.appendChild(editorContainer);
		}

		// Quick basic fields
		const quickTitle = document.createElement("div");
		quickTitle.textContent = "Campos Rápidos de Compatibilidad:";
		quickTitle.style.cssText = "font-size: 11px; color: #888; font-weight: 600; margin-top: 6px;";
		section.appendChild(quickTitle);

		const formGrid = document.createElement("div");
		formGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 12px;";

		// Title
		const titleCol = document.createElement("div");
		titleCol.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		titleCol.innerHTML = "<label style='font-weight:600;'>Título Principal</label>";
		const titleInput = document.createElement("input");
		titleInput.type = "text";
		titleInput.value = screen.title || "HAS MUERTO";
		titleInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px;";
		titleInput.onchange = () => {
			screen.title = titleInput.value.trim() || "HAS MUERTO";
			const titleElem = screen.elements?.find((e) => e.type === "title");
			if (titleElem) titleElem.content = screen.title;
			this.sync();
			if (this.visualEditor) this.visualEditor.setMode(mode);
		};
		titleCol.appendChild(titleInput);

		// Message
		const msgCol = document.createElement("div");
		msgCol.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		msgCol.innerHTML = "<label style='font-weight:600;'>Mensaje / Subtítulo</label>";
		const msgInput = document.createElement("input");
		msgInput.type = "text";
		msgInput.value = screen.message || "";
		msgInput.placeholder = "ej. Fuera de pista, inténtalo de nuevo...";
		msgInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px;";
		msgInput.onchange = () => {
			screen.message = msgInput.value.trim();
			const subElem = screen.elements?.find((e) => e.type === "subtitle");
			if (subElem) subElem.content = screen.message;
			this.sync();
			if (this.visualEditor) this.visualEditor.setMode(mode);
		};
		msgCol.appendChild(msgInput);

		// Accent Color
		const colorCol1 = document.createElement("div");
		colorCol1.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		colorCol1.innerHTML = "<label style='font-weight:600;'>Color de Acento</label>";
		const accentInput = document.createElement("input");
		accentInput.type = "color";
		accentInput.value = screen.accentColor || "#ff3b47";
		accentInput.style.cssText = "width: 100%; height: 34px; background: none; border: 1px solid #555; border-radius: 4px; cursor: pointer;";
		accentInput.onchange = () => {
			screen.accentColor = accentInput.value;
			this.sync();
			if (this.visualEditor) this.visualEditor.setMode(mode);
		};
		colorCol1.appendChild(accentInput);

		// Background preset picker
		const bgCol = document.createElement("div");
		bgCol.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
		bgCol.innerHTML = "<label style='font-weight:600;'>Estilo de Fondo</label>";
		const bgSelect = document.createElement("select");
		bgSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px;";
		const bgOptions = [
			{ v: "rgba(13, 15, 23, 0.92)", t: "Negro Obsidiana (Estándar)" },
			{ v: "rgba(35, 10, 15, 0.94)", t: "Rojo Carmesí (Dramático)" },
			{ v: "rgba(10, 24, 38, 0.92)", t: "Azul Cibernético (Sci-Fi)" },
			{ v: "rgba(18, 14, 28, 0.94)", t: "Púrpura Neón" },
			{ v: "rgba(5, 5, 5, 0.96)", t: "Negro Total" },
		];
		bgOptions.forEach((bo) => {
			const opt = document.createElement("option");
			opt.value = bo.v;
			opt.textContent = bo.t;
			if (screen.backgroundColor === bo.v) opt.selected = true;
			bgSelect.appendChild(opt);
		});
		bgSelect.onchange = () => {
			screen.backgroundColor = bgSelect.value;
			this.sync();
			if (this.visualEditor) this.visualEditor.setMode(mode);
		};
		bgCol.appendChild(bgSelect);

		formGrid.append(titleCol, msgCol, colorCol1, bgCol);
		section.appendChild(formGrid);

		// Buttons configuration section
		const btnHeader = document.createElement("div");
		btnHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-top: 14px;";
		const btnTitle = document.createElement("strong");
		btnTitle.textContent = "Botones de Acción en Pantalla";
		const addBtn = document.createElement("button");
		addBtn.type = "button";
		addBtn.textContent = "+ Añadir Botón";
		addBtn.style.cssText = "background: #2a9d8f; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;";
		addBtn.onclick = () => {
			if (screen.buttons.length >= 3) {
				alert("Máximo 3 botones permitidos");
				return;
			}
			screen.buttons.push({
				id: `btn_${Date.now()}`,
				label: "Nuevo Botón",
				action: "respawn",
				isPrimary: false,
			});
			this.sync();
			if (this.container) this.render(this.container);
		};
		btnHeader.append(btnTitle, addBtn);
		section.appendChild(btnHeader);

		const btnList = document.createElement("div");
		btnList.style.cssText = "display: flex; flex-direction: column; gap: 8px; margin-top: 8px;";

		screen.buttons.forEach((b: DeathScreenActionButton, bIdx: number) => {
			const bRow = document.createElement("div");
			bRow.style.cssText = "display: flex; gap: 8px; align-items: center; background: #22242c; padding: 6px 10px; border-radius: 4px; border: 1px solid #333;";

			// Label input
			const lInput = document.createElement("input");
			lInput.type = "text";
			lInput.value = b.label;
			lInput.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 4px 6px; border-radius: 4px; width: 120px;";
			lInput.onchange = () => {
				b.label = lInput.value.trim() || "Aceptar";
				this.sync();
			};

			// Action select
			const aSelect = document.createElement("select");
			aSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 4px 6px; border-radius: 4px; flex: 1;";
			const actions: Array<{ v: DeathActionButtonType; t: string }> = [
				{ v: "respawn", t: "Acción: Reaparecer" },
				{ v: "spectate", t: "Acción: Observar (Espectador)" },
				{ v: "restart", t: "Acción: Reiniciar Partida" },
				{ v: "lobby", t: "Acción: Volver al Lobby" },
			];
			actions.forEach((act) => {
				const opt = document.createElement("option");
				opt.value = act.v;
				opt.textContent = act.t;
				if (b.action === act.v) opt.selected = true;
				aSelect.appendChild(opt);
			});
			aSelect.onchange = () => {
				b.action = aSelect.value as DeathActionButtonType;
				this.sync();
			};

			// Is primary checkbox
			const pLabel = document.createElement("label");
			pLabel.style.cssText = "display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;";
			const pCb = document.createElement("input");
			pCb.type = "checkbox";
			pCb.checked = Boolean(b.isPrimary);
			pCb.onchange = () => {
				screen.buttons.forEach((other) => (other.isPrimary = false));
				b.isPrimary = pCb.checked;
				this.sync();
				if (this.container) this.render(this.container);
			};
			pLabel.append(pCb, document.createTextNode("Primario"));

			// Delete button
			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.textContent = "✕";
			delBtn.title = "Eliminar botón";
			delBtn.style.cssText = "background: #8b0000; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;";
			if (screen.buttons.length <= 1) {
				delBtn.disabled = true;
				delBtn.style.opacity = "0.4";
			} else {
				delBtn.onclick = () => {
					screen.buttons.splice(bIdx, 1);
					this.sync();
					if (this.container) this.render(this.container);
				};
			}

			bRow.append(lInput, aSelect, pLabel, delBtn);
			btnList.appendChild(bRow);
		});

		section.appendChild(btnList);
		return section;
	}

	private createPreviewSection(mode: ExperienceModeProfile): HTMLElement {
		const section = this.createSectionBox("Previsualización en Pantalla Completa");

		const row = document.createElement("div");
		row.style.cssText = "display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;";

		const stateSelectWrap = document.createElement("div");
		stateSelectWrap.style.cssText = "display: flex; align-items: center; gap: 8px;";
		const stateLabel = document.createElement("strong");
		stateLabel.textContent = "Estado a probar:";

		const stateSelect = document.createElement("select");
		stateSelect.style.cssText = "background: #111; color: white; border: 1px solid #555; padding: 6px 10px; border-radius: 4px;";
		const states: Array<{ v: "respawn" | "last_life" | "game_over" | "spectator"; t: string }> = [
			{ v: "respawn", t: "Reaparición normal (con cuenta regresiva)" },
			{ v: "last_life", t: "Última vida restante" },
			{ v: "game_over", t: "Fin de partida (0 vidas restantes)" },
			{ v: "spectator", t: "Transición a modo observador" },
		];
		states.forEach((st) => {
			const opt = document.createElement("option");
			opt.value = st.v;
			opt.textContent = st.t;
			if (this.previewState === st.v) opt.selected = true;
			stateSelect.appendChild(opt);
		});
		stateSelect.onchange = () => {
			this.previewState = stateSelect.value as any;
		};
		stateSelectWrap.append(stateLabel, stateSelect);

		const previewBtn = document.createElement("button");
		previewBtn.type = "button";
		previewBtn.textContent = "▶ Previsualizar Pantalla de Muerte";
		previewBtn.style.cssText = `
			background: linear-gradient(135deg, #e63946, #d90429);
			color: white;
			border: none;
			padding: 8px 18px;
			border-radius: 6px;
			cursor: pointer;
			font-weight: bold;
			font-size: 13px;
			box-shadow: 0 4px 12px rgba(230, 57, 70, 0.4);
			transition: transform 0.15s ease;
		`;
		previewBtn.onmouseenter = () => (previewBtn.style.transform = "scale(1.02)");
		previewBtn.onmouseleave = () => (previewBtn.style.transform = "scale(1)");
		previewBtn.onclick = () => {
			if (this.game?.deathManager?.deathScreen) {
				this.game.deathManager.deathScreen.showPreview(mode, this.previewState);
			}
		};

		row.append(stateSelectWrap, previewBtn);
		section.appendChild(row);
		return section;
	}

	private createSectionBox(titleText: string): HTMLElement {
		const box = document.createElement("div");
		box.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 10px;
			background: #1e2027;
			padding: 12px;
			border-radius: 6px;
			border: 1px solid #2d303b;
		`;
		const heading = document.createElement("h4");
		heading.textContent = titleText;
		heading.style.margin = "0 0 4px 0";
		heading.style.color = "#00d2ff";
		heading.style.fontSize = "14px";
		box.appendChild(heading);
		return box;
	}
}
