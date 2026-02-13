export class PlayerConfigPanel {
    constructor(game, manager) {
        this.game = game;
        this.manager = manager;
        this.container = null;
        this.selectedProfileId = 'default';
    }

    createUI(parentContainer) {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            color: white; font-family: sans-serif;
        `;

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
        this.container.appendChild(tabHeader);

        // Content Container
        const content = document.createElement('div');
        content.style.cssText = "flex:1; display:flex; overflow:hidden;";
        this.container.appendChild(content);

        if (this.activeTab === 'roles') {
            this.renderRolesTab(content);
        } else {
            this.renderSpawnPanel(content);
        }
    }

    renderRolesTab(parentContainer) {
        // Wrapper for 2-column layout
        parentContainer.style.display = 'flex';
        parentContainer.style.gap = '20px';
        parentContainer.style.height = '100%';
        parentContainer.style.minHeight = '0'; // Prevent parent from growing

        // Inject Scrollbar Style globally for this panel if not present
        if (!document.getElementById('player-config-scroll-style')) {
            const scrollStyle = document.createElement('style');
            scrollStyle.id = 'player-config-scroll-style';
            scrollStyle.innerHTML = `
                .profile-list-scroll::-webkit-scrollbar { width: 6px; }
                .profile-list-scroll::-webkit-scrollbar-track { background: #111; }
                .profile-list-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
                .profile-list-scroll::-webkit-scrollbar-thumb:hover { background: #555; }
            `;
            this.container.appendChild(scrollStyle);
        }

        // Left: Sidebar (Profile List)
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width: 250px;
            background: #222;
            border-right: 1px solid #444;
            display: flex; flex-direction: column;
            padding: 10px; gap: 10px;
            height: 100%;
            overflow: hidden; 
            box-sizing: border-box;
        `;

        const sbTitle = document.createElement('h3');
        sbTitle.textContent = "Editor de Roles";
        sbTitle.style.margin = "0 0 10px 0";
        sbTitle.style.borderBottom = "1px solid #555";
        sbTitle.style.paddingBottom = "5px";
        sbTitle.style.flexShrink = "0";
        sidebar.appendChild(sbTitle);

        // Container for list to isolate scrolling
        this.profileList = document.createElement('div');
        this.profileList.className = 'profile-list-scroll';
        this.profileList.style.cssText = `
            flex: 1 1 auto; 
            height: 0px; /* CRITICAL: Forces flex child to default to 0 and grow, enabling scroll */
            overflow-y: auto;
            display: flex; flex-direction: column; gap: 5px;
            padding-right: 5px;
        `;

        sidebar.appendChild(this.profileList);

        const addBtn = document.createElement('button');
        addBtn.textContent = "+ Crear Nuevo Rol";
        addBtn.style.cssText = `
            background: #00aa00; color: white; border: none; padding: 10px;
            cursor: pointer; border-radius: 4px; font-weight: bold;
            flex-shrink: 0; 
            margin-top: auto; /* Push to bottom if needed, but flex gap handles it */
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
            padding: 10px; overflow-y: auto;
        `;
        parentContainer.appendChild(this.contentArea);

        this.renderSidebar();
        this.renderContent();
    }

    renderSpawnPanel(parentContainer) {
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
            if (p.id !== 'default') {
                const delBtn = document.createElement('button');
                delBtn.textContent = "✕";
                delBtn.style.cssText = "background:none; border:none; color:#f44; cursor:pointer;";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar perfil "${p.name}"?`)) {
                        this.manager.removeProfile(p.id);
                        if (this.selectedProfileId === p.id) this.selectedProfileId = 'default';
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
        extraCol.innerHTML = "<h4 style='color:#aaa; border-bottom:1px solid #444;'>Aplicar Configuración</h4>";

        // Assignment Mode (Only show if this is the active config context, assumes single config for now)
        const modeContainer = document.createElement('div');
        modeContainer.innerHTML = "<p style='color:#888; font-size:12px;'>Aplica este rol al jugador local</p>";

        // --- ANIMATIONS SECTION ---
        const animHeader = document.createElement('h4');
        animHeader.textContent = "Animaciones";
        animHeader.style.cssText = "color:#aaa; border-bottom:1px solid #444; margin-top: 20px;";
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
        extraCol.appendChild(animContainer);


        // Apply Button (Immediate Test)
        const applyBtn = document.createElement('button');
        applyBtn.textContent = "Aplicar este Rol al Jugador Local (Test)";
        applyBtn.style.cssText = "background: #44f; color: white; border: none; padding: 10px; width: 100%; cursor: pointer; border-radius: 4px; margin-top: 10px;";
        applyBtn.onclick = () => {
            this.manager.assignments.defaultProfileId = profile.id;
            this.manager.applyConfiguration();
            alert(`Rol "${profile.name}" aplicado al jugador.`);
        };
        extraCol.appendChild(modeContainer);
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
