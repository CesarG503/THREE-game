// @ts-nocheck

import * as THREE from "three";

const VFX_OPTIONS = [
  "Ninguno",
  "Bubble Explosion",
  "Cartoon Bang",
  "Cartoon Blue Flamethrower",
  "Dollar Bill Shower",
  "Cartoon Lightning Ball",
  "Cartoon Blood Splash",
  "Cartoon Fireball Explosion",
  "Cartoon Purple Lightning",
  "Explosión de Gas Azul"
];

const SCOPE_OPTIONS = [
  { value: 1, text: "Ninguno (1x)" },
  { value: 2, text: "Mira Corta (x2)" },
  { value: 4, text: "Mira Media (x4)" },
  { value: 5, text: "Mira Media-Alta (x5)" },
  { value: 8, text: "Mira Larga (x8)" },
  { value: 10, text: "Mira Francotirador (x10)" },
  { value: 16, text: "Mira Avanzada (x16)" }
];

export class AdvancedWeaponConfigPanel {
  constructor(game, constructionMenu = null) {
    this.game = game;
    this.constructionMenu = constructionMenu;
    this.weapon = null;
    this.container = null;
    this.propertyPanel = null;
    this.statsPanel = null;
    this.trajectorySvg = null;
    this.init();
  }

  init() {
    this.container = document.createElement("div");
    this.container.id = "advanced-weapon-config-panel";
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.84);
      backdrop-filter: blur(5px);
      color: #e6edf3;
      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    const style = document.createElement("style");
    style.textContent = `
      #advanced-weapon-config-panel * { box-sizing: border-box; }
      .awc-window {
        width: min(1500px, 96vw);
        height: min(900px, 92vh);
        display: grid;
        grid-template-rows: 58px 1fr 58px;
        background: rgba(18, 20, 23, 0.94);
        border: 1px solid #3c4652;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 24px 70px rgba(0,0,0,0.55);
      }
      .awc-header,
      .awc-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 18px;
        background: rgba(0,0,0,0.35);
        border-bottom: 1px solid #343b44;
      }
      .awc-footer {
        border-top: 1px solid #343b44;
        border-bottom: 0;
      }
      .awc-title {
        font-size: 15px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .awc-body {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(280px, 360px) 1fr minmax(270px, 340px);
      }
      .awc-col {
        min-height: 0;
        overflow: auto;
        padding: 18px;
      }
      .awc-col + .awc-col { border-left: 1px solid #343b44; }
      .awc-section {
        margin-bottom: 22px;
      }
      .awc-section-title {
        font-size: 11px;
        color: #8b949e;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0 0 10px;
      }
      .awc-prop-row {
        display: grid;
        grid-template-columns: 1fr 132px;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
        font-size: 13px;
      }
      .awc-prop-row.wide {
        grid-template-columns: 1fr;
        align-items: stretch;
      }
      .awc-prop-value {
        width: 100%;
        min-height: 30px;
        background: #0d1117;
        border: 1px solid #46505c;
        border-radius: 4px;
        color: #fff;
        padding: 5px 8px;
        outline: none;
      }
      .awc-prop-value[type="checkbox"] {
        width: 18px;
        min-height: 18px;
        justify-self: end;
        accent-color: #58a6ff;
      }
      .awc-btn {
        border: 1px solid #46505c;
        color: #f0f6fc;
        background: #1f2933;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 700;
        font-size: 12px;
      }
      .awc-btn:hover { background: #2d3946; }
      .awc-btn-primary {
        background: #0b65c2;
        border-color: #1f7ee7;
      }
      .awc-btn-primary:hover { background: #0f78df; }
      .awc-preview {
        height: 100%;
        min-height: 0;
        display: grid;
        grid-template-rows: 1fr auto;
        gap: 14px;
      }
      .awc-trajectory {
        width: 100%;
        height: 100%;
        min-height: 280px;
        background:
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),
          rgba(0,0,0,0.24);
        background-size: 24px 24px;
        border: 1px solid #343b44;
        border-radius: 6px;
      }
      .awc-stat {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        padding: 9px 0;
        border-bottom: 1px solid #303844;
        font-size: 13px;
      }
      .awc-chip-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .awc-chip {
        padding: 6px 8px;
        border-radius: 4px;
        background: #0d1117;
        border: 1px solid #303844;
        font-size: 12px;
        color: #c9d1d9;
      }
      @media (max-width: 980px) {
        .awc-window { height: 96vh; }
        .awc-body { grid-template-columns: 1fr; }
        .awc-col + .awc-col { border-left: 0; border-top: 1px solid #343b44; }
      }
    `;

