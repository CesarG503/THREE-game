import * as THREE from "three";
import { RampUtils } from "../utils/RampUtils";

/**
 * Gestor de Colocación de Objetos
 * Maneja la lógica de previsualización (ghost) y raycasting para colocar items.
 */
export const getTubeSegments = (scale: any) => {
    if (scale && scale.segments && Array.isArray(scale.segments) && scale.segments.length > 0) {
        return scale.segments;
    }
    const length1 = (scale && scale.y) || 2.0;
    const length2 = (scale && scale.length2) !== undefined ? scale.length2 : 2.0;
    const bendAngleX = (scale && scale.bendAngleX) !== undefined ? scale.bendAngleX : 0;
    const bendAngleY = (scale && scale.bendAngleY) !== undefined ? scale.bendAngleY : 90;
    return [
        { length: length1, bendAngleX: 0, bendAngleY: 0 },
        { length: length2, bendAngleX: bendAngleX, bendAngleY: bendAngleY }
    ];
};

export class PlacementManager {
    scene: THREE.Scene;
    camera: THREE.Camera;
    placementGhost: THREE.Group | null;
    ghostBaseMat: THREE.MeshBasicMaterial | null;
    ghostArrowMat: THREE.MeshBasicMaterial | null;
    ghostArrow: THREE.Mesh | null;
    texImpulso: THREE.Texture | null;
    texSalto: THREE.Texture | null;
    currentSlot: number;
    rotationIndex: number;
    snapToGrid: boolean;
    gridSize: number;
    aerialGridActive: boolean;
    aerialGridFixed: boolean;
    aerialCollider: THREE.Mesh | null;
    aerialVisual: THREE.Group | null;
    ghostBoxMesh: THREE.Mesh | null;
    ghostSphereMesh: THREE.Mesh | null;
    ghostCylinderMesh: THREE.Mesh | null;
    ghostRampMesh: THREE.Mesh | null;
    ghostStairsGroup: THREE.Group | null;
    ghostLadderGroup: THREE.Group | null;
    ghostTubeGroup: THREE.Group | null;
    ghostConeMesh: THREE.Mesh | null;
    ghostSpikedFloorGroup: THREE.Group | null;
    ghostRampLastKey: string | null;
    ghostStairsLastKey: string | null;
    ghostLadderLastKey: string | null;
    ghostTubeLastKey: string | null;
    ghostSpikedFloorLastKey: string | null;
    ghostLabelSprite: THREE.Sprite | null;
    logicToolbar: HTMLDivElement | null;
    toolbarInputs: Record<string, HTMLInputElement>;
    toolbarSpawnInputs: Record<string, HTMLInputElement> | null;
    collisionShapeRow: HTMLDivElement | null;
    boxInputsContainer: HTMLDivElement | null;
    sphereInputsContainer: HTMLDivElement | null;
    spawnInputsContainer: HTMLDivElement | null;
    spawnCircleInputs: HTMLDivElement | null;
    spawnSquareInputs: HTMLDivElement | null;
    spawnXYZInputs: Record<string, HTMLInputElement> | null;
    spawnRadInp: HTMLInputElement | null;
    targetInputsContainer: HTMLDivElement | null;
    currentCollisionSize: any;
    currentSpawnProperties: any;
    currentTargetProperties: any;
    currentItem: any;
    currentHit: any;
    lastValidPosition: THREE.Vector3 | null;
    lastValidQuaternion: THREE.Quaternion | null;

    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Grupo para la visualización fantasma
        this.placementGhost = null;
        this.ghostBaseMat = null;
        this.ghostArrowMat = null;
        this.ghostArrow = null;
        this.ghostBoxMesh = null;
        this.ghostSphereMesh = null;
        this.ghostCylinderMesh = null;
        this.ghostRampMesh = null;
        this.ghostStairsGroup = null;
        this.ghostLadderGroup = null;
        this.ghostTubeGroup = null;
        this.ghostConeMesh = null;
        this.ghostSpikedFloorGroup = null;
        this.ghostRampLastKey = null;
        this.ghostStairsLastKey = null;
        this.ghostLadderLastKey = null;
        this.ghostTubeLastKey = null;
        this.ghostSpikedFloorLastKey = null;
        this.ghostLabelSprite = null;

        // Texturas precargadas
        this.texImpulso = null;
        this.texSalto = null;

        // Estado del input
        this.currentSlot = -1;
        this.rotationIndex = 0;

        // Configuración Snapping
        this.snapToGrid = false;
        this.gridSize = 1;

        // Configuración Aerial Grid
        this.aerialGridActive = false;
        this.aerialGridFixed = false;
        this.aerialCollider = null;
        this.aerialVisual = null;
        this.logicToolbar = null;
        this.toolbarInputs = {};
        this.toolbarSpawnInputs = null;
        this.collisionShapeRow = null;
        this.boxInputsContainer = null;
        this.sphereInputsContainer = null;
        this.spawnInputsContainer = null;
        this.spawnCircleInputs = null;
        this.spawnSquareInputs = null;
        this.spawnXYZInputs = null;
        this.spawnRadInp = null;
        this.targetInputsContainer = null;
        this.currentCollisionSize = null;
        this.currentSpawnProperties = null;
        this.currentTargetProperties = null;
        this.currentItem = null;
        this.currentHit = null;
        this.lastValidPosition = null;
        this.lastValidQuaternion = null;

