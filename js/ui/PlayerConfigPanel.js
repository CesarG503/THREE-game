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
            display: flex; gap: 20px;
            color: white; font-family: sans-serif;
        `;

        // Left: Sidebar (Profile List)
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width: 250px;
            background: #222;
            border-right: 1px solid #444;
            display: flex; flex-direction: column;
            padding: 10px; gap: 10px;
        `;

        const sbTitle = document.createElement('h3');
        sbTitle.textContent = "Perfiles de Jugador";
        sbTitle.style.margin = "0 0 10px 0";
        sbTitle.style.borderBottom = "1px solid #555";
        sbTitle.style.paddingBottom = "5px";
        sidebar.appendChild(sbTitle);

        this.profileList = document.createElement('div');
        this.profileList.style.cssText = `
            flex: 1; overflow-y: auto;
            display: flex; flex-direction: column; gap: 5px;
        `;
        sidebar.appendChild(this.profileList);

        const addBtn = document.createElement('button');
        addBtn.textContent = "+ Crear Nuevo Rol";
        addBtn.style.cssText = `
            background: #00aa00; color: white; border: none; padding: 10px;
            cursor: pointer; border-radius: 4px; font-weight: bold;
        `;
        addBtn.onclick = () => {
            const newP = this.manager.addProfile();
            this.selectedProfileId = newP.id;
            this.render();
        };
        sidebar.appendChild(addBtn);

        this.container.appendChild(sidebar);

        // Right: Content (Editor)
        this.contentArea = document.createElement('div');
        this.contentArea.style.cssText = `
            flex: 1; display: flex; flex-direction: column; gap: 15px;
            padding: 10px; overflow-y: auto;
        `;
        this.container.appendChild(this.contentArea);

        parentContainer.appendChild(this.container);
        this.render();
    }

    render() {
        this.renderSidebar();
        this.renderContent();
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

        this.createSlider(statsCol, "Vida Total", profile.maxHealth, 1, 1000, (v) => this.manager.updateProfile(profile.id, { maxHealth: v }));
        this.createSlider(statsCol, "Velocidad Movimiento", profile.speed, 1, 50, (v) => this.manager.updateProfile(profile.id, { speed: v }));
        this.createSlider(statsCol, "Fuerza de Salto", profile.jumpForce, 0, 50, (v) => this.manager.updateProfile(profile.id, { jumpForce: v }));

        // Respawn Logic
        const respawnContainer = document.createElement('div');
        respawnContainer.style.marginTop = "15px";
        respawnContainer.innerHTML = "<label style='display:block; color:#aaa; margin-bottom:5px;'>Reapariciones</label>";

        const respawnSel = document.createElement('select');
        respawnSel.style.cssText = "background:#333; color:white; padding:5px; border:1px solid #555; width: 100%;";
        const rOpts = [
            { v: -1, t: "Infinitas" },
            { v: 0, t: "Muerte Permanente (0)" },
            { v: 1, t: "1 Vida Extra" },
            { v: 3, t: "3 Vidas" },
            { v: 5, t: "5 Vidas" }
        ];
        rOpts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.v;
            opt.textContent = o.t;
            if (profile.respawns === o.v) opt.selected = true;
            respawnSel.appendChild(opt);
        });
        respawnSel.onchange = (e) => this.manager.updateProfile(profile.id, { respawns: parseInt(e.target.value) });
        respawnContainer.appendChild(respawnSel);
        statsCol.appendChild(respawnContainer);

        grid.appendChild(statsCol);

        // Appearance / Logic Column
        const extraCol = document.createElement('div');
        extraCol.innerHTML = "<h4 style='color:#aaa; border-bottom:1px solid #444;'>Configuración de Partida</h4>";

        // Assignment Mode (Only show if this is the active config context, assumes single config for now)
        const modeContainer = document.createElement('div');
        modeContainer.innerHTML = "<p style='color:#888; font-size:12px;'>Cómo aplicar estos roles en la partida:</p>";

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

    createSlider(container, label, value, min, max, onChange) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = "15px";

        const header = document.createElement('div');
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.marginBottom = "5px";

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.style.color = "#ddd";

        const valDisp = document.createElement('span');
        valDisp.textContent = value;
        valDisp.style.color = "#0ff";

        header.appendChild(lbl);
        header.appendChild(valDisp);

        const range = document.createElement('input');
        range.type = "range";
        range.min = min;
        range.max = max;
        range.value = value;
        range.style.width = "100%";
        range.oninput = (e) => {
            valDisp.textContent = e.target.value;
            onChange(parseFloat(e.target.value));
        };

        wrap.appendChild(header);
        wrap.appendChild(range);
        container.appendChild(wrap);
    }
}