    this.container.appendChild(style);
    document.body.appendChild(this.container);
  }

  show(weapon) {
    if (!weapon) return;
    this.weapon = weapon;
    this.render();
    this.container.style.display = "flex";
    if (this.game?.cameraController) this.game.cameraController.setUIOpen(true);
  }

  hide() {
    this.container.style.display = "none";
    if (this.game?.cameraController && !this.constructionMenu?.isVisible) {
      this.game.cameraController.setUIOpen(false);
    }
  }

  render() {
    this.container.querySelector(".awc-window")?.remove();

    const windowEl = document.createElement("div");
    windowEl.className = "awc-window";
    windowEl.innerHTML = `
      <div class="awc-header">
        <button class="awc-btn" id="awc-back-btn">Volver</button>
        <div class="awc-title">${this.escapeHtml(this.weapon.name || "Arma")}</div>
        <div></div>
      </div>
      <div class="awc-body">
        <div class="awc-col" id="awc-properties"></div>
        <div class="awc-col">
          <div class="awc-preview">
            <svg class="awc-trajectory" id="awc-trajectory" viewBox="0 0 600 320" preserveAspectRatio="none"></svg>
            <div class="awc-chip-row" id="awc-effect-chips"></div>
          </div>
        </div>
        <div class="awc-col" id="awc-stats"></div>
      </div>
      <div class="awc-footer">
        <div>
          <button class="awc-btn" id="awc-reset-btn">RESTABLECER</button>
          <button class="awc-btn" id="awc-equip-btn">EQUIPAR</button>
          <button class="awc-btn" id="awc-drop-btn">DROPEAR</button>
        </div>
        <button class="awc-btn awc-btn-primary" id="awc-save-btn">GUARDAR CAMBIOS</button>
      </div>
    `;

    this.container.appendChild(windowEl);
    this.propertyPanel = windowEl.querySelector("#awc-properties");
    this.statsPanel = windowEl.querySelector("#awc-stats");
    this.trajectorySvg = windowEl.querySelector("#awc-trajectory");

    windowEl.querySelector("#awc-back-btn").onclick = () => this.hide();
    windowEl.querySelector("#awc-save-btn").onclick = () => {
      this.syncConstructionMenu();
      this.hide();
    };
    windowEl.querySelector("#awc-reset-btn").onclick = () => this.resetWeapon();
    windowEl.querySelector("#awc-equip-btn").onclick = () => this.equipWeapon();
    windowEl.querySelector("#awc-drop-btn").onclick = () => this.dropWeapon();

    this.populateProperties();
    this.drawTrajectory();
    this.renderStats();
    this.renderEffectChips();
  }

  createSection(title) {
    const section = document.createElement("div");
    section.className = "awc-section";
    const heading = document.createElement("div");
    heading.className = "awc-section-title";
    heading.textContent = title;
    section.appendChild(heading);
    this.propertyPanel.appendChild(section);
    return section;
  }

  createInput(section, label, kind, value, key) {
    const row = document.createElement("label");
    row.className = "awc-prop-row";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    row.appendChild(labelEl);

    let input;
    if (Array.isArray(kind)) {
      input = document.createElement("select");
      kind.forEach((entry) => {
        const option = document.createElement("option");
        if (typeof entry === "object") {
          option.value = entry.value;
          option.textContent = entry.text;
        } else {
          option.value = entry;
          option.textContent = entry;
        }
        input.appendChild(option);
      });
      input.value = value;
    } else {
      input = document.createElement("input");
      input.type = kind;
      if (kind === "number") {
        input.step = "0.1";
      }
      if (kind === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = value;
      }
    }

    input.className = "awc-prop-value";
    input.addEventListener(kind === "checkbox" ? "change" : "input", () => {
      if (kind === "checkbox") {
        this.weapon[key] = input.checked;
      } else if (kind === "number") {
        const numeric = parseFloat(input.value);
        if (!Number.isNaN(numeric)) this.weapon[key] = numeric;
      } else {
        this.weapon[key] = key === "maxScope" ? parseInt(input.value) : input.value;
      }
      this.syncInlineControls(key);
      this.drawTrajectory();
      this.renderStats();
      this.renderEffectChips();
    });

    row.appendChild(input);
    section.appendChild(row);
  }

  createVFXSelects(section, label, key) {
    const row = document.createElement("div");
    row.className = "awc-prop-row wide";

    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
    const labelEl = document.createElement("span");
    labelEl.textContent = `${label} (Máx 3)`;
    const addBtn = document.createElement("button");
    addBtn.className = "awc-btn";
    addBtn.textContent = "+";
    addBtn.style.padding = "3px 9px";
    header.appendChild(labelEl);
    header.appendChild(addBtn);
    row.appendChild(header);

    const selectContainer = document.createElement("div");
    selectContainer.style.cssText = "display:flex; flex-direction:column; gap:6px;";
    row.appendChild(selectContainer);
    section.appendChild(row);

    let values = String(this.weapon[key] || "Ninguno").split(",").map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) values = ["Ninguno"];

    const commit = () => {
      this.weapon[key] = values.join(", ");
      this.syncInlineControls(key);
      this.renderEffectChips();
    };

    const render = () => {
      selectContainer.innerHTML = "";
      addBtn.style.display = values.length < 3 ? "inline-flex" : "none";

      values.forEach((value, index) => {
        const selectRow = document.createElement("div");
        selectRow.style.cssText = "display:grid; grid-template-columns:1fr 32px; gap:6px;";

        const select = document.createElement("select");
        select.className = "awc-prop-value";
        VFX_OPTIONS.forEach((optionValue) => {
          const option = document.createElement("option");
          option.value = optionValue;
          option.textContent = optionValue;
          select.appendChild(option);
        });
        select.value = value;
        select.onchange = () => {
          values[index] = select.value;
          commit();
        };

        const removeBtn = document.createElement("button");
        removeBtn.className = "awc-btn";
        removeBtn.textContent = "x";
        removeBtn.onclick = () => {
          values.splice(index, 1);
          if (values.length === 0) values = ["Ninguno"];
          commit();
          render();
        };

        selectRow.appendChild(select);
        selectRow.appendChild(removeBtn);
        selectContainer.appendChild(selectRow);
      });
    };

    addBtn.onclick = () => {
      if (values.length < 3) {
        values.push("Ninguno");
        commit();
        render();
      }
    };

    render();
  }

  populateProperties() {
    this.propertyPanel.innerHTML = "";

    let section = this.createSection("ESTADISTICAS BASICAS");
    this.createInput(section, "Daño", "number", this.weapon.damage ?? 10, "damage");
    this.createInput(section, "Tiempo de Recarga (s)", "number", this.weapon.cooldown ?? 0.5, "cooldown");
    this.createInput(section, "Mano Equipada", [
      { value: "right", text: "Derecha" },
      { value: "left", text: "Izquierda" }
    ], this.weapon.equippedHand || "right", "equippedHand");
    this.createInput(section, "Nivel de Mira (Scope)", SCOPE_OPTIONS, this.weapon.maxScope ?? 1, "maxScope");

    section = this.createSection("DISPARO");
    this.createInput(section, "Retroceso", "number", this.weapon.recoil ?? 5, "recoil");
    this.createInput(section, "Modo de Retroceso", [
      { value: "hybrid", text: "Híbrido" },
      { value: "recenter", text: "Auto-Centrado" },
      { value: "manual", text: "Manual" }
    ], this.weapon.recoilMode || "hybrid", "recoilMode");
    this.createInput(section, "Automático", "checkbox", this.weapon.isAuto ?? false, "isAuto");
    this.createInput(section, "Velocidad de Disparo", "number", this.weapon.shotSpeed ?? 50, "shotSpeed");

    section = this.createSection("PROYECTIL");
    this.createInput(section, "Tipo de Proyectil", [
      { value: "bullet", text: "Bala" },
      { value: "ball", text: "Pelota" }
    ], this.weapon.projectileType || "bullet", "projectileType");
    this.createInput(section, "Gravedad (Caída)", "number", this.weapon.bulletDrop ?? 1, "bulletDrop");
    this.createInput(section, "Estela de Humo", "checkbox", this.weapon.hasTracer ?? false, "hasTracer");
    this.createInput(section, "Línea de Trayectoria", "checkbox", this.weapon.hasTrajectoryLine ?? false, "hasTrajectoryLine");
    this.createInput(section, "Rebote al Chocar", "checkbox", this.weapon.rebote ?? false, "rebote");

    section = this.createSection("EFECTOS");
    this.createInput(section, "Impacto (Humo)", "checkbox", this.weapon.hasImpactEffect ?? false, "hasImpactEffect");
    this.createVFXSelects(section, "Estela Especial VFX", "customTracerVFX");
    this.createVFXSelects(section, "Efecto de Impacto VFX", "customImpactVFX");
    this.createInput(section, "Permanecer para siempre", "checkbox", this.weapon.tracerStayForever ?? false, "tracerStayForever");
    this.createInput(section, "Eliminar al Colisionar", "checkbox", this.weapon.tracerDestroyOnCollision ?? false, "tracerDestroyOnCollision");
    this.createInput(section, "Efecto VFX al Colisionar", VFX_OPTIONS, this.weapon.tracerCollisionVFX || "Ninguno", "tracerCollisionVFX");

    section = this.createSection("IMPULSO AL JUGADOR");
    this.createInput(section, "Salto Cohete", "checkbox", this.weapon.hasPlayerImpulseUp ?? false, "hasPlayerImpulseUp");
    this.createInput(section, "Fuerza Salto Cohete", "number", this.weapon.playerImpulseUpForce ?? 15, "playerImpulseUpForce");
    this.createInput(section, "Reducción en el Aire (%)", "number", this.weapon.playerImpulseUpAirReduction ?? 50, "playerImpulseUpAirReduction");
    this.createInput(section, "Empuje Atrás", "checkbox", this.weapon.hasPlayerImpulseBack ?? false, "hasPlayerImpulseBack");
    this.createInput(section, "Fuerza Empuje Atrás", "number", this.weapon.playerImpulseBackForce ?? 5, "playerImpulseBackForce");
  }

  drawTrajectory() {
    if (!this.trajectorySvg) return;
    const speed = Math.max(1, Number(this.weapon.shotSpeed ?? 50));
    const drop = this.weapon.projectileType === "bullet" ? 0 : Math.max(0, Number(this.weapon.bulletDrop ?? 1));
    const points = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = 35 + t * 520;
      const y = 250 - Math.min(speed * 0.85, 120) * t + drop * 95 * t * t;
      points.push(`${x.toFixed(1)},${Math.max(30, Math.min(290, y)).toFixed(1)}`);
    }
    this.trajectorySvg.innerHTML = `
      <polyline points="${points.join(" ")}" fill="none" stroke="#58a6ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="35" cy="250" r="7" fill="#f0883e"/>
      <text x="24" y="286" fill="#8b949e" font-size="13">origen</text>
      <text x="438" y="42" fill="#8b949e" font-size="13">trayectoria estimada</text>
    `;
  }

  renderStats() {
    if (!this.statsPanel) return;
    const dps = (Number(this.weapon.damage ?? 10) / Math.max(Number(this.weapon.cooldown ?? 0.5), 0.05)).toFixed(1);
    const scope = Number(this.weapon.maxScope ?? 1);
    const projectile = this.weapon.projectileType || "bullet";

    this.statsPanel.innerHTML = `
      <div class="awc-section-title">RESUMEN</div>
      ${this.statRow("DPS estimado", dps)}
      ${this.statRow("Daño", this.weapon.damage ?? 10)}
      ${this.statRow("Cooldown", `${this.weapon.cooldown ?? 0.5}s`)}
      ${this.statRow("Velocidad", this.weapon.shotSpeed ?? 50)}
      ${this.statRow("Proyectil", projectile)}
      ${this.statRow("Mira máxima", `x${scope}`)}
      ${this.statRow("Modo recoil", this.weapon.recoilMode || "hybrid")}
      ${this.statRow("Disparo", this.weapon.isAuto ? "Automático" : "Semiauto")}
    `;
  }

  renderEffectChips() {
    const chips = this.container.querySelector("#awc-effect-chips");
    if (!chips) return;
    const values = [
      this.weapon.customTracerVFX,
      this.weapon.customImpactVFX,
      this.weapon.tracerCollisionVFX,
      this.weapon.hasTracer ? "Humo" : null,
      this.weapon.hasTrajectoryLine ? "Linea" : null,
      this.weapon.tracerStayForever ? "Persistente" : null,
      this.weapon.tracerDestroyOnCollision ? "Destruir al colisionar" : null
    ].filter(Boolean);

    chips.innerHTML = values.length
      ? values.map((value) => `<span class="awc-chip">${this.escapeHtml(String(value))}</span>`).join("")
      : `<span class="awc-chip">Sin efectos activos</span>`;
  }

  statRow(label, value) {
    return `<div class="awc-stat"><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(String(value))}</strong></div>`;
  }

  syncInlineControls(key = null) {
    const cm = this.constructionMenu;
    if (!cm) return;

    cm.currentDraftItem = this.weapon;
    const map = {
      damage: cm.damageInput,
      cooldown: cm.cooldownInput,
      equippedHand: cm.handSelect,
      maxScope: cm.maxScopeSelect,
      recoil: cm.recoilInput,
      recoilMode: cm.recoilModeSelect,
      isAuto: cm.autoInput,
      projectileType: cm.projectileTypeSelect,
      shotSpeed: cm.speedInput,
      bulletDrop: cm.dropInput,
      hasTracer: cm.tracerInput,
      hasTrajectoryLine: cm.trajectoryInput,
      rebote: cm.reboteInput,
      hasImpactEffect: cm.impactInput,
      customTracerVFX: cm.customTracerSelect,
      tracerStayForever: cm.tracerStayForeverInput,
      tracerDestroyOnCollision: cm.tracerDestroyInput,
      tracerCollisionVFX: cm.tracerCollisionSelect,
      customImpactVFX: cm.customImpactSelect,
      hasPlayerImpulseUp: cm.playerImpulseUpInput,
      playerImpulseUpForce: cm.playerImpulseUpForceInput,
      playerImpulseUpAirReduction: cm.playerImpulseUpAirRedInput,
      hasPlayerImpulseBack: cm.playerImpulseBackInput,
      playerImpulseBackForce: cm.playerImpulseBackForceInput
    };

    const sync = (prop) => {
      const input = map[prop];
      if (!input) return;
      if (input.type === "checkbox") input.checked = Boolean(this.weapon[prop]);
      else input.value = this.weapon[prop] ?? "";
    };

    if (key) sync(key);
    else Object.keys(map).forEach(sync);
  }

  syncConstructionMenu() {
    this.syncInlineControls();
    if (this.constructionMenu?.editorTitle) {
      this.constructionMenu.editorTitle.textContent = this.weapon.name;
    }
  }

  resetWeapon() {
    if (!this.weapon?.originalConfig) return;
    const draft = new this.weapon.constructor(this.weapon.originalConfig);
    if (this.weapon._baseId) draft._baseId = this.weapon._baseId;
    this.weapon = draft;
    if (this.constructionMenu) {
      this.constructionMenu.currentDraftItem = draft;
      this.constructionMenu.selectItem(draft);
    }
    this.render();
  }

  createWeaponCopy() {
    const draftConfig = Object.assign({}, this.weapon.originalConfig || {}, this.weapon);
    delete draftConfig.model;
    delete draftConfig.equipGroup;
    delete draftConfig.transformGroup;
    delete draftConfig.mixer;
    delete draftConfig.actionShoot;
    delete draftConfig.actionReload;
    delete draftConfig.blasterSystem;
    return new this.weapon.constructor(draftConfig);
  }

  equipWeapon() {
    if (!this.game?.inventoryManager || !this.weapon) return;
    this.game.inventoryManager.addItem(this.createWeaponCopy());
  }

  dropWeapon() {
    if (!this.game?.itemDropManager || !this.game?.character || !this.weapon) return;
    const newWeapon = this.createWeaponCopy();
    const pos = this.game.character.getPosition().clone();
    const dir = new THREE.Vector3();
    if (this.game.sceneManager?.camera) {
      this.game.sceneManager.camera.getWorldDirection(dir);
    }
    pos.add(dir.clone().multiplyScalar(1.5));
    pos.y += 1.5;

    const dropped = this.game.itemDropManager.dropItem(newWeapon, pos, dir);

    if (this.game.networkManager?.isConnected) {
      const itemData = Object.assign({}, newWeapon);
      itemData.itemClass = newWeapon.constructor.name;
      delete itemData.model;
      delete itemData.equipGroup;
      delete itemData.transformGroup;
      delete itemData.mixer;
      delete itemData.actionShoot;
      delete itemData.actionReload;
      delete itemData.blasterSystem;
      delete itemData.originalConfig;

      this.game.networkManager.sendPlayerAction("dropItem", {
        dropId: dropped.dropId,
        itemData,
        position: { x: pos.x, y: pos.y, z: pos.z },
        direction: { x: dir.x, y: dir.y, z: dir.z },
        torque: dropped.torque
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