        this.init();
    }

    /**
     * Inicializa recursos y objetos visuales
     */
    init() {
        // Cargar texturas
        const loader = new THREE.TextureLoader();
        this.texImpulso = loader.load("/assets/textures/impulso.png");
        this.texSalto = loader.load("/assets/textures/salto.png");

        // Crear grupo fantasma
        this.placementGhost = new THREE.Group();
        this.placementGhost.name = "placementGhost";
        this.scene.add(this.placementGhost);

        // 1. Ghost BOX (Paredes, Pilares, Pads)
        const boxGeo = new THREE.BoxGeometry(1, 1, 1); // Base 1x1x1, scale later
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        this.ghostBaseMat = material;

        this.ghostBoxMesh = new THREE.Mesh(boxGeo, material);
        // Position handled in update
        this.placementGhost.add(this.ghostBoxMesh);

        // 1b. Ghost SPHERE
        const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
        this.ghostSphereMesh = new THREE.Mesh(sphereGeo, material);
        this.ghostSphereMesh.visible = false;
        this.placementGhost.add(this.ghostSphereMesh);

        // 1c. Ghost CYLINDER (Spawn Point)
        const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32);
        this.ghostCylinderMesh = new THREE.Mesh(cylGeo, material);
        this.ghostCylinderMesh.visible = false;
        this.placementGhost.add(this.ghostCylinderMesh);

        // 2. Ghost RAMP (Prisma Triangular)
        const rampGeo = RampUtils.createGeometry({ x: 1, y: 1, z: 1 });
        this.ghostRampMesh = new THREE.Mesh(rampGeo, material);
        this.ghostRampMesh.visible = false;
        this.placementGhost.add(this.ghostRampMesh);

        // 3. Ghost STAIRS
        this.ghostStairsGroup = new THREE.Group();
        this.placementGhost.add(this.ghostStairsGroup);

        // 4. Ghost LADDER
        this.ghostLadderGroup = new THREE.Group();
        this.placementGhost.add(this.ghostLadderGroup);

        // 5. Ghost TUBE
        this.ghostTubeGroup = new THREE.Group();
        this.placementGhost.add(this.ghostTubeGroup);

        // 6. Ghost CONE
        const coneGeo = new THREE.ConeGeometry(1, 1, 32);
        this.ghostConeMesh = new THREE.Mesh(coneGeo, material);
        this.ghostConeMesh.visible = false;
        this.placementGhost.add(this.ghostConeMesh);

        // 7. Ghost SPIKED FLOOR
        this.ghostSpikedFloorGroup = new THREE.Group();
        this.placementGhost.add(this.ghostSpikedFloorGroup);


        // Flecha / Icono indicador (Solo para Pads viejos)
        const arrowGeo = new THREE.PlaneGeometry(2.4, 2.4);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.ghostArrowMat = arrowMat;

        this.ghostArrow = new THREE.Mesh(arrowGeo, arrowMat);
        this.ghostArrow.rotation.x = -Math.PI / 2;
        this.ghostArrow.position.y = 0.05; // Ligeramente elevado
        this.placementGhost.add(this.ghostArrow);

        // Grid Aéreo
        this.initAerialGrid();

        // Logic Toolbar (Interactive Collision)
        // Defaults: shape=box, size=2x2x2, radius=1
        this.currentCollisionSize = { x: 2, y: 2, z: 2, radius: 1.0, shapeType: "box" };
        this.initLogicToolbar();

        // Ocultar por defecto
        this.placementGhost.visible = false;
    }

    initLogicToolbar() {
        this.logicToolbar = document.createElement("div");
        this.logicToolbar.id = "placement-logic-toolbar";
        this.logicToolbar.style.cssText = `
            position: absolute; left: 20px; top: 50%; transform: translateY(-50%);
            background: rgba(0,0,0,0.8); padding: 15px; border-radius: 8px;
            display: none; flex-direction: column; gap: 10px; color: white;
            border: 1px solid #444; z-index: 2000; font-family: sans-serif;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;
        const title = document.createElement("div");
        title.textContent = "Dimensiones";
        title.style.fontWeight = "bold"; title.style.marginBottom = "5px"; title.style.textAlign = "center"; title.style.color = "#00FFFF";
        this.logicToolbar.appendChild(title);

        const axes = ["x", "y", "z"];
        this.toolbarInputs = {};

        // --- SHAPE SELECTOR ---
        this.collisionShapeRow = document.createElement("div");
        this.collisionShapeRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px; margin-bottom: 5px; border-bottom:1px solid #555; padding-bottom:5px;";

        const shapeLbl = document.createElement("label"); shapeLbl.textContent = "FORMA";
        const shapeSelect = document.createElement("select");
        shapeSelect.style.cssText = "background:#222; color:white; border:1px solid #555; padding:2px;";

        const optBox = document.createElement("option"); optBox.value = "box"; optBox.textContent = "Cubo";
        const optSphere = document.createElement("option"); optSphere.value = "sphere"; optSphere.textContent = "Esfera";

        shapeSelect.appendChild(optBox);
        shapeSelect.appendChild(optSphere);
        shapeSelect.value = "box";

        shapeSelect.onchange = (e) => {
            this.currentCollisionSize.shapeType = (e.target as HTMLSelectElement).value;
            this.updateToolbarVisibility();
        };
        // Prevent Key Propagation
        shapeSelect.onkeydown = (e) => e.stopPropagation();

        this.collisionShapeRow.appendChild(shapeLbl);
        this.collisionShapeRow.appendChild(shapeSelect);
        this.logicToolbar.appendChild(this.collisionShapeRow);


        // --- BOX INPUTS ---
        this.boxInputsContainer = document.createElement("div");
        this.boxInputsContainer.style.cssText = "display:flex; flex-direction:column; gap:5px;";

        axes.forEach(axis => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
            const lbl = document.createElement("label"); lbl.textContent = axis.toUpperCase();
            const inp = document.createElement("input"); inp.type = "number"; inp.step = "0.5"; inp.value = "2";
            inp.style.width = "60px"; inp.style.background = "#222"; inp.style.color = "white"; inp.style.border = "1px solid #555"; inp.style.padding = "4px";

            inp.oninput = (e) => {
                let val = parseFloat((e.target as HTMLInputElement).value);
                if (isNaN(val) || val < 0.1) val = 0.1;
                this.currentCollisionSize[axis] = val;
                // e.target.value = val // Don't snap back on input, interferes with typing
            };
            // Prevent event propagation to game inputs
            inp.onkeydown = (e) => e.stopPropagation();

            row.appendChild(lbl); row.appendChild(inp);
            this.boxInputsContainer.appendChild(row);
            this.toolbarInputs[axis] = inp;
        });
        this.logicToolbar.appendChild(this.boxInputsContainer);

        // --- SPHERE INPUTS ---
        this.sphereInputsContainer = document.createElement("div");
        this.sphereInputsContainer.style.cssText = "display:none; flex-direction:column; gap:5px;";

        const radRow = document.createElement("div");
        radRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const radLbl = document.createElement("label"); radLbl.textContent = "RADIO";
        const radInp = document.createElement("input"); radInp.type = "number"; radInp.step = "0.5"; radInp.value = "1.0";
        radInp.style.width = "60px"; radInp.style.background = "#222"; radInp.style.color = "white"; radInp.style.border = "1px solid #555"; radInp.style.padding = "4px";

        radInp.oninput = (e) => {
            let val = parseFloat((e.target as HTMLInputElement).value);
            if (isNaN(val) || val < 0.1) val = 0.1;
            this.currentCollisionSize.radius = val;
        };
        radInp.onkeydown = (e) => e.stopPropagation();

        radRow.appendChild(radLbl); radRow.appendChild(radInp);
        this.sphereInputsContainer.appendChild(radRow);
        this.logicToolbar.appendChild(this.sphereInputsContainer);

        // --- SPAWN POINT INPUTS ---
        // Defaults
        this.currentSpawnProperties = { shapeType: "circle", radius: 1.0, x: 2, y: 0.1, z: 2, rotation: 0 };

        this.spawnInputsContainer = document.createElement("div");
        this.spawnInputsContainer.style.cssText = "display:none; flex-direction:column; gap:5px;";

        // Shape Selector for Spawn
        const spawnShapeRow = document.createElement("div");
        spawnShapeRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px; margin-bottom: 5px; border-bottom:1px solid #555; padding-bottom:5px;";
        const spawnShapeLbl = document.createElement("label"); spawnShapeLbl.textContent = "FORMA";
        const spawnShapeSelect = document.createElement("select");
        spawnShapeSelect.style.cssText = "background:#222; color:white; border:1px solid #555; padding:2px;";

        const optCircle = document.createElement("option"); optCircle.value = "circle"; optCircle.textContent = "Círculo";
        const optSquare = document.createElement("option"); optSquare.value = "square"; optSquare.textContent = "Cuadrado";

        spawnShapeSelect.appendChild(optCircle);
        spawnShapeSelect.appendChild(optSquare);
        spawnShapeSelect.value = "circle";

        spawnShapeSelect.onchange = (e) => {
            this.currentSpawnProperties.shapeType = (e.target as HTMLSelectElement).value;
            this.updateToolbarVisibility();
        };
        spawnShapeSelect.onkeydown = (e) => e.stopPropagation();

        spawnShapeRow.appendChild(spawnShapeLbl);
        spawnShapeRow.appendChild(spawnShapeSelect);
        this.spawnInputsContainer.appendChild(spawnShapeRow);

        // Circle Inputs (Radius)
        this.spawnCircleInputs = document.createElement("div");
        this.spawnCircleInputs.style.cssText = "display:flex; flex-direction:column; gap:5px;";

        const scRow = document.createElement("div");
        scRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const scLbl = document.createElement("label"); scLbl.textContent = "RADIO";
        const scInp = document.createElement("input"); scInp.type = "number"; scInp.step = "0.5"; scInp.value = "1.0";
        scInp.style.width = "60px"; scInp.style.background = "#222"; scInp.style.color = "white"; scInp.style.border = "1px solid #555"; scInp.style.padding = "4px";
        scInp.oninput = (e) => {
            let val = parseFloat((e.target as HTMLInputElement).value);
            if (isNaN(val) || val < 0.1) val = 0.1;
            this.currentSpawnProperties.radius = val;
            // Sync square if needed? (Optional, let's keep separate)
        };
        scInp.onkeydown = (e) => e.stopPropagation();
        scRow.appendChild(scLbl); scRow.appendChild(scInp);
        this.spawnCircleInputs.appendChild(scRow);
        this.spawnInputsContainer.appendChild(this.spawnCircleInputs);

        // Square Inputs (X, Y, Z)
        this.spawnSquareInputs = document.createElement("div");
        this.spawnSquareInputs.style.cssText = "display:none; flex-direction:column; gap:5px;";

        axes.forEach(axis => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
            const lbl = document.createElement("label"); lbl.textContent = axis.toUpperCase();
            const inp = document.createElement("input"); inp.type = "number"; inp.step = "0.5";
            inp.value = String(this.currentSpawnProperties[axis] || 2);
            inp.style.width = "60px"; inp.style.background = "#222"; inp.style.color = "white"; inp.style.border = "1px solid #555"; inp.style.padding = "4px";

            // Store ref and sync logic
            if (!this.toolbarSpawnInputs) this.toolbarSpawnInputs = {};
            this.toolbarSpawnInputs[axis] = inp;

            inp.oninput = (e) => {
                let val = parseFloat((e.target as HTMLInputElement).value);
                if (isNaN(val) || val < 0.1) val = 0.1;
                this.currentSpawnProperties[axis] = val;

                // Circle Sync Logic
                if (this.currentSpawnProperties.shapeType === "circle") {
                    if (axis === "x" || axis === "z") {
                        this.currentSpawnProperties.x = val;
                        this.currentSpawnProperties.z = val;
                        this.currentSpawnProperties.radius = val / 2;
                    }
                    this.updateSpawnInputsValues();
                }
            };
            inp.onkeydown = (e) => e.stopPropagation();

            row.appendChild(lbl); row.appendChild(inp);
            this.spawnSquareInputs.appendChild(row);
        });
        this.spawnInputsContainer.appendChild(this.spawnSquareInputs);

        this.logicToolbar.appendChild(this.spawnInputsContainer);

        // --- TARGET OBJECT INPUTS ---
        this.currentTargetProperties = { rings: 3, baseDamage: 10, ringMultipliers: [0.10, 0.55, 1.0], radius: 1.0, useProjectileDamage: false };
        this.targetInputsContainer = document.createElement("div");
        this.targetInputsContainer.style.cssText = "display:none; flex-direction:column; gap:5px;";

        // Use Projectile Damage Input
        const projDmgRowTarget = document.createElement("div");
        projDmgRowTarget.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const projDmgLblTarget = document.createElement("label"); projDmgLblTarget.textContent = "DAÑO DE BALA";
        const projDmgInpTarget = document.createElement("input"); projDmgInpTarget.type = "checkbox"; projDmgInpTarget.checked = false;
        // The logic mapping happens after `dmgInpTarget` is created.
        projDmgInpTarget.onkeydown = (e) => e.stopPropagation();
        projDmgRowTarget.appendChild(projDmgLblTarget); projDmgRowTarget.appendChild(projDmgInpTarget);
        this.targetInputsContainer.appendChild(projDmgRowTarget);

        // Radius Input
        const radRowTarget = document.createElement("div");
        radRowTarget.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const radLblTarget = document.createElement("label"); radLblTarget.textContent = "RADIO";
        const radInpTarget = document.createElement("input"); radInpTarget.type = "number"; radInpTarget.step = "0.5"; radInpTarget.value = "1.0";
        radInpTarget.style.width = "60px"; radInpTarget.style.background = "#222"; radInpTarget.style.color = "white"; radInpTarget.style.border = "1px solid #555"; radInpTarget.style.padding = "4px";
        radInpTarget.oninput = (e) => {
            let val = parseFloat((e.target as HTMLInputElement).value);
            if (isNaN(val) || val < 0.1) val = 0.1;
            this.currentTargetProperties.radius = val;
        };
        radInpTarget.onkeydown = (e) => e.stopPropagation();
        radRowTarget.appendChild(radLblTarget); radRowTarget.appendChild(radInpTarget);
        this.targetInputsContainer.appendChild(radRowTarget);

        // Rings Input
        const ringsRow = document.createElement("div");
        ringsRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const ringsLbl = document.createElement("label"); ringsLbl.textContent = "ANILLOS";
        const ringsInp = document.createElement("input"); ringsInp.type = "number"; ringsInp.step = "1"; ringsInp.value = "3";
        ringsInp.style.width = "60px"; ringsInp.style.background = "#222"; ringsInp.style.color = "white"; ringsInp.style.border = "1px solid #555"; ringsInp.style.padding = "4px";
        ringsInp.oninput = (e) => {
            let val = parseInt((e.target as HTMLInputElement).value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 10) val = 10;
            this.currentTargetProperties.rings = val;

            const newMults = [];
            if (val === 1) {
                newMults.push(1.0);
            } else {
                for (let i = 0; i < val; i++) {
                    const t = i / (val - 1);
                    const v = 0.1 + t * 0.9;
                    newMults.push(Number(v.toFixed(2)));
                }
            }
            this.currentTargetProperties.ringMultipliers = newMults;
        };
        ringsInp.onkeydown = (e) => e.stopPropagation();
        ringsRow.appendChild(ringsLbl); ringsRow.appendChild(ringsInp);
        this.targetInputsContainer.appendChild(ringsRow);

        // Base Damage Input
        const dmgRow = document.createElement("div");
        dmgRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const dmgLbl = document.createElement("label"); dmgLbl.textContent = "DAÑO BASE";
        const dmgInp = document.createElement("input"); dmgInp.type = "number"; dmgInp.step = "1"; dmgInp.value = "10";
        dmgInp.style.width = "60px"; dmgInp.style.background = "#222"; dmgInp.style.color = "white"; dmgInp.style.border = "1px solid #555"; dmgInp.style.padding = "4px";
        dmgInp.oninput = (e) => {
            let val = parseFloat((e.target as HTMLInputElement).value);
            if (isNaN(val)) val = 10;
            this.currentTargetProperties.baseDamage = val;
        };
        dmgInp.onkeydown = (e) => e.stopPropagation();
        dmgRow.appendChild(dmgLbl); dmgRow.appendChild(dmgInp);
        this.targetInputsContainer.appendChild(dmgRow);

        // Map checkbox logic
        dmgInp.disabled = this.currentTargetProperties.useProjectileDamage;
        dmgInp.style.opacity = this.currentTargetProperties.useProjectileDamage ? "0.5" : "1.0";
        projDmgInpTarget.onchange = (e) => {
            const isChecked = (e.target as HTMLInputElement).checked;
            this.currentTargetProperties.useProjectileDamage = isChecked;
            dmgInp.disabled = isChecked;
            dmgInp.style.opacity = isChecked ? "0.5" : "1.0";
        };

        this.logicToolbar.appendChild(this.targetInputsContainer);

        spawnShapeRow.appendChild(spawnShapeLbl);
        spawnShapeRow.appendChild(spawnShapeSelect);
        this.spawnInputsContainer.appendChild(spawnShapeRow);

        // Circle Inputs (Radius, Rotation)
        this.spawnCircleInputs = document.createElement("div");
        this.spawnCircleInputs.style.cssText = "display:flex; flex-direction:column; gap:5px;";

        // Radius
        const spawnRadRow = document.createElement("div");
        spawnRadRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
        const spawnRadLbl = document.createElement("label"); spawnRadLbl.textContent = "RADIO (R)";
        const spawnRadInp = document.createElement("input"); spawnRadInp.type = "number"; spawnRadInp.step = "0.5"; spawnRadInp.value = "1.0";
        this.spawnRadInp = spawnRadInp;
        spawnRadInp.style.width = "60px"; spawnRadInp.style.background = "#222"; spawnRadInp.style.color = "white"; spawnRadInp.style.border = "1px solid #555"; spawnRadInp.style.padding = "4px;";
        spawnRadInp.onchange = (e) => {
            let val = parseFloat((e.target as HTMLInputElement).value);
            if (isNaN(val) || val < 0.1) val = 0.1;
            this.currentSpawnProperties.radius = val;
        };
        spawnRadInp.onkeydown = (e) => e.stopPropagation();
        spawnRadRow.appendChild(spawnRadLbl); spawnRadRow.appendChild(spawnRadInp);
        this.spawnCircleInputs.appendChild(spawnRadRow);

        this.spawnInputsContainer.appendChild(this.spawnCircleInputs);

        // Square Inputs (X, Y, Z)
        this.spawnSquareInputs = document.createElement("div");
        this.spawnSquareInputs.style.cssText = "display:none; flex-direction:column; gap:5px;";

        this.spawnXYZInputs = {};

        ["x", "y", "z"].forEach(axis => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap: 10px;";
            const lbl = document.createElement("label"); lbl.textContent = axis.toUpperCase();
            const inp = document.createElement("input"); inp.type = "number"; inp.step = "0.5";
            // Default Y is thin (0.1), X/Z 2
            const initialVal = (axis === "y") ? 0.1 : 2;
            inp.value = String(initialVal);
            inp.style.width = "60px"; inp.style.background = "#222"; inp.style.color = "white"; inp.style.border = "1px solid #555"; inp.style.padding = "4px";

            this.spawnXYZInputs[axis] = inp;

            inp.onchange = (e) => {
                let val = parseFloat((e.target as HTMLInputElement).value);
                if (isNaN(val) || val < 0.1) val = 0.1;
                this.currentSpawnProperties[axis] = val;

                // Circle Sync Logic
                if (this.currentSpawnProperties.shapeType === "circle") {
                    if (axis === "x" || axis === "z") {
                        this.currentSpawnProperties.x = val;
                        this.currentSpawnProperties.z = val;
                        this.currentSpawnProperties.radius = val / 2;
                    }
                    this.updateSpawnInputsValues();
                }
            };
            inp.onkeydown = (e) => e.stopPropagation();

            row.appendChild(lbl); row.appendChild(inp);
            this.spawnSquareInputs.appendChild(row);
        });
        this.spawnInputsContainer.appendChild(this.spawnSquareInputs);

        this.logicToolbar.appendChild(this.spawnInputsContainer);

        const hint = document.createElement("div");
        hint.textContent = "Edita para redimensionar";
        hint.style.fontSize = "10px"; hint.style.color = "#aaa"; hint.style.textAlign = "center";
        this.logicToolbar.appendChild(hint);

        document.body.appendChild(this.logicToolbar);
    }

    updateToolbarVisibility() {
        // 1. Check for specific Item Types FIRST
        if (this.currentItem && this.currentItem.type === "spawn_point") {
            if (this.collisionShapeRow) this.collisionShapeRow.style.display = "none";
            this.boxInputsContainer.style.display = "none";
            this.sphereInputsContainer.style.display = "none";
            this.targetInputsContainer.style.display = "none";
            this.spawnInputsContainer.style.display = "flex";

            // Spawn Point Sub-logic
            if (this.currentSpawnProperties.shapeType === "circle") {
                this.spawnCircleInputs.style.display = "flex";
                this.spawnSquareInputs.style.display = "flex";
            } else {
                this.spawnCircleInputs.style.display = "none";
                this.spawnSquareInputs.style.display = "flex";
            }

        } else if (this.currentItem && this.currentItem.type === "target") {
            // Target object properties
            if (this.collisionShapeRow) this.collisionShapeRow.style.display = "none";
            this.boxInputsContainer.style.display = "none";
            this.sphereInputsContainer.style.display = "none";
            this.spawnInputsContainer.style.display = "none";
            this.targetInputsContainer.style.display = "flex";

            // 2. Then check Collision Shape State (Implicitly for interactive_collision or defaults)
        } else if (this.currentCollisionSize && this.currentCollisionSize.shapeType === "sphere") {
            if (this.collisionShapeRow) this.collisionShapeRow.style.display = "flex";
            this.boxInputsContainer.style.display = "none";
            this.targetInputsContainer.style.display = "none";
            this.sphereInputsContainer.style.display = "flex";
            this.spawnInputsContainer.style.display = "none";
        } else {
            // Default: Box Collision
            if (this.collisionShapeRow) this.collisionShapeRow.style.display = "flex";
            if (this.boxInputsContainer) this.boxInputsContainer.style.display = "flex";
            if (this.targetInputsContainer) this.targetInputsContainer.style.display = "none";
            if (this.sphereInputsContainer) this.sphereInputsContainer.style.display = "none";
            if (this.spawnInputsContainer) this.spawnInputsContainer.style.display = "none";
        }
    }

    initAerialGrid() {
        // 1. Dynamic Collider Plane (Infinite-like Plane)
        // We use a large flat box or plane. 
        // 100x1x100 is good.
        const geometry = new THREE.PlaneGeometry(1000, 1000);
        geometry.rotateX(-Math.PI / 2); // Horizontal
        const material = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        this.aerialCollider = new THREE.Mesh(geometry, material);
        this.aerialCollider.name = "aerialColliderGhost";
        this.scene.add(this.aerialCollider);

        // 2. Visual Grid (Single Layer)
        this.aerialVisual = new THREE.Group();
        this.aerialVisual.name = "aerialVisualHelper";

        // Single Grid Helper
        // 100 size, 100 divisions = 1x1 cells
        const grid = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
        this.aerialVisual.add(grid);

        // No bounding box needed for infinite-like plane
        this.aerialVisual.visible = false;
        this.scene.add(this.aerialVisual);
    }

    setAerialGrid(active) {
        this.aerialGridActive = active;
        // Reset fixed state when disabled? Or keep memory? 
        // User didn't specify, but usually disabling grid implies full reset.
        if (!active) {
            this.aerialGridFixed = false;
        }
        if (this.aerialVisual) {
            this.aerialVisual.visible = active;
        }
    }

    toggleAerialGridFixed() {
        if (!this.aerialGridActive) return false;
        this.aerialGridFixed = !this.aerialGridFixed;
        return this.aerialGridFixed;
    }

    /**
     * Checks if the object is considered "Ground" (terrain/floor)
     * vs a constructed block.
     */
    isGround(object) {
        // Simple heuristic: if it's explicitly explicitly the aerial collider or flagged as ground
        if (object === this.aerialCollider) return true;
        if (object.userData && object.userData.isGround) return true;
        // If it's a MapObject (constructed), it's NOT ground
        if (object.userData && object.userData.isMapObject) return false;

        // Fallback: Default to true if not clearly a MapObject
        return true;
    }

    /**
     * Checks for collisions at the proposed position
     */
    checkCollision(position, size) {
        // Create box for the new object
        const box = new THREE.Box3();
        // Shrink slightly to avoid touching-is-collision
        const hitBoxSize = size.clone().multiplyScalar(0.95);
        box.setFromCenterAndSize(position, hitBoxSize);

        const checkList = this.scene.children.filter(o =>
            o !== this.placementGhost &&
            !this.placementGhost.children.includes(o) &&
            o !== this.aerialCollider &&
            o.visible
        );

        for (const obj of checkList) {
            // Check player collision
            if (obj.userData && obj.userData.isPlayer) {
                // Approximate player size
                const playerPos = obj.position.clone();
                // Player box approx 1x2x1 centered at pos.y + 1
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    playerPos.clone().add(new THREE.Vector3(0, 1, 0)),
                    new THREE.Vector3(0.8, 1.8, 0.8)
                );
                if (box.intersectsBox(playerBox)) return true;
                continue;
            }

            // Check against other MapObjects logic
            if (obj.userData && obj.userData.isMapObject && (obj as any).geometry) {
                // If it's a mesh, get its bounding box
                const objBox = new THREE.Box3().setFromObject(obj);

                // Only check reasonable objects
                if (objBox.getSize(new THREE.Vector3()).length() > 1000) continue;

                if (box.intersectsBox(objBox)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Calculates the actual dimensions of the item after rotation
     */
    getRealSize(item, rotationIndex) {
        let size = new THREE.Vector3(1, 1, 1); // Default
        if (item.type === "interactive_collision") {
            if (this.currentCollisionSize.shapeType === "sphere") {
                const r = this.currentCollisionSize.radius;
                size.set(r * 2, r * 2, r * 2);
            } else {
                size.set(this.currentCollisionSize.x, this.currentCollisionSize.y, this.currentCollisionSize.z);
            }
        } else if (item.type === "gravity_sphere") {
            const radius = item.scale.radius !== undefined ? item.scale.radius : (item.scale.x / 2 || 0.75);
            size.set(radius * 2, radius * 2, radius * 2);
        } else if (item.type === "target") {
            const diameter = (this.currentTargetProperties && this.currentTargetProperties.radius) ? this.currentTargetProperties.radius * 2 : (item.scale.x || 2);
            size.set(diameter, item.scale.y || 0.2, diameter);
        } else if (item.type === "sphere") {
            const r = item.scale.radius || item.scale.x / 2 || 1.0;
            size.set(r * 2, r * 2, r * 2);
        } else if (item.type === "cylinder") {
            const r = item.scale.radius || item.scale.x / 2 || 1.0;
            const h = item.scale.y || 1.0;
            size.set(r * 2, h, r * 2);
        } else if (item.type === "circle") {
            const r = item.scale.radius || item.scale.x / 2 || 1.0;
            const h = item.scale.y || 0.05;
            size.set(r * 2, h, r * 2);
        } else if (item.type === "tube") {
            const r = item.scale.radius || 0.5;
            const segments = getTubeSegments(item.scale);
            const totalLen = segments.reduce((sum, s) => sum + (s.length || 2.0), 0);
            size.set(r * 2, totalLen, r * 2);
        } else if (item.constructor.name === "MapObjectItem") {
            size.set(item.scale.x || 1, item.scale.y || 1, item.scale.z || 1);
        } else if (item.id.includes("pad")) {
            size.set(3, 0.2, 3);
        }

        // Swap dimensions based on rotation
        // Rotation 1 (-90) & 3 (+90) swap X and Z
        if (rotationIndex === 1 || rotationIndex === 3) {
            const temp = size.x;
            size.x = size.z;
            size.z = temp;
        }
        return size;
    }

    getRotationAngle(rotationIndex) {
        if (rotationIndex === 1) return -Math.PI / 2;
        if (rotationIndex === 2) return -Math.PI;
        if (rotationIndex === 3) return Math.PI / 2;
        return 0;
    }

    getSurfaceAlignedQuaternion(normal, rotationIndex = 0) {
        const safeNormal = normal.clone().normalize();
        if (safeNormal.lengthSq() < 0.0001) safeNormal.set(0, 1, 0);

        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), safeNormal);
        const twist = new THREE.Quaternion().setFromAxisAngle(safeNormal, this.getRotationAngle(rotationIndex));
        quaternion.premultiply(twist);
        return quaternion;
    }

    rebuildStairsGhost(item) {
        // Prevent rebuilding if same item scale
        const key = `${item.scale.x}_${item.scale.y}_${item.scale.z}`;
        if (this.ghostStairsLastKey === key && this.ghostStairsGroup.children.length > 0) return;

        this.ghostStairsLastKey = key;

        // Clear existing
        while (this.ghostStairsGroup.children.length > 0) {
            this.ghostStairsGroup.remove(this.ghostStairsGroup.children[0]);
        }

        // Generate Steps (Logic from MapObjectItem)
        const targetStepHeight = 0.25;
        const numSteps = Math.max(1, Math.round(item.scale.y / targetStepHeight));

        const stepHeight = item.scale.y / numSteps;
        const stepDepth = item.scale.z / numSteps;
        const stepWidth = item.scale.x;

        const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);

        const startY = -item.scale.y / 2 + stepHeight / 2; // Bottom relative to center
        const startZ = -item.scale.z / 2 + stepDepth / 2; // Back relative to center

        for (let i = 0; i < numSteps; i++) {
            const mesh = new THREE.Mesh(stepGeo, this.ghostBaseMat);

            // Position
            mesh.position.y = startY + (i * stepHeight);
            mesh.position.z = startZ + (i * stepDepth);
            mesh.position.x = 0; // Centered width

            // OPTIMIZATION: Disable raycasting for ghost meshes
            mesh.raycast = () => { };

            this.ghostStairsGroup.add(mesh);
        }
    }

    rebuildRampGhost(item) {
        if (!this.ghostRampMesh) return;

        const key = `${item.scale.x}_${item.scale.y}_${item.scale.z}`;
        if (this.ghostRampLastKey === key) return;

        this.ghostRampLastKey = key;
        this.ghostRampMesh.geometry.dispose();
        this.ghostRampMesh.geometry = RampUtils.createGeometry(item.scale);
        this.ghostRampMesh.scale.set(1, 1, 1);
    }

    rebuildSpikedFloorGhost(item) {
        if (!this.ghostSpikedFloorGroup) return;

        const spikeRadius = item.scale.spikeRadius !== undefined ? item.scale.spikeRadius : 0.15;
        const spikeHeight = item.scale.spikeHeight !== undefined ? item.scale.spikeHeight : 0.4;
        const spikeSpacing = item.scale.spikeSpacing !== undefined ? item.scale.spikeSpacing : 0.5;
        const spikeColor = item.scale.spikeColor !== undefined ? item.scale.spikeColor : "#dc2626";

        const key = `${item.scale.x}_${item.scale.y}_${item.scale.z}_${spikeRadius}_${spikeHeight}_${spikeSpacing}_${spikeColor}`;
        if (this.ghostSpikedFloorLastKey === key && this.ghostSpikedFloorGroup.children.length > 0) return;

        this.ghostSpikedFloorLastKey = key;

        // Clear existing
        while (this.ghostSpikedFloorGroup.children.length > 0) {
            this.ghostSpikedFloorGroup.remove(this.ghostSpikedFloorGroup.children[0]);
        }

        // 1. Base floor box
        const baseGeo = new THREE.BoxGeometry(item.scale.x, item.scale.y, item.scale.z);
        const baseMesh = new THREE.Mesh(baseGeo, this.ghostBaseMat);
        baseMesh.raycast = () => { };
        this.ghostSpikedFloorGroup.add(baseMesh);

        // 2. Add spikes
        const buffer = spikeRadius * 1.5;
        const availableW = item.scale.x - 2 * buffer;
        const availableD = item.scale.z - 2 * buffer;

        const numX = availableW > 0 ? Math.max(1, Math.floor(availableW / spikeSpacing) + 1) : 1;
        const numZ = availableD > 0 ? Math.max(1, Math.floor(availableD / spikeSpacing) + 1) : 1;

        const spikeGeo = new THREE.ConeGeometry(spikeRadius, spikeHeight, 8);
        const spikeMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(spikeColor),
            transparent: true,
            opacity: 0.4,
            wireframe: true
        });

        for (let i = 0; i < numX; i++) {
            for (let j = 0; j < numZ; j++) {
                let xPos = 0;
                if (numX > 1) {
                    xPos = -availableW / 2 + (i * (availableW / (numX - 1)));
                } else {
                    xPos = 0;
                }

                let zPos = 0;
                if (numZ > 1) {
                    zPos = -availableD / 2 + (j * (availableD / (numZ - 1)));
                } else {
                    zPos = 0;
                }

                const spike = new THREE.Mesh(spikeGeo, spikeMat);
                spike.position.set(xPos, item.scale.y / 2 + spikeHeight / 2, zPos);
                spike.raycast = () => { };
                this.ghostSpikedFloorGroup.add(spike);
            }
        }
    }

    rebuildLadderGhost(item) {
        const key = `${item.scale.x}_${item.scale.y}_${item.scale.z}`;
        if (this.ghostLadderLastKey === key && this.ghostLadderGroup.children.length > 0) return;

        this.ghostLadderLastKey = key;

        // Clear
        while (this.ghostLadderGroup.children.length > 0) {
            this.ghostLadderGroup.remove(this.ghostLadderGroup.children[0]);
        }

        const height = item.scale.y;
        const width = item.scale.x;

        // Rails
        const railGeo = new THREE.BoxGeometry(0.1, height, 0.1);

        const leftRail = new THREE.Mesh(railGeo, this.ghostBaseMat);
        leftRail.position.set(-width / 2, height / 2, 0); // Shift UP to sit on pivot

        const rightRail = new THREE.Mesh(railGeo, this.ghostBaseMat);
        rightRail.position.set(width / 2, height / 2, 0); // Shift UP to sit on pivot

        this.ghostLadderGroup.add(leftRail);
        this.ghostLadderGroup.add(rightRail);

        // Rungs
        const rungCount = Math.floor(height / 0.4);
        const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, width, 8);
        rungGeo.rotateZ(Math.PI / 2);

        for (let i = 0; i < rungCount; i++) {
            const rung = new THREE.Mesh(rungGeo, this.ghostBaseMat);
            // Start from bottom (0) + first step. 
            // Pivot is now at Y=0 (Bottom of ladder)
        rung.position.set(0, (i + 1) * 0.4, 0);
            this.ghostLadderGroup.add(rung);
        }
    }

    rebuildTubeGhost(item) {
        const radius = item.scale.radius || 0.5;
        const segments = getTubeSegments(item.scale);

        const key = JSON.stringify(segments) + "_" + radius;
        if (this.ghostTubeLastKey === key && this.ghostTubeGroup && this.ghostTubeGroup.children.length > 0) return;

        this.ghostTubeLastKey = key;

        // Clear existing
        while (this.ghostTubeGroup.children.length > 0) {
            this.ghostTubeGroup.remove(this.ghostTubeGroup.children[0]);
        }

        let parentGroup = this.ghostTubeGroup;

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const segLength = seg.length || 2.0;

            const cylGeo = new THREE.CylinderGeometry(radius, radius, segLength, 16);
            const mesh = new THREE.Mesh(cylGeo, this.ghostBaseMat);
            mesh.raycast = () => {};
            mesh.position.set(0, segLength / 2, 0);
            parentGroup.add(mesh);

            if (i < segments.length - 1) {
                const elbowGeo = new THREE.SphereGeometry(radius, 16, 16);
                const elbowMesh = new THREE.Mesh(elbowGeo, this.ghostBaseMat);
                elbowMesh.raycast = () => {};
                elbowMesh.position.set(0, segLength, 0);
                parentGroup.add(elbowMesh);

                const nextSeg = segments[i + 1];
                const childGroup = new THREE.Group();
                childGroup.position.set(0, segLength, 0);
                childGroup.rotation.set(
                    (nextSeg.bendAngleX || 0) * Math.PI / 180,
                    (nextSeg.bendAngleY || 0) * Math.PI / 180,
                    0,
                    "YXZ"
                );
                parentGroup.add(childGroup);
                parentGroup = childGroup;
            }
        }
    }

    /**
     * Actualiza la posición y visualización del fantasma
     * @param {number} inventorySlot - Índice del slot seleccionado (0 o 1)
     * @param {number} rotationIndex - Índice de rotación (0-3) para pads laterales
     * @param {THREE.Vector3} [playerPosition] - Posición del jugador para altura dinámica
     * @returns {THREE.Vector3|null} - Punto de impacto válido o null
     */
    update(item, rotationIndex, playerPosition) {
        this.currentItem = item;
        this.rotationIndex = rotationIndex;

        // Toolbar Visibility Logic
        if (item && (item.type === "interactive_collision" || item.type === "spawn_point" || item.type === "target")) {
            this.logicToolbar.style.display = "flex";
            this.updateToolbarVisibility(); // Ensure correct sub-menu is shown
        } else {
            this.logicToolbar.style.display = "none";
        }

        // Si no hay item o no es de construcción, ocultar
        // Added ignore for 'weapon' type
        if (!item || (!item.isImpulsePad && !item.type) || item.type === "weapon") {
            this.placementGhost.visible = false;
            this.currentHit = null;
            if (this.aerialVisual) this.aerialVisual.visible = false;
            this.logicToolbar.style.display = "none"; // Ensure hidden
            return;
        }

        // --- Aerial Grid Dynamic Update ---
        if (this.aerialGridActive && playerPosition) {
            if (!this.aerialGridFixed) {
                const gridY = Math.round(playerPosition.y);
                this.aerialVisual.position.y = gridY;
                this.aerialCollider.position.y = gridY;
            }
            this.aerialVisual.visible = true;
            this.aerialVisual.position.x = Math.round(playerPosition.x);
            this.aerialVisual.position.z = Math.round(playerPosition.z);
        } else if (!this.aerialGridActive) {
            if (this.aerialVisual) this.aerialVisual.visible = false;
        }

        // Raycast
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        // Filter out ghost and characters
        const hit = intersects.find(h => {
            if (h.distance >= 60) return false;
            if (h.object.type !== "Mesh") return false;

            // Ignore Player (Recursive check)
            let obj = h.object;
            while (obj) {
                if (obj.userData && obj.userData.isPlayer) return false;
                obj = obj.parent;
            }

            // Ignore Aerial Collider if not active
            if (!this.aerialGridActive && h.object === this.aerialCollider) return false;

            // Ignore the entire Ghost Hierarchy
            let parent = h.object;
            while (parent) {
                if (parent === this.placementGhost) return false;
                parent = parent.parent;
            }

            return true;
        });

        this.currentHit = hit ? hit.point : null;

        if (hit) {
            this.lastValidQuaternion = null;

            // --- MOVEMENT CONTROLLER LOGIC ---
            if (item.type === "movement_controller") {
                let targetObj = hit.object;
                while (targetObj && (!targetObj.userData || !targetObj.userData.isEditableMapObject)) {
                    targetObj = targetObj.parent;
                }
                const isTargetObject = !!targetObj;

                if (!isTargetObject) {
                    this.placementGhost.visible = false;
                    this.lastValidPosition = null;
                    return null;
                }

                this.placementGhost.visible = true;

                // 1. Match Target Size
                const targetBox = new THREE.Box3().setFromObject(targetObj);
                const targetSize = new THREE.Vector3();
                targetBox.getSize(targetSize);
                const targetCenter = new THREE.Vector3();
                targetBox.getCenter(targetCenter);

                this.ghostBaseMat.visible = true;
                this.ghostArrow.visible = false;
                if (this.ghostRampMesh) this.ghostRampMesh.visible = false;
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;
                if (this.ghostLadderGroup) this.ghostLadderGroup.visible = false;
                if (this.ghostSphereMesh) this.ghostSphereMesh.visible = false;
                if (this.ghostCylinderMesh) this.ghostCylinderMesh.visible = false;
                if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                if (this.ghostConeMesh) this.ghostConeMesh.visible = false;
                if (this.ghostSpikedFloorGroup) this.ghostSpikedFloorGroup.visible = false;

                // Use Box Mesh for highlight
                this.ghostBoxMesh.visible = true;
                this.ghostBoxMesh.scale.copy(targetSize);

                // Color Blue for Logic Highlighting
                this.ghostBaseMat.color.setHex(0x0000ff);
                this.ghostBaseMat.opacity = 0.5;

                // Position at Center of Target
                this.placementGhost.position.copy(targetCenter);
                this.placementGhost.rotation.set(0, 0, 0);
                this.placementGhost.quaternion.copy(targetObj.quaternion);

                // 2. Text Label
                if (!this.ghostLabelSprite) {
                    this.ghostLabelSprite = this.createLabelSprite("Aplicar", "#FFFF00");
                    this.placementGhost.add(this.ghostLabelSprite);
                }
                this.ghostLabelSprite.visible = true;
                this.ghostLabelSprite.position.set(0, targetSize.y / 2 + 0.5, 0); // Above object

                // Update text
                const logicProps = targetObj.userData.logicProperties;
                const hasLogic = logicProps && (logicProps.waypoints || (Array.isArray(logicProps.sequences) && logicProps.sequences.length > 0));
                const txt = hasLogic ? "Aplicado!" : "Aplicar";
                const col = hasLogic ? "#00FF00" : "#FFFF00";
                this.updateLabelSprite(this.ghostLabelSprite, txt, col);

                this.lastValidPosition = hit.point;
                return hit.point;
            } else if (item.type === "damage_controller") {
                let targetObj = hit.object;
                while (targetObj && (!targetObj.userData || !targetObj.userData.isEditableMapObject)) {
                    targetObj = targetObj.parent;
                }
                const isTargetObject = !!targetObj;

                if (!isTargetObject) {
                    this.placementGhost.visible = false;
                    this.lastValidPosition = null;
                    return null;
                }

                this.placementGhost.visible = true;

                // 1. Match Target Size
                const targetBox = new THREE.Box3().setFromObject(targetObj);
                const targetSize = new THREE.Vector3();
                targetBox.getSize(targetSize);
                const targetCenter = new THREE.Vector3();
                targetBox.getCenter(targetCenter);

                this.ghostBaseMat.visible = true;
                this.ghostArrow.visible = false;
                if (this.ghostRampMesh) this.ghostRampMesh.visible = false;
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;
                if (this.ghostLadderGroup) this.ghostLadderGroup.visible = false;
                if (this.ghostSphereMesh) this.ghostSphereMesh.visible = false;
                if (this.ghostCylinderMesh) this.ghostCylinderMesh.visible = false;
                if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                if (this.ghostConeMesh) this.ghostConeMesh.visible = false;
                if (this.ghostSpikedFloorGroup) this.ghostSpikedFloorGroup.visible = false;

                // Use Box Mesh for highlight
                this.ghostBoxMesh.visible = true;
                this.ghostBoxMesh.scale.copy(targetSize);

                // Color Red for Damage Logic Highlighting
                this.ghostBaseMat.color.setHex(0xff3333);
                this.ghostBaseMat.opacity = 0.5;

                // Position at Center of Target
                this.placementGhost.position.copy(targetCenter);
                this.placementGhost.rotation.set(0, 0, 0);
                this.placementGhost.quaternion.copy(targetObj.quaternion);

                // 2. Text Label
                if (!this.ghostLabelSprite) {
                    this.ghostLabelSprite = this.createLabelSprite("Aplicar", "#FFFF00");
                    this.placementGhost.add(this.ghostLabelSprite);
                }
                this.ghostLabelSprite.visible = true;
                this.ghostLabelSprite.position.set(0, targetSize.y / 2 + 0.5, 0); // Above object

                // Update text
                const logicProps = targetObj.userData.logicProperties;
                const hasLogic = logicProps && logicProps.enableDamage === true;
                const txt = hasLogic ? "Aplicado!" : "Aplicar Daño";
                const col = hasLogic ? "#00FF00" : "#ffaa00";
                this.updateLabelSprite(this.ghostLabelSprite, txt, col);

                this.lastValidPosition = hit.point;
                return hit.point;
            } else if (item.type === "ladder") {
                // --- LADDER WALL LOGIC ---
                // Supports Wall Alignment AND Rotation/Grid

                this.placementGhost.visible = true;
                if (this.ghostLabelSprite) this.ghostLabelSprite.visible = false;

                // Hide generic box, show ladder
                this.ghostBoxMesh.visible = false;
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;

                // Update Material Color based on Item
                if (item.color) {
                    this.ghostBaseMat.color.setHex(item.color);
                } else {
                    this.ghostBaseMat.color.setHex(0xffffff);
                }

                this.rebuildLadderGhost(item);
                this.ghostLadderGroup.visible = true;

                this.ghostBaseMat.opacity = 0.5; // Slightly more opaque for visibility

                // Set Size
                const realSize = this.getRealSize(item, rotationIndex);
                let targetPos = hit.point.clone();

                // 1. Grid Snapping (If Active)
                // We do this BEFORE Wall checks or AFTER? 
                // Usually Grid determines the "base" point.
                const gridSize = this.gridSize || 1;
                if (this.snapToGrid || this.aerialGridActive) { // aerialGrid uses grid snapping logic too
                    targetPos.x = Math.round(targetPos.x / gridSize) * gridSize;
                    targetPos.y = Math.round(targetPos.y / gridSize) * gridSize;
                    targetPos.z = Math.round(targetPos.z / gridSize) * gridSize;
                }

                // 2. Orientation
                if (hit.face && Math.abs(hit.face.normal.y) < 0.9) {
                    // -- WALL PLACEMENT --
                    // If we are snapping to grid, wall placement might be tricky (floating).
                    // But user requested "Seguir Activar Construcción en Cuadrícula".
                    // So we respect the grid position calculated above.

                    // If NOT snapping, we use exact wall point + offset
                    if (!this.snapToGrid && !this.aerialGridActive) {
                        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                        normal.y = 0; normal.normalize();

                        // Align to wall
                        const lookTarget = targetPos.clone().add(normal);
                        this.placementGhost.position.copy(targetPos);
                        this.placementGhost.lookAt(lookTarget);

                        // Offset
                        const offset = normal.multiplyScalar(0.1);
                        // Apply offset to Ghost only? Or targetPos?
                        // If we return targetPos, that's where it spawns.
                        this.placementGhost.position.add(offset);
                        targetPos.add(offset);
                    } else {
                        // Grid Snap Active: Wall alignment is secondary to Grid?
                        // Actually, rotating to face the wall is still good UX.
                        // But 'R' should override or offset it? 
                        // "Rotar con R normalmente". 
                        // Let's allow R to set absolute rotation (0, 90, 180, 270).

                        this.placementGhost.position.copy(targetPos);

                        // Apply Rotation Index
                        this.placementGhost.rotation.set(0, 0, 0);
                        if (rotationIndex === 1) this.placementGhost.rotation.y = -Math.PI / 2;
                        if (rotationIndex === 2) this.placementGhost.rotation.y = -Math.PI;
                        if (rotationIndex === 3) this.placementGhost.rotation.y = Math.PI / 2;
                    }
                } else {
                    // -- FLOOR / CEILING --
                    // Standard mechanics

                    // If grid was applied above, targetPos is already snapped.

                    this.placementGhost.position.copy(targetPos);

                    // Apply Rotation
                    this.placementGhost.rotation.set(0, 0, 0);
                    if (rotationIndex === 1) this.placementGhost.rotation.y = -Math.PI / 2;
                    if (rotationIndex === 2) this.placementGhost.rotation.y = -Math.PI;
                    if (rotationIndex === 3) this.placementGhost.rotation.y = Math.PI / 2;
                }

                this.lastValidPosition = this.placementGhost.position.clone(); // Use ghost pos which handles logic

                // Allow spawning at this pos/rot
                this.lastValidQuaternion = this.placementGhost.quaternion.clone();

                // We need to return the Rotation quaternion for the spawn logic if it differs from Index?
                // SpawnObject uses rotationIndex if quaternion not passed?
                // Actually `update` returns position.
                // `MapObjectItem.use` gets position from `placementManager.getCurrentTarget()`
                return this.lastValidPosition;
            }

            // Disable Label for others
            if (this.ghostLabelSprite) this.ghostLabelSprite.visible = false;
            this.ghostBaseMat.opacity = 0.3; // Reset opacity

            // Reset Color to White (Default)
            if (item.color) {
                this.ghostBaseMat.color.setHex(item.color);
            } else {
                this.ghostBaseMat.color.setHex(0xffffff);
            }

            this.placementGhost.visible = true;
            if (this.ghostLadderGroup) this.ghostLadderGroup.visible = false;

            // --- Determine Size (Smart Sizing) ---
            let realSize = this.getRealSize(item, rotationIndex);

            // Override size for interaction_button globally in this scope
            if (item.type === "interaction_button") {
                realSize = new THREE.Vector3(0.6, 0.1, 0.6);
            }

            const gridSize = this.gridSize || 1;
            let targetPos = hit.point.clone();
            const surfaceAlignedTypes = ["interaction_button", "target", "gravity_pad", "impulse_jump", "impulse_lateral", "farming_zone", "logic_camera", "camera_panel", "camera_prop", "cone", "spiked_floor"];

            // --- Snapping Logic ---
            if (this.snapToGrid || this.aerialGridActive) {
                const isAerialHit = (hit.object === this.aerialCollider);
                const isMapObject = hit.object.userData && hit.object.userData.isMapObject;

                if (surfaceAlignedTypes.includes(item.type) && hit.face) {
                    // --- BUTTON/TARGET SURFACE LOGIC (GRID) ---
                    // Size is already set above

                    // Align to Normal
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                    const quaternion = this.getSurfaceAlignedQuaternion(normal, rotationIndex);

                    this.lastValidQuaternion = quaternion.clone();
                    this.placementGhost.quaternion.copy(quaternion);

                    // Snap Logic on Surface
                    // Keep axis parallel to normal (flush)
                    // Snap axes perpendicular to normal
                    const axes = ["x", "y", "z"];
                    axes.forEach(ax => {
                        if (Math.abs(normal[ax]) > 0.5) {
                            // Parallel to normal -> flush but OFFSET by half height
                            targetPos[ax] = hit.point[ax] + normal[ax] * (realSize.y / 2);
                        } else {
                            // Perpendicular -> Snap to Grid center or line based on size
                            const s = realSize[ax];
                            const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0;
                            targetPos[ax] = Math.round((hit.point[ax] - offset) / gridSize) * gridSize + offset;
                        }
                    });

                } else if (isMapObject && hit.face) {
                    // --- SMART SNAPPING (Block-to-Block) ---
                    const hitBox = new THREE.Box3().setFromObject(hit.object);
                    const hitCenter = new THREE.Vector3();
                    hitBox.getCenter(hitCenter);
                    const hitSize = new THREE.Vector3();
                    hitBox.getSize(hitSize);

                    // Identify Normal Axis
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                    const axis = new THREE.Vector3(
                        Math.round(normal.x),
                        Math.round(normal.y),
                        Math.round(normal.z)
                    );

                    // Calculate Offset Distance (Center to Center)
                    const offsetDist = new THREE.Vector3()
                        .copy(hitSize).multiplyScalar(0.5)
                        .add(realSize.clone().multiplyScalar(0.5))
                        .multiply(axis);

                    // Initial Target = HitCenter + Offset
                    let finalPos = hitCenter.clone().add(offsetDist);

                    // Surface Axis Snapping
                    const axes = ["x", "y", "z"];
                    axes.forEach(ax => {
                        if (Math.abs(axis[ax]) < 0.1) {
                            // If dimensions match, align perfectly with the target object (Stacking/Rowing)
                            if (Math.abs(realSize[ax] - hitSize[ax]) < 0.1) {
                                finalPos[ax] = hitCenter[ax];
                            } else {
                                // Default Grid Snapping
                                let val = hit.point[ax];
                                const s = realSize[ax];

                                // Dual Snap for Thin Objects (Consistency with Ground Logic)
                                if (Math.abs(s - 0.5) < 0.1) {
                                    const baseGrid = Math.round(val / gridSize) * gridSize;
                                    if (val >= baseGrid) {
                                        finalPos[ax] = baseGrid + 0.25;
                                    } else {
                                        finalPos[ax] = baseGrid - 0.25;
                                    }
                                } else {
                                    // Standard 
                                    const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0;
                                    val = Math.round((val - offset) / gridSize) * gridSize + offset;
                                    finalPos[ax] = val;
                                }
                            }
                        }
                    });
                    targetPos.copy(finalPos);

                } else {
                    // --- GROUND / GLOBAL LOGIC (STATIC MAP & FALLBACK) ---

                    // Special Handling for Buttons, Targets and Gravity Pads on Static Geometry (Walls/Floors)
                    if (surfaceAlignedTypes.includes(item.type) && hit.face) {
                        // Align to Normal
                        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                        const quaternion = this.getSurfaceAlignedQuaternion(normal, rotationIndex);

                        this.lastValidQuaternion = quaternion.clone();
                        this.placementGhost.quaternion.copy(quaternion);

                        // Snap Logic on Surface
                        // Keep axis parallel to normal (flush)
                        // Snap axes perpendicular to normal
                        const axes = ["x", "y", "z"];
                        axes.forEach(ax => {
                            if (Math.abs(normal[ax]) > 0.5) {
                                // Parallel to normal -> flush but OFFSET by half height
                                targetPos[ax] = hit.point[ax] + normal[ax] * (realSize.y / 2);
                            } else {
                                // Perpendicular -> Snap to Grid center or line based on size
                                const s = realSize[ax];
                                const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0;
                                targetPos[ax] = Math.round((hit.point[ax] - offset) / gridSize) * gridSize + offset;
                            }
                        });
                    } else {
                        // STANDARD LOGIC
                        const globalY = isAerialHit ? this.aerialCollider.position.y : hit.point.y;

                        // X/Z Snap with Dual-Snap for Thin Walls
                        ["x", "z"].forEach(ax => {
                            let val = hit.point[ax];
                            const s = realSize[ax];

                            // Check for "Thin" object (e.g. Wall thickness ~0.5)
                            // Precision check: 0.5 is typical. Let's say < 0.9 and > 0.1
                            if (Math.abs(s - 0.5) < 0.1) {
                                // DUAL SNAP LOGIC
                                // We want to snap to Grid +/- 0.25
                                // 1. Find nearest Grid Line
                                const baseGrid = Math.round(val / gridSize) * gridSize;

                                // 2. Determine side (Inner/Outer) based on cursor relative to line
                                if (val >= baseGrid) {
                                    targetPos[ax] = baseGrid + 0.25;
                                } else {
                                    targetPos[ax] = baseGrid - 0.25;
                                }
                            } else {
                                // Standard Center Snapping
                                const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0;
                                targetPos[ax] = Math.round((val - offset) / gridSize) * gridSize + offset;
                            }
                        });

                        // Y Snap
                        if (isAerialHit || !hit.face || Math.abs(hit.face.normal.y) > 0.5 || !isMapObject) {
                            targetPos.y = globalY + realSize.y / 2;
                        } else {
                            targetPos.y = Math.round(hit.point.y);
                        }
                    }
                }
            } else {
                // --- FREE PLACEMENT & SURFACE ALIGNMENT ---

                // Special case: Interaction Buttons, Targets and Gravity Pads align to the hit surface normal.
                if (surfaceAlignedTypes.includes(item.type) && hit.face) {
                    // Custom Size override for free placement too for buttons
                    if (item.type === "interaction_button") {
                        realSize = new THREE.Vector3(0.6, 0.1, 0.6);
                    }
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();

                    // Align Y up to Normal
                    const quaternion = this.getSurfaceAlignedQuaternion(normal, rotationIndex);

                    // Apply to ghost
                    this.placementGhost.quaternion.copy(quaternion);
                    this.lastValidQuaternion = quaternion.clone();

                    // Position needs offset by half height along normal
                    // Use updated realSize.y
                    const offset = normal.multiplyScalar(realSize.y / 2);
                    targetPos.add(offset);

                    this.placementGhost.rotation.setFromQuaternion(quaternion);

                } else {
                    // Reset Quaternion for normal items (Vertical Up)
                    this.placementGhost.quaternion.identity();
                    this.lastValidQuaternion = null;
                }

                // We still want the object to sit ON the surface, not sink into it.
                // Move center away from hit point by half extent along normal.
                if (hit.face) {
                    if (!surfaceAlignedTypes.includes(item.type)) {
                        // Generic surface offset logic
                        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
                        const yOffset = realSize.y / 2;
                        const offset = new THREE.Vector3(
                            normal.x * yOffset,
                            normal.y * yOffset,
                            normal.z * yOffset
                        );
                        targetPos.add(offset);
                    }
                } else {
                    // Fallback
                    targetPos.y += realSize.y / 2;
                }
            }

            this.placementGhost.position.copy(targetPos);

            // Adjust visual geometry matches RealSize
            if (item.constructor.name === "MapObjectItem") {
                this.ghostBaseMat.visible = true;
                this.ghostRampMesh.visible = false;
                this.ghostBoxMesh.visible = false;
                this.ghostSphereMesh.visible = false;
                this.ghostCylinderMesh.visible = false;
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;
                if (this.ghostLadderGroup) this.ghostLadderGroup.visible = false;
                if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                if (this.ghostConeMesh) this.ghostConeMesh.visible = false;
                if (this.ghostSpikedFloorGroup) this.ghostSpikedFloorGroup.visible = false;

                if (item.type === "impulse_jump" || item.type === "impulse_lateral") {
                    const isJump = (item.type === "impulse_jump");
                    this.ghostArrow.visible = true;
                    
                    // Assign texture
                    this.ghostArrowMat.map = isJump ? this.texSalto : this.texImpulso;
                    this.ghostArrowMat.needsUpdate = true;
                    
                    // Size the plane according to the scale of the pad
                    this.ghostArrow.scale.set(item.scale.x * 0.8 / 2.4, item.scale.z * 0.8 / 2.4, 1);
                    
                    // Set position on top of the ghost box
                    this.ghostArrow.position.y = item.scale.y / 2 + 0.01;
                    
                    // Set rotation:
                    this.ghostArrow.rotation.x = -Math.PI / 2;
                    this.ghostArrow.rotation.y = 0;
                    this.ghostArrow.rotation.z = isJump ? 0 : 0;
                } else {
                    this.ghostArrow.visible = false;
                }

                if (item.type === "ramp") {
                    this.ghostRampMesh.visible = true;
                    this.rebuildRampGhost(item);
                    // Reset Y because targetPos is Center now
                    this.ghostRampMesh.position.y = 0;
                } else if (item.type === "stairs") {
                    // STAIRS PREVIEW
                    if (!this.ghostStairsGroup) {
                        this.ghostStairsGroup = new THREE.Group();
                        this.placementGhost.add(this.ghostStairsGroup);
                    }
                    this.ghostStairsGroup.visible = true;
                    this.rebuildStairsGhost(item);
                } else {
                    if (item.type === "logic_camera" || item.type === "camera_prop") {
                        if (this.cameraGhostFrustum) {
                            this.placementGhost.remove(this.cameraGhostFrustum);
                            this.cameraGhostFrustum.geometry?.dispose?.();
                            this.cameraGhostFrustum = null;
                        }

                        const makeFrustum = (fov = 60, far = 6, aspect = 16 / 9) => {
                            const near = 0.35;
                            const fovRad = THREE.MathUtils.degToRad(fov);
                            const nearH = Math.tan(fovRad / 2) * near;
                            const nearW = nearH * aspect;
                            const farH = Math.tan(fovRad / 2) * far;
                            const farW = farH * aspect;
                            const points = [
                                new THREE.Vector3(0, 0, 0), new THREE.Vector3(-farW, farH, -far),
                                new THREE.Vector3(0, 0, 0), new THREE.Vector3(farW, farH, -far),
                                new THREE.Vector3(0, 0, 0), new THREE.Vector3(farW, -farH, -far),
                                new THREE.Vector3(0, 0, 0), new THREE.Vector3(-farW, -farH, -far),
                                new THREE.Vector3(-nearW, nearH, -near), new THREE.Vector3(nearW, nearH, -near),
                                new THREE.Vector3(nearW, nearH, -near), new THREE.Vector3(nearW, -nearH, -near),
                                new THREE.Vector3(nearW, -nearH, -near), new THREE.Vector3(-nearW, -nearH, -near),
                                new THREE.Vector3(-nearW, -nearH, -near), new THREE.Vector3(-nearW, nearH, -near),
                                new THREE.Vector3(-farW, farH, -far), new THREE.Vector3(farW, farH, -far),
                                new THREE.Vector3(farW, farH, -far), new THREE.Vector3(farW, -farH, -far),
                                new THREE.Vector3(farW, -farH, -far), new THREE.Vector3(-farW, -farH, -far),
                                new THREE.Vector3(-farW, -farH, -far), new THREE.Vector3(-farW, farH, -far)
                            ];
                            const geometry = new THREE.BufferGeometry().setFromPoints(points);
                            const helperLineMat = new THREE.LineBasicMaterial({
                                color: 0x38bdf8,
                                transparent: true,
                                opacity: 0.8
                            });
                            return new THREE.LineSegments(geometry, helperLineMat);
                        };

                        const props = item.logicProperties || {};
                        this.cameraGhostFrustum = makeFrustum(Number(props.fov ?? 60), Number(props.far ?? 6), Number(props.aspect ?? 16 / 9));
                        this.placementGhost.add(this.cameraGhostFrustum);

                        this.ghostBoxMesh.visible = true;
                        this.ghostBoxMesh.scale.set(0.35, 0.25, 0.25);
                        this.ghostBoxMesh.position.y = 0;
                    } else {
                        if (this.cameraGhostFrustum) {
                            this.placementGhost.remove(this.cameraGhostFrustum);
                            this.cameraGhostFrustum.geometry?.dispose?.();
                            this.cameraGhostFrustum = null;
                        }

                        // Standard Box
                        if (["sphere", "cylinder", "circle", "tube", "cone", "spiked_floor"].includes(item.type)) {
                            this.ghostBoxMesh.visible = false;
                        } else {
                            this.ghostBoxMesh.visible = true;
                            if (item.type === "interaction_button") {
                                // Use correct visual size for ghost
                                this.ghostBoxMesh.scale.set(realSize.x, realSize.y, realSize.z);
                            } else if (item.type === "target") {
                                this.ghostBoxMesh.scale.set(realSize.x, realSize.y, realSize.z);
                            } else {
                                this.ghostBoxMesh.scale.set(item.scale.x, item.scale.y, item.scale.z);
                            }
                            this.ghostBoxMesh.position.y = 0;
                        }
                       // --- INTERACTIVE COLLISION GHOST UPDATE ---
                    if (item.type === "interactive_collision") {
                        // Ensure Spawn Ghost is Hidden
                        this.ghostCylinderMesh.visible = false;

                        if (this.currentCollisionSize.shapeType === "sphere") {
                            this.ghostBoxMesh.visible = false;
                            this.ghostSphereMesh.visible = true;
                            const r = this.currentCollisionSize.radius;
                            this.ghostSphereMesh.scale.set(r, r, r);
                            this.ghostSphereMesh.position.y = 0;
                        } else {
                            this.ghostSphereMesh.visible = false;
                            this.ghostBoxMesh.visible = true;
                            this.ghostBoxMesh.scale.set(
                                this.currentCollisionSize.x,
                                this.currentCollisionSize.y,
                                this.currentCollisionSize.z
                            );
                        }
                    } else if (item.type === "gravity_sphere") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostCylinderMesh.visible = false;
                        this.ghostSphereMesh.visible = true;
                        const radius = item.scale.radius !== undefined ? item.scale.radius : (item.scale.x / 2 || 0.75);
                        this.ghostSphereMesh.scale.set(radius, radius, radius);
                        this.ghostSphereMesh.position.y = 0;
                    } else if (item.type === "spawn_point") {
                        // SPAWN POINT GHOST
                        // Check properties
                        if (this.currentSpawnProperties.shapeType === "circle") {
                            this.ghostBoxMesh.visible = false;
                            this.ghostSphereMesh.visible = false;
                            this.ghostCylinderMesh.visible = true;

                            // Cylinder Geometry is Radius 1, Height 1.
                            // We want Radius = current.radius
                            // We want Height = 0.05 or custom? 
                            // Circle mode implies mostly flat or default height. 
                            // User asked for "R" for circle. Did not explicitly ask for height in circle mode, 
                            // but "X Y Z" for both? "change from circle to square X Y Z in both modes... and R also for circle"
                            // So Circle might need Height too? 
                            // Let's assume Circle uses default thin height or we can add Y to circle inputs if needed.
                            // For now, let's keep it thin 0.05 or use Y from square properties if user switches?
                            // Providing "R" usually implies radius only. 
                            // I'll stick to a thin disk for Circle unless I see a request for cylinder height.
                            // Actually, let's use a fixed height for Circle to keep it as a "pad", distinct from a pillar.
                            const r = this.currentSpawnProperties.radius;
                            const h = 0.05;
                            this.ghostCylinderMesh.scale.set(r, h, r);
                            this.ghostCylinderMesh.position.y = 0;
                        } else {
                            // Square Mode -> Box
                            this.ghostCylinderMesh.visible = false;
                            this.ghostSphereMesh.visible = false;
                            this.ghostBoxMesh.visible = true;

                            const props = this.currentSpawnProperties;
                            this.ghostBoxMesh.scale.set(props.x, props.y, props.z);
                            this.ghostBoxMesh.position.y = 0;
                        }
                    } else if (item.type === "sphere") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostCylinderMesh.visible = false;
                        if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                        this.ghostSphereMesh.visible = true;
                        const r = item.scale.radius || item.scale.x / 2 || 1.0;
                        this.ghostSphereMesh.scale.set(r, r, r);
                        this.ghostSphereMesh.position.y = 0;
                    } else if (item.type === "cylinder") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostSphereMesh.visible = false;
                        if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                        this.ghostCylinderMesh.visible = true;
                        const r = item.scale.radius || item.scale.x / 2 || 1.0;
                        const h = item.scale.y || 1.0;
                        this.ghostCylinderMesh.scale.set(r, h, r);
                        this.ghostCylinderMesh.position.y = 0;
                    } else if (item.type === "circle") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostSphereMesh.visible = false;
                        if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                        this.ghostCylinderMesh.visible = true;
                        const r = item.scale.radius || item.scale.x / 2 || 1.0;
                        const h = item.scale.y || 0.05;
                        this.ghostCylinderMesh.scale.set(r, h, r);
                        this.ghostCylinderMesh.position.y = 0;
                    } else if (item.type === "cone") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostSphereMesh.visible = false;
                        this.ghostCylinderMesh.visible = false;
                        if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                        if (this.ghostSpikedFloorGroup) this.ghostSpikedFloorGroup.visible = false;
                        this.ghostConeMesh.visible = true;
                        const r = item.scale.radius || item.scale.x / 2 || 1.0;
                        const h = item.scale.y || 1.0;
                        this.ghostConeMesh.scale.set(r, h, r);
                        this.ghostConeMesh.position.y = 0;
                    } else if (item.type === "spiked_floor") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostSphereMesh.visible = false;
                        this.ghostCylinderMesh.visible = false;
                        if (this.ghostTubeGroup) this.ghostTubeGroup.visible = false;
                        if (this.ghostConeMesh) this.ghostConeMesh.visible = false;
                        this.rebuildSpikedFloorGhost(item);
                        if (this.ghostSpikedFloorGroup) this.ghostSpikedFloorGroup.visible = true;
                    } else if (item.type === "tube") {
                        this.ghostBoxMesh.visible = false;
                        this.ghostSphereMesh.visible = false;
                        this.ghostCylinderMesh.visible = false;
                        this.rebuildTubeGhost(item);
                        if (this.ghostTubeGroup) this.ghostTubeGroup.visible = true;
                    }
                }
            }
            } else {
                // Pads
                this.ghostBoxMesh.position.y = 0;
                // Ensure other meshes are hidden for pads if reused
                if (this.ghostRampMesh) this.ghostRampMesh.visible = false;
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;
                if (this.ghostConeMesh) this.ghostConeMesh.visible = false;
                if (this.ghostSpikedFloorGroup) this.ghostSpikedFloorGroup.visible = false;
                this.ghostBoxMesh.visible = true;
            }

            // Apply rotation to ghost group
            if (this.lastValidQuaternion) {
                this.placementGhost.quaternion.copy(this.lastValidQuaternion);
            } else if (item.constructor.name === "MapObjectItem") {
                this.placementGhost.rotation.y = 0;
                if (rotationIndex === 1) this.placementGhost.rotation.y = -Math.PI / 2;
                if (rotationIndex === 2) this.placementGhost.rotation.y = -Math.PI;
                if (rotationIndex === 3) this.placementGhost.rotation.y = Math.PI / 2;
            } else {
                this.placementGhost.rotation.y = 0;
            }


            // --- Validation Logic ---
            let isValid = true;

            // Validation uses Center
            let collisionPosition = targetPos;
            let collisionSize = realSize;
            if (this.lastValidQuaternion) {
                const ghostBox = new THREE.Box3().setFromObject(this.placementGhost);
                collisionPosition = new THREE.Vector3();
                collisionSize = new THREE.Vector3();
                ghostBox.getCenter(collisionPosition);
                ghostBox.getSize(collisionSize);
            }

            if (this.checkCollision(collisionPosition, collisionSize)) {
                isValid = false;
            }

            // Return Base Position (Bottom Center) for Spawner
            const basePos = targetPos.clone();
            const isSurfaceAligned = surfaceAlignedTypes.includes(item.type);
            if (!isSurfaceAligned) {
                basePos.y -= realSize.y / 2;
            }

            // ALWAYS update lastValidPosition with the SNAPPED position
            // regardless of collision validity.
            // This ensures placement happens where the ghost is shown.
            this.lastValidPosition = basePos;

            // Visual Feedback
            if (isValid) {
                if (item.constructor.name === "MapObjectItem") {
                    this.ghostBaseMat.color.setHex(0x00ff00);
                    this.ghostArrowMat.color.setHex(0xffffff);
                } else {
                    const isJump = (item.id === "pad_jump");
                    const color = isJump ? 0x00ffff : 0x00ff00;
                    this.ghostBaseMat.color.setHex(color);
                    this.ghostArrowMat.color.setHex(0xffffff);
                }
                return basePos;
            } else {
                this.ghostBaseMat.color.setHex(0xff0000);
                this.ghostArrowMat.color.setHex(0xff0000);
                // Do NOT clear lastValidPosition here.
                // We return null to indicate INVALID, but we keep the pos stored just in case user forces it?
                // Actually, if we return null, the caller might use null.
                // But `getCurrentTarget` uses `this.lastValidPosition`.
                // So as long as we set `this.lastValidPosition`, `getCurrentTarget` will return it.
                return null;
            }

        } else {
            this.placementGhost.visible = false;
            this.lastValidPosition = null;
            return null;
        }
    }

    /**
     * Updates ghost for Logic Map Editor (References a live scene object instead of inventory item)
     */
    updateLogicGhost(targetObject, playerPosition, rotationIndex) {
        if (!targetObject) {
            this.placementGhost.visible = false;
            return null;
        }


        this.placementGhost.visible = true;

        // --- Aerial Grid Dynamic Update (Logic Mode) ---
        if (this.aerialGridActive && playerPosition) {
            if (!this.aerialGridFixed) {
                const gridY = Math.round(playerPosition.y);
                this.aerialVisual.position.y = gridY;
                this.aerialCollider.position.y = gridY;
            }
            this.aerialVisual.visible = true;
            this.aerialVisual.position.x = Math.round(playerPosition.x);
            this.aerialVisual.position.z = Math.round(playerPosition.z);
        } else if (!this.aerialGridActive) {
            if (this.aerialVisual) this.aerialVisual.visible = false;
        }

        // Hide standard ghosts
        if (this.ghostRampMesh) this.ghostRampMesh.visible = false;
        if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;
        if (this.ghostArrow) this.ghostArrow.visible = false;
        if (this.ghostLabelSprite) this.ghostLabelSprite.visible = false; // Hide Label

        this.ghostBoxMesh.visible = true;

        // Match Size
        const box = new THREE.Box3().setFromObject(targetObject);
        const size = new THREE.Vector3();
        box.getSize(size);
        // Adjust size if target is rotated? Box3 is AABB. 
        // We want local size. userData usually has originalScale or we get from geometry parameters if BoxGeometry.
        // If we use AABB of rotated object, size changes. 
        // Best to use userData.originalScale if available.
        if (targetObject.userData.originalScale) {
            this.ghostBoxMesh.scale.copy(targetObject.userData.originalScale);
        } else {
            this.ghostBoxMesh.scale.copy(size);
        }

        this.ghostBaseMat.color.setHex(0x0000ff); // Logic Color (BLUE)
        this.ghostBaseMat.opacity = 0.5; // Higher opacity

        // Raycast logic
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        const hit = intersects.find(h => {
            if (h.distance >= 100) return false;
            if (h.object.type !== "Mesh") return false;
            if (h.object.userData.isPlayer) return false;
            let parent = h.object;
            while (parent) {
                if (parent === this.placementGhost || parent === targetObject) return false;
                parent = parent.parent;
            }
            return true;
        });

        if (!hit) {
            this.placementGhost.visible = false;
            this.lastValidPosition = null;
            return null;
        }

        let targetPos = hit.point.clone();

        // Snap to grid if active
        // User wants "Cube" (size 1) to be centered in square.
        // Size 1 is ODD. Center should be at 0.5, 1.5, etc.
        // Size 2 is EVEN. Center should be at 1.0, 2.0 (On lines).
        // Formula: 
        // offset = (size % 2 !== 0) ? 0.5 : 0
        // val = Math.round(val - offset) + offset

        if (this.snapToGrid || this.aerialGridActive) {
            const gridSize = this.gridSize || 1;

            // X Snap
            const sx = this.ghostBoxMesh.scale.x;
            const offsetX = (Math.abs(sx % 2) > 0.01) ? (gridSize / 2) : 0;
            targetPos.x = Math.round((targetPos.x - offsetX) / gridSize) * gridSize + offsetX;

            // Z Snap
            const sz = this.ghostBoxMesh.scale.z;
            const offsetZ = (Math.abs(sz % 2) > 0.01) ? (gridSize / 2) : 0;
            targetPos.z = Math.round((targetPos.z - offsetZ) / gridSize) * gridSize + offsetZ;

            // Y Snap
            const sy = this.ghostBoxMesh.scale.y;
            // For Y, we usually want it sitting ON the grid/floor.
            // If we hit a face, we want y = hit.y + sy/2.
            // But we also want to snap that height to steps?
            // User compliant about "cuadricula" usually refers to X/Z plane.
            // Let's keep Y logical:

            // If floor hit, sit on it.
            if (hit.face && hit.face.normal.y > 0.5) {
                // But usually we want Snapped X/Z but Y on surface.

                // Let's stick to full grid snap for now as requested.
            }
        } else {
            // Free placement, sit on floor
            // Match standard logic
        }

        // Adjust Y to be Center
        targetPos.y += this.ghostBoxMesh.scale.y / 2;

        this.placementGhost.position.copy(targetPos);

        // Rotation Lognic ('R')
        // Rotate the GHOST group
        this.placementGhost.rotation.set(0, 0, 0); // Reset
        // Apply Y rotation based on index
        let rotY = 0;
        if (rotationIndex === 1) rotY = -Math.PI / 2;
        if (rotationIndex === 2) rotY = -Math.PI;
        if (rotationIndex === 3) rotY = Math.PI / 2;

        this.placementGhost.rotation.y = rotY;

        this.lastValidPosition = targetPos;
        return targetPos;
    }

    getCurrentTarget() {
        return this.lastValidPosition || this.currentHit;
    }

    createLabelSprite(text, colorStr) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 256;
        canvas.height = 128; // Rectangular

        this.drawLabelOnCanvas(ctx, text, colorStr, canvas.width, canvas.height);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2, 1, 1); // Adjust size
        return sprite;
    }

    updateLabelSprite(sprite, text, colorStr) {
        if (!sprite || !sprite.material || !sprite.material.map) return;

        const tex = sprite.material.map;
        const canvas = tex.image;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawLabelOnCanvas(ctx, text, colorStr, canvas.width, canvas.height);

        tex.needsUpdate = true;
    }

    drawLabelOnCanvas(ctx, text, colorStr, w, h) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, w, h);

        ctx.font = "bold 40px Arial";
        ctx.fillStyle = colorStr;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, w / 2, h / 2);

        // Border
        ctx.strokeStyle = colorStr;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, w, h);
    }
    // Expose current rotation for spawner
    getPlacementRotation() {
        if (this.lastValidQuaternion) {
            return this.lastValidQuaternion;
        }
        return this.rotationIndex;
    }

    updateSpawnInputsValues() {
        if (this.spawnRadInp) this.spawnRadInp.value = this.currentSpawnProperties.radius;
        if (this.spawnXYZInputs) {
            this.spawnXYZInputs.x.value = this.currentSpawnProperties.x;
            this.spawnXYZInputs.y.value = this.currentSpawnProperties.y;
            this.spawnXYZInputs.z.value = this.currentSpawnProperties.z;
        }
    }
}
