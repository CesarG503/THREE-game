// @ts-nocheck

import { HUDConfigPanel } from './HUDConfigPanel'
import { uploadAsset } from '../platform/api'
import { GRAVITY_ORIENTATION_OPTIONS } from '../utils/GravityOrientation'

const DEFAULT_POLYGON_SKIN_URL = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/entity/player/wide/steve.png"

export class PlayerConfigPanel {
    constructor(game, manager) {
        this.game = game;
        this.manager = manager;
        this.container = null;
        this.selectedProfileId = 'default';
        this.activeRoleVisualTab = 'sameRole';
        this.hudPanel = new HUDConfigPanel(game, manager, () => {
            // Optional callback on close
        });
    }

    createUI(parentContainer) {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            color: white; font-family: sans-serif;
            min-height: 0;
        `;

        if (!document.getElementById('player-config-scroll-style')) {
            const scrollStyle = document.createElement('style');
            scrollStyle.id = 'player-config-scroll-style';
            scrollStyle.innerHTML = `
                .player-config-scroll::-webkit-scrollbar { width: 6px; }
                .player-config-scroll::-webkit-scrollbar-track { background: #111; }
                .player-config-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
                .player-config-scroll::-webkit-scrollbar-thumb:hover { background: #555; }
            `;
            this.container.appendChild(scrollStyle);
        }

        this.activeTab = 'roles'; // 'roles' or 'spawns'
        parentContainer.appendChild(this.container);
        this.render();
    }


    render() {
        this.container.innerHTML = ""; // Clear for full re-render

        // Tab Header
        const tabHeader = document.createElement('div');
        tabHeader.style.cssText = "display:flex; border-bottom:1px solid #444; margin-bottom:10px; background:#222; flex-shrink: 0;";

        const createTab = (id, label) => {
            const tab = document.createElement('div');
            tab.textContent = label;
            tab.style.cssText = `
                padding: 10px 20px; cursor: pointer;
                background: ${this.activeTab === id ? '#444' : 'transparent'};
                color: ${this.activeTab === id ? 'white' : '#aaa'};
                font-weight: bold; border-right: 1px solid #444;
            `;
            tab.onclick = () => {
                this.activeTab = id;
                this.render();
            };
            return tab;
        };

        tabHeader.appendChild(createTab('roles', 'Roles de Jugador'));
        tabHeader.appendChild(createTab('spawns', 'Puntos de Aparición'));
        tabHeader.appendChild(createTab('apply', 'Test Aplicar'));
        this.container.appendChild(tabHeader);

        // Content Container
        const content = document.createElement('div');
        content.className = 'player-config-scroll';
        content.style.cssText = "flex:1; display:flex; overflow-y:auto; overflow-x:hidden; min-height:0;";
        this.container.appendChild(content);

        if (this.activeTab === 'roles') {
            this.renderRolesTab(content);
        } else if (this.activeTab === 'spawns') {
            this.renderSpawnPanel(content);
        } else if (this.activeTab === 'apply') {
            this.renderApplyTab(content);
        }
    }

    renderRolesTab(parentContainer) {
        // Wrapper for 2-column layout
        parentContainer.className = 'player-config-scroll';
        parentContainer.style.display = 'flex';
        parentContainer.style.gap = '20px';
        parentContainer.style.alignItems = 'flex-start'; // Allow items to dictate their own height
        parentContainer.style.overflowY = 'auto'; // Master scroll for the whole tab
        parentContainer.style.paddingRight = '5px'; // Offset for scrollbar

        // Left: Sidebar (Profile List)
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width: 250px;
            background: #222;
            border-right: 1px solid #444;
            display: flex; flex-direction: column;
            padding: 10px; gap: 10px;
            box-sizing: border-box;
            flex-shrink: 0;
            position: sticky; /* Keep sidebar visible while scrolling content */
            top: 0;
            height: fit-content;
        `;

        const sbTitle = document.createElement('h3');
        sbTitle.textContent = "Editor de Roles";
        sbTitle.style.margin = "0 0 10px 0";
        sbTitle.style.borderBottom = "1px solid #555";
        sbTitle.style.paddingBottom = "5px";
        sbTitle.style.flexShrink = "0";
        sidebar.appendChild(sbTitle);

        // Container for list
        this.profileList = document.createElement('div');
        this.profileList.style.cssText = `
            display: flex; flex-direction: column; gap: 5px;
        `;

        sidebar.appendChild(this.profileList);

        const addBtn = document.createElement('button');
        addBtn.textContent = "+ Crear Nuevo Rol";
        addBtn.style.cssText = `
            background: #00aa00; color: white; border: none; padding: 10px;
            cursor: pointer; border-radius: 4px; font-weight: bold;
            flex-shrink: 0; 
            margin-top: 10px;
        `;
        addBtn.onclick = () => {
            const newP = this.manager.addProfile();
            this.selectedProfileId = newP.id;
            this.render();
        };
        sidebar.appendChild(addBtn);

        parentContainer.appendChild(sidebar);

        // Right: Content (Editor)
        this.contentArea = document.createElement('div');
        this.contentArea.style.cssText = `
            flex: 1; display: flex; flex-direction: column; gap: 15px;
            padding: 10px; min-width: 0; /* Prevent horizontal overflow */
        `;
        parentContainer.appendChild(this.contentArea);

        this.renderSidebar();
        this.renderContent();
    }

    renderSpawnPanel(parentContainer) {
        parentContainer.className = 'player-config-scroll';
        parentContainer.style.flexDirection = 'column';
        parentContainer.style.padding = '20px';
        parentContainer.style.overflowY = 'auto';

        const title = document.createElement('h2');
        title.textContent = "Gestión de Puntos de Aparición";
        title.style.borderBottom = "1px solid #555";
        title.style.paddingBottom = "10px";
        parentContainer.appendChild(title);

        // Scan Scene
        const spawns = [];
        if (this.game.sceneManager && this.game.sceneManager.scene) {
            this.game.sceneManager.scene.traverse(child => {
                if (child.userData && child.userData.mapObjectType === 'spawn_point') {
                    spawns.push(child);
                }
            });
        }

        const stats = document.createElement('div');
        stats.style.marginBottom = "20px";
        stats.innerHTML = `<p>Total Puntos de Aparición detectados: <strong style="color:#0f0">${spawns.length}</strong></p>`;
        parentContainer.appendChild(stats);

        // Group by Team
        const teams = {}; // 0 = Global/No Team
        spawns.forEach(s => {
            const t = (s.userData.logicProperties && s.userData.logicProperties.team) || 1; // Default Team 1
            if (!teams[t]) teams[t] = 0;
            teams[t]++;
        });

        // 1. Global Default
        const globalBox = document.createElement('div');
        globalBox.style.cssText = "background:#222; padding:15px; border-radius:4px; margin-bottom:20px; border:1px solid #444;";
        globalBox.innerHTML = "<h3 style='margin-top:0;'>Asignación Global</h3><p style='color:#aaa; font-size:12px;'>Rol por defecto para jugadores sin equipo o si no hay regla específica.</p>";

        const globalRow = document.createElement('div');
        globalRow.style.display = 'flex';
        globalRow.style.gap = '10px';
        globalRow.style.alignItems = 'center';

        const globalSel = this.createProfileSelector(this.manager.assignments.defaultProfileId);
        const globalBtn = document.createElement('button');
        globalBtn.textContent = "Aplicar a Todo";
        globalBtn.style.cssText = "padding:5px 10px; cursor:pointer; background:#444; color:white; border:none;";
        globalBtn.onclick = () => {
            this.manager.setDefaultProfile(globalSel.value);
            alert("Rol Global Actualizado");
        };

        globalRow.appendChild(globalSel);
        globalRow.appendChild(globalBtn);
        globalBox.appendChild(globalRow);
        parentContainer.appendChild(globalBox);

        // 2. Team Assignments
        const teamSection = document.createElement('div');
        teamSection.innerHTML = "<h3>Asignación por Equipos</h3>";

        Object.keys(teams).sort().forEach(teamId => {
            const teamRow = document.createElement('div');
            teamRow.style.cssText = "background:#333; padding:10px; margin-bottom:10px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;";

            const info = document.createElement('div');
            info.innerHTML = `<strong>Equipo ${teamId}</strong> <span style='color:#aaa;'>(${teams[teamId]} Spawns)</span>`;

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '10px';

            const currentProfile = this.manager.assignments.teamProfiles[teamId] || 'default';
            const sel = this.createProfileSelector(currentProfile);

            const btn = document.createElement('button');
            btn.textContent = "Asignar";
            btn.style.cssText = "padding:5px 10px; cursor:pointer; background:#0066cc; color:white; border:none; border-radius:3px;";
            btn.onclick = () => {
                this.manager.setTeamProfile(teamId, sel.value);
                alert(`Rol asignado al Equipo ${teamId}`);
            };

            actions.appendChild(sel);
            actions.appendChild(btn);

            teamRow.appendChild(info);
            teamRow.appendChild(actions);
            teamSection.appendChild(teamRow);
        });

        if (Object.keys(teams).length === 0) {
            teamSection.innerHTML += "<p style='color:#aaa; font-style:italic;'>No se han detectado equipos (spawns con propiedad team).</p>";
        }

        parentContainer.appendChild(teamSection);
    }

    renderApplyTab(parentContainer) {
        parentContainer.className = 'player-config-scroll';
        parentContainer.style.flexDirection = 'column';
        parentContainer.style.padding = '20px';
        parentContainer.style.overflowY = 'auto';

        const title = document.createElement('h2');
        title.textContent = "Aplicar Roles en Tiempo Real";
        title.style.borderBottom = "1px solid #555";
        title.style.paddingBottom = "10px";
        parentContainer.appendChild(title);

        const listContainer = document.createElement('div');
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '10px';
        parentContainer.appendChild(listContainer);

        // Gather players
        const players = [];
        if (this.game.networkManager) {
            if (this.game.networkManager.playerId) {
                players.push({
                    id: this.game.networkManager.playerId,
                    name: "Tu (" + (this.game.networkManager.playerName || "Jugador") + ")",
                    isLocal: true
                });
            }
            if (this.game.networkManager.remotePlayers) {
                this.game.networkManager.remotePlayers.forEach((p, id) => {
                    players.push({ id: id, name: p.playerName, isLocal: false });
                });
            }
        } else {
            // Fallback for offline testing
            players.push({ id: 'local', name: "Tu (Offline)", isLocal: true });
        }

        if (players.length === 0) {
            listContainer.innerHTML = "<p style='color:#aaa;'>No hay jugadores conectados.</p>";
            return;
        }

        players.forEach(player => {
            const row = document.createElement('div');
            row.style.cssText = "background:#222; padding:15px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; border:1px solid #444;";

            const infoBox = document.createElement('div');
            const nameEl = document.createElement('div');
            nameEl.innerHTML = `<strong>${player.name}</strong>`;
            if (player.isLocal) {
                nameEl.innerHTML += ` <span style='background:#00aa00; padding:2px 5px; border-radius:3px; font-size:10px; margin-left:5px;'>Local</span>`;
            }
            infoBox.appendChild(nameEl);

            const actionsBox = document.createElement('div');
            actionsBox.style.display = 'flex';
            actionsBox.style.gap = '10px';
            actionsBox.style.alignItems = 'center';

            // Determine current assignment
            let currentProfileId = this.manager.assignments.defaultProfileId; // fallback
            if (this.manager.assignments.playerProfiles && this.manager.assignments.playerProfiles[player.id]) {
                currentProfileId = this.manager.assignments.playerProfiles[player.id];
            }

            const sel = this.createProfileSelector(currentProfileId);

            const btn = document.createElement('button');
            btn.textContent = "Aplicar Rol";
            btn.style.cssText = "padding:8px 15px; cursor:pointer; background:#0066cc; color:white; border:none; border-radius:3px; font-weight:bold;";
            btn.onclick = () => {
                this.manager.setPlayerProfile(player.id, sel.value);
                // Si es el jugador local, forzamos aplicar cambios inmediatamente
                if (player.isLocal) {
                    this.manager.applyConfiguration();
                }
                alert(`Rol aplicado a ${player.name}`);
            };

            actionsBox.appendChild(sel);
            actionsBox.appendChild(btn);

            row.appendChild(infoBox);
            row.appendChild(actionsBox);
            listContainer.appendChild(row);
        });
    }

    createProfileSelector(selectedId) {
        const sel = document.createElement('select');
        sel.style.cssText = "background:#111; color:white; padding:5px; border:1px solid #555; border-radius:3px;";
        this.manager.getProfiles().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            if (p.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    }

    renderSidebar() {
        this.profileList.innerHTML = "";
        const profiles = this.manager.getProfiles();

        profiles.forEach(p => {
            const item = document.createElement('div');
            const isSelected = p.id === this.selectedProfileId;
            item.style.cssText = `
                padding: 10px;
                background: ${isSelected ? '#444' : '#333'};
                border-left: 4px solid ${p.color};
                cursor: pointer;
                display: flex; justify-content: space-between; align-items: center;
                border-radius: 4px;
            `;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = p.name;
            item.appendChild(nameSpan);

            // Delete Btn
            if (p.id !== 'default' && p.id !== 'admin_tester') {
                const delBtn = document.createElement('button');
                delBtn.textContent = "✕";
                delBtn.style.cssText = "background:none; border:none; color:#f44; cursor:pointer;";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar perfil "${p.name}"?`)) {
                        this.manager.removeProfile(p.id);
                        if (this.selectedProfileId === p.id) this.selectedProfileId = 'admin_tester';
                        this.render();
                    }
                };
                item.appendChild(delBtn);
            }

            item.onclick = () => {
                this.selectedProfileId = p.id;
                this.render();
            };

            this.profileList.appendChild(item);
        });
    }

    renderContent() {
        this.contentArea.innerHTML = "";
        const profile = this.manager.getProfile(this.selectedProfileId);
        if (!profile) return;

        // Header
        const header = document.createElement('div');
        header.style.cssText = "border-bottom: 1px solid #555; padding-bottom: 10px; margin-bottom: 10px;";

        const titleInput = document.createElement('input');
        titleInput.value = profile.name;
        titleInput.style.cssText = "background: #222; border: 1px solid #555; color: white; font-size: 20px; padding: 5px; width: 300px;";
        titleInput.onchange = (e) => {
            this.manager.updateProfile(profile.id, { name: e.target.value });
            this.renderSidebar(); // Refresh name in list
        };
        header.appendChild(titleInput);
        this.contentArea.appendChild(header);

        // Properties Grid
        const grid = document.createElement('div');
        grid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 20px;";

        // Stats Column
        const statsCol = document.createElement('div');
        statsCol.innerHTML = "<h4 style='color:#aaa; border-bottom:1px solid #444;'>Estadísticas Base</h4>";

        this.createStatControl(statsCol, "Vida Total", 'maxHealth', profile, 1, 1000);
        this.createStatControl(statsCol, "Velocidad Movimiento", 'speed', profile, 1, 50);
        this.createStatControl(statsCol, "Fuerza de Salto", 'jumpForce', profile, 0, 50);
        // Multi-Jump Control (Conditional)
        const multiJumpControl = this.createStatControl(statsCol, "Saltos en el Aire", 'maxMultiJumps', profile, 0, 10);

        // Flight Toggle
        const flightContainer = document.createElement('div');
        flightContainer.style.marginTop = "10px";
        flightContainer.style.display = "flex";
        flightContainer.style.alignItems = "center";
        flightContainer.style.gap = "10px";

        const flightCheck = document.createElement('input');
        flightCheck.type = "checkbox";
        flightCheck.checked = profile.canFly || false;
        flightCheck.style.transform = "scale(1.2)";
        flightCheck.onchange = (e) => {
            // No mutual exclusivity -> Flight and Multi-Jump can coexist
            this.manager.updateProfile(profile.id, { canFly: e.target.checked });
        };

        const flightLabel = document.createElement('label');
        flightLabel.textContent = "Habilitar Vuelo (Doble Salto)";
        flightLabel.style.color = "#ddd";
        flightLabel.onclick = () => flightCheck.click();

        flightContainer.appendChild(flightCheck);
        flightContainer.appendChild(flightLabel);
        statsCol.appendChild(flightContainer);

        // Hide HUD Toggle
        const hideHUDContainer = document.createElement('div');
        hideHUDContainer.style.marginTop = "10px";
        hideHUDContainer.style.display = "flex";
        hideHUDContainer.style.alignItems = "center";
        hideHUDContainer.style.gap = "10px";

        const hideHUDCheck = document.createElement('input');
        hideHUDCheck.type = "checkbox";
        hideHUDCheck.checked = profile.hideHUD || false;
        hideHUDCheck.style.transform = "scale(1.2)";
        hideHUDCheck.onchange = (e) => {
            this.manager.updateProfile(profile.id, { hideHUD: e.target.checked });
        };

        const hideHUDLabel = document.createElement('label');
        hideHUDLabel.textContent = "Ocultar HUD del Jugador";
        hideHUDLabel.style.color = "#ddd";
        hideHUDLabel.onclick = () => hideHUDCheck.click();

        hideHUDContainer.appendChild(hideHUDCheck);
        hideHUDContainer.appendChild(hideHUDLabel);
        statsCol.appendChild(hideHUDContainer);

        // Disable Interaction Toggle
        const disableInteractionContainer = document.createElement('div');
        disableInteractionContainer.style.marginTop = "10px";
        disableInteractionContainer.style.display = "flex";
        disableInteractionContainer.style.alignItems = "center";
        disableInteractionContainer.style.gap = "10px";

        const disableInteractionCheck = document.createElement('input');
        disableInteractionCheck.type = "checkbox";
        disableInteractionCheck.checked = profile.disableInteraction || false;
        disableInteractionCheck.style.transform = "scale(1.2)";
        disableInteractionCheck.onchange = (e) => {
            this.manager.updateProfile(profile.id, { disableInteraction: e.target.checked });
        };

        const disableInteractionLabel = document.createElement('label');
        disableInteractionLabel.textContent = "Deshabilitar Construcción / Interacción";
        disableInteractionLabel.style.color = "#ddd";
        disableInteractionLabel.onclick = () => disableInteractionCheck.click();

        disableInteractionContainer.appendChild(disableInteractionCheck);
        disableInteractionContainer.appendChild(disableInteractionLabel);
        statsCol.appendChild(disableInteractionContainer);

        const gravityContainer = document.createElement('div');
        gravityContainer.style.cssText = "margin-top:15px; display:flex; flex-direction:column; gap:6px;";

        const gravityLabel = document.createElement('label');
        gravityLabel.textContent = "Orientación de Gravedad";
        gravityLabel.style.cssText = "color:#aaa; font-size:13px;";
        gravityContainer.appendChild(gravityLabel);

        const gravitySelect = document.createElement('select');
        gravitySelect.style.cssText = "background:#333; color:white; padding:7px; border:1px solid #555; border-radius:4px; width:100%;";
        GRAVITY_ORIENTATION_OPTIONS.forEach(optInfo => {
            const opt = document.createElement('option');
            opt.value = optInfo.value;
            opt.textContent = optInfo.label;
            if ((profile.gravityOrientation || "down") === optInfo.value) opt.selected = true;
            gravitySelect.appendChild(opt);
        });
        gravitySelect.onchange = (e) => {
            this.manager.updateProfile(profile.id, { gravityOrientation: e.target.value });
        };
        gravityContainer.appendChild(gravitySelect);

        const gravityDurationRow = document.createElement('div');
        gravityDurationRow.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:10px;";
        const gravityDurationLabel = document.createElement('span');
        gravityDurationLabel.textContent = "Giro (s)";
        gravityDurationLabel.style.cssText = "color:#aaa; font-size:13px;";
        const gravityDurationInput = document.createElement('input');
        gravityDurationInput.type = "number";
        gravityDurationInput.min = "0";
        gravityDurationInput.step = "0.1";
        gravityDurationInput.value = profile.gravityTransitionDuration ?? 0.65;
        gravityDurationInput.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width:80px; border-radius:4px;";
        gravityDurationInput.onchange = (e) => {
            this.manager.updateProfile(profile.id, { gravityTransitionDuration: Math.max(0, parseFloat(e.target.value) || 0) });
        };
        gravityDurationInput.onkeydown = (e) => e.stopPropagation();
        gravityDurationRow.appendChild(gravityDurationLabel);
        gravityDurationRow.appendChild(gravityDurationInput);
        gravityContainer.appendChild(gravityDurationRow);

        statsCol.appendChild(gravityContainer);

        // Respawn Logic
        const respawnContainer = document.createElement('div');
        respawnContainer.style.marginTop = "15px";
        respawnContainer.innerHTML = "<label style='display:block; color:#aaa; margin-bottom:5px;'>Reapariciones</label>";

        const containerRow = document.createElement('div');
        containerRow.style.display = 'flex';
        containerRow.style.gap = '10px';

        const respawnSel = document.createElement('select');
        respawnSel.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; flex:1;";

        const respawnInput = document.createElement('input');
        respawnInput.type = "number";
        respawnInput.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width: 80px; display:none;";

        const rOpts = [
            { v: -1, t: "Infinitas" },
            { v: 0, t: "Muerte Permanente (0)" },
            { v: 1, t: "1 Vida Extra" },
            { v: 3, t: "3 Vidas" },
            { v: 5, t: "5 Vidas" },
            { v: 'custom', t: "Personalizado..." }
        ];

        let isCustom = true;
        rOpts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.v;
            opt.textContent = o.t;
            if (profile.respawns === o.v) {
                opt.selected = true;
                isCustom = false;
            }
            respawnSel.appendChild(opt);
        });

        if (isCustom) {
            respawnSel.value = 'custom';
            respawnInput.style.display = 'block';
            respawnInput.value = profile.respawns;
        }

        respawnSel.onchange = (e) => {
            if (e.target.value === 'custom') {
                respawnInput.style.display = 'block';
                respawnInput.value = profile.respawns > 0 ? profile.respawns : 10;
                respawnInput.focus();
                this.manager.updateProfile(profile.id, { respawns: parseInt(respawnInput.value) });
            } else {
                respawnInput.style.display = 'none';
                this.manager.updateProfile(profile.id, { respawns: parseInt(e.target.value) });
            }
        };

        respawnInput.onchange = (e) => {
            this.manager.updateProfile(profile.id, { respawns: parseInt(e.target.value) });
        };

        const stopProp = (e) => { if (e.key === 'e' || e.key === 'E') e.stopPropagation(); };
        respawnSel.onkeydown = stopProp;
        respawnInput.onkeydown = stopProp;

        containerRow.appendChild(respawnSel);
        containerRow.appendChild(respawnInput);
        respawnContainer.appendChild(containerRow);
        statsCol.appendChild(respawnContainer);

        grid.appendChild(statsCol);

        // Appearance / Logic Column
        const extraCol = document.createElement('div');

        const skinHeader = document.createElement('h4');
        skinHeader.textContent = "Skin Polygon";
        skinHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444;";
        extraCol.appendChild(skinHeader);

        const skinModeWrap = document.createElement('div');
        skinModeWrap.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-bottom:10px;";
        const skinModeLabel = document.createElement('label');
        skinModeLabel.textContent = "Skin para este rol";
        skinModeLabel.style.cssText = "color:#ddd; font-size:13px;";
        const skinModeSelect = document.createElement('select');
        skinModeSelect.style.cssText = "background:#333; color:white; padding:7px; border:1px solid #555; border-radius:4px; width:100%;";
        [
            { v: "player", t: "Usar skin del jugador" },
            { v: "role", t: "Colocar una skin para este rol" }
        ].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if ((profile.skinMode || "player") === opt.v) o.selected = true;
            skinModeSelect.appendChild(o);
        });
        skinModeSelect.onchange = (e) => {
            this.manager.updateProfile(profile.id, { skinMode: e.target.value });
            this.render();
        };
        skinModeWrap.appendChild(skinModeLabel);
        skinModeWrap.appendChild(skinModeSelect);
        extraCol.appendChild(skinModeWrap);

        const skinBox = document.createElement('div');
        skinBox.style.cssText = `display:${(profile.skinMode || "player") === "role" ? "flex" : "none"}; gap:10px; align-items:center; margin-bottom:15px;`;

        const skinPreview = document.createElement('div');
        skinPreview.style.cssText = `
            width:64px; height:64px; border:1px solid #555; border-radius:4px;
            background:#111 center/cover no-repeat;
            image-rendering: pixelated; flex-shrink:0;
        `;
        if (profile.skinUrl) skinPreview.style.backgroundImage = `url("${profile.skinUrl}")`;

        const skinActions = document.createElement('div');
        skinActions.style.cssText = "display:flex; flex-direction:column; gap:6px; flex:1;";

        const skinInput = document.createElement('input');
        skinInput.type = "file";
        skinInput.accept = "image/png";
        skinInput.style.display = "none";

        const skinUploadBtn = document.createElement('button');
        skinUploadBtn.textContent = "Subir Skin 64x64";
        skinUploadBtn.style.cssText = "background:#333; color:white; border:1px solid #555; padding:8px; cursor:pointer; border-radius:4px;";
        skinUploadBtn.onclick = () => skinInput.click();

        const clearSkinBtn = document.createElement('button');
        clearSkinBtn.textContent = "Usar Skin Base";
        clearSkinBtn.style.cssText = "background:#222; color:#ddd; border:1px solid #555; padding:6px; cursor:pointer; border-radius:4px;";
        clearSkinBtn.onclick = () => {
            this.manager.updateProfile(profile.id, { skinUrl: DEFAULT_POLYGON_SKIN_URL, skinAssetId: null });
            this.render();
        };

        skinInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const originalText = skinUploadBtn.textContent;
            skinUploadBtn.textContent = "Subiendo...";
            skinUploadBtn.disabled = true;
            try {
                const asset = await uploadAsset(file, {
                    kind: "CHARACTER_SKIN",
                    visibility: "UNLISTED",
                    name: file.name,
                    metadata: { source: "player-config-panel" }
                });
                this.manager.updateProfile(profile.id, {
                    skinUrl: asset.fileUrl,
                    skinAssetId: asset.id
                });
                this.render();
            } catch (err) {
                console.error("No se pudo subir la skin", err);
                alert(err instanceof Error ? err.message : "No se pudo subir la skin");
                skinUploadBtn.textContent = originalText;
            } finally {
                skinUploadBtn.disabled = false;
                skinInput.value = "";
            }
        };

        skinActions.appendChild(skinUploadBtn);
        skinActions.appendChild(clearSkinBtn);
        skinActions.appendChild(skinInput);
        skinBox.appendChild(skinPreview);
        skinBox.appendChild(skinActions);
        extraCol.appendChild(skinBox);

        const roleVisual = normalizeRoleVisualConfig(profile.roleVisual, profile.color);
        const activeVisualTab = this.activeRoleVisualTab || "sameRole";
        const visual = roleVisual[activeVisualTab] || roleVisual.sameRole;
        const updateVisual = (patch) => {
            const nextRule = normalizeVisualRule({ ...visual, ...patch }, profile.color);
            this.manager.updateProfile(profile.id, {
                roleVisual: {
                    ...roleVisual,
                    [activeVisualTab]: nextRule
                }
            });
            this.render();
        };

        const visualHeader = document.createElement('h4');
        visualHeader.textContent = "Diferenciador de Rol / Equipo";
        visualHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444; margin-top:18px;";
        extraCol.appendChild(visualHeader);

        const visualBox = document.createElement('div');
        visualBox.style.cssText = "display:flex; flex-direction:column; gap:10px; margin-bottom:15px;";

        const visualTabs = document.createElement('div');
        visualTabs.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:6px;";
        [
            { id: "sameRole", label: "Mismo rol / equipo" },
            { id: "otherRole", label: "Otros roles / equipos" }
        ].forEach(tabInfo => {
            const tabButton = document.createElement('button');
            tabButton.type = "button";
            tabButton.textContent = tabInfo.label;
            const active = activeVisualTab === tabInfo.id;
            tabButton.style.cssText = `
                background:${active ? "#31505f" : "#222"};
                color:${active ? "#e9fbff" : "#bbb"};
                border:1px solid ${active ? "#63d9ff" : "#555"};
                padding:8px 6px; border-radius:4px; cursor:pointer;
                font-size:12px; font-weight:${active ? "700" : "500"};
            `;
            tabButton.onclick = () => {
                this.activeRoleVisualTab = tabInfo.id;
                this.render();
            };
            visualTabs.appendChild(tabButton);
        });
        visualBox.appendChild(visualTabs);

        const visualSelect = document.createElement('select');
        visualSelect.style.cssText = "background:#333; color:white; padding:7px; border:1px solid #555; border-radius:4px; width:100%;";
        [
            { v: "none", t: "Sin diferenciacion" },
            { v: "color", t: "Marca de color" },
            { v: "aura", t: "Aura visible" },
            { v: "color_aura", t: "Color + aura" },
            { v: "outline", t: "Borde de jugador" }
        ].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if (visual.type === opt.v) o.selected = true;
            visualSelect.appendChild(o);
        });
        visualSelect.onchange = (e) => updateVisual({ type: e.target.value });
        visualBox.appendChild(visualSelect);

        const colorRow = document.createElement('div');
        colorRow.style.cssText = "display:grid; grid-template-columns:52px 1fr; gap:8px; align-items:center;";

        const colorPicker = document.createElement('input');
        colorPicker.type = "color";
        colorPicker.value = normalizeColorValue(visual.color || profile.color || "#ffffff");
        colorPicker.title = "Color del diferenciador";
        colorPicker.style.cssText = "width:52px; height:36px; padding:2px; border:1px solid #555; border-radius:4px; background:#222; cursor:pointer;";
        colorPicker.onchange = (e) => updateVisual({
            color: e.target.value,
            type: visual.type === "none" ? "color" : visual.type
        });

        const colorLabel = document.createElement('div');
        colorLabel.textContent = activeVisualTab === "sameRole"
            ? "Color que vera tu mismo rol/equipo"
            : "Color que veran otros roles/equipos";
        colorLabel.style.cssText = "color:#bbb; font-size:12px; line-height:1.35;";

        colorRow.appendChild(colorPicker);
        colorRow.appendChild(colorLabel);
        visualBox.appendChild(colorRow);

        const auraSelect = document.createElement('select');
        auraSelect.style.cssText = `display:${["aura", "color_aura"].includes(visual.type) ? "block" : "none"}; background:#333; color:white; padding:7px; border:1px solid #555; border-radius:4px; width:100%;`;
        [
            { v: "soft", t: "Aura suave" },
            { v: "pulse", t: "Aura pulsante" },
            { v: "ring", t: "Anillo de equipo" }
        ].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if (visual.aura === opt.v) o.selected = true;
            auraSelect.appendChild(o);
        });
        auraSelect.onchange = (e) => updateVisual({
            aura: e.target.value,
            type: visual.type === "none" ? "aura" : visual.type
        });
        visualBox.appendChild(auraSelect);

        if (visual.type === "outline") {
            const outlineHint = document.createElement('div');
            outlineHint.textContent = "Borde neon sutil en el contorno del jugador Polygon Skin.";
            outlineHint.style.cssText = "color:#9fdff0; font-size:12px; line-height:1.35; background:#10242c; border:1px solid #235064; border-radius:4px; padding:8px;";
            visualBox.appendChild(outlineHint);
        }

        extraCol.appendChild(visualBox);

        // --- ANIMATIONS SECTION ---
        const animHeader = document.createElement('h4');
        animHeader.textContent = "Animaciones";
        animHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444;";
        extraCol.appendChild(animHeader);

        const animContainer = document.createElement('div');
        animContainer.style.marginBottom = "15px";

        const jumpAnimLabel = document.createElement('label');
        jumpAnimLabel.textContent = "Animación de Salto";
        jumpAnimLabel.style.display = "block";
        jumpAnimLabel.style.color = "#ddd";
        jumpAnimLabel.style.marginBottom = "5px";
        animContainer.appendChild(jumpAnimLabel);

        const jumpAnimSelect = document.createElement('select');
        jumpAnimSelect.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width: 100%; box-sizing: border-box;";

        const jumpOptions = [
            { v: 'none', t: "Ninguna" },
            { v: 'flip', t: "Salto Mortal (Flip)" }
        ];

        jumpOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if (profile.jumpAnimationType === opt.v) o.selected = true;
            jumpAnimSelect.appendChild(o);
        });

        // Default to flip if undefined
        if (!profile.jumpAnimationType) {
            jumpAnimSelect.value = 'flip';
        }

        jumpAnimSelect.onchange = (e) => {
            this.manager.updateProfile(profile.id, { jumpAnimationType: e.target.value });
        };

        animContainer.appendChild(jumpAnimSelect);

        // Fall Animation
        const fallAnimLabel = document.createElement('label');
        fallAnimLabel.textContent = "Animación de Caída";
        fallAnimLabel.style.display = "block";
        fallAnimLabel.style.color = "#ddd";
        fallAnimLabel.style.marginTop = "10px";
        fallAnimLabel.style.marginBottom = "5px";
        animContainer.appendChild(fallAnimLabel);

        const fallAnimSelect = document.createElement('select');
        fallAnimSelect.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width: 100%; box-sizing: border-box;";

        const fallOptions = [
            { v: 'none', t: "Ninguna" },
            { v: 'flip', t: "Salto Mortal (Flip)" }
        ];

        fallOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if (profile.fallAnimationType === opt.v) o.selected = true;
            fallAnimSelect.appendChild(o);
        });

        // Default to none if undefined
        if (!profile.fallAnimationType) {
            fallAnimSelect.value = 'none';
        }

        fallAnimSelect.onchange = (e) => {
            this.manager.updateProfile(profile.id, { fallAnimationType: e.target.value });
        };

        animContainer.appendChild(fallAnimSelect);

        extraCol.appendChild(animContainer);

        // --- COLISIÓN ENTRE JUGADORES ---
        const collisionHeader = document.createElement('h4');
        collisionHeader.textContent = "Colisión entre Jugadores";
        collisionHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444; margin-top: 20px;";
        extraCol.appendChild(collisionHeader);

        const collisionContainer = document.createElement('div');
        collisionContainer.style.marginBottom = "15px";

        const collisionLabel = document.createElement('label');
        collisionLabel.textContent = "Tipo de Colisión";
        collisionLabel.style.display = "block";
        collisionLabel.style.color = "#ddd";
        collisionLabel.style.marginBottom = "5px";
        collisionContainer.appendChild(collisionLabel);

        const collisionSelect = document.createElement('select');
        collisionSelect.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width: 100%; box-sizing: border-box;";

        const collisionOptions = [
            { v: 'push', t: "Colisión empujar" },
            { v: 'no-push', t: "Colisión sin empujar" },
            { v: 'none', t: "Sin interacción (Atravesar)" }
        ];

        collisionOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if (profile.playerCollision === opt.v) o.selected = true;
            collisionSelect.appendChild(o);
        });

        if (!profile.playerCollision) {
            collisionSelect.value = 'push'; // Default mapping
        }

        collisionSelect.onchange = (e) => {
            this.manager.updateProfile(profile.id, { playerCollision: e.target.value });
        };

        collisionContainer.appendChild(collisionSelect);

        extraCol.appendChild(collisionContainer);

        // --- MODO DE CÁMARA POR DEFECTO ---
        const cameraHeader = document.createElement('h4');
        cameraHeader.textContent = "Modo de Cámara";
        cameraHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444; margin-top: 20px;";
        extraCol.appendChild(cameraHeader);

        const cameraContainer = document.createElement('div');
        cameraContainer.style.marginBottom = "15px";

        const cameraLabel = document.createElement('label');
        cameraLabel.textContent = "Modo Predeterminado";
        cameraLabel.style.display = "block";
        cameraLabel.style.color = "#ddd";
        cameraLabel.style.marginBottom = "5px";
        cameraContainer.appendChild(cameraLabel);

        const cameraSelect = document.createElement('select');
        cameraSelect.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width: 100%; box-sizing: border-box;";

        const cameraOptions = [
            { v: 'third-person-collision', t: "3ra Persona: Choque con Objetos" },
            { v: 'third-person-free', t: "3ra Persona: Libre (Sin límites)" },
            { v: 'first-person', t: "1ra Persona" },
            { v: 'free-fly', t: "Cámara Libre (Espectador)" }
        ];

        cameraOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.t;
            if ((profile.cameraMode || 'third-person-collision') === opt.v) o.selected = true;
            cameraSelect.appendChild(o);
        });

        cameraSelect.onchange = (e) => {
            this.manager.updateProfile(profile.id, { cameraMode: e.target.value });
            if (this.manager.assignments.defaultProfileId === profile.id) {
                this.manager.applyConfiguration();
            }
        };

        cameraContainer.appendChild(cameraSelect);
        extraCol.appendChild(cameraContainer);

        // --- HUD CONFIG BUTTON ---
        const hudBtn = document.createElement('button');
        hudBtn.textContent = "Editar HUD e Inventario";
        hudBtn.style.cssText = "background: #d6b600; color: black; border: none; padding: 10px; width: 100%; cursor: pointer; border-radius: 4px; margin-top: 10px; font-weight:bold;";
        hudBtn.onclick = () => {
            this.hudPanel.open(profile);
        };
        extraCol.appendChild(hudBtn);


        // --- APLICAR CONFIGURACION ---
        const applyHeader = document.createElement('h4');
        applyHeader.textContent = "Aplicar Configuración";
        applyHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444; margin-top: 20px;";
        extraCol.appendChild(applyHeader);

        const modeContainer = document.createElement('div');
        modeContainer.innerHTML = "<p style='color:#888; font-size:12px;'>Aplica este rol al jugador local para probarlo en tiempo real.</p>";
        extraCol.appendChild(modeContainer);

        // Apply Button (Immediate Test)
        const applyBtn = document.createElement('button');
        applyBtn.textContent = "Aplicar este Rol al Jugador Local (Test)";
        applyBtn.style.cssText = "background: #44f; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; border-radius: 4px; margin-top: 5px;";
        applyBtn.onclick = () => {
            this.manager.assignments.defaultProfileId = profile.id;
            const myId = this.game?.networkManager?.playerId || "local";
            this.manager.setPlayerProfile(myId, profile.id);
            this.manager.applyConfiguration();
            alert(`Rol "${profile.name}" aplicado al jugador.`);
        };
        extraCol.appendChild(applyBtn);

        grid.appendChild(extraCol);
        this.contentArea.appendChild(grid);
    }

    createStatControl(container, label, key, profile, min, max) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = "15px";

        const render = () => {
            wrap.innerHTML = "";
            const mode = (profile.statModes && profile.statModes[key]) || 'standard';
            const value = profile[key];

            const header = document.createElement('div');
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";
            header.style.marginBottom = "5px";

            const leftSide = document.createElement('div');
            leftSide.style.display = 'flex';
            leftSide.style.alignItems = 'center';
            leftSide.style.gap = '10px';

            // Toggle Button
            const toggleBtn = document.createElement('button');
            toggleBtn.innerHTML = mode === 'standard' ? "&#9881;" : "&infin;"; // Gear or Infinite
            toggleBtn.title = mode === 'standard' ? "Modo Estándar (Limitado)" : "Modo Libre (Sin Límite)";
            toggleBtn.style.cssText = "background:none; border:1px solid #555; color:#aaa; cursor:pointer; padding: 0 5px; font-size:12px; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center;";
            toggleBtn.onclick = () => {
                const newMode = mode === 'standard' ? 'free' : 'standard';
                if (!profile.statModes) profile.statModes = {};
                profile.statModes[key] = newMode;

                if (newMode === 'standard') {
                    let v = profile[key];
                    if (v > max) v = max;
                    if (v < min) v = min;
                    this.manager.updateProfile(profile.id, { [key]: v });
                } else {
                    this.manager.updateProfile(profile.id, { statModes: profile.statModes });
                }
                render();
            };

            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.color = "#ddd";

            leftSide.appendChild(toggleBtn);
            leftSide.appendChild(lbl);
            header.appendChild(leftSide);

            if (mode === 'standard') {
                // Value Display (Editable)
                const valDisp = document.createElement('span');
                valDisp.textContent = value;
                valDisp.style.color = "#0ff";
                valDisp.style.cursor = "pointer";
                valDisp.title = "Doble click para editar";

                valDisp.ondblclick = () => {
                    const input = document.createElement('input');
                    input.type = "number";
                    input.value = value;
                    input.style.cssText = "width:60px; background:#222; color:white; border:1px solid #555; padding:2px;";

                    const finish = () => {
                        let n = parseFloat(input.value);
                        if (isNaN(n)) n = value;
                        if (n < min) n = min;
                        if (n > max) n = max;

                        this.manager.updateProfile(profile.id, { [key]: n });
                        render();
                    };

                    input.onblur = finish;
                    input.onkeydown = (e) => {
                        if (e.key === 'e' || e.key === 'E') e.stopPropagation();
                        if (e.key === 'Enter') { e.preventDefault(); finish(); }
                    };

                    header.replaceChild(input, valDisp);
                    input.focus();
                    input.select();
                };

                header.appendChild(valDisp);
                wrap.appendChild(header);

                // Slider
                const range = document.createElement('input');
                range.type = "range";
                range.min = min;
                range.max = max;
                range.value = value;
                range.style.width = "100%";
                range.oninput = (e) => {
                    const v = parseFloat(e.target.value);
                    valDisp.textContent = v;
                    this.manager.updateProfile(profile.id, { [key]: v });
                };
                wrap.appendChild(range);

            } else {
                // Free Mode - Input only
                const input = document.createElement('input');
                input.type = "number";
                input.value = value;
                input.style.cssText = "width: 80px; background:#222; color:#0f0; border:1px solid #555; padding:5px; text-align:right;";
                input.onchange = (e) => {
                    this.manager.updateProfile(profile.id, { [key]: parseFloat(e.target.value) });
                };
                input.onkeydown = (e) => { if (e.key === 'e' || e.key === 'E') e.stopPropagation(); };

                header.appendChild(input);
                wrap.appendChild(header);
            }
        };

        render();
        container.appendChild(wrap);
    }
}

function normalizeRoleVisualConfig(value, fallbackColor = "#ffffff") {
    const visual = value && typeof value === "object" ? value : {};
    if (visual.sameRole || visual.otherRole) {
        return {
            sameRole: normalizeVisualRule(visual.sameRole, fallbackColor),
            otherRole: normalizeVisualRule(visual.otherRole, fallbackColor)
        };
    }

    const legacy = normalizeVisualRule(visual, fallbackColor);
    return {
        sameRole: { ...legacy },
        otherRole: { ...legacy }
    };
}

function normalizeVisualRule(value, fallbackColor = "#ffffff") {
    const visual = value && typeof value === "object" ? value : {};
    return {
        type: ["none", "color", "aura", "color_aura", "outline"].includes(visual.type) ? visual.type : "none",
        color: normalizeColorValue(visual.color || fallbackColor || "#ffffff"),
        aura: ["soft", "pulse", "ring"].includes(visual.aura) ? visual.aura : "soft"
    };
}

function normalizeColorValue(value) {
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
        return value;
    }
    return "#ffffff";
}
