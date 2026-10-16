// @ts-nocheck
import { FuelZoneLogic } from './logic_items/FuelZoneLogic';
import { normalizeFuelZone } from '../fuel/FuelZoneSettings';

import * as THREE from "three";
import { MapObjectItem } from "../items/MapObjectItem";
import { LogicSystem } from "../managers/LogicSystem";
import { GameConfigPanel } from "./GameConfigPanel";
import { PlayerConfigPanel } from "./PlayerConfigPanel";
import { GunItem } from "../items/GunItem";
import { WEAPONS_CONFIG } from "../items/WeaponSettings";
import { MapShapeEditor } from "./MapShapeEditor";
import { AdvancedWeaponConfigPanel } from "./AdvancedWeaponConfigPanel";
import { getActiveFarmingGroups } from "./GameHUD";
import { MOTORBIKE_SIZE, normalizeMotorbikeSettings } from "../vehicles/MotorbikeSettings";
import { MotorbikeLogic } from "./logic_items/MotorbikeLogic";
import { SectionedItemEditor, SECTION_ICONS } from "./components/SectionedItemEditor";
import { JetpackItem } from "../items/JetpackItem";
import { savePlatformMapForRoom } from "../platform/mapRuntime";
import { listAssets, uploadAsset } from "../platform/api";
import { getDefaultTextureSettings, normalizeTextureSettings } from "../utils/TextureMapping";
import { GRAVITY_ORIENTATION_OPTIONS } from "../utils/GravityOrientation";
import { getSkyboxPresetDefaults } from "../platform/skyboxPresets";
import { SolarVisualTimelineEditor } from "./SolarVisualTimelineEditor";
import { sampleSolarVisualPoints, formatSolarPointTime } from "../platform/solarVisualTimeline";
import {
  formatTimeOfDayHHMM,
  calculateSolarCyclePosition,
  normalizeSolarCycleSettings,
  interpolateTimelineState,
  normalizeTimeline,
  normalizeTimelineKeyframe,
  DEFAULT_DAY_NIGHT_PROFILES,
  getKeyframeTimeAndDuration,
  setKeyframeStartTime,
  setKeyframeEndTime,
  setKeyframeDuration,
  updateKeyframeLabel,
  addPresetKeyframeToTimeline,
  removeKeyframeFromTimeline
} from "../platform/timelineDefaults";

const SKYBOX_CUBEMAP_DIR = "/assets/skybox/Cubemap";
const SKYBOX_VALUE_PREFIX = "skybox:";
const SKYBOX_PROBE_COUNT = 99;
const SKYBOX_PREVIEW_TEXTURE_CACHE = new Map();
const CUBEMAP_FACE_CROPS = {
    left: { x: 0, y: 1 },
    front: { x: 1, y: 1 },
    right: { x: 2, y: 1 },
    back: { x: 3, y: 1 },
    top: { x: 1, y: 0 },
    bottom: { x: 1, y: 2 }
};

function getSkyboxAtlasUrl(index) {
    return `${SKYBOX_CUBEMAP_DIR}/Cubemap_Sky_${String(index).padStart(2, "0")}-512x512.png`;
}

function getSkyboxUrlFromValue(value) {
    return typeof value === "string" && value.startsWith(SKYBOX_VALUE_PREFIX)
        ? value.slice(SKYBOX_VALUE_PREFIX.length)
        : null;
}

function applyCubemapFacePreview(element, url, face = "front") {
    const crop = CUBEMAP_FACE_CROPS[face] || CUBEMAP_FACE_CROPS.front;
    element.style.backgroundImage = `url("${url}")`;
    element.style.backgroundSize = "400% 300%";
    element.style.backgroundPosition = `${(crop.x / 3) * 100}% ${(crop.y / 2) * 100}%`;
}

function extractCubemapFace(image, faceSize, face) {
    const crop = CUBEMAP_FACE_CROPS[face] || CUBEMAP_FACE_CROPS.front;
    const canvas = document.createElement("canvas");
    canvas.width = faceSize;
    canvas.height = faceSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create skybox preview canvas");
    ctx.drawImage(
        image,
        crop.x * faceSize,
        crop.y * faceSize,
        faceSize,
        faceSize,
        0,
        0,
        faceSize,
        faceSize
    );
    return canvas;
}

function loadSkyboxPreviewTexture(url) {
    if (SKYBOX_PREVIEW_TEXTURE_CACHE.has(url)) return SKYBOX_PREVIEW_TEXTURE_CACHE.get(url);

    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            try {
                const faceSize = Math.min(image.width / 4, image.height / 3);
                const texture = new THREE.CubeTexture([
                    extractCubemapFace(image, faceSize, "right"),
                    extractCubemapFace(image, faceSize, "left"),
                    extractCubemapFace(image, faceSize, "top"),
                    extractCubemapFace(image, faceSize, "bottom"),
                    extractCubemapFace(image, faceSize, "front"),
                    extractCubemapFace(image, faceSize, "back")
                ]);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
                resolve(texture);
            } catch (error) {
                reject(error);
            }
        };
        image.onerror = () => reject(new Error(`Could not load skybox preview ${url}`));
        image.src = url;
    });

    SKYBOX_PREVIEW_TEXTURE_CACHE.set(url, promise);
    return promise;
}

export class ConstructionMenu {
    constructor(inventoryManager, gameInstance) {
        this.inventoryManager = inventoryManager;
        this.game = gameInstance;
        this.isVisible = false;
        this.skyboxAssetPromise = null;
        this.mapShapeEditor = new MapShapeEditor(this.game, this);

        // Systems
        this.logicSystem = new LogicSystem(this.game);

        // Data
        this.libraryItems = [];
        this.customTextureAssets = [];
        this.generateLibrary();
        this.generateLogicLibrary();

        this.generateLogicLibrary();

        this.gameConfigPanel = new GameConfigPanel(this.game, this.logicSystem);
        this.playerConfigPanel = new PlayerConfigPanel(this.game, this.logicSystem.playerConfigManager);
        this.advancedWeaponConfigPanel = null;

        this.setupUI();
        void this.refreshCustomTextures();
    }

    discoverSkyboxAssets() {
        if (this.skyboxAssetPromise) return this.skyboxAssetPromise;

        const candidates = Array.from({ length: SKYBOX_PROBE_COUNT }, (_, i) => {
            const index = i + 1;
            return {
                text: `Skybox ${String(index).padStart(2, "0")}`,
                value: `${SKYBOX_VALUE_PREFIX}${getSkyboxAtlasUrl(index)}`
            };
        });

        this.skyboxAssetPromise = Promise.all(candidates.map(async (asset) => {
            const url = asset.value.slice(SKYBOX_VALUE_PREFIX.length);
            try {
                const response = await fetch(url, { method: "HEAD" });
                const contentType = response.headers.get("content-type") || "";
                return response.ok && contentType.startsWith("image/") ? asset : null;
            } catch (error) {
                return null;
            }
        })).then(results => results.filter(Boolean));

        return this.skyboxAssetPromise;
    }

    generateLibrary() {
        // Shapes
        const shapes = [
            { id_prefix: "wall", name: "Pared", type: "wall", scale: { x: 5, y: 3, z: 0.5 } },
            { id_prefix: "wall_low", name: "Muro Bajo", type: "wall", scale: { x: 5, y: 1, z: 0.5 } },
            { id_prefix: "floor", name: "Suelo", type: "wall", scale: { x: 5, y: 0.5, z: 5 } },
            { id_prefix: "platform", name: "Plataforma", type: "wall", scale: { x: 10, y: 0.5, z: 10 } },
            { id_prefix: "pillar", name: "Pilar", type: "pillar", scale: { x: 1, y: 4, z: 1 } },
            { id_prefix: "cube_s", name: "Cubo Pequeño", type: "wall", scale: { x: 1, y: 1, z: 1 } },
            { id_prefix: "cube_l", name: "Cubo Grande", type: "wall", scale: { x: 3, y: 3, z: 3 } },
            { id_prefix: "ramp", name: "Rampa", type: "ramp", scale: { x: 4, y: 2, z: 4 } },
            { id_prefix: "stairs", name: "Gradas", type: "stairs", scale: { x: 4, y: 2, z: 4 } },
            { id_prefix: "ladder", name: "Escalera", type: "ladder", scale: { x: 1, y: 3, z: 0.5 } },
            { id_prefix: "tall", name: "Torre", type: "pillar", scale: { x: 2, y: 10, z: 2 } },
            { id_prefix: "sphere_shape", name: "Esfera", type: "sphere", scale: { x: 2, y: 2, z: 2, radius: 1 } },
            { id_prefix: "cylinder_shape", name: "Cilindro", type: "cylinder", scale: { x: 2, y: 3, z: 2, radius: 1 } },
            { id_prefix: "cone_shape", name: "Cono", type: "cone", scale: { x: 2, y: 3, z: 2, radius: 1 } },
            { id_prefix: "spiked_floor_shape", name: "Suelo de Pinchos", type: "spiked_floor", scale: { x: 5, y: 0.5, z: 5, spikeRadius: 0.15, spikeHeight: 0.4, spikeSpacing: 0.5 } },
            { id_prefix: "circle_shape", name: "Círculo con Superficie", type: "circle", scale: { x: 3, y: 0.05, z: 3, radius: 1.5 } },
            { id_prefix: "tube_shape", name: "Tubo Dobladizo", type: "tube", scale: { x: 1, y: 2, z: 1, radius: 0.5, length2: 2, bendAngleX: 0, bendAngleY: 90 } },
            { id_prefix: "camera_prop", name: "Cámara (Decorativa)", type: "camera_prop", scale: { x: 0.7, y: 0.7, z: 0.7 } }
        ];

        // Single Color (White)
        const whiteHex = 0xFFFFFF;

        shapes.forEach(shape => {
            const item = new MapObjectItem(
                `${shape.id_prefix}`,
                `${shape.name}`,
                shape.type,
                "",
                whiteHex,
                shape.scale
            );
            this.libraryItems.push(item);
        });

        // Add Guns to Library
        WEAPONS_CONFIG.forEach(cfg => {
            this.libraryItems.push(new GunItem(cfg));
        });

        const motorbike = new MapObjectItem("motorbike", "Motocicleta", "motorbike", "", 0xffffff, { ...MOTORBIKE_SIZE });
        motorbike.logicProperties = normalizeMotorbikeSettings();
        this.libraryItems.push(motorbike);

        // Add Consumables to Library
        this.libraryItems.push(new JetpackItem());
    }

    generateLogicLibrary() {
        // Logic Objects
        this.logicItems = [];

        // Player Spawn
        const spawn = new MapObjectItem(
            "spawn_point",
            "Punto de Spawn",
            "spawn_point",
            "",
            0x00FF00,
            { x: 2, y: 0.05, z: 2 }
        );
        // Default Logic Properties
        spawn.logicProperties = {
            team: 1,
            capacity: 1,
            order: 1
        };
        this.logicItems.push(spawn);

        // Movement Controller
        const mover = new MapObjectItem(
            "movement_controller",
            "Controlador de Movimiento",
            "movement_controller",
            "",
            0x00FFFF,
            { x: 0.5, y: 0.5, z: 0.5 }
        );
        mover.logicProperties = {
            targetUuid: null,
            sequences: [{
                name: "Secuencia Principal",
                speed: 2.0,
                loop: true,
                active: true,
                triggerType: "none",
                waypoints: []
            }]
        };
        this.logicItems.push(mover);

        // Damage Controller
        const damageCtrl = new MapObjectItem(
            "damage_controller",
            "Controlador de Daño",
            "damage_controller",
            "",
            0xFF3333,
            { x: 0.5, y: 0.5, z: 0.5 }
        );
        damageCtrl.logicProperties = {
            name: "Controlador de Daño",
            enableDamage: true,
            damage: 10,
            instantKill: false,
            percentDamage: 0,
            maxDamage: 100,
            enableDamageStopLimit: false,
            damageStopLimit: 100,
            damageCooldown: 1.0,
            accumulatedDamage: 0,
            enableKnockback: false,
            knockbackForce: 15,
            knockbackDirection: "automatic"
        };
        this.logicItems.push(damageCtrl);

        // Interaction Button
        const button = new MapObjectItem(
            "button",
            "Botón Interactivo",
            "interaction_button",
            "",
            0xFF0000,
            { x: 1, y: 1, z: 1 }
        );
        // Default Logic
        button.logicProperties = {
            holdTime: 1.0,
            oneShot: false,
            targetUuid: null
        };
        this.logicItems.push(button);

        // Gravity Sphere
        const gravitySphere = new MapObjectItem(
            "gravity_sphere",
            "Esfera de Gravedad",
            "gravity_sphere",
            "",
            0x9C27B0,
            { x: 1.5, y: 1.5, z: 1.5, radius: 0.75 }
        );
        gravitySphere.logicProperties = {
            holdTime: 0.5,
            oneShot: false,
            pulsationMode: false,
            targetUuid: null
        };
        this.logicItems.push(gravitySphere);

        const logicCamera = new MapObjectItem(
            "logic_camera",
            "Camara",
            "logic_camera",
            "",
            0x1F2937,
            { x: 0.7, y: 0.7, z: 0.7 }
        );
        logicCamera.logicProperties = {
            logicKind: "logic_camera",
            name: "Camara",
            mode: "fixed",
            fov: 60,
            far: 6,
            aspect: 16 / 9,
            eyeHeightOffset: 0
        };
        this.logicItems.push(logicCamera);

        const cameraPanel = new MapObjectItem(
            "camera_panel",
            "Panel de Camaras",
            "camera_panel",
            "",
            0x0F172A,
            { x: 1.2, y: 0.12, z: 1.0 }
        );
        cameraPanel.logicProperties = {
            logicKind: "camera_panel",
            name: "Panel de Camaras",
            cameraIds: [],
            holdTime: 0
        };
        this.logicItems.push(cameraPanel);

        const logicLight = new MapObjectItem(
            "logic_light",
            "Fuente de Luz",
            "logic_light",
            "",
            0xFFEB3B,
            { x: 0.5, y: 0.5, z: 0.5 }
        );
        logicLight.logicProperties = {
            logicKind: "logic_light",
            lightType: "point",
            color: "#ffffff",
            intensity: 2.0,
            distance: 15.0,
            decay: 2.0,
            angle: 45.0,
            penumbra: 0.5,
            castShadow: true
        };
        this.logicItems.push(logicLight);

        // Interactive Collision
        const collision = new MapObjectItem(
            "interactive_collision",
            "Colisión Interactiva",
            "interactive_collision",
            "",
            0x0088FF,
            { x: 2, y: 2, z: 2 }
        );
        // Default Properties handled in MapObjectItem logic, but good to init here too if needed
        collision.logicProperties = {
            name: "Colisión Interactiva",
            isTraversable: false,
            triggerOnTouch: false,
            triggerOnEnter: false
        };
        this.logicItems.push(collision);

        // Target (Diana)
        const target = new MapObjectItem(
            "interactive_target",
            "Diana Interactiva",
            "target",
            "",
            0xFF8800,
            { x: 2, y: 0.2, z: 2 }
        );
        // Default Logic
        target.logicProperties = {
            name: "Diana Interactiva",
            rings: 3,
            baseDamage: 10,
            ringMultipliers: [1, 2, 3],
            radius: 1.0,
            useProjectileDamage: false
        };
        this.logicItems.push(target);

        const impulseJump = new MapObjectItem(
            "impulse_jump",
            "Pad de Salto",
            "impulse_jump",
            "",
            0x00FFFF,
            { x: 3, y: 0.10, z: 3 }
        );
        impulseJump.logicProperties = {
            name: "Pad de Salto",
            strength: 25,
            cooldown: 0.25,
            padKind: "jump"
        };
        this.logicItems.push(impulseJump);

        const impulseLateral = new MapObjectItem(
            "impulse_lateral",
            "Pad de Empuje",
            "impulse_lateral",
            "",
            0x00FF00,
            { x: 3, y: 0.10, z: 3 }
        );
        impulseLateral.logicProperties = {
            name: "Pad de Empuje",
            strength: 40,
            cooldown: 0.25,
            padKind: "lateral"
        };
        this.logicItems.push(impulseLateral);

        const impulseNeon = new MapObjectItem(
            "impulse_neon",
            "Pad Neón de Impulso",
            "impulse_neon",
            "",
            0x242830,
            { x: 3, y: 0.10, z: 4.5 }
        );
        impulseNeon.logicProperties = {
            name: "Pad Neón de Impulso",
            strength: 40,
            cooldown: 0.25,
            padKind: "lateral",
            arrowColumnsMode: "auto",
            arrowColumns: 2,
            arrowSpanMode: "clamped",
            ovalDensity: 14
        };
        this.logicItems.push(impulseNeon);

        const gravityPad = new MapObjectItem(
            "gravity_pad",
            "Pad de Gravedad",
            "gravity_pad",
            "",
            0x2F75FF,
            { x: 3, y: 0.2, z: 3 }
        );
        gravityPad.logicProperties = {
            name: "Pad de Gravedad",
            gravityOrientation: "up",
            transitionDuration: 0.8,
            cooldown: 0.35
        };
        this.logicItems.push(gravityPad);

        const fuelZone = new MapObjectItem("fuel_zone", "Zona de recarga de gasolina", "fuel_zone", "", 0x19c99a, { x: 4, y: 2, z: 4 });
        fuelZone.opacity = 0.14;
        fuelZone.logicProperties = normalizeFuelZone();
        this.logicItems.push(fuelZone);

        const farmingZone = new MapObjectItem(
            "farming_zone",
            "Zona de Farmeo",
            "farming_zone",
            "",
            0xFF4500,
            { x: 3, y: 0.2, z: 3 }
        );
        farmingZone.opacity = 0.7;
        farmingZone.logicProperties = {
            name: "Zona de Farmeo",
            spawnInterval: 1.0,
            itemsPerSpawn: 1,
            itemValue: 1
        };
        this.logicItems.push(farmingZone);
    }

    setupUI() {
        // Remove old gridHelper creation, handled by main_rapier.js

        // Main Container
        this.container = document.createElement("div");
        this.container.id = "construction-menu";
        this.container.style.cssText = `
            position: absolute;
            top: 5%; 
            left: 50%;
            transform: translateX(-50%);
            width: 80%; 
            height: 70%;
            background: rgba(0,0,0,0.9);
            border: 2px solid #444; 
            border-radius: 12px;
            display: none;
            flex-direction: column;
            color: white;
            font-family: sans-serif;
            z-index: 1000;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
        `;

        // Header / Tabs
        const header = document.createElement("div");
        header.style.cssText = "display: flex; gap: 20px; font-size: 24px; margin-bottom: 20px; border-bottom: 1px solid #555; padding-bottom: 10px; overflow-x: auto; flex-shrink: 0;";

        this.tabLibrary = document.createElement("div");
        this.tabLibrary.textContent = "Librería de Objetos";
        this.tabLibrary.style.cursor = "pointer";
        this.tabLibrary.style.fontWeight = "bold";
        this.tabLibrary.style.borderBottom = "2px solid white";
        this.tabLibrary.onclick = () => this.switchTab("library");

        this.tabLogic = document.createElement("div");
        this.tabLogic.textContent = "Lógica Interactiva";
        this.tabLogic.style.cursor = "pointer";
        this.tabLogic.style.color = "#888";
        this.tabLogic.style.borderBottom = "none";
        this.tabLogic.onclick = () => this.switchTab("logic");

        this.tabSettings = document.createElement("div");
        this.tabSettings.textContent = "Config Entorno";
        this.tabSettings.style.cursor = "pointer";
        this.tabSettings.style.color = "#888";
        this.tabSettings.style.borderBottom = "none";
        this.tabSettings.onclick = () => this.switchTab("settings");

        this.tabGameConfig = document.createElement("div");
        this.tabGameConfig.textContent = "Config Partida";
        this.tabGameConfig.style.cursor = "pointer";
        this.tabGameConfig.style.color = "#888";
        this.tabGameConfig.style.borderBottom = "none";
        this.tabGameConfig.onclick = () => this.switchTab("gameConfig");

        this.tabPlayerConfig = document.createElement("div");
        this.tabPlayerConfig.textContent = "Config Jugador";
        this.tabPlayerConfig.style.cursor = "pointer";
        this.tabPlayerConfig.style.color = "#888";
        this.tabPlayerConfig.style.borderBottom = "none";
        this.tabPlayerConfig.style.whiteSpace = "nowrap";
        this.tabPlayerConfig.onclick = () => this.switchTab("playerConfig");

        this.tabSaveLoad = document.createElement("div");
        this.tabSaveLoad.textContent = "Guardar / Cargar";
        this.tabSaveLoad.style.cursor = "pointer";
        this.tabSaveLoad.style.color = "#888";
        this.tabSaveLoad.style.borderBottom = "none";
        this.tabSaveLoad.onclick = () => this.switchTab("saveload");

        header.appendChild(this.tabLibrary);
        header.appendChild(this.tabLogic);
        header.appendChild(this.tabGameConfig);
        header.appendChild(this.tabPlayerConfig);
        header.appendChild(this.tabSettings);
        header.appendChild(this.tabSaveLoad);
        this.container.appendChild(header);

        // Content Area Containers
        this.contentLibrary = document.createElement("div");
        this.contentLibrary.style.cssText = `
            flex: 1;
            display: flex; /* Flex Row */
            gap: 20px;
            overflow: hidden; /* Manage overflow internally */
        `;

        // Left: Scrollable List of Sections
        this.libraryLeftCol = document.createElement("div");
        this.libraryLeftCol.style.cssText = `
            flex: 2;
            display: flex;
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding-right: 10px;
        `;

        // Helper to create a collapsible section
        const createCollapsibleSection = (title, itemsFiltFunc) => {
            const details = document.createElement("details");
            details.open = true;
            details.style.cssText = `
                background: #2a2a2a;
                border-radius: 8px;
                padding: 10px;
                border: 1px solid #444;
            `;

            const summary = document.createElement("summary");
            summary.textContent = title;
            summary.style.cssText = `
                font-size: 18px;
                font-weight: bold;
                color: #fff;
                cursor: pointer;
                outline: none;
                user-select: none;
                padding-bottom: 5px;
                border-bottom: 2px solid #555;
                margin-bottom: 15px;
            `;
            details.appendChild(summary);

            const grid = document.createElement("div");
            grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                grid-auto-rows: 120px;
                gap: 10px;
            `;

            const filteredItems = this.libraryItems.filter(itemsFiltFunc);
            this.renderLibraryGrid(grid, filteredItems);

            details.appendChild(grid);
            return details;
        };

        // Create Sections
        const sectionConstruction = createCollapsibleSection("Construcción", item => item.type !== "weapon" && item.type !== "consumable" && item.type !== "collectible" && item.type !== "motorbike");
        const sectionWeapons = createCollapsibleSection("Armas", item => item.type === "weapon");
        const sectionConsumables = createCollapsibleSection("Consumibles", item => item.type === "consumable");

        const sectionVehicles = createCollapsibleSection("Vehículos", item => item.type === "motorbike");
        this.libraryLeftCol.appendChild(sectionVehicles);
        this.libraryLeftCol.appendChild(sectionConstruction);
        this.libraryLeftCol.appendChild(sectionWeapons);
        this.libraryLeftCol.appendChild(sectionConsumables);

        // Right: Customizer Panel
        this.libraryPanel = document.createElement("div");
        this.libraryPanel.style.cssText = `
            flex: 1;
            background: #222;
            border-left: 1px solid #444;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border-radius: 8px;
            overflow-y: auto; /* Global Scroll */
            scrollbar-width: thin; /* Firefox */
            scrollbar-color: #444 #222; /* Firefox */
        `;

        // Inject Custom Scrollbar Style for Webkit
        const style = document.createElement("style");
        style.innerHTML = `
            #construction-menu ::-webkit-scrollbar {
                width: 6px;
            }
            #construction-menu ::-webkit-scrollbar-track {
                background: #222; 
            }
            #construction-menu ::-webkit-scrollbar-thumb {
                background: #444; 
                border-radius: 3px;
            }
            #construction-menu ::-webkit-scrollbar-thumb:hover {
                background: #555; 
            }
        `;
        this.container.appendChild(style);

        this.sectionRailWrapper = document.createElement("div");
        this.sectionRailWrapper.className = "construction-section-rail-wrapper";
        this.sectionRailWrapper.style.cssText = `
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            flex-shrink: 0;
            width: 44px;
            max-height: 100%;
            overflow-y: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
            align-self: flex-start;
            margin-top: 10px;
        `;

        this.renderLibraryPanel(this.libraryPanel);

        this.contentLibrary.appendChild(this.libraryLeftCol);
        this.contentLibrary.appendChild(this.sectionRailWrapper);
        this.contentLibrary.appendChild(this.libraryPanel);

        // Logic Content
        this.contentLogic = document.createElement("div");
        this.contentLogic.style.cssText = `
            flex: 1;
            display: none; 
            gap: 20px;
            overflow: hidden;
            flex-direction: row; /* Horizontal Split */
        `;

        // Left: Logic Library (New Items)
        const leftContainer = document.createElement("div");
        leftContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-right: 1px solid #444;
            padding-right: 10px;
        `;
        const leftTitle = document.createElement("h3");
        leftTitle.textContent = "Nuevo Objeto";
        leftTitle.style.margin = "0 0 10px 0";
        leftTitle.style.color = "#aaa";
        leftContainer.appendChild(leftTitle);

        this.logicGrid = document.createElement("div");
        this.logicGrid.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding-right: 5px;
        `;
        this.renderLogicLibraryGrid(this.logicGrid);
        leftContainer.appendChild(this.logicGrid);

        this.contentLogic.appendChild(leftContainer);

        // Right: Scene Logic Objects (Tree + Editor)
        const rightContainer = document.createElement("div");
        rightContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        const rightTitle = document.createElement("h3");
        rightTitle.textContent = "Objetos en Escena";
        rightTitle.style.margin = "0 0 10px 0";
        rightTitle.style.color = "#aaa";
        rightContainer.appendChild(rightTitle);

        // Tree View Container
        this.logicTreePanel = document.createElement("div");
        this.logicTreePanel.style.cssText = `
            flex: 1;
            background: #222;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 5px;
        `;
        rightContainer.appendChild(this.logicTreePanel);

        // Properties Editor Container (Bottom of Right)
        this.logicPropertiesPanel = document.createElement("div");
        this.logicPropertiesPanel.style.cssText = `
            height: 250px; /* Fixed height for editor */
            background: #2b2b2b;
            border-top: 2px solid #555;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow-y: auto;
            border-radius: 0 0 8px 8px; /* Rounded only bottom if attached */
        `;
        this.logicPropertiesPanel.innerHTML = "<div style=\"color:#666; text-align:center; padding-top:20px;\">Selecciona un objeto de la lista para editar</div>";

        rightContainer.appendChild(this.logicPropertiesPanel);
        this.contentLogic.appendChild(rightContainer);

        this.contentSettings = document.createElement("div");
        this.contentSettings.style.cssText = `
            flex: 1;
            display: none; /* Hidden by default */
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding: 10px;
        `;
        this.renderSettings(this.contentSettings);

        this.contentSaveLoad = document.createElement("div");
        this.contentSaveLoad.style.cssText = `
            flex: 1;
            display: none;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 15px;
            overflow-y: auto;
            padding: 10px;
            align-items: flex-start;
            align-content: flex-start;
        `;
        this.renderSaveLoad(this.contentSaveLoad);

        // Game Config Content
        this.contentGameConfig = document.createElement("div");
        this.contentGameConfig.style.cssText = `
            flex: 1; display: none; flex-direction: column; overflow: hidden; min-height: 0;
        `;
        this.gameConfigPanel.createUI(this.contentGameConfig);

        // Player Config Content
        this.contentPlayerConfig = document.createElement("div");
        this.contentPlayerConfig.style.cssText = "flex: 1; display: none; flex-direction: column; overflow: hidden; min-height: 0;";
        this.playerConfigPanel.createUI(this.contentPlayerConfig);

        this.container.appendChild(this.contentLibrary);
        this.container.appendChild(this.contentLogic);
        this.container.appendChild(this.contentSettings);
        this.container.appendChild(this.contentGameConfig);
        this.container.appendChild(this.contentPlayerConfig);
        this.container.appendChild(this.contentSaveLoad);

        // Instructions
        const footer = document.createElement("div");
        footer.textContent = "Arrastra objetos a tu barra de inventario inferior para equiparlos. Pulsa 'E' para cerrar.";
        footer.style.marginTop = "20px";
        footer.style.color = "#aaa";
        this.container.appendChild(footer);

        document.body.appendChild(this.container);
    }

    switchTab(tabName) {
        // Reset all
        this.contentLibrary.style.display = "none";
        this.contentLogic.style.display = "none";
        this.contentSettings.style.display = "none";
        this.contentGameConfig.style.display = "none";
        this.contentSaveLoad.style.display = "none";

        this.tabLibrary.style.fontWeight = "normal";
        this.tabLibrary.style.color = "#888";
        this.tabLibrary.style.borderBottom = "none";

        this.tabLogic.style.fontWeight = "normal";
        this.tabLogic.style.color = "#888";
        this.tabLogic.style.borderBottom = "none";

        this.tabSettings.style.fontWeight = "normal";
        this.tabSettings.style.color = "#888";
        this.tabSettings.style.borderBottom = "none";

        this.tabSaveLoad.style.fontWeight = "normal";
        this.tabSaveLoad.style.color = "#888";
        this.tabSaveLoad.style.borderBottom = "none";

        this.tabGameConfig.style.fontWeight = "normal";
        this.tabGameConfig.style.color = "#888";
        this.tabGameConfig.style.borderBottom = "none";

        this.contentPlayerConfig.style.display = "none";
        this.tabPlayerConfig.style.fontWeight = "normal";
        this.tabPlayerConfig.style.color = "#888";
        this.tabPlayerConfig.style.borderBottom = "none";

        // Activate Selected
        if (tabName === "library") {
            this.contentLibrary.style.display = "flex";
            this.tabLibrary.style.fontWeight = "bold";
            this.tabLibrary.style.color = "white";
            this.tabLibrary.style.borderBottom = "2px solid white";
        } else if (tabName === "logic") {
            this.contentLogic.style.display = "flex";
            this.tabLogic.style.fontWeight = "bold";
            this.tabLogic.style.color = "white";
            this.tabLogic.style.borderBottom = "2px solid white";
            this.renderLogicLibraryGrid(this.logicGrid);
            this.refreshLogicList();
        } else if (tabName === "settings") {
            this.contentSettings.style.display = "flex";
            this.tabSettings.style.fontWeight = "bold";
            this.tabSettings.style.color = "white";
            this.tabSettings.style.borderBottom = "2px solid white";
            this.refreshSettings();
        } else if (tabName === "gameConfig") {
            this.contentGameConfig.style.display = "flex";
            this.tabGameConfig.style.fontWeight = "bold";
            this.tabGameConfig.style.color = "white";
            this.tabGameConfig.style.borderBottom = "2px solid white";
            this.gameConfigPanel.render();
        } else if (tabName === "playerConfig") {
            this.contentPlayerConfig.style.display = "flex";
            this.tabPlayerConfig.style.fontWeight = "bold";
            this.tabPlayerConfig.style.color = "white";
            this.tabPlayerConfig.style.borderBottom = "2px solid white";
            this.playerConfigPanel.render();
        } else if (tabName === "saveload") {
            this.contentSaveLoad.style.display = "flex";
            this.tabSaveLoad.style.fontWeight = "bold";
            this.tabSaveLoad.style.color = "white";
            this.tabSaveLoad.style.borderBottom = "2px solid white";
        }
    }

    renderSettings(container) {
        let skyboxPreviewToken = 0;
        let skyboxPreviewScene = null;
        let skyboxPreviewCamera = null;
        let skyboxPreviewRenderer = null;
        let renderSkyboxPreview = () => { };

        if (this.skyboxPreviewCleanup) {
            this.skyboxPreviewCleanup();
            this.skyboxPreviewCleanup = null;
        }

        // Grid Toggle
        const row = document.createElement("div");
        row.style.cssText = "display: flex; align-items: center; gap: 10px;";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "chk-show-grid";
        checkbox.checked = true;
        checkbox.style.transform = "scale(1.5)";
        checkbox.addEventListener("change", (e) => {
            if (this.game && this.game.sceneManager) {
                this.game.sceneManager.scene.children.forEach(child => {
                    if (child.name === "mapGrid") {
                        child.visible = e.target.checked;
                    }
                });
            }
        });

        const label = document.createElement("label");
        label.textContent = "Mostrar Cuadrícula de Mapa";
        label.htmlFor = "chk-show-grid";
        label.style.fontSize = "18px";
        label.style.cursor = "pointer";

        row.appendChild(checkbox);
        row.appendChild(label);
        container.appendChild(row);

        // Snapping Toggle
        const rowSnap = document.createElement("div");
        rowSnap.style.cssText = "display: flex; align-items: center; gap: 10px;";

        const checkSnap = document.createElement("input");
        checkSnap.type = "checkbox";
        checkSnap.id = "chk-snap-grid";
        checkSnap.style.transform = "scale(1.5)";
        checkSnap.addEventListener("change", (e) => {
            if (this.game.placementManager) {
                this.game.placementManager.snapToGrid = e.target.checked;
            }
        });

        const labelSnap = document.createElement("label");
        labelSnap.textContent = "Activar Construcción en Cuadrícula";
        labelSnap.htmlFor = "chk-snap-grid";
        labelSnap.style.fontSize = "18px";
        labelSnap.style.cursor = "pointer";

        rowSnap.appendChild(checkSnap);
        rowSnap.appendChild(labelSnap);
        container.appendChild(rowSnap);

        // No-Clip Toggle
        const rowClip = document.createElement("div");
        rowClip.style.cssText = "display: flex; align-items: center; gap: 10px;";

        const checkClip = document.createElement("input");
        checkClip.type = "checkbox";
        checkClip.id = "chk-no-clip";
        checkClip.style.transform = "scale(1.5)";
        checkClip.addEventListener("change", (e) => {
            if (this.game.character && this.game.character.setNoClip) {
                this.game.character.setNoClip(e.target.checked);
            }
        });

        const labelClip = document.createElement("label");
        labelClip.textContent = "Desactivar Colisión (Fantasma)";
        labelClip.htmlFor = "chk-no-clip";
        labelClip.style.fontSize = "18px";
        labelClip.style.cursor = "pointer";

        rowClip.appendChild(checkClip);
        rowClip.appendChild(labelClip);
        container.appendChild(rowClip);

        // Aerial Grid Toggle
        const rowAerial = document.createElement("div");
        rowAerial.style.cssText = "display: flex; align-items: center; gap: 10px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;";

        const checkAerial = document.createElement("input");
        checkAerial.type = "checkbox";
        checkAerial.id = "chk-aerial-grid";
        checkAerial.style.transform = "scale(1.5)";
        checkAerial.addEventListener("change", (e) => {
            if (this.game.placementManager) {
                this.game.placementManager.setAerialGrid(e.target.checked);

                // Toggle Status UI
                const statusEl = document.getElementById("aerial-grid-status");
                if (statusEl) {
                    statusEl.style.display = e.target.checked ? "block" : "none";
                    statusEl.textContent = "G: Suelo No Fijado";
                    statusEl.style.color = "#00FF00";
                }
            }
        });

        const labelAerial = document.createElement("label");
        labelAerial.textContent = "Activar Grid Aéreo (Construcción en el Aire)";
        labelAerial.htmlFor = "chk-aerial-grid";
        labelAerial.style.fontSize = "18px";
        labelAerial.style.cursor = "pointer";
        labelAerial.style.color = "#00ffcc";

        rowAerial.appendChild(checkAerial);
        rowAerial.appendChild(labelAerial);
        container.appendChild(rowAerial);

        // Environment / Sky Config
        const rowSky = document.createElement("div");
        rowSky.style.cssText = "display: flex; flex-direction: column; gap: 10px; margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;";

        const labelSky = document.createElement("label");
        labelSky.textContent = "Apariencia del Cielo";
        labelSky.style.fontSize = "18px";
        labelSky.style.color = "#aaa";

        this.selectSky = document.createElement("select");
        this.selectSky.style.cssText = `
            padding: 8px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        `;
        const selectedSkyType = this.getSelectedEnvironmentState()?.skyType || this.game.environmentConfig?.skyType || "day";
        let pendingSkyType = selectedSkyType;
        const options = [
            { value: "day", text: "Día", preview: "linear-gradient(180deg, #79c8ff 0%, #e4f7ff 72%, #b8e3ff 100%)" },
            { value: "night", text: "Noche", preview: "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.9) 0 2px, transparent 3px), radial-gradient(circle at 70% 38%, rgba(255,255,255,0.8) 0 1px, transparent 2px), linear-gradient(180deg, #030617 0%, #101544 100%)" },
            { value: "sunset", text: "Atardecer", preview: "linear-gradient(180deg, #ff8f70 0%, #ffc46b 48%, #33235f 100%)" },
            { value: "shader", text: "Cielo Atmosférico Shader", preview: "linear-gradient(180deg, #1b2838 0%, #204060 50%, #4080a0 100%)" }
        ];
        const skyOptionLabels = new Map(options.map(opt => [opt.value, opt.text]));
        const skyOptionPreviews = new Map(options.map(opt => [opt.value, opt.preview]));

        const previewWrap = document.createElement("div");
        previewWrap.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            align-items: stretch;
        `;

        const previewFrame = document.createElement("div");
        previewFrame.style.cssText = `
            min-height: 220px;
            border: 1px solid #555;
            border-radius: 8px;
            overflow: hidden;
            background: #111;
            position: relative;
        `;

        const previewImage = document.createElement("div");
        previewImage.style.cssText = `
            position: absolute;
            inset: 0;
            background-size: cover;
            background-position: center;
        `;
        previewFrame.appendChild(previewImage);

        const skyboxPreviewViewport = document.createElement("div");
        skyboxPreviewViewport.style.cssText = `
            position: absolute;
            inset: 0;
            display: none;
            background: #070910;
            cursor: grab;
            user-select: none;
            touch-action: none;
        `;
        previewFrame.appendChild(skyboxPreviewViewport);

        const previewLabel = document.createElement("div");
        previewLabel.style.cssText = `
            position: absolute;
            left: 8px;
            right: 8px;
            bottom: 8px;
            padding: 6px 8px;
            border-radius: 6px;
            background: rgba(0,0,0,0.62);
            color: white;
            font-size: 13px;
            font-weight: bold;
            text-shadow: 0 1px 2px #000;
        `;
        previewFrame.appendChild(previewLabel);

        const skyboxGrid = document.createElement("div");
        skyboxGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
            gap: 8px;
            max-height: 178px;
            overflow-y: auto;
            padding: 2px 4px 2px 0;
        `;

        previewWrap.appendChild(previewFrame);
        previewWrap.appendChild(skyboxGrid);

        const actionsRow = document.createElement("div");
        actionsRow.style.cssText = "display: flex; align-items: center; gap: 10px; flex-wrap: wrap;";

        const applySkyBtn = document.createElement("button");
        applySkyBtn.textContent = "Aplicar cielo";
        applySkyBtn.style.cssText = `
            padding: 8px 12px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
        `;
        applySkyBtn.onmouseover = () => applySkyBtn.style.background = "#1d4ed8";
        applySkyBtn.onmouseout = () => applySkyBtn.style.background = "#2563eb";

        const previewStatus = document.createElement("span");
        previewStatus.style.cssText = "color: #9ca3af; font-size: 13px;";

        actionsRow.appendChild(this.selectSky);
        actionsRow.appendChild(applySkyBtn);
        actionsRow.appendChild(previewStatus);

        const applySkyboxPreview = (skyboxUrl) => {
            const token = ++skyboxPreviewToken;
            loadSkyboxPreviewTexture(skyboxUrl)
                .then((texture) => {
                    if (token !== skyboxPreviewToken) return;
                    skyboxPreviewScene.background = texture;
                    renderSkyboxPreview();
                })
                .catch((error) => {
                    console.warn("Failed to load skybox preview", skyboxUrl, error);
                });
        };

        this.setPendingSky = (value) => {
            pendingSkyType = value || "day";
            this.selectSky.value = pendingSkyType;
            const skyboxUrl = getSkyboxUrlFromValue(pendingSkyType);
            const label = skyOptionLabels.get(pendingSkyType) || "Skybox guardado";
            const selectedState = this.getSelectedEnvironmentState();
            previewLabel.textContent = label;
            previewStatus.textContent = pendingSkyType === (selectedState?.skyType || this.game.environmentConfig?.skyType || "day") ? "Aplicado" : "Vista previa";

            const preset = getSkyboxPresetDefaults(pendingSkyType);
            if (this.presetNameSpan) this.presetNameSpan.textContent = `${preset.name}`;
            if (this.presetDescSpan) this.presetDescSpan.textContent = preset.themeDescription;

            if (skyboxUrl) {
                previewImage.style.display = "none";
                skyboxPreviewViewport.style.display = "block";
                applySkyboxPreview(skyboxUrl);
            } else {
                ++skyboxPreviewToken;
                skyboxPreviewScene.background = null;
                skyboxPreviewViewport.style.display = "none";
                previewImage.style.display = "block";
                previewImage.style.backgroundImage = skyOptionPreviews.get(pendingSkyType) || skyOptionPreviews.get("day");
                previewImage.style.backgroundSize = "cover";
                previewImage.style.backgroundPosition = "center";
            }

            Array.from(skyboxGrid.children).forEach((child: any) => {
                const isActive = child.dataset.skyValue === pendingSkyType;
                child.style.borderColor = isActive ? "#60a5fa" : "#555";
                child.style.boxShadow = isActive ? "0 0 0 2px rgba(96,165,250,0.35)" : "none";
            });
        };

        const applyPendingSky = () => {
            const skyType = pendingSkyType || "day";
            const defaults = getSkyboxPresetDefaults(skyType);

            const currentCfg = this.game.environmentConfig || {};
            const currentState = this.getSelectedEnvironmentState();
            const isSkyboxChanged = (currentState?.skyType || currentCfg.skyType) !== skyType;

            const newConfig: any = { skyType };
            if (isSkyboxChanged) {
                newConfig.environmentIntensity = defaults.environmentIntensity;
                newConfig.backgroundIntensity = defaults.backgroundIntensity;
                newConfig.backgroundBlurriness = defaults.backgroundBlurriness;
                newConfig.skyboxRotation = defaults.skyboxRotation;
                newConfig.sunColor = defaults.sunColor;
                newConfig.sunIntensity = defaults.sunIntensity;
                newConfig.ambientColor = defaults.ambientColor;
                newConfig.ambientIntensity = defaults.ambientIntensity;
                newConfig.sunElevation = defaults.sunElevation;
                newConfig.sunAzimuth = defaults.sunAzimuth;
                newConfig.enableSkyboxFog = defaults.enableSkyboxFog;
                newConfig.fogColor = defaults.fogColor;
                newConfig.fogNear = defaults.fogNear;
                newConfig.fogFar = defaults.fogFar;
            }

            if (this.game && this.game.updateEnvironmentConfig) {
                this.updateSelectedEnvironmentState(newConfig);
                this.refreshSettings();
                if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
                    const mapJson = this.game.saveMap();
                    this.game.networkManager.broadcastMapSync(mapJson);
                }
                previewStatus.textContent = "Aplicado";
            } else if (this.game.sceneManager && this.game.sceneManager.setSky) {
                this.game.sceneManager.setSky(skyType);
                previewStatus.textContent = "Aplicado";
            } else {
                console.warn("SceneManager setSky not found");
            }
        };

        const appendSkyOption = (opt) => {
            const el = document.createElement("option");
            el.value = opt.value;
            el.textContent = opt.text;
            this.selectSky.appendChild(el);
            return el;
        };

        const createSkyCard = (opt) => {
            const card = document.createElement("button");
            card.type = "button";
            card.dataset.skyValue = opt.value;
            card.title = opt.text;
            card.style.cssText = `
                height: 76px;
                border: 1px solid #555;
                border-radius: 7px;
                background: #222;
                overflow: hidden;
                cursor: pointer;
                padding: 0;
                position: relative;
            `;

            const image = document.createElement("div");
            image.style.cssText = `
                position: absolute;
                inset: 0;
                background-size: cover;
                background-position: center;
            `;
            const skyboxUrl = getSkyboxUrlFromValue(opt.value);
            if (skyboxUrl) {
                applyCubemapFacePreview(image, skyboxUrl, "front");
            } else {
                image.style.backgroundImage = opt.preview || skyOptionPreviews.get("day");
                image.style.backgroundSize = "cover";
                image.style.backgroundPosition = "center";
            }
            card.appendChild(image);

            const name = document.createElement("span");
            name.textContent = opt.text;
            name.style.cssText = `
                position: absolute;
                left: 4px;
                right: 4px;
                bottom: 4px;
                padding: 3px 4px;
                border-radius: 4px;
                background: rgba(0,0,0,0.64);
                color: white;
                font-size: 11px;
                font-weight: bold;
                line-height: 1.1;
                text-align: center;
            `;
            card.appendChild(name);

            card.onclick = () => this.setPendingSky(opt.value);
            return card;
        };

        options.forEach((opt) => {
            appendSkyOption(opt);
            skyboxGrid.appendChild(createSkyCard(opt));
        });

        const skyboxGroup = document.createElement("optgroup");
        skyboxGroup.label = "Skybox (assets)";
        const loadingSkyboxes = document.createElement("option");
        loadingSkyboxes.disabled = true;
        loadingSkyboxes.textContent = "Buscando skyboxes...";
        skyboxGroup.appendChild(loadingSkyboxes);
        this.selectSky.appendChild(skyboxGroup);

        let savedSkyOption = null;
        if (selectedSkyType.startsWith(SKYBOX_VALUE_PREFIX)) {
            const savedUrl = getSkyboxUrlFromValue(selectedSkyType);
            savedSkyOption = appendSkyOption({ value: selectedSkyType, text: "Skybox guardado" });
            savedSkyOption.hidden = true;
            skyboxGrid.appendChild(createSkyCard({ value: selectedSkyType, text: "Skybox guardado", preview: savedUrl ? `url("${savedUrl}")` : skyOptionPreviews.get("day") }));
        }

        this.discoverSkyboxAssets().then((skyboxes) => {
            skyboxGroup.innerHTML = "";
            if (skyboxes.length === 0) {
                const empty = document.createElement("option");
                empty.disabled = true;
                empty.textContent = "No hay skyboxes en assets";
                skyboxGroup.appendChild(empty);
                return;
            }

            const savedSkyboxExists = skyboxes.some(opt => opt.value === selectedSkyType);
            if (savedSkyOption && savedSkyboxExists) savedSkyOption.remove();

            skyboxes.forEach((opt) => {
                skyOptionLabels.set(opt.value, opt.text);
                const el = document.createElement("option");
                el.value = opt.value;
                el.textContent = opt.text;
                skyboxGroup.appendChild(el);
                if (!Array.from(skyboxGrid.children).some((child) => child.dataset.skyValue === opt.value)) {
                    skyboxGrid.appendChild(createSkyCard(opt));
                }
            });
            this.setPendingSky(skyboxes.some(opt => opt.value === selectedSkyType) ? selectedSkyType : pendingSkyType);
        });

        this.selectSky.addEventListener("change", (e: any) => {
            this.setPendingSky(e.target.value);
        });
        applySkyBtn.addEventListener("click", applyPendingSky);

        rowSky.appendChild(labelSky);
        rowSky.appendChild(actionsRow);
        rowSky.appendChild(previewWrap);

        // ------------------ Panel de Propiedades Predeterminadas & Edición de Skybox ------------------
        const skyboxParamsGroup = document.createElement("div");
        skyboxParamsGroup.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 14px;
            padding: 14px;
            background: rgba(24, 28, 38, 0.85);
            border: 1px solid #3b82f6;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const presetHeader = document.createElement("div");
        presetHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #334155; padding-bottom: 10px;";

        const presetTitle = document.createElement("div");
        presetTitle.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
        this.presetNameSpan = document.createElement("span");
        this.presetNameSpan.style.cssText = "font-size: 15px; font-weight: bold; color: #60a5fa;";
        this.presetNameSpan.textContent = "Propiedades Predeterminadas del Skybox";

        this.presetDescSpan = document.createElement("span");
        this.presetDescSpan.style.cssText = "font-size: 12px; color: #94a3b8;";
        this.presetDescSpan.textContent = "Cargando temática...";

        presetTitle.appendChild(this.presetNameSpan);
        presetTitle.appendChild(this.presetDescSpan);

        const resetDefaultsBtn = document.createElement("button");
        resetDefaultsBtn.type = "button";
        resetDefaultsBtn.textContent = "Restablecer Predeterminados del Skybox";
        resetDefaultsBtn.style.cssText = `
            padding: 6px 12px;
            background: #374151;
            color: #f3f4f6;
            border: 1px solid #4b5563;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        `;
        resetDefaultsBtn.onmouseover = () => resetDefaultsBtn.style.background = "#4b5563";
        resetDefaultsBtn.onmouseout = () => resetDefaultsBtn.style.background = "#374151";

        resetDefaultsBtn.onclick = () => {
            const skyType = pendingSkyType || "day";
            const defaults = getSkyboxPresetDefaults(skyType);
            this.updateSelectedEnvironmentState({
                skyType,
                environmentIntensity: defaults.environmentIntensity,
                backgroundIntensity: defaults.backgroundIntensity,
                backgroundBlurriness: defaults.backgroundBlurriness,
                skyboxRotation: defaults.skyboxRotation,
                sunColor: defaults.sunColor,
                sunIntensity: defaults.sunIntensity,
                ambientColor: defaults.ambientColor,
                ambientIntensity: defaults.ambientIntensity,
                sunElevation: defaults.sunElevation,
                sunAzimuth: defaults.sunAzimuth,
                enableSkyboxFog: defaults.enableSkyboxFog,
                enableSunLight: defaults.enableSunLight !== false,
                enableAmbientLight: defaults.enableAmbientLight !== false,
                fogColor: defaults.fogColor,
                fogNear: defaults.fogNear,
                fogFar: defaults.fogFar,
                ...(defaults.skyTurbidity !== undefined ? { skyTurbidity: defaults.skyTurbidity } : {}),
                ...(defaults.skyRayleigh !== undefined ? { skyRayleigh: defaults.skyRayleigh } : {}),
                ...(defaults.skyMieCoefficient !== undefined ? { skyMieCoefficient: defaults.skyMieCoefficient } : {}),
                ...(defaults.skyMieDirectionalG !== undefined ? { skyMieDirectionalG: defaults.skyMieDirectionalG } : {})
            });
            this.refreshSettings();
            if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
                const mapJson = this.game.saveMap();
                this.game.networkManager.broadcastMapSync(mapJson);
            }
        };

        presetHeader.appendChild(presetTitle);
        presetHeader.appendChild(resetDefaultsBtn);
        skyboxParamsGroup.appendChild(presetHeader);

        this.selectedStateInfo = document.createElement("div");
        this.selectedStateInfo.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            padding: 8px 10px;
            background: rgba(2, 132, 199, 0.14);
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 6px;
            color: #e0f2fe;
            font-size: 12px;
        `;
        skyboxParamsGroup.appendChild(this.selectedStateInfo);

        const buildSliderRow = (labelText, min, max, step, initialVal, unit, onChange) => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
            const labelRow = document.createElement("div");
            labelRow.style.cssText = "display: flex; justify-content: space-between; font-size: 12px; color: #cbd5e1;";
            const lbl = document.createElement("span");
            lbl.textContent = labelText;
            const valSpan = document.createElement("span");
            valSpan.style.color = "#60a5fa";
            valSpan.style.fontWeight = "bold";
            valSpan.textContent = initialVal + unit;
            labelRow.appendChild(lbl);
            labelRow.appendChild(valSpan);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = String(min);
            slider.max = String(max);
            slider.step = String(step);
            slider.value = String(initialVal);
            slider.style.cssText = "cursor: pointer; width: 100%;";
            slider.addEventListener("input", (e: any) => {
                const num = parseFloat(e.target.value);
                valSpan.textContent = (step < 1 ? num.toFixed(2) : num) + unit;
                onChange(num);
            });
            row.appendChild(labelRow);
            row.appendChild(slider);
            return { row, slider, valSpan };
        };

        const buildColorRow = (labelText, initialVal, onChange) => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 8px;";
            const lbl = document.createElement("span");
            lbl.textContent = labelText;
            lbl.style.cssText = "font-size: 12px; color: #cbd5e1;";

            const colorWrap = document.createElement("div");
            colorWrap.style.cssText = "display: flex; align-items: center; gap: 6px;";

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = initialVal || "#ffffff";
            colorInput.style.cssText = "border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; background: transparent;";

            const hexSpan = document.createElement("span");
            hexSpan.style.cssText = "font-size: 12px; color: #94a3b8; font-family: monospace;";
            hexSpan.textContent = initialVal || "#ffffff";

            colorInput.addEventListener("input", (e: any) => {
                const hex = e.target.value;
                hexSpan.textContent = hex;
                onChange(hex);
            });

            colorWrap.appendChild(colorInput);
            colorWrap.appendChild(hexSpan);
            row.appendChild(lbl);
            row.appendChild(colorWrap);
            return { row, colorInput, hexSpan };
        };

        const controlsGrid = document.createElement("div");
        controlsGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;";

        // 1. Reflejos IBL & Fondo
        const section1 = document.createElement("div");
        section1.style.cssText = "display: flex; flex-direction: column; gap: 8px; border-left: 2px solid #3b82f6; padding-left: 10px;";
        const sec1Title = document.createElement("span");
        sec1Title.textContent = "Reflejos IBL & Apariencia de Skybox:";
        sec1Title.style.cssText = "font-size: 13px; font-weight: bold; color: #93c5fd;";
        section1.appendChild(sec1Title);

        const updateEnvProp = (partial: any) => {
            this.updateSelectedEnvironmentState(partial);
            this.refreshSettings();
        };

        const ctrlEnv = buildSliderRow("Intensidad Reflejos IBL (Tinte 3D):", 0, 3, 0.05, 1.0, "", (v) => {
            updateEnvProp({ environmentIntensity: v });
        });
        this.sliderEnvIntensity = ctrlEnv.slider;
        this.valEnvIntensity = ctrlEnv.valSpan;
        section1.appendChild(ctrlEnv.row);

        const ctrlBg = buildSliderRow("Brillo del Fondo Skybox:", 0, 3, 0.05, 1.0, "", (v) => {
            updateEnvProp({ backgroundIntensity: v });
        });
        this.sliderBgIntensity = ctrlBg.slider;
        this.valBgIntensity = ctrlBg.valSpan;
        section1.appendChild(ctrlBg.row);

        const ctrlRot = buildSliderRow("Rotación del Skybox (Eje Y):", 0, 360, 1, 0, "°", (v) => {
            updateEnvProp({ skyboxRotation: v });
        });
        this.sliderSkyRotation = ctrlRot.slider;
        this.valSkyRotation = ctrlRot.valSpan;
        section1.appendChild(ctrlRot.row);

        const ctrlBlur = buildSliderRow("Desenfoque del Fondo:", 0, 1, 0.05, 0.0, "", (v) => {
            updateEnvProp({ backgroundBlurriness: v });
        });
        this.sliderBgBlur = ctrlBlur.slider;
        this.valBgBlur = ctrlBlur.valSpan;
        section1.appendChild(ctrlBlur.row);

        controlsGrid.appendChild(section1);

        // 2. Luces Sol y Ambiente
        const section2 = document.createElement("div");
        section2.style.cssText = "display: flex; flex-direction: column; gap: 8px; border-left: 2px solid #eab308; padding-left: 10px;";
        const sec2Title = document.createElement("span");
        sec2Title.textContent = "Luces Directas del Skybox:";
        sec2Title.style.cssText = "font-size: 13px; font-weight: bold; color: #fde047;";
        section2.appendChild(sec2Title);

        const rowChkSun = document.createElement("div");
        rowChkSun.style.cssText = "display: flex; align-items: center; gap: 8px;";
        this.checkSunLight = document.createElement("input");
        this.checkSunLight.type = "checkbox";
        this.checkSunLight.id = "chk-sun-light";
        this.checkSunLight.style.transform = "scale(1.2)";
        this.checkSunLight.addEventListener("change", (e: any) => {
            updateEnvProp({ enableSunLight: e.target.checked });
        });
        const lblChkSun = document.createElement("label");
        lblChkSun.textContent = "Habilitar Luz Solar Directa";
        lblChkSun.htmlFor = "chk-sun-light";
        lblChkSun.style.cssText = "font-size: 12px; color: #cbd5e1; cursor: pointer;";
        rowChkSun.appendChild(this.checkSunLight);
        rowChkSun.appendChild(lblChkSun);
        section2.appendChild(rowChkSun);

        const ctrlSunCol = buildColorRow("Color Luz del Sol:", "#ffffff", (hex) => {
            updateEnvProp({ sunColor: hex });
        });
        this.inputSkySunColor = ctrlSunCol.colorInput;
        this.hexSkySunColor = ctrlSunCol.hexSpan;
        section2.appendChild(ctrlSunCol.row);

        const ctrlSunInt = buildSliderRow("Intensidad Solar:", 0, 3, 0.05, 0.8, "", (v) => {
            updateEnvProp({ sunIntensity: v });
        });
        this.sliderSkySunIntensity = ctrlSunInt.slider;
        this.valSkySunIntensity = ctrlSunInt.valSpan;
        section2.appendChild(ctrlSunInt.row);

        const rowChkAmb = document.createElement("div");
        rowChkAmb.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 4px;";
        this.checkAmbientLight = document.createElement("input");
        this.checkAmbientLight.type = "checkbox";
        this.checkAmbientLight.id = "chk-ambient-light";
        this.checkAmbientLight.style.transform = "scale(1.2)";
        this.checkAmbientLight.addEventListener("change", (e: any) => {
            updateEnvProp({ enableAmbientLight: e.target.checked });
        });
        const lblChkAmb = document.createElement("label");
        lblChkAmb.textContent = "Habilitar Luz Ambiental";
        lblChkAmb.htmlFor = "chk-ambient-light";
        lblChkAmb.style.cssText = "font-size: 12px; color: #cbd5e1; cursor: pointer;";
        rowChkAmb.appendChild(this.checkAmbientLight);
        rowChkAmb.appendChild(lblChkAmb);
        section2.appendChild(rowChkAmb);

        const ctrlAmbCol = buildColorRow("Color Luz Ambiental:", "#ffffff", (hex) => {
            updateEnvProp({ ambientColor: hex });
        });
        this.inputSkyAmbientColor = ctrlAmbCol.colorInput;
        this.hexSkyAmbientColor = ctrlAmbCol.hexSpan;
        section2.appendChild(ctrlAmbCol.row);

        const ctrlAmbInt = buildSliderRow("Intensidad Ambiental:", 0, 3, 0.05, 0.6, "", (v) => {
            updateEnvProp({ ambientIntensity: v });
        });
        this.sliderSkyAmbientIntensity = ctrlAmbInt.slider;
        this.valSkyAmbientIntensity = ctrlAmbInt.valSpan;
        section2.appendChild(ctrlAmbInt.row);

        controlsGrid.appendChild(section2);

        // 3. Niebla de Skybox
        const section3 = document.createElement("div");
        section3.style.cssText = "display: flex; flex-direction: column; gap: 8px; border-left: 2px solid #10b981; padding-left: 10px;";
        const sec3Title = document.createElement("span");
        sec3Title.textContent = "Niebla Armónica del Skybox:";
        sec3Title.style.cssText = "font-size: 13px; font-weight: bold; color: #6ee7b7;";
        section3.appendChild(sec3Title);

        const rowChkFog = document.createElement("div");
        rowChkFog.style.cssText = "display: flex; align-items: center; gap: 8px;";
        this.checkSkyboxFog = document.createElement("input");
        this.checkSkyboxFog.type = "checkbox";
        this.checkSkyboxFog.id = "chk-skybox-fog";
        this.checkSkyboxFog.style.transform = "scale(1.2)";
        this.checkSkyboxFog.addEventListener("change", (e: any) => {
            updateEnvProp({ enableSkyboxFog: e.target.checked });
        });
        const lblChkFog = document.createElement("label");
        lblChkFog.textContent = "Habilitar Niebla Atmosférica";
        lblChkFog.htmlFor = "chk-skybox-fog";
        lblChkFog.style.cssText = "font-size: 12px; color: #cbd5e1; cursor: pointer;";
        rowChkFog.appendChild(this.checkSkyboxFog);
        rowChkFog.appendChild(lblChkFog);
        section3.appendChild(rowChkFog);

        const ctrlFogCol = buildColorRow("Color de Niebla:", "#87ceeb", (hex) => {
            updateEnvProp({ fogColor: hex });
        });
        this.inputSkyFogColor = ctrlFogCol.colorInput;
        this.hexSkyFogColor = ctrlFogCol.hexSpan;
        section3.appendChild(ctrlFogCol.row);

        const ctrlFogNear = buildSliderRow("Distancia Cercana:", 0, 100, 1, 15, "m", (v) => {
            updateEnvProp({ fogNear: v });
        });
        this.sliderSkyFogNear = ctrlFogNear.slider;
        this.valSkyFogNear = ctrlFogNear.valSpan;
        section3.appendChild(ctrlFogNear.row);

        const ctrlFogFar = buildSliderRow("Distancia Lejana:", 10, 300, 1, 75, "m", (v) => {
            updateEnvProp({ fogFar: v });
        });
        this.sliderSkyFogFar = ctrlFogFar.slider;
        this.valSkyFogFar = ctrlFogFar.valSpan;
        section3.appendChild(ctrlFogFar.row);

        controlsGrid.appendChild(section3);

        skyboxParamsGroup.appendChild(controlsGrid);
        rowSky.appendChild(skyboxParamsGroup);

        skyboxPreviewScene = new THREE.Scene();
        skyboxPreviewCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 10);
        skyboxPreviewRenderer = new THREE.WebGLRenderer({ antialias: true });
        skyboxPreviewRenderer.outputColorSpace = THREE.SRGBColorSpace;
        skyboxPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        skyboxPreviewRenderer.domElement.style.width = "100%";
        skyboxPreviewRenderer.domElement.style.height = "100%";
        skyboxPreviewRenderer.domElement.style.display = "block";
        skyboxPreviewViewport.appendChild(skyboxPreviewRenderer.domElement);

        let previewYaw = -25;
        let previewPitch = 0;
        let previewDragging = false;
        let previewDragX = 0;
        let previewDragY = 0;

        renderSkyboxPreview = () => {
            const width = Math.max(1, previewFrame.clientWidth || 320);
            const height = Math.max(1, previewFrame.clientHeight || 220);
            skyboxPreviewCamera.aspect = width / height;
            skyboxPreviewCamera.rotation.order = "YXZ";
            skyboxPreviewCamera.rotation.y = THREE.MathUtils.degToRad(previewYaw);
            skyboxPreviewCamera.rotation.x = THREE.MathUtils.degToRad(previewPitch);
            skyboxPreviewCamera.updateProjectionMatrix();
            skyboxPreviewRenderer.setSize(width, height, false);
            skyboxPreviewRenderer.render(skyboxPreviewScene, skyboxPreviewCamera);
        };
        const previewResizeObserver = new ResizeObserver(renderSkyboxPreview);
        previewResizeObserver.observe(previewFrame);

        skyboxPreviewViewport.addEventListener("pointerdown", (e) => {
            previewDragging = true;
            previewDragX = e.clientX;
            previewDragY = e.clientY;
            skyboxPreviewViewport.style.cursor = "grabbing";
            skyboxPreviewViewport.setPointerCapture(e.pointerId);
        });

        skyboxPreviewViewport.addEventListener("pointermove", (e) => {
            if (!previewDragging) return;
            const dx = e.clientX - previewDragX;
            const dy = e.clientY - previewDragY;
            previewDragX = e.clientX;
            previewDragY = e.clientY;
            previewYaw -= dx * 0.22;
            previewPitch = Math.max(-82, Math.min(82, previewPitch - dy * 0.18));
            renderSkyboxPreview();
        });

        const stopSkyboxPreviewDrag = (e) => {
            previewDragging = false;
            skyboxPreviewViewport.style.cursor = "grab";
            if (e && skyboxPreviewViewport.hasPointerCapture(e.pointerId)) {
                skyboxPreviewViewport.releasePointerCapture(e.pointerId);
            }
        };
        skyboxPreviewViewport.addEventListener("pointerup", stopSkyboxPreviewDrag);
        skyboxPreviewViewport.addEventListener("pointercancel", stopSkyboxPreviewDrag);
        skyboxPreviewViewport.addEventListener("pointerleave", () => {
            if (!previewDragging) skyboxPreviewViewport.style.cursor = "grab";
        });

        this.skyboxPreviewCleanup = () => {
            previewResizeObserver.disconnect();
            skyboxPreviewScene.background = null;
            skyboxPreviewRenderer.dispose();
            skyboxPreviewRenderer.domElement.remove();
        };

        this.setPendingSky(selectedSkyType);

        // Lighting Config Container
        const rowLighting = document.createElement("div");
        rowLighting.style.cssText = "display: flex; flex-direction: column; gap: 12px; margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;";

        const labelLighting = document.createElement("label");
        labelLighting.textContent = "Iluminación del Mundo";
        labelLighting.style.fontSize = "18px";
        labelLighting.style.color = "#aaa";
        rowLighting.appendChild(labelLighting);

        // Modo de Iluminación Unificado
        const rowLightMode = document.createElement("div");
        rowLightMode.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 10px;";
        const labelLMode = document.createElement("span");
        labelLMode.textContent = "Modo de Iluminación:";
        labelLMode.style.fontSize = "14px";
        labelLMode.style.color = "#ccc";
        const badgeLMode = document.createElement("span");
        badgeLMode.textContent = "☀️ Modo Día / Base Unificado";
        badgeLMode.style.cssText = "padding: 5px 10px; background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; border-radius:6px; font-size:12px; font-weight:bold;";
        rowLightMode.appendChild(labelLMode);
        rowLightMode.appendChild(badgeLMode);
        rowLighting.appendChild(rowLightMode);

        // Shadow Quality Select
        const rowShadowQuality = document.createElement("div");
        rowShadowQuality.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 10px;";
        const labelSQ = document.createElement("span");
        labelSQ.textContent = "Calidad de Sombras:";
        labelSQ.style.fontSize = "14px";
        labelSQ.style.color = "#ccc";
        this.selectShadowQuality = document.createElement("select");
        this.selectShadowQuality.style.cssText = "padding: 6px; background:#333; color:white; border:1px solid #555; border-radius:4px; cursor:pointer; width:150px;";
        [
            { value: "low", label: "Bajo (Alto Rendimiento)" },
            { value: "medium", label: "Medio" },
            { value: "high", label: "Alto (Detallado)" },
            { value: "off", label: "Desactivado" }
        ].forEach(opt => {
            const o = document.createElement("option");
            o.value = opt.value;
            o.textContent = opt.label;
            this.selectShadowQuality.appendChild(o);
        });
        this.selectShadowQuality.addEventListener("change", (e) => {
            this.game.updateEnvironmentConfig({ shadowQuality: e.target.value });
        });
        rowShadowQuality.appendChild(labelSQ);
        rowShadowQuality.appendChild(this.selectShadowQuality);
        rowLighting.appendChild(rowShadowQuality);

        // Sun/Moon trajectory controls (shared by shader skies and skyboxes)
        const rowSunPositionGroup = document.createElement("div");
        rowSunPositionGroup.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 8px 0; margin-top: 2px;";

        const titleSunPos = document.createElement("span");
        titleSunPos.textContent = "Sistema solar/lunar (luz y sombras):";
        titleSunPos.style.fontSize = "13px";
        titleSunPos.style.fontWeight = "bold";
        titleSunPos.style.color = "#fbbf24";
        rowSunPositionGroup.appendChild(titleSunPos);

        const rowSolarVisual = document.createElement("div");
        rowSolarVisual.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:10px; background:#111827; border:1px solid #263244; border-radius:4px; padding:7px 8px;";
        const labelSolarVisual = document.createElement("label");
        labelSolarVisual.textContent = "Sol y luna visibles";
        labelSolarVisual.style.cssText = "font-size:12px; color:#e5e7eb; cursor:pointer;";
        this.checkSolarVisual = document.createElement("input");
        this.checkSolarVisual.type = "checkbox";
        this.checkSolarVisual.style.transform = "scale(1.15)";
        this.checkSolarVisual.addEventListener("change", (e: any) => {
            this.game.updateEnvironmentConfig({ enableSolarVisual: e.target.checked });
            this.refreshSettings();
        });
        labelSolarVisual.onclick = () => this.checkSolarVisual.click();
        rowSolarVisual.appendChild(labelSolarVisual);
        rowSolarVisual.appendChild(this.checkSolarVisual);
        rowSunPositionGroup.appendChild(rowSolarVisual);

        const solarPreviewWrap = document.createElement("div");
        solarPreviewWrap.style.cssText = "display:flex; flex-direction:column; gap:8px; background:#101318; border:1px solid #334155; border-radius:6px; padding:8px;";

        this.solarPathCanvas = document.createElement("canvas");
        this.solarPathCanvas.height = 190;
        this.solarPathCanvas.style.cssText = "width:100%; height:190px; display:block; border-radius:4px; background:#0b1020; cursor:crosshair; touch-action:none;";
        this.solarPathCanvas.setAttribute("aria-label", "Trayectoria y puntos del sol o la luna");
        this.solarPathCanvas.addEventListener("pointerdown", (e) => {
            this.solarPathCanvas.setPointerCapture(e.pointerId);
            this.solarPathPointerStart = { x: e.clientX, y: e.clientY };
            this.solarPathDragTarget = this.pickSolarPathDragTarget(e);
            if (this.solarPathDragTarget !== "point") this.updateSolarPathFromPointer(e);
        });
        this.solarPathCanvas.addEventListener("pointermove", (e) => {
            if (!this.solarPathDragTarget) return;
            if (Math.hypot(e.clientX - this.solarPathPointerStart.x, e.clientY - this.solarPathPointerStart.y) < 4) return;
            this.updateSolarPathFromPointer(e);
        });
        this.solarPathCanvas.addEventListener("dblclick", (e) => {
            const { x, layout } = this.getSolarPathPointerPoint(e);
            this.solarVisualEditor.addPoint(layout.fromXToTime(x));
        });
        const endSolarDrag = (e) => {
            if (this.solarPathCanvas.hasPointerCapture?.(e.pointerId)) {
                this.solarPathCanvas.releasePointerCapture(e.pointerId);
            }
            this.solarPathDragTarget = null;
        };
        this.solarPathCanvas.addEventListener("pointerup", endSolarDrag);
        this.solarPathCanvas.addEventListener("pointercancel", endSolarDrag);
        solarPreviewWrap.appendChild(this.solarPathCanvas);

        const solarStatsRow = document.createElement("div");
        solarStatsRow.style.cssText = "display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:6px;";
        const makeSolarStat = (label: string, color: string) => {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display:flex; flex-direction:column; gap:2px; background:#0f172a; border:1px solid #263244; border-radius:4px; padding:6px; min-width:0;";
            const labelEl = document.createElement("span");
            labelEl.textContent = label;
            labelEl.style.cssText = "font-size:10px; color:#94a3b8;";
            const valueEl = document.createElement("span");
            valueEl.style.cssText = `font-size:12px; font-family:monospace; font-weight:bold; color:${color}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
            wrap.appendChild(labelEl);
            wrap.appendChild(valueEl);
            solarStatsRow.appendChild(wrap);
            return valueEl;
        };
        this.valSolarPathTime = makeSolarStat("Hora", "#38bdf8");
        this.valSunElevation = makeSolarStat("Elevación", "#fbbf24");
        this.valSunAzimuth = makeSolarStat("Azimut", "#a7f3d0");
        solarPreviewWrap.appendChild(solarStatsRow);
        rowSunPositionGroup.appendChild(solarPreviewWrap);
        this.solarVisualEditor = new SolarVisualTimelineEditor({
            getConfig: () => this.game.environmentConfig || {},
            update: (patch) => this.game.updateEnvironmentConfig(patch),
            refresh: () => this.refreshSettings()
        });
        this.solarVisualEditor.element.insertBefore(solarPreviewWrap, this.solarVisualEditor.element.children[1]);
        rowSunPositionGroup.appendChild(this.solarVisualEditor.element);

        const solarControlsGrid = document.createElement("div");
        solarControlsGrid.style.cssText = "display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px;";
        this.solarPathControls = {};

        const createSolarPathSlider = (labelStr, key, minVal, maxVal, stepVal, formatter = (v) => String(v)) => {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display:flex; flex-direction:column; gap:3px; min-width:0;";
            const labelRow = document.createElement("div");
            labelRow.style.cssText = "display:flex; justify-content:space-between; gap:8px; font-size:11px; color:#cbd5e1;";
            const labelEl = document.createElement("span");
            labelEl.textContent = labelStr;
            labelEl.style.cssText = "overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
            const valEl = document.createElement("span");
            valEl.style.cssText = "font-family:monospace; color:#fbbf24; white-space:nowrap;";
            labelRow.appendChild(labelEl);
            labelRow.appendChild(valEl);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = String(minVal);
            slider.max = String(maxVal);
            slider.step = String(stepVal);
            slider.style.cssText = "width:100%; cursor:pointer;";
            slider.addEventListener("input", (e: any) => {
                const config = this.game.environmentConfig || {};
                let val = parseFloat(e.target.value);
                const update: any = { solarPathEnabled: true };
                if (key === "solarPathSunriseTime") {
                    val = Math.min(val, Number(config.solarPathSunsetTime ?? 18) - 0.5);
                } else if (key === "solarPathSunsetTime") {
                    val = Math.max(val, Number(config.solarPathSunriseTime ?? 6) + 0.5);
                }
                update[key] = Math.round(val * 10) / 10;
                this.game.updateEnvironmentConfig(update);
                this.refreshSettings();
            });

            wrap.appendChild(labelRow);
            wrap.appendChild(slider);
            solarControlsGrid.appendChild(wrap);
            this.solarPathControls[key] = { slider, valEl, formatter };
            return { slider, valEl };
        };

        createSolarPathSlider("Amanecer", "solarPathSunriseTime", 0, 23.5, 0.1, (v) => formatTimeOfDayHHMM(v));
        createSolarPathSlider("Atardecer", "solarPathSunsetTime", 0.5, 24, 0.1, (v) => formatTimeOfDayHHMM(v));
        createSolarPathSlider("Altura máxima", "solarPathMaxElevation", 5, 90, 1, (v) => `${Math.round(v)}°`);
        createSolarPathSlider("Profundidad noche", "solarPathNightDepth", 5, 80, 1, (v) => `${Math.round(v)}°`);
        createSolarPathSlider("Azimut inicial", "solarPathAzimuthStart", 0, 360, 1, (v) => `${Math.round(v)}°`);
        createSolarPathSlider("Azimut final", "solarPathAzimuthEnd", 0, 360, 1, (v) => `${Math.round(v)}°`);
        const orbitDetails = document.createElement("details");
        const orbitSummary = document.createElement("summary");
        orbitSummary.textContent = "Órbita de 24 horas";
        orbitSummary.style.cssText = "cursor:pointer;color:#ccc;font-size:12px;padding:8px 0;";
        orbitDetails.append(orbitSummary, solarControlsGrid);
        rowSunPositionGroup.appendChild(orbitDetails);

        // Star Options Container
        const rowStarsGroup = document.createElement("div");
        rowStarsGroup.style.cssText = "display: flex; flex-direction: column; gap: 8px; border-left: 2px solid #8b5cf6; padding-left: 10px; margin-top: 5px;";

        const titleStars = document.createElement("span");
        titleStars.textContent = "Configuración de Estrellas Nocturnas:";
        titleStars.style.fontSize = "13px";
        titleStars.style.fontWeight = "bold";
        titleStars.style.color = "#c084fc";
        rowStarsGroup.appendChild(titleStars);

        // Checkbox: Stars in Night mode
        const rowStarsNight = document.createElement("div");
        rowStarsNight.style.cssText = "display: flex; align-items: center; gap: 8px;";
        this.checkStarsNight = document.createElement("input");
        this.checkStarsNight.type = "checkbox";
        this.checkStarsNight.id = "chk-stars-night";
        this.checkStarsNight.style.transform = "scale(1.2)";
        this.checkStarsNight.addEventListener("change", (e: any) => {
            this.game.updateEnvironmentConfig({ enableStarsNight: e.target.checked });
        });
        const labelStarsNight = document.createElement("label");
        labelStarsNight.textContent = "Estrellas en Modo Noche";
        labelStarsNight.htmlFor = "chk-stars-night";
        labelStarsNight.style.fontSize = "13px";
        labelStarsNight.style.cursor = "pointer";
        rowStarsNight.appendChild(this.checkStarsNight);
        rowStarsNight.appendChild(labelStarsNight);
        rowStarsGroup.appendChild(rowStarsNight);

        // Checkbox: Stars in Night Skybox
        const rowStarsSkybox = document.createElement("div");
        rowStarsSkybox.style.cssText = "display: flex; align-items: center; gap: 8px;";
        this.checkStarsSkybox = document.createElement("input");
        this.checkStarsSkybox.type = "checkbox";
        this.checkStarsSkybox.id = "chk-stars-skybox";
        this.checkStarsSkybox.style.transform = "scale(1.2)";
        this.checkStarsSkybox.addEventListener("change", (e: any) => {
            this.game.updateEnvironmentConfig({ enableStarsSkybox: e.target.checked });
        });
        const labelStarsSkybox = document.createElement("label");
        labelStarsSkybox.textContent = "Estrellas sobre Skybox";
        labelStarsSkybox.htmlFor = "chk-stars-skybox";
        labelStarsSkybox.style.fontSize = "13px";
        labelStarsSkybox.style.cursor = "pointer";
        rowStarsSkybox.appendChild(this.checkStarsSkybox);
        rowStarsSkybox.appendChild(labelStarsSkybox);
        rowStarsGroup.appendChild(rowStarsSkybox);

        // Checkbox: Stars in Dynamic Cycle
        const rowStarsCycle = document.createElement("div");
        rowStarsCycle.style.cssText = "display: flex; align-items: center; gap: 8px;";
        this.checkStarsCycle = document.createElement("input");
        this.checkStarsCycle.type = "checkbox";
        this.checkStarsCycle.id = "chk-stars-cycle";
        this.checkStarsCycle.style.transform = "scale(1.2)";
        this.checkStarsCycle.addEventListener("change", (e: any) => {
            this.updateSelectedEnvironmentState({ enableStars: e.target.checked });
        });
        const labelStarsCycle = document.createElement("label");
        labelStarsCycle.textContent = "Estrellas en este estado";
        labelStarsCycle.htmlFor = "chk-stars-cycle";
        labelStarsCycle.style.fontSize = "13px";
        labelStarsCycle.style.cursor = "pointer";
        rowStarsCycle.appendChild(this.checkStarsCycle);
        rowStarsCycle.appendChild(labelStarsCycle);
        rowStarsGroup.appendChild(rowStarsCycle);

        rowLighting.appendChild(rowStarsGroup);

        // ------------------ Panel de Simulación de 24 Horas & Línea del Tiempo ------------------
        const simContainer = document.createElement("div");
        simContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            padding: 12px;
            background: #141414;
            border: 1px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;

        // Top Control Bar matching GameConfigPanel styles
        const simTopBar = document.createElement("div");
        simTopBar.style.cssText = "display: flex; gap: 5px; background: #222; padding: 8px; border-radius: 6px; align-items: center; border: 1px solid #444; flex-wrap: wrap;";

        const simLabel = document.createElement("span");
        simLabel.textContent = "Simulación:";
        simLabel.style.cssText = "font-size: 11px; color: #aaa; margin-right: 5px;";
        simTopBar.appendChild(simLabel);

        const createCtrlBtn = (icon: string, title: string, color: string, onClick: () => void) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.innerHTML = icon;
            btn.title = title;
            btn.style.cssText = `
                background: #333; color: ${color}; border: 1px solid #555; 
                width: 30px; height: 30px; border-radius: 4px; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 14px;
            `;
            btn.onclick = onClick;
            btn.onmouseenter = () => { if (btn.dataset.active !== "true") btn.style.background = "#444"; };
            btn.onmouseleave = () => { if (btn.dataset.active !== "true") btn.style.background = "#333"; };
            simTopBar.appendChild(btn);
            return btn;
        };

        this.simPlayBtn = createCtrlBtn("▶", "Iniciar Simulación del Día", "#0f0", () => {
            this.game.updateEnvironmentConfig({ enableDayNightCycle: true, isCycleSimulating: true });
            this.refreshSettings();
        });

        this.simPauseBtn = createCtrlBtn("⏸", "Pausar Simulación", "#fa0", () => {
            this.game.updateEnvironmentConfig({ enableDayNightCycle: false, isCycleSimulating: false });
            this.refreshSettings();
        });

        this.simStopBtn = createCtrlBtn("⏹", "Detener y Reiniciar (12:00 Mediodía)", "#f44", () => {
            this.game.updateEnvironmentConfig({ enableDayNightCycle: false, isCycleSimulating: false, timeOfDay: 12 });
            this.refreshSettings();
        });

        const sep1 = document.createElement("div");
        sep1.style.cssText = "width: 1px; height: 20px; background: #555; margin: 0 5px;";
        simTopBar.appendChild(sep1);

        this.simPrevBtn = createCtrlBtn("⏮", "Estado Anterior", "#fff", () => {
            const config = this.game.environmentConfig || {};
            const timeline = config.dayNightTimeline && config.dayNightTimeline.length > 0 ? config.dayNightTimeline : DEFAULT_DAY_NIGHT_PROFILES[0].timeline;
            const sorted = [...timeline].sort((a, b) => a.time - b.time);
            const currentT = config.timeOfDay ?? 12;
            let prevState = sorted[sorted.length - 1];
            for (let i = sorted.length - 1; i >= 0; i--) {
                if (sorted[i].time < currentT - 0.1) {
                    prevState = sorted[i];
                    break;
                }
            }
            this.game.updateEnvironmentConfig({ selectedEnvironmentStateId: prevState.id, timeOfDay: prevState.time, isCycleSimulating: false, enableDayNightCycle: false });
            this.refreshSettings();
        });

        this.simNextBtn = createCtrlBtn("⏭", "Estado Siguiente", "#fff", () => {
            const config = this.game.environmentConfig || {};
            const timeline = config.dayNightTimeline && config.dayNightTimeline.length > 0 ? config.dayNightTimeline : DEFAULT_DAY_NIGHT_PROFILES[0].timeline;
            const sorted = [...timeline].sort((a, b) => a.time - b.time);
            const currentT = config.timeOfDay ?? 12;
            let nextState = sorted[0];
            for (let i = 0; i < sorted.length; i++) {
                if (sorted[i].time > currentT + 0.1) {
                    nextState = sorted[i];
                    break;
                }
            }
            this.game.updateEnvironmentConfig({ selectedEnvironmentStateId: nextState.id, timeOfDay: nextState.time, isCycleSimulating: false, enableDayNightCycle: false });
            this.refreshSettings();
        });

        // Time Display matching GameConfigPanel
        const timeContainer = document.createElement("div");
        timeContainer.style.cssText = "margin-left: auto; display: flex; align-items: center; gap: 5px;";

        const timeIcon = document.createElement("span");
        timeIcon.textContent = "⏱";
        timeIcon.style.fontSize = "12px";
        timeContainer.appendChild(timeIcon);

        this.simClockSpan = document.createElement("span");
        this.simClockSpan.textContent = "12:00";
        this.simClockSpan.style.cssText = "font-family: monospace; font-size: 14px; color: #0ff;";
        timeContainer.appendChild(this.simClockSpan);

        simTopBar.appendChild(timeContainer);
        simContainer.appendChild(simTopBar);

        // Pestañas de Perfiles de Ciclo Día/Noche
        this.simTabsContainer = document.createElement("div");
        this.simTabsContainer.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 6px; border-bottom: 1px solid #333; padding-bottom: 6px; flex-wrap: wrap;";
        simContainer.appendChild(this.simTabsContainer);

        // Keyframe Cards Grid
        this.simCardsGrid = document.createElement("div");
        this.simCardsGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 4px;";
        simContainer.appendChild(this.simCardsGrid);

        // Sliders for Time of Day & Speed inside Sim Container
        this.rowTimeOfDay = document.createElement("div");
        this.rowTimeOfDay.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-top: 6px;";
        const labelTODRow = document.createElement("div");
        labelTODRow.style.cssText = "display: flex; justify-content: space-between; font-size:12px; color:#cbd5e1;";
        const labelTOD = document.createElement("span");
        labelTOD.textContent = "Control Manual de Hora (0 a 24h):";
        this.valTimeOfDay = document.createElement("span");
        this.valTimeOfDay.style.color = "#38bdf8";
        this.valTimeOfDay.style.fontWeight = "bold";
        labelTODRow.appendChild(labelTOD);
        labelTODRow.appendChild(this.valTimeOfDay);

        this.sliderTimeOfDay = document.createElement("input");
        this.sliderTimeOfDay.type = "range";
        this.sliderTimeOfDay.min = "0";
        this.sliderTimeOfDay.max = "24";
        this.sliderTimeOfDay.step = "0.1";
        this.sliderTimeOfDay.style.cssText = "cursor:pointer; width:100%;";
        this.sliderTimeOfDay.addEventListener("input", (e) => {
            const val = parseFloat((e.target as any).value);
            this.game.updateEnvironmentConfig({ timeOfDay: val });
            this.refreshSettings();
        });
        this.rowTimeOfDay.appendChild(labelTODRow);
        this.rowTimeOfDay.appendChild(this.sliderTimeOfDay);
        simContainer.appendChild(this.rowTimeOfDay);

        this.rowCycleSpeed = document.createElement("div");
        this.rowCycleSpeed.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
        const labelCSRow = document.createElement("div");
        labelCSRow.style.cssText = "display: flex; justify-content: space-between; font-size:12px; color:#cbd5e1;";
        const labelCS = document.createElement("span");
        labelCS.textContent = "Velocidad de Simulación:";
        this.valCycleSpeed = document.createElement("span");
        this.valCycleSpeed.style.color = "#4ade80";
        this.valCycleSpeed.style.fontWeight = "bold";
        labelCSRow.appendChild(labelCS);
        labelCSRow.appendChild(this.valCycleSpeed);

        this.sliderCycleSpeed = document.createElement("input");
        this.sliderCycleSpeed.type = "range";
        this.sliderCycleSpeed.min = "0";
        this.sliderCycleSpeed.max = "1";
        this.sliderCycleSpeed.step = "0.01";
        this.sliderCycleSpeed.style.cssText = "cursor:pointer; width:100%;";
        this.sliderCycleSpeed.addEventListener("input", (e) => {
            const val = parseFloat((e.target as any).value);
            this.game.updateEnvironmentConfig({ cycleSpeed: val });
            this.valCycleSpeed.textContent = (val * 10).toFixed(1) + "x";
        });
        this.rowCycleSpeed.appendChild(labelCSRow);
        this.rowCycleSpeed.appendChild(this.sliderCycleSpeed);
        simContainer.appendChild(this.rowCycleSpeed);

        rowLighting.insertBefore(simContainer, rowLightMode);
        rowLighting.insertBefore(rowSky, rowLightMode);

        // Custom Light intensities and colors rows
        this.rowCustomLights = document.createElement("div");
        this.rowCustomLights.style.cssText = "display: flex; flex-direction: column; gap: 8px; border-left: 2px solid #555; padding-left: 10px; margin-top: 5px;";

        // Sun Light row
        const rowSunL = document.createElement("div");
        rowSunL.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#ccc;";
        rowSunL.textContent = "Luz Sol (Intensidad / Color):";
        const wrapSunL = document.createElement("div");
        wrapSunL.style.cssText = "display:flex; gap:6px; align-items:center;";
        this.inputSunIntensity = document.createElement("input");
        this.inputSunIntensity.type = "number";
        this.inputSunIntensity.step = "0.1";
        this.inputSunIntensity.style.cssText = "background:#333; border:1px solid #555; color:white; padding:3px; width:45px; text-align:right;";
        this.inputSunIntensity.addEventListener("change", (e) => {
            this.updateSelectedEnvironmentState({ sunIntensity: parseFloat(e.target.value) || 0 });
        });
        this.inputSunColor = document.createElement("input");
        this.inputSunColor.type = "color";
        this.inputSunColor.style.cssText = "background:transparent; border:none; width:28px; height:24px; padding:0; cursor:pointer;";
        this.inputSunColor.addEventListener("change", (e) => {
            this.updateSelectedEnvironmentState({ sunColor: e.target.value });
        });
        wrapSunL.appendChild(this.inputSunIntensity);
        wrapSunL.appendChild(this.inputSunColor);
        rowSunL.appendChild(wrapSunL);
        this.rowCustomLights.appendChild(rowSunL);

        // Ambient Light row
        const rowAmbL = document.createElement("div");
        rowAmbL.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#ccc;";
        rowAmbL.textContent = "Luz Ambiente (Intensidad / Color):";
        const wrapAmbL = document.createElement("div");
        wrapAmbL.style.cssText = "display:flex; gap:6px; align-items:center;";
        this.inputAmbientIntensity = document.createElement("input");
        this.inputAmbientIntensity.type = "number";
        this.inputAmbientIntensity.step = "0.1";
        this.inputAmbientIntensity.style.cssText = "background:#333; border:1px solid #555; color:white; padding:3px; width:45px; text-align:right;";
        this.inputAmbientIntensity.addEventListener("change", (e) => {
            this.updateSelectedEnvironmentState({ ambientIntensity: parseFloat(e.target.value) || 0 });
        });
        this.inputAmbientColor = document.createElement("input");
        this.inputAmbientColor.type = "color";
        this.inputAmbientColor.style.cssText = "background:transparent; border:none; width:28px; height:24px; padding:0; cursor:pointer;";
        this.inputAmbientColor.addEventListener("change", (e) => {
            this.updateSelectedEnvironmentState({ ambientColor: e.target.value });
        });
        wrapAmbL.appendChild(this.inputAmbientIntensity);
        wrapAmbL.appendChild(this.inputAmbientColor);
        rowAmbL.appendChild(wrapAmbL);
        this.rowCustomLights.appendChild(rowAmbL);
        rowLighting.appendChild(this.rowCustomLights);

        // Solar/lunar trajectory and shader atmosphere controls
        this.rowSkyShader = document.createElement("div");
        this.rowSkyShader.style.cssText = "display: flex; flex-direction: column; gap: 10px; border-left: 2px solid #f59e0b; padding-left: 10px; margin-top: 5px;";

        const skyShaderTitle = document.createElement("div");
        skyShaderTitle.textContent = "Trayectoria solar/lunar y atmósfera";
        skyShaderTitle.style.cssText = "font-size:12px; color:#ffffff; font-weight:bold; text-transform:uppercase; letter-spacing:0.04em;";
        this.rowSkyShader.appendChild(skyShaderTitle);
        this.rowSkyShader.appendChild(rowSunPositionGroup);

        const transitionRow = document.createElement("div");
        transitionRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#ddd;";
        const transitionLabel = document.createElement("span");
        transitionLabel.textContent = "Cambio al siguiente estado:";
        this.selectTransitionMode = document.createElement("select");
        this.selectTransitionMode.style.cssText = "background:#222; color:#fff; border:1px solid #555; border-radius:4px; padding:4px; font-size:12px; width:130px;";
        [
            { value: "procedural", label: "Procedural" },
            { value: "instant", label: "De golpe" }
        ].forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            this.selectTransitionMode.appendChild(option);
        });
        this.selectTransitionMode.addEventListener("change", (e) => {
            this.updateSelectedEnvironmentState({ transitionMode: e.target.value });
            this.renderTimelineProfilesAndCards(true);
            this.refreshSettings();
        });
        transitionRow.appendChild(transitionLabel);
        transitionRow.appendChild(this.selectTransitionMode);
        this.rowSkyShader.appendChild(transitionRow);

        this.shaderAtmosphereGroup = document.createElement("div");
        this.shaderAtmosphereGroup.style.cssText = "display:flex; flex-direction:column; gap:8px; border-top:1px solid #334155; padding-top:10px;";

        const atmosphereTitle = document.createElement("span");
        atmosphereTitle.textContent = "Atmósfera del sol en este estado:";
        atmosphereTitle.style.cssText = "font-size:12px; color:#93c5fd; font-weight:bold;";
        this.shaderAtmosphereGroup.appendChild(atmosphereTitle);

        const createShaderSlider = (labelStr, key, minVal, maxVal, stepVal, unit = "") => {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
            const labelRow = document.createElement("div");
            labelRow.style.cssText = "display: flex; justify-content: space-between; font-size:12px; color:#aaa;";
            const labelText = document.createElement("span");
            labelText.textContent = labelStr;
            const valSpan = document.createElement("span");
            valSpan.style.color = "#ffaa00";
            labelRow.appendChild(labelText);
            labelRow.appendChild(valSpan);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = String(minVal);
            slider.max = String(maxVal);
            slider.step = String(stepVal);
            slider.style.cssText = "cursor:pointer; width:100%;";

            slider.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                const update = {};
                update[key] = val;
                this.updateSelectedEnvironmentState(update);
                valSpan.textContent = val.toFixed(2) + unit;
            });

            wrap.appendChild(labelRow);
            wrap.appendChild(slider);
            this.shaderAtmosphereGroup.appendChild(wrap);

            return { slider, valSpan };
        };

        this.shaderSliders = {
            turbidity: createShaderSlider("Turbidez del Aire (Turbidity):", "skyTurbidity", 0, 20, 0.5),
            rayleigh: createShaderSlider("Dispersión Rayleigh:", "skyRayleigh", 0, 4, 0.1),
            mieCoefficient: createShaderSlider("Coeficiente Mie:", "skyMieCoefficient", 0, 0.1, 0.001),
            mieDirectionalG: createShaderSlider("Direccional G de Mie:", "skyMieDirectionalG", 0, 1, 0.05)
        };
        this.rowSkyShader.appendChild(this.shaderAtmosphereGroup);
        rowLighting.appendChild(this.rowSkyShader);

        container.appendChild(rowLighting);

        // Map Boundaries and Rules Config
        const rowMap = document.createElement("div");
        rowMap.style.cssText = "display: flex; flex-direction: column; gap: 15px; margin-top: 15px; border-top: 1px solid #444; padding-top: 15px;";

        const labelMap = document.createElement("h3");
        labelMap.textContent = "Límites y Reglas del Mapa";
        labelMap.style.color = "#fff";
        labelMap.style.margin = "0 0 5px 0";
        rowMap.appendChild(labelMap);

        // Open Advanced Editor Button
        const btnOpenEditor = document.createElement("button");
        btnOpenEditor.textContent = "Abrir Editor Avanzado de Forma";
        btnOpenEditor.style.cssText = `
            padding: 10px; background: #4d4d4dff; color: white; border: none; border-radius: 4px;
            font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s;
            margin-bottom: 10px;
        `;
        btnOpenEditor.onmouseover = () => btnOpenEditor.style.background = "#7e7e7ea5";
        btnOpenEditor.onmouseout = () => btnOpenEditor.style.background = "#4d4d4dff";
        btnOpenEditor.onclick = () => {
            this.mapShapeEditor.open();
        };
        rowMap.appendChild(btnOpenEditor);

        this.checkInvisibleWalls = null as any;
        this.checkWallsAdvanced = null as any;
        this.rowWallsAdvanced = null as any;
        this.rowWallsConfigure = null as any;
        this.checkInvisibleCeilings = null as any;
        this.checkCeilingsAdvanced = null as any;
        this.rowCeilingsAdvanced = null as any;
        this.rowCeilingsConfigure = null as any;

        const configChangeHandler = () => {
            if (this.game && this.game.environmentConfig) {
                const newConfig = {
                    mapSizeX: parseFloat(this.inputSizeX.value) || 100,
                    mapSizeZ: parseFloat(this.inputSizeZ.value) || 100,
                    invisibleWalls: this.checkInvisibleWalls.checked,
                    invisibleWallsAdvanced: this.checkInvisibleWalls.checked,
                    ceilingsEnabled: this.checkInvisibleCeilings.checked,
                    ceilingsAdvanced: this.checkInvisibleCeilings.checked,
                    fallDeath: this.checkFallDeath.checked,
                    fallDeathY: parseFloat(this.inputFallY.value) || -20,
                    skyType: this.game.environmentConfig?.skyType || "day"
                };
                this.game.updateEnvironmentConfig(newConfig);
                if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
                    const mapJson = this.game.saveMap();
                    this.game.networkManager.broadcastMapSync(mapJson);
                }
            }
        };

        // Size X
        this.rowSizeX = document.createElement("div");
        this.rowSizeX.style.cssText = "display: flex; align-items: center; justify-content: space-between;";
        const labelSizeX = document.createElement("label");
        labelSizeX.textContent = "Ancho del Mapa (X):";
        this.inputSizeX = document.createElement("input");
        this.inputSizeX.type = "number";
        this.inputSizeX.min = "10";
        this.inputSizeX.step = "10";
        this.inputSizeX.style.cssText = "padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; width: 80px; text-align: center;";
        this.inputSizeX.value = String(this.game.environmentConfig ? this.game.environmentConfig.mapSizeX : 100);
        if (this.game.environmentConfig && this.game.environmentConfig.shapeType === "custom") {
            this.inputSizeX.disabled = true;
        }
        this.inputSizeX.addEventListener("change", configChangeHandler);
        this.rowSizeX.appendChild(labelSizeX);
        this.rowSizeX.appendChild(this.inputSizeX);
        rowMap.appendChild(this.rowSizeX);

        // Size Z
        this.rowSizeZ = document.createElement("div");
        this.rowSizeZ.style.cssText = "display: flex; align-items: center; justify-content: space-between;";
        const labelSizeZ = document.createElement("label");
        labelSizeZ.textContent = "Largo del Mapa (Z):";
        this.inputSizeZ = document.createElement("input");
        this.inputSizeZ.type = "number";
        this.inputSizeZ.min = "10";
        this.inputSizeZ.step = "10";
        this.inputSizeZ.style.cssText = "padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; width: 80px; text-align: center;";
        this.inputSizeZ.value = String(this.game.environmentConfig ? this.game.environmentConfig.mapSizeZ : 100);
        if (this.game.environmentConfig && (this.game.environmentConfig.shapeType === "custom" || this.game.environmentConfig.shapeType === "circle")) {
            this.inputSizeZ.disabled = true;
        }
        this.inputSizeZ.addEventListener("change", configChangeHandler);
        this.rowSizeZ.appendChild(labelSizeZ);
        this.rowSizeZ.appendChild(this.inputSizeZ);
        rowMap.appendChild(this.rowSizeZ);

        // Invisible Walls
        const rowWalls = document.createElement("div");
        rowWalls.style.cssText = "display: flex; align-items: center; justify-content: space-between;";
        const labelWalls = document.createElement("label");
        labelWalls.textContent = "Paredes en Límites:";
        this.checkInvisibleWalls = document.createElement("input");
        this.checkInvisibleWalls.type = "checkbox";
        this.checkInvisibleWalls.style.transform = "scale(1.5)";
        this.checkInvisibleWalls.checked = this.game.environmentConfig ? this.game.environmentConfig.invisibleWalls : false;
        rowWalls.appendChild(labelWalls);
        rowWalls.appendChild(this.checkInvisibleWalls);
        rowMap.appendChild(rowWalls);

        // Advanced Walls Toggle Row (Hidden, implicitly handled)
        this.rowWallsAdvanced = document.createElement("div");
        this.rowWallsAdvanced.style.display = "none";
        this.checkWallsAdvanced = document.createElement("input");
        this.checkWallsAdvanced.type = "checkbox";

        // Advanced Walls Configure Row
        this.rowWallsConfigure = document.createElement("div");
        this.rowWallsConfigure.style.cssText = "display: none; align-items: center; justify-content: flex-end; margin-left: 15px; border-left: 2px solid #555; padding-left: 10px; margin-top: 5px; margin-bottom: 5px;";
        const btnConfigureWalls = document.createElement("button");
        btnConfigureWalls.textContent = "🛠 Configurar Paredes";
        btnConfigureWalls.style.cssText = `
            padding: 6px 12px; background: #FF9800; color: white; border: none; border-radius: 4px;
            font-size: 13px; font-weight: bold; cursor: pointer; transition: background 0.2s;
        `;
        btnConfigureWalls.onmouseover = () => btnConfigureWalls.style.background = "#e68a00";
        btnConfigureWalls.onmouseout = () => btnConfigureWalls.style.background = "#FF9800";
        btnConfigureWalls.onclick = () => {
            this.mapShapeEditor.open("walls");
        };
        this.rowWallsConfigure.appendChild(btnConfigureWalls);
        rowMap.appendChild(this.rowWallsConfigure);

        this.syncWallsVisibility = () => {
            const hasWalls = this.checkInvisibleWalls.checked;
            this.rowWallsConfigure.style.display = hasWalls ? "flex" : "none";
        };

        this.checkInvisibleWalls.addEventListener("change", () => {
            this.syncWallsVisibility();
            configChangeHandler();
        });

        setTimeout(this.syncWallsVisibility, 0);

        // Ceilings (Techos)
        const rowCeilings = document.createElement("div");
        rowCeilings.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-top: 5px;";
        const labelCeilings = document.createElement("label");
        labelCeilings.textContent = "Techos:";
        this.checkInvisibleCeilings = document.createElement("input");
        this.checkInvisibleCeilings.type = "checkbox";
        this.checkInvisibleCeilings.style.transform = "scale(1.5)";
        this.checkInvisibleCeilings.checked = this.game.environmentConfig ? !!this.game.environmentConfig.ceilingsEnabled : false;
        rowCeilings.appendChild(labelCeilings);
        rowCeilings.appendChild(this.checkInvisibleCeilings);
        rowMap.appendChild(rowCeilings);

        // Advanced Ceilings Toggle Row (Hidden, implicitly handled)
        this.rowCeilingsAdvanced = document.createElement("div");
        this.rowCeilingsAdvanced.style.display = "none";
        this.checkCeilingsAdvanced = document.createElement("input");
        this.checkCeilingsAdvanced.type = "checkbox";

        // Advanced Ceilings Configure Row
        this.rowCeilingsConfigure = document.createElement("div");
        this.rowCeilingsConfigure.style.cssText = "display: none; align-items: center; justify-content: flex-end; margin-left: 15px; border-left: 2px solid #555; padding-left: 10px; margin-top: 5px; margin-bottom: 5px;";
        const btnConfigureCeilings = document.createElement("button");
        btnConfigureCeilings.textContent = "🛠 Configurar Techos";
        btnConfigureCeilings.style.cssText = `
            padding: 6px 12px; background: #FF9800; color: white; border: none; border-radius: 4px;
            font-size: 13px; font-weight: bold; cursor: pointer; transition: background 0.2s;
        `;
        btnConfigureCeilings.onmouseover = () => btnConfigureCeilings.style.background = "#e68a00";
        btnConfigureCeilings.onmouseout = () => btnConfigureCeilings.style.background = "#FF9800";
        btnConfigureCeilings.onclick = () => {
            this.mapShapeEditor.open("ceilings");
        };
        this.rowCeilingsConfigure.appendChild(btnConfigureCeilings);
        rowMap.appendChild(this.rowCeilingsConfigure);

        this.syncCeilingsVisibility = () => {
            const hasCeilings = this.checkInvisibleCeilings.checked;
            this.rowCeilingsConfigure.style.display = hasCeilings ? "flex" : "none";
        };

        this.checkInvisibleCeilings.addEventListener("change", () => {
            this.syncCeilingsVisibility();
            configChangeHandler();
        });

        setTimeout(this.syncCeilingsVisibility, 0);

        // Fall Death Toggle
        const rowFall = document.createElement("div");
        rowFall.style.cssText = "display: flex; align-items: center; justify-content: space-between;";
        const labelFall = document.createElement("label");
        labelFall.textContent = "Muerte Instantánea por Caída:";
        this.checkFallDeath = document.createElement("input");
        this.checkFallDeath.type = "checkbox";
        this.checkFallDeath.style.transform = "scale(1.5)";
        this.checkFallDeath.checked = this.game.environmentConfig ? this.game.environmentConfig.fallDeath : true;
        this.checkFallDeath.addEventListener("change", configChangeHandler);
        rowFall.appendChild(labelFall);
        rowFall.appendChild(this.checkFallDeath);
        rowMap.appendChild(rowFall);

        // Fall Death Y Limit
        const rowFallY = document.createElement("div");
        rowFallY.style.cssText = "display: flex; align-items: center; justify-content: space-between;";
        const labelFallY = document.createElement("label");
        labelFallY.textContent = "Límite Y de Caída (Muerte):";
        this.inputFallY = document.createElement("input");
        this.inputFallY.type = "number";
        this.inputFallY.step = "5";
        this.inputFallY.style.cssText = "padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; width: 80px; text-align: center;";
        this.inputFallY.value = String(this.game.environmentConfig ? this.game.environmentConfig.fallDeathY : -20);
        this.inputFallY.addEventListener("change", configChangeHandler);
        rowFallY.appendChild(labelFallY);
        rowFallY.appendChild(this.inputFallY);
        rowMap.appendChild(rowFallY);

        container.appendChild(rowMap);
    }

    getTimelineStateContext() {
        const config = this.game?.environmentConfig || {};
        let profiles = config.dayNightProfiles && config.dayNightProfiles.length > 0
            ? config.dayNightProfiles
            : DEFAULT_DAY_NIGHT_PROFILES.map(p => ({
                id: p.id,
                name: p.name,
                isDefault: p.isDefault,
                timeline: normalizeTimeline(p.timeline).map(k => ({ ...k }))
            }));

        profiles = profiles.map(p => ({
            ...p,
            timeline: normalizeTimeline(p.timeline).map(k => ({ ...k }))
        }));

        let activeId = config.activeTimelineProfileId || profiles[0].id;
        let activeProfile = profiles.find(p => p.id === activeId) || profiles[0];
        activeId = activeProfile.id;

        const timeline = normalizeTimeline(
            config.dayNightTimeline && config.dayNightTimeline.length > 0
                ? config.dayNightTimeline
                : activeProfile.timeline
        ).map(k => ({ ...k }));

        activeProfile.timeline = timeline.map(k => ({ ...k }));

        const currentTime = config.timeOfDay !== undefined ? Number(config.timeOfDay) : 12;
        let selected = config.selectedEnvironmentStateId
            ? timeline.find(k => k.id === config.selectedEnvironmentStateId)
            : null;

        if (!selected) {
            let minDiff = 999;
            timeline.forEach(k => {
                const diff = Math.min(
                    Math.abs(k.time - currentTime),
                    Math.abs(k.time - (currentTime - 24)),
                    Math.abs(k.time - (currentTime + 24))
                );
                if (diff < minDiff) {
                    minDiff = diff;
                    selected = k;
                }
            });
        }

        return { config, profiles, activeId, activeProfile, timeline, selected };
    }

    getSelectedEnvironmentState() {
        return this.getTimelineStateContext().selected;
    }

    updateSelectedEnvironmentState(partial: any, stateId?: string) {
        if (!this.game || !this.game.environmentConfig) return null;

        const ctx = this.getTimelineStateContext();
        const targetId = stateId || ctx.selected?.id || ctx.timeline[0]?.id;
        if (!targetId) return null;

        let updatedState = null;
        const updatedTimeline = ctx.timeline.map((state, index) => {
            const nextState = state.id === targetId
                ? normalizeTimelineKeyframe({ ...state, ...partial }, index)
                : normalizeTimelineKeyframe(state, index);
            if (nextState.id === targetId) updatedState = nextState;
            return nextState;
        }).sort((a, b) => a.time - b.time);

        const updatedProfiles = ctx.profiles.map(profile => ({
            ...profile,
            timeline: profile.id === ctx.activeProfile.id
                ? updatedTimeline.map(k => ({ ...k }))
                : normalizeTimeline(profile.timeline).map(k => ({ ...k }))
        }));

        const selectedState = updatedState || updatedTimeline.find(k => k.id === targetId) || updatedTimeline[0];
        this.game.updateEnvironmentConfig({
            ...partial,
            activeTimelineProfileId: ctx.activeProfile.id,
            selectedEnvironmentStateId: selectedState.id,
            timeOfDay: selectedState.time,
            dayNightTimeline: updatedTimeline,
            dayNightProfiles: updatedProfiles
        });
        return selectedState;
    }

    getSkyTypeLabel(skyType: string) {
        if (skyType === "shader") return "Cielo Atmosférico Shader";
        if (skyType === "day") return "Día";
        if (skyType === "night") return "Noche";
        if (skyType === "sunset") return "Atardecer";
        if (typeof skyType === "string" && skyType.startsWith(SKYBOX_VALUE_PREFIX)) {
            const match = skyType.match(/Cubemap_Sky_(\d+)/i);
            return match ? `Skybox #${match[1]}` : "Skybox";
        }
        return skyType || "Día";
    }

    getSolarPathCanvasLayout() {
        const canvas = this.solarPathCanvas;
        const rect = canvas?.getBoundingClientRect?.();
        const width = Math.max(280, Math.round(rect?.width || canvas?.clientWidth || 320));
        const height = Math.max(170, Math.round(rect?.height || 190));
        const margin = 28;
        const horizonY = height * 0.62;
        const topY = 18;
        const bottomY = height - 22;
        const dayHeight = horizonY - topY;
        const nightHeight = bottomY - horizonY;
        const toX = (time) => {
            const normalized = Math.abs(time - 24) < 0.0001 ? 24 : (((time % 24) + 24) % 24);
            return margin + (normalized / 24) * (width - margin * 2);
        };
        const toY = (elevation) => {
            if (elevation >= 0) return horizonY - (Math.min(elevation, 90) / 90) * dayHeight;
            return horizonY + (Math.min(Math.abs(elevation), 80) / 80) * nightHeight;
        };
        const fromXToTime = (x) => {
            const t = ((THREE.MathUtils.clamp(x, margin, width - margin) - margin) / (width - margin * 2)) * 24;
            return Math.round(t * 60) / 60;
        };
        const fromYToElevation = (y) => {
            const value = ((horizonY - THREE.MathUtils.clamp(y, topY, horizonY - 4)) / dayHeight) * 90;
            return Math.round(THREE.MathUtils.clamp(value, 5, 90));
        };
        return { width, height, margin, horizonY, topY, bottomY, dayHeight, nightHeight, toX, toY, fromXToTime, fromYToElevation };
    }

    getSolarPathPointerPoint(e: PointerEvent) {
        const canvas = this.solarPathCanvas;
        const rect = canvas.getBoundingClientRect();
        const layout = this.getSolarPathCanvasLayout();
        return {
            x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * layout.width,
            y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * layout.height,
            layout
        };
    }

    pickSolarPathDragTarget(e: PointerEvent) {
        const config = this.game?.environmentConfig || {};
        const { x, y, layout } = this.getSolarPathPointerPoint(e);
        const editor = this.solarVisualEditor;
        if (!editor) return "time";
        const sign = editor.body === "moon" ? -1 : 1;
        let nearest = null;
        let distance = 14;
        editor.timeline[editor.body].forEach(point => {
            const position = calculateSolarCyclePosition(config, point.time);
            const d = Math.hypot(layout.toX(point.time) - x, layout.toY(position.sunElevation * sign) - y);
            if (d < distance) { nearest = point; distance = d; }
        });
        if (nearest) {
            editor.selectPoint(nearest.id);
            return "point";
        }
        return "time";
    }

    updateSolarPathFromPointer(e: PointerEvent) {
        if (!this.game?.environmentConfig || !this.solarPathCanvas) return;
        const config = this.game.environmentConfig;
        const { x, y, layout } = this.getSolarPathPointerPoint(e);
        const target = this.solarPathDragTarget || "time";
        if (target === "point") {
            this.solarVisualEditor.updatePoint({ time: layout.fromXToTime(x) });
            return;
        }
        const update = {
            timeOfDay: layout.fromXToTime(x),
            enableDayNightCycle: false,
            isCycleSimulating: false
        };

        this.game.updateEnvironmentConfig(update);
        this.refreshSettings();
    }

    drawSolarPathPreview() {
        const canvas = this.solarPathCanvas;
        if (!canvas || !this.game?.environmentConfig) return;

        const config = this.game.environmentConfig;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const editor = this.solarVisualEditor;
        const body = editor?.body || "sun";
        const sign = body === "moon" ? -1 : 1;

        const layout = this.getSolarPathCanvasLayout();
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.round(layout.width * dpr);
        const pixelHeight = Math.round(layout.height * dpr);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, layout.width, layout.height);

        const bg = ctx.createLinearGradient(0, 0, 0, layout.height);
        bg.addColorStop(0, "#172554");
        bg.addColorStop(0.55, "#0f172a");
        bg.addColorStop(1, "#020617");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, layout.width, layout.height);

        ctx.strokeStyle = "rgba(148, 163, 184, 0.24)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(layout.margin, layout.horizonY);
        ctx.lineTo(layout.width - layout.margin, layout.horizonY);
        ctx.stroke();

        [0, 6, 12, 18, 24].forEach(hour => {
            const x = layout.toX(hour);
            ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
            ctx.beginPath();
            ctx.moveTo(x, layout.topY);
            ctx.lineTo(x, layout.bottomY);
            ctx.stroke();
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(hour === 24 ? "24" : String(hour).padStart(2, "0"), x, layout.height - 7);
        });

        const drawPathSegment = (day: boolean) => {
            ctx.beginPath();
            let started = false;
            for (let i = 0; i <= 144; i++) {
                const time = (i / 144) * 24;
                const solar = calculateSolarCyclePosition(config, time);
                if ((solar.sunElevation * sign >= 0) !== day) {
                    started = false;
                    continue;
                }
                const x = layout.toX(time);
                const y = layout.toY(solar.sunElevation * sign);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.strokeStyle = day ? (body === "sun" ? "#fbbf24" : "#93c5fd") : "#64748b";
            ctx.setLineDash(day ? [] : [4, 4]);
            ctx.lineWidth = day ? 3 : 2;
            ctx.stroke();
            ctx.setLineDash([]);
        };
        drawPathSegment(false);
        drawPathSegment(true);

        const settings = normalizeSolarCycleSettings(config);
        const currentTime = config.timeOfDay !== undefined ? Number(config.timeOfDay) : 12;
        const solarNow = calculateSolarCyclePosition(config, currentTime);
        const currentX = layout.toX(currentTime);
        const currentY = layout.toY(solarNow.sunElevation * sign);
        const pointVisual = editor ? sampleSolarVisualPoints(editor.timeline[body], currentTime) : null;
        const radius = Math.min(12, Math.max(4, 6 * (pointVisual?.size ?? 1)));
        const haloRadius = Math.min(48, radius * (1.4 + (pointVisual?.glowSize ?? 1) * 0.8));
        const tint = pointVisual?.color || "#ffffff";
        const glow = ctx.createRadialGradient(currentX, currentY, 1, currentX, currentY, haloRadius);
        glow.addColorStop(0, tint);
        glow.addColorStop(0.55, tint + "80");
        glow.addColorStop(1, tint + "00");
        ctx.save();
        ctx.globalAlpha = Math.min(1, (pointVisual?.glowIntensity ?? 1) * 0.7);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(currentX, currentY, haloRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = pointVisual?.color || "#ffffff";
        ctx.beginPath();
        ctx.arc(currentX, currentY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(currentX, layout.topY);
        ctx.lineTo(currentX, layout.bottomY);
        ctx.stroke();
        editor?.timeline[body].forEach((point, index) => {
            const position = calculateSolarCyclePosition(config, point.time);
            const x = layout.toX(point.time);
            const y = layout.toY(position.sunElevation * sign);
            const selected = point.id === editor.selectedId;
            ctx.fillStyle = selected ? "#22d3ee" : point.color;
            ctx.strokeStyle = selected ? "#ffffff" : "#111827";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, selected ? 7 : 5, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            if (selected) {
                ctx.font = "bold 10px monospace";
                ctx.textAlign = "center";
                ctx.fillStyle = "#ffffff";
                ctx.fillText(`${index + 1} · ${formatSolarPointTime(point.time)}`, Math.max(34, Math.min(layout.width - 34, x)), Math.max(12, y - 12));
            }
        });

        if (this.valSolarPathTime) this.valSolarPathTime.textContent = formatTimeOfDayHHMM(currentTime);
        if (this.valSunElevation) this.valSunElevation.textContent = `${(solarNow.sunElevation * sign).toFixed(1)}°`;
        if (this.valSunAzimuth) this.valSunAzimuth.textContent = `${((solarNow.sunAzimuth + (body === "moon" ? 180 : 0)) % 360).toFixed(0)}°`;

        if (this.solarPathControls) {
            Object.entries(this.solarPathControls).forEach(([key, control]: any) => {
                const value = settings[key];
                if (control?.slider && document.activeElement !== control.slider) {
                    control.slider.value = String(value);
                }
                if (control?.valEl) {
                    control.valEl.textContent = control.formatter ? control.formatter(value) : String(value);
                }
            });
        }
    }

    renderTimelineProfilesAndCards(forceRebuild = false) {
        if (!this.game || !this.game.environmentConfig) return;
        const ctx = this.getTimelineStateContext();
        const config = ctx.config;
        const profiles = ctx.profiles;
        const activeId = ctx.activeId;
        const activeProfile = ctx.activeProfile;
        const timeline = ctx.timeline;
        const sortedTimeline = [...timeline].sort((a, b) => a.time - b.time);
        const currentTime = config.timeOfDay !== undefined ? Number(config.timeOfDay) : 12;
        const selectedStateId = ctx.selected?.id || sortedTimeline[0]?.id;

        let closestStateId = sortedTimeline[0]?.id || "";
        let minDiff = 999;
        sortedTimeline.forEach(k => {
            const diff = Math.min(
                Math.abs(k.time - currentTime),
                Math.abs(k.time - (currentTime - 24)),
                Math.abs(k.time - (currentTime + 24))
            );
            if (diff < minDiff) {
                minDiff = diff;
                closestStateId = k.id;
            }
        });

        const shouldRebuildDOM = forceRebuild || !this.simCardsGrid || this.simCardsGrid.children.length === 0;

        if (shouldRebuildDOM) {
            // 1. Render Tab Buttons
            if (this.simTabsContainer) {
                this.simTabsContainer.innerHTML = "";

                const leftTabsWrap = document.createElement("div");
                leftTabsWrap.style.cssText = "display: flex; gap: 6px; align-items: center; flex-wrap: wrap;";

                profiles.forEach(prof => {
                    const isActive = prof.id === activeId;
                    const tabBtn = document.createElement("button");
                    tabBtn.type = "button";
                    tabBtn.textContent = prof.name;
                    tabBtn.style.cssText = `
                        padding: 5px 14px;
                        background: ${isActive ? "#0284c7" : "#222222"};
                        border: 1px solid ${isActive ? "#00ffff" : "#444444"};
                        border-radius: 4px;
                        color: ${isActive ? "#ffffff" : "#aaaaaa"};
                        font-size: 12px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: ${isActive ? "0 0 8px rgba(0, 255, 255, 0.4)" : "none"};
                    `;
                    tabBtn.onclick = () => {
                        this.game.updateEnvironmentConfig({
                            activeTimelineProfileId: prof.id,
                            dayNightTimeline: prof.timeline.map(k => ({ ...k })),
                            dayNightProfiles: profiles,
                            selectedEnvironmentStateId: prof.timeline[0]?.id || null,
                            timeOfDay: prof.timeline[0]?.time ?? 12
                        });
                        this.renderTimelineProfilesAndCards(true);
                        this.refreshSettings();
                    };

                    if (!prof.isDefault && profiles.length > 1) {
                        const delSpan = document.createElement("span");
                        delSpan.textContent = " ×";
                        delSpan.style.cssText = "margin-left: 6px; color: #ff4444; font-weight: bold; cursor: pointer;";
                        delSpan.onclick = (e) => {
                            e.stopPropagation();
                            const updatedProfiles = profiles.filter(p => p.id !== prof.id);
                            const fallbackProf = updatedProfiles[0];
                            this.game.updateEnvironmentConfig({
                                dayNightProfiles: updatedProfiles,
                                activeTimelineProfileId: fallbackProf.id,
                                dayNightTimeline: fallbackProf.timeline.map(k => ({ ...k })),
                                selectedEnvironmentStateId: fallbackProf.timeline[0]?.id || null,
                                timeOfDay: fallbackProf.timeline[0]?.time ?? 12
                            });
                            this.renderTimelineProfilesAndCards(true);
                            this.refreshSettings();
                        };
                        tabBtn.appendChild(delSpan);
                    }

                    leftTabsWrap.appendChild(tabBtn);
                });

                // Plus Tab Button [+]
                const plusBtn = document.createElement("button");
                plusBtn.type = "button";
                plusBtn.textContent = "+";
                plusBtn.title = "Agregar Nueva Configuración de Ciclo";
                plusBtn.style.cssText = `
                    width: 28px; height: 28px;
                    background: #222222; border: 1px solid #444444; border-radius: 4px;
                    color: #ffffff; font-size: 14px; font-weight: bold; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: background 0.2s;
                `;
                plusBtn.onmouseover = () => plusBtn.style.background = "#333333";
                plusBtn.onmouseout = () => plusBtn.style.background = "#222222";
                plusBtn.onclick = () => {
                    const newId = "custom_" + Date.now();
                    const cicloCount = profiles.filter(p => p.name.includes("Ciclo de Día")).length + 1;
                    const newName = "Ciclo de Día " + cicloCount;
                    const newProf = {
                        id: newId,
                        name: newName,
                        isDefault: false,
                        timeline: timeline.map(k => ({ ...k }))
                    };
                    profiles.push(newProf);
                    this.game.updateEnvironmentConfig({
                        dayNightProfiles: profiles,
                        activeTimelineProfileId: newProf.id,
                        dayNightTimeline: newProf.timeline.map(k => ({ ...k })),
                        selectedEnvironmentStateId: newProf.timeline[0]?.id || null,
                        timeOfDay: newProf.timeline[0]?.time ?? 12
                    });
                    this.renderTimelineProfilesAndCards(true);
                    this.refreshSettings();
                };
                leftTabsWrap.appendChild(plusBtn);
                this.simTabsContainer.appendChild(leftTabsWrap);

                // Right Action: [+ Agregar Estado] Button
                const rightActionsWrap = document.createElement("div");
                rightActionsWrap.style.cssText = "display: flex; align-items: center; gap: 6px;";

                const addStateBtn = document.createElement("button");
                addStateBtn.type = "button";
                addStateBtn.innerHTML = "<span>+</span> Agregar Estado";
                addStateBtn.title = "Agregar Nuevo Estado / Hora al Día";
                addStateBtn.style.cssText = `
                    padding: 5px 12px;
                    background: #10b981;
                    border: none;
                    border-radius: 4px;
                    color: white;
                    font-size: 11px;
                    font-weight: bold;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: background 0.2s;
                `;
                addStateBtn.onmouseover = () => addStateBtn.style.background = "#059669";
                addStateBtn.onmouseout = () => addStateBtn.style.background = "#10b981";
                addStateBtn.onclick = () => {
                    // Backdrop
                    const backdrop = document.createElement("div");
                    backdrop.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                        background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
                        display: flex; align-items: center; justify-content: center;
                        z-index: 100000;
                    `;
                    backdrop.onclick = (e) => {
                        if (e.target === backdrop) backdrop.remove();
                    };

                    // Modal Box
                    const modal = document.createElement("div");
                    modal.style.cssText = `
                        background: #181818; border: 1px solid #444; border-radius: 8px;
                        padding: 18px; width: 380px; max-width: 92vw; color: white;
                        display: flex; flex-direction: column; gap: 12px;
                        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
                    `;

                    // Header
                    const header = document.createElement("div");
                    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 8px;";
                    const title = document.createElement("h3");
                    title.textContent = "➕ Agregar Estado al Día";
                    title.style.cssText = "margin: 0; font-size: 15px; color: #00ffff;";
                    const closeBtn = document.createElement("button");
                    closeBtn.textContent = "×";
                    closeBtn.style.cssText = "background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer;";
                    closeBtn.onclick = () => backdrop.remove();
                    header.appendChild(title);
                    header.appendChild(closeBtn);
                    modal.appendChild(header);

                    // Options Container
                    const optionsWrap = document.createElement("div");
                    optionsWrap.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

                    const applyState = (presetType: "night" | "sunrise" | "noon" | "sunset" | "custom", customTime?: number, customLabel?: string, copyFromId?: string) => {
                        const previousIds = new Set(timeline.map(k => k.id));
                        const updatedTimeline = addPresetKeyframeToTimeline(timeline, presetType, customTime, customLabel, copyFromId);
                        const newState = updatedTimeline.find(k => !previousIds.has(k.id)) || updatedTimeline[updatedTimeline.length - 1];
                        activeProfile.timeline = updatedTimeline;
                        this.game.updateEnvironmentConfig({
                            dayNightTimeline: updatedTimeline,
                            dayNightProfiles: profiles,
                            selectedEnvironmentStateId: newState.id,
                            timeOfDay: newState.time
                        });
                        this.renderTimelineProfilesAndCards(true);
                        this.refreshSettings();
                        backdrop.remove();
                    };

                    const presets = [
                        { type: "night", label: "Noche", time: "00:00", desc: "Cielo nocturno con estrellas y luz de luna.", color: "#8899bb" },
                        { type: "sunrise", label: "Amanecer", time: "06:00", desc: "Luz cálida y sol dorada naciente.", color: "#ff5722" },
                        { type: "noon", label: "Mediodía", time: "12:00", desc: "Sol cenital brillante y máxima iluminación.", color: "#ffaa00" },
                        { type: "sunset", label: "Atardecer", time: "18:00", desc: "Luz anaranjada y crepúsculo de la tarde.", color: "#ff8f70" }
                    ];

                    presets.forEach(p => {
                        const btnOption = document.createElement("button");
                        btnOption.type = "button";
                        btnOption.style.cssText = `
                            display: flex; flex-direction: column; gap: 2px; text-align: left;
                            padding: 8px 10px; background: #222; border: 1px solid #333; border-radius: 6px;
                            color: white; cursor: pointer; transition: all 0.2s;
                        `;
                        btnOption.onmouseover = () => {
                            btnOption.style.background = "#2a2a2a";
                            btnOption.style.borderColor = p.color;
                        };
                        btnOption.onmouseout = () => {
                            btnOption.style.background = "#222";
                            btnOption.style.borderColor = "#333";
                        };
                        btnOption.onclick = () => applyState(p.type as any);

                        const row1 = document.createElement("div");
                        row1.style.cssText = "display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;";
                        const labelSpan = document.createElement("span");
                        labelSpan.textContent = p.label;
                        labelSpan.style.color = p.color;
                        const timeSpan = document.createElement("span");
                        timeSpan.textContent = p.time;
                        timeSpan.style.cssText = "font-family: monospace; color: #00ffff;";
                        row1.appendChild(labelSpan);
                        row1.appendChild(timeSpan);

                        const descSpan = document.createElement("span");
                        descSpan.textContent = p.desc;
                        descSpan.style.cssText = "font-size: 11px; color: #888888;";

                        btnOption.appendChild(row1);
                        btnOption.appendChild(descSpan);
                        optionsWrap.appendChild(btnOption);
                    });

                    // Custom Cycle Option
                    const customSection = document.createElement("div");
                    customSection.style.cssText = "border-top: 1px solid #333; padding-top: 10px; margin-top: 4px; display: flex; flex-direction: column; gap: 8px;";
                    
                    const customTitle = document.createElement("span");
                    customTitle.textContent = "⚙️ Ciclo Personalizado / Copiar Configuración";
                    customTitle.style.cssText = "font-size: 12px; font-weight: bold; color: #10b981;";

                    const customRow1 = document.createElement("div");
                    customRow1.style.cssText = "display: flex; gap: 8px; align-items: center;";
                    
                    const labelTime = document.createElement("span");
                    labelTime.textContent = "Hora de Inicio (0-24):";
                    labelTime.style.cssText = "font-size: 11px; color: #aaa;";
                    
                    const inputCustomTime = document.createElement("input");
                    inputCustomTime.type = "number";
                    inputCustomTime.min = "0";
                    inputCustomTime.max = "23.9";
                    inputCustomTime.step = "0.5";
                    inputCustomTime.value = "15.0";
                    inputCustomTime.style.cssText = "width: 60px; background: #111; color: #00ffff; border: 1px solid #444; border-radius: 4px; padding: 4px; font-size: 12px; text-align: center;";

                    customRow1.appendChild(labelTime);
                    customRow1.appendChild(inputCustomTime);

                    const customRow2 = document.createElement("div");
                    customRow2.style.cssText = "display: flex; gap: 8px; align-items: center;";
                    const labelCopy = document.createElement("span");
                    labelCopy.textContent = "Iniciar con:";
                    labelCopy.style.cssText = "font-size: 11px; color: #aaa; min-width: 65px;";
                    
                    const selectCopy = document.createElement("select");
                    selectCopy.style.cssText = "flex: 1; background: #111; color: white; border: 1px solid #444; border-radius: 4px; padding: 4px; font-size: 11px;";
                    
                    const optInterp = document.createElement("option");
                    optInterp.value = "interpolated";
                    optInterp.textContent = "Interpolado del ciclo actual";
                    selectCopy.appendChild(optInterp);

                    const optN = document.createElement("option");
                    optN.value = "night"; optN.textContent = "Configuración Noche (Medianoche)";
                    selectCopy.appendChild(optN);

                    const optSr = document.createElement("option");
                    optSr.value = "sunrise"; optSr.textContent = "Configuración Amanecer (06:00)";
                    selectCopy.appendChild(optSr);

                    const optNo = document.createElement("option");
                    optNo.value = "noon"; optNo.textContent = "Configuración Mediodía (12:00)";
                    selectCopy.appendChild(optNo);

                    const optSs = document.createElement("option");
                    optSs.value = "sunset"; optSs.textContent = "Configuración Atardecer (18:00)";
                    selectCopy.appendChild(optSs);

                    sortedTimeline.forEach(k => {
                        const optK = document.createElement("option");
                        optK.value = "copy_" + k.id;
                        optK.textContent = `Copiar del estado: ${k.label} (${formatTimeOfDayHHMM(k.time)})`;
                        selectCopy.appendChild(optK);
                    });

                    customRow2.appendChild(labelCopy);
                    customRow2.appendChild(selectCopy);

                    const btnAddCustom = document.createElement("button");
                    btnAddCustom.type = "button";
                    btnAddCustom.textContent = "Crear Estado Personalizado";
                    btnAddCustom.style.cssText = `
                        padding: 8px; background: #10b981; border: none; border-radius: 4px;
                        color: white; font-weight: bold; font-size: 12px; cursor: pointer; transition: background 0.2s; margin-top: 4px;
                    `;
                    btnAddCustom.onmouseover = () => btnAddCustom.style.background = "#059669";
                    btnAddCustom.onmouseout = () => btnAddCustom.style.background = "#10b981";
                    btnAddCustom.onclick = () => {
                        const cTime = parseFloat(inputCustomTime.value) || 12;
                        const selectedVal = selectCopy.value;
                        if (selectedVal === "interpolated") {
                            applyState("custom", cTime, "Estado Personalizado");
                        } else if (selectedVal.startsWith("copy_")) {
                            const kfId = selectedVal.replace("copy_", "");
                            applyState("custom", cTime, "Estado Copiado", kfId);
                        } else {
                            applyState(selectedVal as any, cTime, "Estado Personalizado");
                        }
                    };

                    customSection.appendChild(customTitle);
                    customSection.appendChild(customRow1);
                    customSection.appendChild(customRow2);
                    customSection.appendChild(btnAddCustom);

                    modal.appendChild(optionsWrap);
                    modal.appendChild(customSection);
                    backdrop.appendChild(modal);
                    document.body.appendChild(backdrop);
                };
                rightActionsWrap.appendChild(addStateBtn);
                this.simTabsContainer.appendChild(rightActionsWrap);
            }

            // 2. Render Cards Grid
            if (this.simCardsGrid) {
                this.simCardsGrid.innerHTML = "";
                this.keyframeCardElements = [];

                sortedTimeline.forEach(kf => {
                    const isSelected = kf.id === selectedStateId;
                    const isPlaybackState = kf.id === closestStateId;
                    const info = getKeyframeTimeAndDuration(sortedTimeline, kf.id);
                    const skyLabel = this.getSkyTypeLabel(kf.skyType || "shader");

                    const card = document.createElement("div");
                    card.dataset.active = isSelected ? "true" : "false";
                    card.dataset.playback = isPlaybackState ? "true" : "false";
                    card.style.cssText = `
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: space-between;
                        gap: 6px;
                        padding: 10px 8px;
                        background: ${isSelected ? "#181818" : "#222222"};
                        border: 2px solid ${isSelected ? "#00ffff" : (isPlaybackState ? "#4ade80" : "#333333")};
                        border-radius: 6px;
                        cursor: pointer;
                        color: white;
                        position: relative;
                        transition: all 0.2s;
                        box-shadow: ${isSelected ? "0 0 10px rgba(0, 255, 255, 0.4)" : (isPlaybackState ? "0 0 8px rgba(74, 222, 128, 0.28)" : "none")};
                    `;
                    card.onmouseover = () => {
                        if (card.dataset.active !== "true") card.style.borderColor = "#555555";
                    };
                    card.onmouseout = () => {
                        if (card.dataset.active !== "true") card.style.borderColor = card.dataset.playback === "true" ? "#4ade80" : "#333333";
                    };
                    card.onclick = () => {
                        this.game.updateEnvironmentConfig({
                            selectedEnvironmentStateId: kf.id,
                            timeOfDay: kf.time,
                            isCycleSimulating: false,
                            enableDayNightCycle: false
                        });
                        this.refreshSettings();
                    };

                    if (sortedTimeline.length > 2) {
                        const btnDelKf = document.createElement("button");
                        btnDelKf.type = "button";
                        btnDelKf.innerHTML = "🗑️";
                        btnDelKf.title = "Eliminar este estado del día";
                        btnDelKf.style.cssText = "position: absolute; top: 3px; right: 4px; background: transparent; border: none; font-size: 11px; cursor: pointer; opacity: 0.6; padding: 2px;";
                        btnDelKf.onmouseover = () => btnDelKf.style.opacity = "1.0";
                        btnDelKf.onmouseout = () => btnDelKf.style.opacity = "0.6";
                        btnDelKf.onclick = (e) => {
                            e.stopPropagation();
                            const updatedTimeline = removeKeyframeFromTimeline(timeline, kf.id);
                            const fallbackState = updatedTimeline.find(k => k.id === selectedStateId) || updatedTimeline[0];
                            activeProfile.timeline = updatedTimeline;
                            this.game.updateEnvironmentConfig({
                                dayNightTimeline: updatedTimeline,
                                dayNightProfiles: profiles,
                                selectedEnvironmentStateId: fallbackState?.id || null,
                                timeOfDay: fallbackState?.time ?? 12
                            });
                            this.renderTimelineProfilesAndCards(true);
                            this.refreshSettings();
                        };
                        card.appendChild(btnDelKf);
                    }

                    // Title Header (Click to edit custom name)
                    const titleWrap = document.createElement("div");
                    titleWrap.style.cssText = "display: flex; align-items: center; gap: 4px; max-width: 90%; justify-content: center;";

                    const titleSpan = document.createElement("span");
                    titleSpan.textContent = kf.label;
                    titleSpan.title = "Haz clic para editar el nombre de este estado";
                    titleSpan.style.cssText = "font-size: 13px; font-weight: bold; color: #ffffff; cursor: pointer; border-bottom: 1px dashed #666;";
                    
                    const editIcon = document.createElement("span");
                    editIcon.textContent = "✏️";
                    editIcon.style.cssText = "font-size: 10px; opacity: 0.7; cursor: pointer;";

                    const triggerLabelEdit = (e: Event) => {
                        e.stopPropagation();
                        const newName = prompt("Nombre personalizado para este estado:", kf.label);
                        if (newName !== null && newName.trim() !== "") {
                            const updatedTimeline = updateKeyframeLabel(timeline, kf.id, newName);
                            activeProfile.timeline = updatedTimeline;
                            this.game.updateEnvironmentConfig({
                                dayNightTimeline: updatedTimeline,
                                dayNightProfiles: profiles,
                                selectedEnvironmentStateId: kf.id
                            });
                            this.renderTimelineProfilesAndCards(true);
                            this.refreshSettings();
                        }
                    };

                    titleSpan.onclick = triggerLabelEdit;
                    editIcon.onclick = triggerLabelEdit;

                    titleWrap.appendChild(titleSpan);
                    titleWrap.appendChild(editIcon);

                    // Time Range Badge (e.g. 06:00 - 12:00)
                    const rangeSpan = document.createElement("span");
                    rangeSpan.textContent = info.rangeStr;
                    rangeSpan.style.cssText = "font-size: 12px; font-family: monospace; font-weight: bold; color: #00ffff;";

                    // Duration Timer Badge (e.g. ⏱ 6.0h)
                    const durBadge = document.createElement("span");
                    durBadge.textContent = `⏱ Duración: ${info.duration}h`;
                    durBadge.style.cssText = "font-size: 10px; font-family: monospace; font-weight: bold; color: #4ade80;";

                    const transitionWrap = document.createElement("div");
                    transitionWrap.style.cssText = "display:flex; align-items:center; gap:4px; width:100%; justify-content:center;";
                    transitionWrap.onclick = (e) => e.stopPropagation();
                    const transitionMiniLabel = document.createElement("span");
                    transitionMiniLabel.textContent = "Cambio";
                    transitionMiniLabel.style.cssText = "font-size:9px; color:#94a3b8;";
                    const transitionSelect = document.createElement("select");
                    transitionSelect.title = "Cómo cambian las luces y propiedades hacia el siguiente estado";
                    transitionSelect.style.cssText = "background:#111; color:#e5e7eb; border:1px solid #444; border-radius:3px; font-size:10px; padding:2px; max-width:86px;";
                    [
                        { value: "procedural", label: "Procedural" },
                        { value: "instant", label: "Golpe" }
                    ].forEach(opt => {
                        const option = document.createElement("option");
                        option.value = opt.value;
                        option.textContent = opt.label;
                        transitionSelect.appendChild(option);
                    });
                    transitionSelect.value = kf.transitionMode || "procedural";
                    transitionSelect.onchange = () => {
                        this.updateSelectedEnvironmentState({ transitionMode: transitionSelect.value }, kf.id);
                        this.renderTimelineProfilesAndCards(true);
                        this.refreshSettings();
                    };
                    transitionWrap.appendChild(transitionMiniLabel);
                    transitionWrap.appendChild(transitionSelect);

                    // Time & Duration Controls (Inicio, Duración, Fin)
                    const timeControlsRow = document.createElement("div");
                    timeControlsRow.style.cssText = "display: flex; gap: 4px; align-items: center; justify-content: center; margin-top: 4px; width: 100%;";
                    timeControlsRow.onclick = (e) => e.stopPropagation();

                    // 1. Hora Inicio
                    const startWrap = document.createElement("div");
                    startWrap.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 1px;";
                    const startLabel = document.createElement("span");
                    startLabel.textContent = "Inicio";
                    startLabel.style.cssText = "font-size: 9px; color: #888888;";
                    const inputStart = document.createElement("input");
                    inputStart.type = "number";
                    inputStart.min = "0";
                    inputStart.max = "23.9";
                    inputStart.step = "0.5";
                    inputStart.value = String(info.startTime);
                    inputStart.title = "Modificar hora de inicio de este estado (0 a 24)";
                    inputStart.style.cssText = "width: 42px; background: #111111; color: #00ffff; border: 1px solid #444444; border-radius: 3px; font-size: 10px; text-align: center; padding: 2px 0;";
                    inputStart.onchange = () => {
                        const val = parseFloat(inputStart.value);
                        if (!isNaN(val)) {
                            const updatedTimeline = setKeyframeStartTime(timeline, kf.id, val);
                            activeProfile.timeline = updatedTimeline;
                            this.game.updateEnvironmentConfig({
                                dayNightTimeline: updatedTimeline,
                                dayNightProfiles: profiles,
                                selectedEnvironmentStateId: kf.id,
                                timeOfDay: val
                            });
                            this.renderTimelineProfilesAndCards(true);
                            this.refreshSettings();
                        }
                    };
                    startWrap.appendChild(startLabel);
                    startWrap.appendChild(inputStart);

                    // 2. Duración (hrs)
                    const durWrap = document.createElement("div");
                    durWrap.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 1px;";
                    const durLabel = document.createElement("span");
                    durLabel.textContent = "Duración";
                    durLabel.style.cssText = "font-size: 9px; color: #888888;";
                    const inputDur = document.createElement("input");
                    inputDur.type = "number";
                    inputDur.min = "0.5";
                    inputDur.max = "24";
                    inputDur.step = "0.5";
                    inputDur.value = String(info.duration);
                    inputDur.title = "Modificar duración en horas";
                    inputDur.style.cssText = "width: 42px; background: #111111; color: #4ade80; border: 1px solid #444444; border-radius: 3px; font-size: 10px; text-align: center; padding: 2px 0;";
                    inputDur.onchange = () => {
                        const val = parseFloat(inputDur.value);
                        if (!isNaN(val) && val > 0) {
                            const updatedTimeline = setKeyframeDuration(timeline, kf.id, val);
                            activeProfile.timeline = updatedTimeline;
                            this.game.updateEnvironmentConfig({
                                dayNightTimeline: updatedTimeline,
                                dayNightProfiles: profiles,
                                selectedEnvironmentStateId: kf.id
                            });
                            this.renderTimelineProfilesAndCards(true);
                            this.refreshSettings();
                        }
                    };
                    durWrap.appendChild(durLabel);
                    durWrap.appendChild(inputDur);

                    // 3. Hora Fin
                    const endWrap = document.createElement("div");
                    endWrap.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 1px;";
                    const endLabel = document.createElement("span");
                    endLabel.textContent = "Fin";
                    endLabel.style.cssText = "font-size: 9px; color: #888888;";
                    const inputEnd = document.createElement("input");
                    inputEnd.type = "number";
                    inputEnd.min = "0";
                    inputEnd.max = "24";
                    inputEnd.step = "0.5";
                    inputEnd.value = String(info.endTime);
                    inputEnd.title = "Modificar hora de fin de este estado (0 a 24)";
                    inputEnd.style.cssText = "width: 42px; background: #111111; color: #00ffff; border: 1px solid #444444; border-radius: 3px; font-size: 10px; text-align: center; padding: 2px 0;";
                    inputEnd.onchange = () => {
                        const val = parseFloat(inputEnd.value);
                        if (!isNaN(val)) {
                            const updatedTimeline = setKeyframeEndTime(timeline, kf.id, val);
                            activeProfile.timeline = updatedTimeline;
                            this.game.updateEnvironmentConfig({
                                dayNightTimeline: updatedTimeline,
                                dayNightProfiles: profiles,
                                selectedEnvironmentStateId: kf.id
                            });
                            this.renderTimelineProfilesAndCards(true);
                            this.refreshSettings();
                        }
                    };
                    endWrap.appendChild(endLabel);
                    endWrap.appendChild(inputEnd);

                    timeControlsRow.appendChild(startWrap);
                    timeControlsRow.appendChild(durWrap);
                    timeControlsRow.appendChild(endWrap);

                    card.appendChild(titleWrap);
                    card.appendChild(rangeSpan);
                    card.appendChild(durBadge);
                    card.appendChild(transitionWrap);

                    const configChips = document.createElement("div");
                    configChips.style.cssText = "display:flex; gap:4px; flex-wrap:wrap; justify-content:center; width:100%;";
                    const makeChip = (text, color = "#94a3b8") => {
                        const chip = document.createElement("span");
                        chip.textContent = text;
                        chip.style.cssText = `
                            font-size: 9px;
                            line-height: 1;
                            padding: 3px 5px;
                            border-radius: 999px;
                            background: rgba(15, 23, 42, 0.9);
                            border: 1px solid ${color};
                            color: ${color};
                            max-width: 100%;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        `;
                        return chip;
                    };
                    configChips.appendChild(makeChip(skyLabel, kf.skyType === "shader" ? "#60a5fa" : "#94a3b8"));
                    const solarAtState = calculateSolarCyclePosition(config, kf.time);
                    configChips.appendChild(makeChip(`Órbita ${solarAtState.sunElevation.toFixed(0)}°`, solarAtState.isDay ? "#fbbf24" : "#93c5fd"));
                    configChips.appendChild(makeChip(`Sol ${Number(kf.sunIntensity ?? 0).toFixed(2)}`, "#fbbf24"));
                    configChips.appendChild(makeChip((kf.transitionMode || "procedural") === "instant" ? "Golpe" : "Procedural", (kf.transitionMode || "procedural") === "instant" ? "#fb7185" : "#4ade80"));
                    configChips.appendChild(makeChip(`Mie ${Number(kf.skyMieCoefficient ?? 0.005).toFixed(3)}`, "#38bdf8"));
                    card.appendChild(configChips);
                    card.appendChild(timeControlsRow);

                    this.simCardsGrid.appendChild(card);
                    this.keyframeCardElements.push({ id: kf.id, time: kf.time, card });
                });
            }
        } else {
            if (this.keyframeCardElements) {
                this.keyframeCardElements.forEach(k => {
                    const isSelected = k.id === selectedStateId;
                    const isPlaybackState = k.id === closestStateId;
                    if (k.card) {
                        k.card.dataset.active = isSelected ? "true" : "false";
                        k.card.dataset.playback = isPlaybackState ? "true" : "false";
                        k.card.style.borderColor = isSelected ? "#00ffff" : (isPlaybackState ? "#4ade80" : "#333333");
                        k.card.style.boxShadow = isSelected ? "0 0 10px rgba(0, 255, 255, 0.4)" : (isPlaybackState ? "0 0 8px rgba(74, 222, 128, 0.28)" : "none");
                        k.card.style.background = isSelected ? "#181818" : "#222222";
                    }
                });
            }
        }
    }

    refreshSettings() {
        if (!this.game || !this.game.environmentConfig) return;
        const config = this.game.environmentConfig;
        const timelineContext = this.getTimelineStateContext();
        const selectedState = timelineContext.selected;
        const selectedConfig = selectedState || config;

        // Size Inputs and Row Visibilities
        const isCustom = config.shapeType === "custom";
        if (this.rowSizeX) this.rowSizeX.style.display = isCustom ? "none" : "flex";
        if (this.rowSizeZ) this.rowSizeZ.style.display = isCustom ? "none" : "flex";

        if (this.inputSizeX) this.inputSizeX.value = String(config.mapSizeX || 100);
        if (this.inputSizeZ) this.inputSizeZ.value = String(config.mapSizeZ || 100);

        // Disable input based on custom shape
        if (this.inputSizeX) this.inputSizeX.disabled = isCustom;
        if (this.inputSizeZ) this.inputSizeZ.disabled = isCustom || config.shapeType === "circle";

        // Walls Config
        if (this.checkInvisibleWalls) this.checkInvisibleWalls.checked = !!config.invisibleWalls;
        if (this.checkWallsAdvanced) this.checkWallsAdvanced.checked = !!config.invisibleWallsAdvanced;

        // Ceilings Config
        if (this.checkInvisibleCeilings) this.checkInvisibleCeilings.checked = !!config.ceilingsEnabled;
        if (this.checkCeilingsAdvanced) this.checkCeilingsAdvanced.checked = !!config.ceilingsAdvanced;

        // Fall Death
        if (this.checkFallDeath) this.checkFallDeath.checked = config.fallDeath !== false;
        if (this.inputFallY) this.inputFallY.value = String(config.fallDeathY !== undefined ? config.fallDeathY : -20);

        // Sync helper for UI rows visibility
        if (this.syncWallsVisibility) this.syncWallsVisibility();
        if (this.syncCeilingsVisibility) this.syncCeilingsVisibility();

        // Skybox preview
        if (selectedConfig.skyType || config.skyType) {
            if (this.setPendingSky) this.setPendingSky(selectedConfig.skyType || config.skyType);
        }

        // ------------------ New Lighting Controls Refresh ------------------
        if (this.selectLightMode) this.selectLightMode.value = selectedConfig.lightMode || config.lightMode || "day";
        if (this.selectShadowQuality) this.selectShadowQuality.value = config.shadowQuality || "medium";

        if (this.checkSolarVisual) this.checkSolarVisual.checked = config.enableSolarVisual !== false;
        this.solarVisualEditor?.refresh();
        this.drawSolarPathPreview();

        // Refresh Star checkboxes
        if (this.checkStarsNight) this.checkStarsNight.checked = config.enableStarsNight !== false;
        if (this.checkStarsSkybox) this.checkStarsSkybox.checked = !!config.enableStarsSkybox;
        if (this.checkStarsCycle) this.checkStarsCycle.checked = !!selectedConfig.enableStars;

        const isPlaying = !!config.enableDayNightCycle || !!config.isCycleSimulating;
        if (this.simPlayBtn && this.simPauseBtn) {
            if (isPlaying) {
                this.simPlayBtn.style.background = "#050";
                this.simPlayBtn.dataset.active = "true";
                this.simPauseBtn.style.background = "#333";
                this.simPauseBtn.dataset.active = "false";
            } else {
                this.simPlayBtn.style.background = "#333";
                this.simPlayBtn.dataset.active = "false";
                this.simPauseBtn.style.background = "#333";
                this.simPauseBtn.dataset.active = "false";
            }
        }

        const currentTime = config.timeOfDay !== undefined ? Number(config.timeOfDay) : 12;
        if (this.simClockSpan) {
            this.simClockSpan.textContent = formatTimeOfDayHHMM(currentTime);
        }

        this.renderTimelineProfilesAndCards(false);

        if (this.selectedStateInfo && selectedState) {
            const stateInfo = getKeyframeTimeAndDuration(timelineContext.timeline, selectedState.id);
            this.selectedStateInfo.innerHTML = "";
            const label = document.createElement("span");
            label.textContent = `Estado seleccionado: ${selectedState.label}`;
            label.style.cssText = "font-weight:bold; color:#ffffff;";
            const meta = document.createElement("span");
            meta.textContent = `${stateInfo.rangeStr} · ${this.getSkyTypeLabel(selectedState.skyType || "shader")}`;
            meta.style.cssText = "font-family:monospace; color:#7dd3fc;";
            this.selectedStateInfo.appendChild(label);
            this.selectedStateInfo.appendChild(meta);
        }

        if (this.sliderTimeOfDay && document.activeElement !== this.sliderTimeOfDay) {
            this.sliderTimeOfDay.value = String(currentTime);
            if (this.valTimeOfDay) this.valTimeOfDay.textContent = currentTime.toFixed(1) + " hrs";
        }

        if (this.sliderCycleSpeed && document.activeElement !== this.sliderCycleSpeed) {
            const spd = config.cycleSpeed !== undefined ? Number(config.cycleSpeed) : 0.05;
            this.sliderCycleSpeed.value = String(spd);
            if (this.valCycleSpeed) this.valCycleSpeed.textContent = (spd * 10).toFixed(1) + "x";
        }

        if (this.rowCustomLights) this.rowCustomLights.style.display = selectedConfig.lightMode === "custom" ? "flex" : "none";
        if (this.inputSunIntensity) this.inputSunIntensity.value = String(selectedConfig.sunIntensity ?? 0.8);
        if (this.inputSunColor) this.inputSunColor.value = selectedConfig.sunColor || "#ffffff";
        if (this.inputAmbientIntensity) this.inputAmbientIntensity.value = String(selectedConfig.ambientIntensity ?? 0.6);
        if (this.inputAmbientColor) this.inputAmbientColor.value = selectedConfig.ambientColor || "#ffffff";

        if (this.rowSkyShader) this.rowSkyShader.style.display = "flex";
        if (this.shaderAtmosphereGroup) {
            this.shaderAtmosphereGroup.style.display = "flex";
        }
        if (this.selectTransitionMode) this.selectTransitionMode.value = selectedConfig.transitionMode || "procedural";
        if (this.shaderSliders) {
            const turbidityVal = selectedConfig.skyTurbidity ?? 10;
            this.shaderSliders.turbidity.slider.value = String(turbidityVal);
            this.shaderSliders.turbidity.valSpan.textContent = turbidityVal.toFixed(2);

            const rayleighVal = selectedConfig.skyRayleigh ?? 2;
            this.shaderSliders.rayleigh.slider.value = String(rayleighVal);
            this.shaderSliders.rayleigh.valSpan.textContent = rayleighVal.toFixed(2);

            const mieCoeffVal = selectedConfig.skyMieCoefficient ?? 0.005;
            this.shaderSliders.mieCoefficient.slider.value = String(mieCoeffVal);
            this.shaderSliders.mieCoefficient.valSpan.textContent = mieCoeffVal.toFixed(3);

            const mieGVal = selectedConfig.skyMieDirectionalG ?? 0.8;
            this.shaderSliders.mieDirectionalG.slider.value = String(mieGVal);
            this.shaderSliders.mieDirectionalG.valSpan.textContent = mieGVal.toFixed(2);
        }

        // --- Refresco de Controles del Panel de Propiedades de Skybox & Timeline ---
        const interp = interpolateTimelineState(config.dayNightTimeline, currentTime);

        if (this.sliderEnvIntensity) {
            const envVal = selectedConfig.environmentIntensity !== undefined ? Number(selectedConfig.environmentIntensity) : interp.environmentIntensity;
            this.sliderEnvIntensity.value = String(envVal);
            if (this.valEnvIntensity) this.valEnvIntensity.textContent = Number(envVal).toFixed(2);
        }
        if (this.sliderBgIntensity) {
            const bgVal = selectedConfig.backgroundIntensity !== undefined ? Number(selectedConfig.backgroundIntensity) : interp.backgroundIntensity;
            this.sliderBgIntensity.value = String(bgVal);
            if (this.valBgIntensity) this.valBgIntensity.textContent = Number(bgVal).toFixed(2);
        }
        if (this.sliderSkyRotation) {
            const rotVal = selectedConfig.skyboxRotation !== undefined ? Number(selectedConfig.skyboxRotation) : 0;
            this.sliderSkyRotation.value = String(rotVal);
            if (this.valSkyRotation) this.valSkyRotation.textContent = rotVal + "°";
        }
        if (this.sliderBgBlur) {
            const blurVal = selectedConfig.backgroundBlurriness !== undefined ? Number(selectedConfig.backgroundBlurriness) : 0;
            this.sliderBgBlur.value = String(blurVal);
            if (this.valBgBlur) this.valBgBlur.textContent = Number(blurVal).toFixed(2);
        }

        if (this.checkSunLight) this.checkSunLight.checked = selectedConfig.enableSunLight !== false;
        if (this.inputSkySunColor) {
            const sc = selectedConfig.sunColor || interp.sunColor;
            this.inputSkySunColor.value = sc;
            if (this.hexSkySunColor) this.hexSkySunColor.textContent = sc;
        }
        if (this.sliderSkySunIntensity) {
            const si = selectedConfig.sunIntensity !== undefined ? Number(selectedConfig.sunIntensity) : interp.sunIntensity;
            this.sliderSkySunIntensity.value = String(si);
            if (this.valSkySunIntensity) this.valSkySunIntensity.textContent = Number(si).toFixed(2);
        }
        if (this.checkAmbientLight) this.checkAmbientLight.checked = selectedConfig.enableAmbientLight !== false;
        if (this.inputSkyAmbientColor) {
            const ac = selectedConfig.ambientColor || interp.ambientColor;
            this.inputSkyAmbientColor.value = ac;
            if (this.hexSkyAmbientColor) this.hexSkyAmbientColor.textContent = ac;
        }
        if (this.sliderSkyAmbientIntensity) {
            const ai = selectedConfig.ambientIntensity !== undefined ? Number(selectedConfig.ambientIntensity) : interp.ambientIntensity;
            this.sliderSkyAmbientIntensity.value = String(ai);
            if (this.valSkyAmbientIntensity) this.valSkyAmbientIntensity.textContent = Number(ai).toFixed(2);
        }

        const isFogEnabled = selectedConfig.enableSkyboxFog !== undefined ? !!selectedConfig.enableSkyboxFog : !!interp.enableSkyboxFog;
        if (this.checkSkyboxFog) this.checkSkyboxFog.checked = isFogEnabled;
        
        if (this.inputSkyFogColor) {
            const fc = selectedConfig.fogColor || interp.fogColor || "#87ceeb";
            this.inputSkyFogColor.value = fc;
            if (this.hexSkyFogColor) this.hexSkyFogColor.textContent = fc;
        }
        if (this.sliderSkyFogNear) {
            const fn = selectedConfig.fogNear !== undefined ? Number(selectedConfig.fogNear) : (interp.fogNear ?? 10);
            this.sliderSkyFogNear.value = String(fn);
            if (this.valSkyFogNear) this.valSkyFogNear.textContent = Number(fn).toFixed(0) + "m";
        }
        if (this.sliderSkyFogFar) {
            const ff = selectedConfig.fogFar !== undefined ? Number(selectedConfig.fogFar) : (interp.fogFar ?? 50);
            this.sliderSkyFogFar.value = String(ff);
            if (this.valSkyFogFar) this.valSkyFogFar.textContent = Number(ff).toFixed(0) + "m";
        }
    }

    renderSaveLoad(container) {
        // Change container layout to support split view
        container.style.flexWrap = "wrap";
        container.style.alignItems = "stretch";

        const leftColumn = document.createElement("div");
        leftColumn.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 15px;
            flex: 1 1 300px;
        `;

        const rightColumn = document.createElement("div");
        rightColumn.style.cssText = `
            flex: 2 1 300px;
            min-width: 280px;
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
            overflow: hidden;
        `;

        const rightTitleRow = document.createElement("div");
        rightTitleRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #555; padding-bottom: 10px; flex-wrap: wrap; gap: 10px;";

        const rightTitle = document.createElement("h3");
        rightTitle.textContent = "Visualizador de Mapa (JSON)";
        rightTitle.style.margin = "0";

        // State for JSON logic
        let filters = {
            gameVersion: true,
            timestamp: true,
            objects: true,
            gameConfig: true,
            playerConfig: true
        };
        let isEditing = false;

        // Edit Checkbox
        const editLabel = document.createElement("label");
        editLabel.style.cssText = "font-size: 13px; color: #facc15; display: flex; align-items: center; gap: 5px; cursor: pointer; font-weight: bold;";
        const editCb = document.createElement("input");
        editCb.type = "checkbox";
        editCb.onchange = (e) => {
            isEditing = e.target.checked;
            if (isEditing) {
                jsonTextArea.style.pointerEvents = "auto";
                jsonTextArea.style.caretColor = "white";
                jsonTextArea.style.overflow = "auto";
                jsonPre.style.pointerEvents = "none";
                jsonPre.style.overflow = "hidden";
                editorContainer.style.border = "1px solid #6366f1";
                applyBtn.style.visibility = "visible";
                filtersContainer.style.opacity = "0.5";
                filtersContainer.style.pointerEvents = "none";
            } else {
                jsonTextArea.style.pointerEvents = "none";
                jsonTextArea.style.caretColor = "transparent";
                jsonTextArea.style.overflow = "hidden";
                jsonPre.style.pointerEvents = "auto";
                jsonPre.style.overflow = "auto";
                editorContainer.style.border = "1px solid transparent";
                applyBtn.style.visibility = "hidden";
                filtersContainer.style.opacity = "1";
                filtersContainer.style.pointerEvents = "auto";
                updateJson();
            }
        };
        editLabel.appendChild(editCb);
        editLabel.appendChild(document.createTextNode("Habilitar Edición Manual"));

        rightTitleRow.appendChild(rightTitle);
        rightTitleRow.appendChild(editLabel);

        const editorContainer = document.createElement("div");
        editorContainer.style.cssText = `
            position: relative;
            flex: 1;
            width: 100%;
            min-height: 400px;
            border: 1px solid transparent;
            border-radius: 6px;
            background: #111;
        `;

        const lineNumbersDiv = document.createElement("div");
        lineNumbersDiv.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 45px; height: 100%;
            background: #1a1a1a;
            color: #666;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.5;
            text-align: right;
            padding: 12px 10px 12px 0;
            box-sizing: border-box;
            border-right: 1px solid #444;
            border-radius: 6px 0 0 6px;
            overflow: hidden;
            user-select: none;
            white-space: pre;
        `;

        const jsonPre = document.createElement("pre");
        jsonPre.style.cssText = `
            position: absolute;
            top: 0; left: 45px; width: calc(100% - 45px); height: 100%;
            background: transparent;
            color: #d1d5db;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.5;
            border: 1px solid #555;
            border-left: none;
            border-radius: 0 6px 6px 0;
            padding: 12px;
            overflow: auto;
            margin: 0;
            box-sizing: border-box;
            white-space: pre;
            pointer-events: auto;
        `;

        const jsonTextArea = document.createElement("textarea");
        jsonTextArea.style.cssText = `
            position: absolute;
            top: 0; left: 45px; width: calc(100% - 45px); height: 100%;
            background: transparent;
            color: transparent;
            caret-color: transparent;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.5;
            border: 1px solid transparent;
            border-left: none;
            border-radius: 0 6px 6px 0;
            padding: 12px;
            resize: none;
            overflow: hidden;
            margin: 0;
            box-sizing: border-box;
            white-space: pre;
            outline: none;
            pointer-events: none;
            z-index: 2;
        `;
        jsonTextArea.spellcheck = false;

        const updateLineNumbers = (text) => {
            if (!text) {
                lineNumbersDiv.textContent = "1\n";
                return;
            }
            const linesCount = text.split("\n").length;
            let numbersStr = "";
            for (let i = 1; i <= linesCount; i++) {
                numbersStr += i + "\n";
            }
            lineNumbersDiv.textContent = numbersStr;
        };

        // Prevent typing from triggering global game inputs (like T for chat)
        jsonTextArea.addEventListener("keydown", (e) => e.stopPropagation());
        jsonTextArea.addEventListener("keyup", (e) => e.stopPropagation());
        jsonTextArea.addEventListener("keypress", (e) => e.stopPropagation());

        // Synchronize scroll and formatting while typing
        jsonTextArea.addEventListener("scroll", () => {
            if (isEditing) {
                jsonPre.scrollTop = jsonTextArea.scrollTop;
                jsonPre.scrollLeft = jsonTextArea.scrollLeft;
                lineNumbersDiv.scrollTop = jsonTextArea.scrollTop;
            }
        });

        jsonPre.addEventListener("scroll", () => {
            if (!isEditing) {
                jsonTextArea.scrollTop = jsonPre.scrollTop;
                jsonTextArea.scrollLeft = jsonPre.scrollLeft;
                lineNumbersDiv.scrollTop = jsonPre.scrollTop;
            }
        });

        jsonTextArea.addEventListener("input", () => {
            if (isEditing) {
                jsonPre.innerHTML = syntaxHighlight(jsonTextArea.value);
                updateLineNumbers(jsonTextArea.value);
            }
        });

        editorContainer.appendChild(lineNumbersDiv);
        editorContainer.appendChild(jsonPre);
        editorContainer.appendChild(jsonTextArea);

        const applyBtn = document.createElement("button");
        applyBtn.textContent = "Aplicar Cambios del JSON";
        applyBtn.style.cssText = `
            background: #15803d;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            visibility: hidden;
        `;
        applyBtn.onclick = () => {
            try {
                const newJson = JSON.parse(jsonTextArea.value);
                if (this.game.loadMap) {
                    this.game.loadMap(newJson);

                    // Sincronizar en modo colaborativo
                    if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
                        this.game.networkManager.broadcastMapSync(newJson);
                    }

                    editCb.checked = false;
                    editCb.dispatchEvent(new Event("change"));
                    alert("¡Cambios aplicados al mapa exitosamente!");
                }
            } catch (err) {
                alert("Error de sintaxis JSON: " + err.message);
            }
        };

        // Filters UI
        const filtersContainer = document.createElement("div");
        filtersContainer.style.cssText = "display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;";

        const createFilter = (key, label) => {
            const lbl = document.createElement("label");
            lbl.style.cssText = "font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 4px; cursor: pointer;";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = true;
            cb.onchange = () => {
                filters[key] = cb.checked;
                if (!isEditing) updateJson();
            };
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(label));
            filtersContainer.appendChild(lbl);
        };

        createFilter("gameVersion", "Versión");
        createFilter("timestamp", "Fecha/Hora");
        createFilter("gameConfig", "Game Config");
        createFilter("playerConfig", "Player Config");
        createFilter("objects", "Objetos 3D");

        // Función de Limpiar Sección
        const deleteContainer = document.createElement("div");
        deleteContainer.style.cssText = "display: flex; gap: 10px; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; width: 100%;";

        const deleteSelect = document.createElement("select");
        deleteSelect.style.cssText = "padding: 5px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;";
        deleteSelect.innerHTML = `
            <option value="objects" selected>Objetos 3D</option>
            <option value="gameConfig">Game Config</option>
            <option value="playerConfig">Player Config</option>
            <option value="all">Todo el Mapa (Limpiar)</option>
        `;

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Borrar";
        deleteBtn.style.cssText = "background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;";

        deleteBtn.onclick = () => {
            const section = deleteSelect.value;
            if (confirm(`¿Estás seguro de que deseas borrar: ${section}?`)) {
                if (this.game.saveMap && this.game.loadMap) {
                    const currentMap = this.game.saveMap();

                    if (section === "objects") {
                        currentMap.objects = [];
                    } else if (section === "gameConfig") {
                        currentMap.gameConfig = null;
                    } else if (section === "playerConfig") {
                        currentMap.playerConfig = null;
                    } else if (section === "all") {
                        currentMap.objects = [];
                        currentMap.gameConfig = null;
                        currentMap.playerConfig = null;
                    }

                    this.game.loadMap(currentMap);

                    if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
                        this.game.networkManager.broadcastMapSync(currentMap);
                    }

                    alert(`Sección ${section} borrada correctamente!`);
                    updateJson();
                }
            }
        };

        deleteContainer.appendChild(document.createTextNode("Limpiar Sección:"));
        deleteContainer.appendChild(deleteSelect);
        deleteContainer.appendChild(deleteBtn);

        rightColumn.appendChild(rightTitleRow);
        rightColumn.appendChild(editorContainer);
        rightColumn.appendChild(applyBtn);
        rightColumn.appendChild(filtersContainer);
        rightColumn.appendChild(deleteContainer);

        const syntaxHighlight = (json) => {
            if (!json) return "";
            json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                let cls = "color: #fca5a5;"; // number
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = "color: #93c5fd; font-weight: bold; font-style: normal;"; // key
                    } else {
                        cls = "color: #86efac;"; // string
                    }
                } else if (/true|false/.test(match)) {
                    cls = "color: #fcd34d; font-weight: bold;"; // boolean
                } else if (/null/.test(match)) {
                    cls = "color: #f87171; font-weight: bold;"; // null
                }
                return "<span style=\"" + cls + "\">" + match + "</span>";
            });
        };

        const updateJson = () => {
            if (!this.game || !this.game.saveMap || isEditing) return;
            try {
                const mapData = this.game.saveMap();
                const filteredData = {};

                if (filters.gameVersion && mapData.gameVersion !== undefined) filteredData.gameVersion = mapData.gameVersion;
                if (filters.timestamp && mapData.timestamp !== undefined) filteredData.timestamp = mapData.timestamp;
                if (filters.objects && mapData.objects !== undefined) filteredData.objects = mapData.objects;
                if (filters.gameConfig && mapData.gameConfig !== undefined) filteredData.gameConfig = mapData.gameConfig;
                if (filters.playerConfig && mapData.playerConfig !== undefined) filteredData.playerConfig = mapData.playerConfig;

                for (let key in mapData) {
                    if (!["gameVersion", "timestamp", "objects", "gameConfig", "playerConfig"].includes(key)) {
                        filteredData[key] = mapData[key];
                    }
                }

                const rawJson = JSON.stringify(filteredData, null, 2);
                jsonPre.innerHTML = syntaxHighlight(rawJson);
                jsonTextArea.value = rawJson;
                updateLineNumbers(rawJson);
            } catch (e) { }
        };

        // Auto update interval
        if (this._jsonUpdateInterval) clearInterval(this._jsonUpdateInterval);
        this._jsonUpdateInterval = setInterval(() => {
            if (container.offsetWidth > 0 && !isEditing) {
                updateJson();
            }
        }, 1000);

        // Save Map Section
        const saveSection = document.createElement("div");
        saveSection.style.cssText = `
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `;

        const saveTitle = document.createElement("h3");
        saveTitle.textContent = "Guardar Mapa";
        saveTitle.style.margin = "0";
        saveTitle.style.borderBottom = "1px solid #555";
        saveTitle.style.paddingBottom = "10px";

        const saveInfo = document.createElement("p");
        saveInfo.textContent = "Revisa el mapa en el panel derecho o descarga el archivo JSON para guardarlo en tu computadora.";
        saveInfo.style.color = "#aaa";
        saveInfo.style.fontSize = "14px";
        saveInfo.style.margin = "0";

        const btnContainer = document.createElement("div");
        btnContainer.style.cssText = "display: flex; flex-direction: column; gap: 10px;";

        const baseBtnStyle = `
            background: #545454ff;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: background 0.2s;
        `;

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Guardar Mapa (Descargar)";
        saveBtn.style.cssText = baseBtnStyle;
        saveBtn.onmouseover = () => saveBtn.style.background = "#656565ff";
        saveBtn.onmouseout = () => saveBtn.style.background = "#545454ff";
        saveBtn.onclick = () => {
            if (this.game.saveMap) {
                const mapData = this.game.saveMap();
                const json = JSON.stringify(mapData, null, 2);

                // Download
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "mi_mapa.json";
                a.click();
                URL.revokeObjectURL(url);

                alert("Mapa guardado! Archivo descargado.");
            } else {
                alert("Error: Función saveMap no encontrada en el juego.");
            }
        };

        const platformStatus = document.createElement("div");
        platformStatus.style.cssText = "min-height: 18px; color: #aaa; font-size: 13px;";
        platformStatus.textContent = this.game.roomId
            ? `Mapa activo: ${this.game.roomId}`
            : "Abre un mapa desde Biblioteca para guardarlo en la plataforma.";

        const platformSaveBtn = document.createElement("button");
        platformSaveBtn.textContent = "Guardar en Plataforma";
        platformSaveBtn.style.cssText = baseBtnStyle + "background:#7c3aed;";
        platformSaveBtn.onmouseover = () => platformSaveBtn.style.background = "#8b5cf6";
        platformSaveBtn.onmouseout = () => platformSaveBtn.style.background = "#7c3aed";
        platformSaveBtn.onclick = async () => {
            if (!this.game.saveMap) {
                platformStatus.style.color = "#f87171";
                platformStatus.textContent = "Error: Funcion saveMap no encontrada.";
                return;
            }

            platformSaveBtn.disabled = true;
            platformStatus.style.color = "#fbbf24";
            platformStatus.textContent = "Guardando version...";

            try {
                const mapData = this.game.saveMap();
                const saved = await savePlatformMapForRoom(this.game.roomId, mapData);
                this.game.activePlatformMap = saved;
                platformStatus.style.color = "#86efac";
                platformStatus.textContent = `Guardado v${saved.version} · ${saved.objectCount} objetos`;
            } catch (err) {
                platformStatus.style.color = "#f87171";
                platformStatus.textContent = err instanceof Error ? err.message : "No se pudo guardar en plataforma.";
            } finally {
                platformSaveBtn.disabled = false;
            }
        };

        btnContainer.appendChild(saveBtn);
        btnContainer.appendChild(platformSaveBtn);
        btnContainer.appendChild(platformStatus);

        saveSection.appendChild(saveTitle);
        saveSection.appendChild(saveInfo);
        saveSection.appendChild(btnContainer);

        // Load Map Section
        const loadSection = document.createElement("div");
        loadSection.style.cssText = `
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `;

        const loadTitle = document.createElement("h3");
        loadTitle.textContent = "Cargar Mapa";
        loadTitle.style.margin = "0";
        loadTitle.style.borderBottom = "1px solid #555";
        loadTitle.style.paddingBottom = "10px";

        const loadInfo = document.createElement("p");
        loadInfo.textContent = "Selecciona un archivo JSON previamente guardado para cargarlo.";
        loadInfo.style.color = "#aaa";
        loadInfo.style.fontSize = "14px";
        loadInfo.style.margin = "0";

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.color = "white";

        const loadBtn = document.createElement("button");
        loadBtn.textContent = "Cargar Mapa";
        loadBtn.style.cssText = baseBtnStyle;
        loadBtn.onmouseover = () => loadBtn.style.background = "#656565ff";
        loadBtn.onmouseout = () => loadBtn.style.background = "#545454ff";
        loadBtn.onclick = () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        if (this.game.loadMap) {
                            this.game.loadMap(json);
                            // Interval updates preview normally
                            setTimeout(updateJson, 100);
                            alert("Mapa cargado correctamente!");
                        } else {
                            alert("Error: Función loadMap no encontrada en el juego.");
                        }
                    } catch (err) {
                        alert("Error al parsear el archivo JSON: " + err);
                    }
                };
                reader.readAsText(file);
            } else {
                alert("Por favor selecciona un archivo primero.");
            }
        };

        loadSection.appendChild(loadTitle);
        loadSection.appendChild(loadInfo);
        loadSection.appendChild(fileInput);
        loadSection.appendChild(loadBtn);

        // Collab Section
        const collabSection = document.createElement("div");
        collabSection.style.cssText = `
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            box-sizing: border-box;
        `;

        const collabTitle = document.createElement("h3");
        collabTitle.textContent = "Edición Colaborativa";
        collabTitle.style.cssText = "margin: 0; border-bottom: 1px solid #555; padding-bottom: 10px;";
        collabSection.appendChild(collabTitle);

        // Indicador de estado
        const statusRow = document.createElement("div");
        statusRow.style.cssText = "display: flex; align-items: center; gap: 8px;";

        const statusDot = document.createElement("span");
        statusDot.style.cssText = `
            width: 9px; height: 9px; border-radius: 50%;
            background: #555; display: inline-block; flex-shrink: 0;
            transition: background 0.3s;
        `;
        const statusText = document.createElement("span");
        statusText.style.cssText = "font-size: 13px; color: #888; transition: color 0.3s;";
        statusText.textContent = "Desactivado";

        statusRow.appendChild(statusDot);
        statusRow.appendChild(statusText);
        collabSection.appendChild(statusRow);

        // Botón toggle
        const collabBtn = document.createElement("button");
        collabBtn.textContent = "Abrir Colaborativo";
        collabBtn.style.cssText = baseBtnStyle;
        collabBtn.onmouseover = () => collabBtn.style.background = "#656565ff";
        collabSection.appendChild(collabBtn);

        // Bloque del link
        const linkBlock = document.createElement("div");
        linkBlock.style.cssText = "display: none; flex-direction: column; gap: 8px; border-top: 1px solid #555; padding-top: 12px;";

        const linkLabel = document.createElement("label");
        linkLabel.textContent = "Link para compartir con colaboradores:";
        linkLabel.style.cssText = "font-size: 13px; color: #aaa;";

        const linkInput = document.createElement("input");
        linkInput.type = "text";
        linkInput.readOnly = true;
        linkInput.style.cssText = `
            background: #1a1a1a; color: #ccc;
            border: 1px solid #555; border-radius: 4px;
            padding: 8px 10px; font-size: 12px; font-family: monospace;
            cursor: pointer; outline: none; width: 100%; box-sizing: border-box;
        `;
        linkInput.onfocus = () => linkInput.select();

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copiar Link";
        copyBtn.style.cssText = `
            background: #545454ff; color: white;
            border: none; padding: 10px;
            border-radius: 6px; cursor: pointer; font-size: 14px;
            font-weight: bold; transition: background 0.2s;
        `;
        copyBtn.onmouseover = () => copyBtn.style.background = "#656565ff";
        copyBtn.onmouseout = () => copyBtn.style.background = "#545454ff";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                copyBtn.textContent = "¡Copiado!";
                setTimeout(() => { copyBtn.textContent = "Copiar Link"; }, 2000);
            }).catch(() => {
                linkInput.select(); document.execCommand("copy");
                copyBtn.textContent = "¡Copiado!";
                setTimeout(() => { copyBtn.textContent = "Copiar Link"; }, 2000);
            });
        };

        linkBlock.appendChild(linkLabel);
        linkBlock.appendChild(linkInput);
        linkBlock.appendChild(copyBtn);

        collabSection.appendChild(linkBlock);

        // Lógica del toggle
        let collabActive = false;
        const buildLink = () => {
            const proto = window.location.protocol === "https:" ? "https:" : "http:";
            return `${proto}//${window.location.host}/editor/#${this.game.roomId || ""}`;
        };
        const applyCollabState = (active) => {
            statusDot.style.background = active ? "#22c55e" : "#555";
            statusText.textContent = active ? "Colaborativo ACTIVO" : "Desactivado";
            statusText.style.color = active ? "#22c55e" : "#888";
            collabBtn.textContent = active ? "Cerrar Colaborativo" : "Abrir Colaborativo";
            collabBtn.style.background = active ? "#1d4d1d" : "#545454ff";
            collabBtn.onmouseout = () => collabBtn.style.background = active ? "#1d4d1d" : "#545454ff";
            linkBlock.style.display = active ? "flex" : "none";
        };

        collabBtn.onclick = () => {
            collabActive = !collabActive;
            if (this.game.networkManager) this.game.networkManager.collaborativeMode = collabActive;
            if (collabActive) linkInput.value = buildLink();
            applyCollabState(collabActive);
        };

        // Restaurar estado si ya estaba activo al re-abrir el panel
        if (this.game.networkManager && this.game.networkManager.collaborativeMode) {
            collabActive = true;
            linkInput.value = buildLink();
            applyCollabState(true);
        }

        leftColumn.appendChild(saveSection);
        leftColumn.appendChild(loadSection);
        leftColumn.appendChild(collabSection);

        container.appendChild(leftColumn);
        container.appendChild(rightColumn);

        // Initial setup
        setTimeout(updateJson, 50);
    }

    renderLibraryGrid(container, items) {
        // Populate Grid
        items.forEach(item => {
            const card = document.createElement("div");
            card.draggable = true;
            card.style.cssText = `
                background: #333;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                cursor: pointer;
                transition: transform 0.1s;
                user-select: none;
            `;
            card.onmouseover = () => {
                if (this.selectedItem !== item) card.style.background = "#444";
                else card.style.background = "#555";
            };
            card.onmouseout = () => {
                if (this.selectedItem !== item) card.style.background = "#333";
                else card.style.background = "#555";
            };
            card.onclick = () => {
                // Update selection UI
                Array.from(container.children).forEach(c => c.style.border = "none");
                card.style.border = "2px solid #00FF00";
                this.selectItem(item);
            };

            const img = document.createElement("img");
            img.src = item.iconPath;
            img.style.width = "64px";
            img.style.height = "64px";
            img.style.objectFit = "contain";
            img.draggable = false;

            const lbl = document.createElement("span");
            lbl.textContent = item.name;
            lbl.style.fontSize = "12px";
            lbl.style.textAlign = "center";

            card.appendChild(img);
            card.appendChild(lbl);

            // Drag Events — Si el item seleccionado en el panel es este mismo, usamos el draft (con cambios del usuario).
            // Así se preservan las propiedades editadas en el panel derecho.
            card.addEventListener("dragstart", (e) => {
                if (this.currentDraftItem && this.currentDraftItem._baseId === item.id) {
                    // El usuario lo tiene seleccionado y editado → usar el draft
                    this.draggedItem = this.currentDraftItem;
                } else {
                    // No está seleccionado → clonar fresco para no mutar la librería
                    this.draggedItem = item.clone ? item.clone() : item;
                }
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/plain", "item");
            });

            container.appendChild(card);
        });
    }
    renderLogicLibraryGrid(container) {
        container.innerHTML = "";

        const groups = [
            {
                title: "Bases y Señales",
                types: ["spawn_point", "movement_controller", "interaction_button", "interactive_collision", "target", "gravity_sphere", "damage_controller"]
            },
            {
                title: "Camaras",
                types: ["logic_camera", "camera_panel"]
            },
            {
                title: "Pads y Zonas",
                types: ["impulse_jump", "impulse_lateral", "impulse_neon", "gravity_pad", "fuel_zone", "farming_zone"]
            }
        ];

        groups.forEach(group => {
            const items = this.logicItems.filter(item => group.types.includes(item.type));
            if (items.length === 0) return;

            const section = document.createElement("details");
            section.open = true;
            section.style.cssText = `
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 8px;
                padding: 10px;
            `;

            const summary = document.createElement("summary");
            summary.textContent = group.title;
            summary.style.cssText = `
                cursor: pointer;
                color: #fff;
                font-weight: bold;
                user-select: none;
                padding-bottom: 8px;
            `;

            const grid = document.createElement("div");
            grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                grid-auto-rows: 120px;
                gap: 10px;
            `;

            this.renderLibraryGrid(grid, items);
            section.appendChild(summary);
            section.appendChild(grid);
            container.appendChild(section);
        });
    }

    renderLibraryPanel(container) {
        // Placeholder State
        this.panelPlaceholder = document.createElement("div");
        this.panelPlaceholder.textContent = "Selecciona un elemento para editar";
        this.panelPlaceholder.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            text-align: center;
        `;

        // Editor State
        this.panelEditor = document.createElement("div");
        this.panelEditor.style.cssText = `
            display: none; /* Hidden init */
            flex-direction: column;
            gap: 15px;
            align-items: center;
            width: 100%;
        `;

        // 1. Title
        this.editorTitleContainer = document.createElement("div");
        this.editorTitleContainer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            border-bottom: 1px solid #444;
            padding-bottom: 10px;
            gap: 10px;
        `;

        this.editorTitle = document.createElement("h3");
        this.editorTitle.style.margin = "0";
        this.editorTitle.style.flex = "1";
        this.editorTitle.style.textAlign = "left";

        this.advancedConfigBtn = document.createElement("button");
        this.advancedConfigBtn.textContent = "Config. Avanzada";
        this.advancedConfigBtn.style.cssText = `
            background: #0078d7;
            color: white;
            border: none;
            padding: 7px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            display: none;
        `;
        this.advancedConfigBtn.onmouseover = () => this.advancedConfigBtn.style.background = "#005a9e";
        this.advancedConfigBtn.onmouseout = () => this.advancedConfigBtn.style.background = "#0078d7";
        this.advancedConfigBtn.onclick = () => {
            if (!this.advancedWeaponConfigPanel) {
                this.advancedWeaponConfigPanel = new AdvancedWeaponConfigPanel(this.game, this);
            }
            this.advancedWeaponConfigPanel.show(this.currentDraftItem);
        };

        this.editorTitleContainer.appendChild(this.editorTitle);
        this.editorTitleContainer.appendChild(this.advancedConfigBtn);

        // 2. Large Preview (Draggable)
        this.editorPreview = document.createElement("div");
        this.editorPreview.draggable = true;
        this.editorPreview.style.cssText = `
            width: 128px;
            height: 128px;
            background: #111;
            border: 2px dashed #444;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            transition: 0.2s;
        `;
        this.editorPreview.onmouseover = () => this.editorPreview.style.borderColor = "#fff";
        this.editorPreview.onmouseout = () => this.editorPreview.style.borderColor = "#444";

        this.editorImg = document.createElement("img");
        this.editorImg.style.width = "100%";
        this.editorImg.style.height = "100%";
        this.editorImg.style.objectFit = "contain";
        this.editorImg.draggable = false;

        this.editorPreview.appendChild(this.editorImg);

        // Drag Logic for Custom Item
        this.editorPreview.addEventListener("dragstart", (e) => {
            if (this.currentDraftItem) {
                this.draggedItem = this.currentDraftItem;
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/plain", "item");
            }
        });

        // 3. Color Controls Setup
        const controlsContainer = document.createElement("div");
        controlsContainer.style.width = "100%";
        controlsContainer.style.display = "flex";
        controlsContainer.style.flexDirection = "column";
        controlsContainer.style.gap = "10px";

        // Color Picker Row
        const pickerRow = document.createElement("div");
        pickerRow.style.display = "flex";
        pickerRow.style.alignItems = "center";
        pickerRow.style.justifyContent = "space-between";

        const pickerLabel = document.createElement("span");
        pickerLabel.textContent = "Color:";

        this.colorPicker = document.createElement("input");
        this.colorPicker.type = "color";
        this.colorPicker.style.border = "none";
        this.colorPicker.style.width = "40px";
        this.colorPicker.style.height = "40px";
        this.colorPicker.style.cursor = "pointer";
        this.colorPicker.style.backgroundColor = "transparent";
        this.colorPicker.addEventListener("input", (e) => {
            this.updateDraftColor(e.target.value);
        });

        pickerRow.appendChild(pickerLabel);
        pickerRow.appendChild(this.colorPicker);
        controlsContainer.appendChild(pickerRow);

        // Opacity Control Row
        const opacityRow = document.createElement("div");
        opacityRow.style.display = "flex";
        opacityRow.style.alignItems = "center";
        opacityRow.style.justifyContent = "space-between";

        const opacityLabel = document.createElement("span");
        opacityLabel.textContent = "Opacidad (%):";

        this.opacityInput = document.createElement("input");
        this.opacityInput.type = "number";
        this.opacityInput.min = "0";
        this.opacityInput.max = "100";
        this.opacityInput.value = "100";
        this.opacityInput.style.width = "50px";
        this.opacityInput.style.background = "#333";
        this.opacityInput.style.color = "white";
        this.opacityInput.style.border = "1px solid #555";
        this.opacityInput.style.borderRadius = "4px";
        this.opacityInput.style.padding = "4px";

        this.opacityInput.addEventListener("input", (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 100;
            if (val < 0) val = 0;
            if (val > 100) val = 100;

            // Update Draft Item Opacity (0.0 - 1.0)
            this.updateDraftOpacity(val / 100.0);
        });

        opacityRow.appendChild(opacityLabel);
        opacityRow.appendChild(this.opacityInput);
        controlsContainer.appendChild(opacityRow);

        // Palette
        this.paletteContainer = document.createElement("div");
        this.paletteContainer.style.cssText = `
            display: flex; 
            flex-wrap: wrap; 
            gap: 5px; 
            justify-content: center;
            margin-top: 10px;
        `;
        const colors = [
            "#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF",
            "#FFFF00", "#00FFFF", "#FF00FF", "#FFA500", "#800080",
            "#40E0D0", "#FFC0CB", "#8B4513", "#808080"
        ];

        colors.forEach(c => {
            const swatch = document.createElement("div");
            swatch.style.cssText = `
                width: 24px; 
                height: 24px; 
                background-color: ${c}; 
                border-radius: 4px; 
                cursor: pointer; 
                border: 1px solid #555;
            `;
            swatch.onclick = () => {
                this.colorPicker.value = c; // Sync picker
                this.updateDraftColor(c);
            };
            this.paletteContainer.appendChild(swatch);
        });
        controlsContainer.appendChild(this.paletteContainer);

        // Add to panel
        this.panelEditor.appendChild(this.editorTitleContainer);
        this.panelEditor.appendChild(this.editorPreview);

        this.defaultEditorControlsSlot = document.createElement("div");
        this.defaultEditorControlsSlot.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        this.sectionedEditor = new SectionedItemEditor();
        this.sectionedEditor.setDetached(true);
        if (this.sectionRailWrapper) {
            this.sectionRailWrapper.appendChild(this.sectionedEditor.getRailElement());
        }

        this.panelEditor.appendChild(this.sectionedEditor.getContentElement());
        this.sectionedEditor.getContentElement().style.display = "none";
        this.panelEditor.appendChild(this.defaultEditorControlsSlot);

        this.defaultEditorControlsSlot.appendChild(controlsContainer);

        // 4. Texture Controls
        const textureContainer = document.createElement("div");
        textureContainer.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;

        const textureLabel = document.createElement("span");
        textureLabel.textContent = "Textura:";
        textureContainer.appendChild(textureLabel);

        const textureGrid = document.createElement("div");
        textureGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        `;

        // Texture Options
        const textures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "/assets/textures/obj/brick.png", img: "/assets/textures/obj/brick.png" },
            { name: "Concreto", path: "/assets/textures/obj/concrete.png", img: "/assets/textures/obj/concrete.png" },
            { name: "Madera", path: "/assets/textures/obj/wood.png", img: "/assets/textures/obj/wood.png" },
            { name: "Hierro", path: "/assets/textures/obj/hierro.png", img: "/assets/textures/obj/hierro.png" }
        ];

        textures.forEach(tex => {
            const btn = document.createElement("div");
            btn.className = "texture-btn";
            btn.title = tex.name;
            btn.style.cssText = `
                width: 100%;
                aspect-ratio: 1;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
                background-color: ${tex.color || "transparent"};
                background-image: ${tex.img ? `url(${tex.img})` : "none"};
                background-size: cover;
                background-position: center;
            `;
            btn.onclick = () => {
                this.updateDraftTexture(tex.path);
                // Highlight selection
                const allBtns = this.panelEditor.querySelectorAll(".texture-btn");
                allBtns.forEach(c => c.style.borderColor = "#555");
                btn.style.borderColor = "#00FF00";
            };
            textureGrid.appendChild(btn);
        });
        this.editorTextureGrid = textureGrid;
        textureContainer.appendChild(textureGrid);

        const customTextureTitle = document.createElement("span");
        customTextureTitle.textContent = "Tus texturas subidas:";
        customTextureTitle.style.cssText = "font-size: 12px; color: #aaa;";
        textureContainer.appendChild(customTextureTitle);

        const customTextureGrid = document.createElement("div");
        customTextureGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
            min-height: 32px;
        `;
        this.customTextureGrid = customTextureGrid;
        textureContainer.appendChild(customTextureGrid);
        this.renderCustomTextureButtons();

        // Upload Button
        const uploadRow = document.createElement("div");
        uploadRow.style.cssText = "display: flex; gap: 5px;";

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) {
                const originalText = uploadBtn.textContent;
                uploadBtn.textContent = "Subiendo...";
                uploadBtn.disabled = true;
                try {
                    const asset = await uploadAsset(file, {
                        kind: "TEXTURE",
                        visibility: "UNLISTED",
                        name: file.name,
                        metadata: { source: "construction-menu" }
                    });
                    this.updateDraftTexture(asset.fileUrl, asset.id);
                    this.customTextureAssets = [asset, ...(this.customTextureAssets || []).filter((item) => item.id !== asset.id)];
                    this.renderCustomTextureButtons();
                    uploadBtn.textContent = "Textura Cargada";
                    uploadBtn.style.color = "#00FF00";

                    const allBtns = this.panelEditor.querySelectorAll(".texture-btn");
                    allBtns.forEach(c => c.style.borderColor = "#555");
                } catch (err) {
                    console.error("No se pudo subir la textura", err);
                    alert(err instanceof Error ? err.message : "No se pudo subir la textura");
                    uploadBtn.textContent = originalText;
                    uploadBtn.style.color = "white";
                } finally {
                    uploadBtn.disabled = false;
                    fileInput.value = "";
                }
            }
        });

        const uploadBtn = document.createElement("button");
        uploadBtn.id = "texture-upload-btn";
        uploadBtn.textContent = "Subir Textura Personal";
        uploadBtn.style.cssText = `
            flex: 1;
            background: #444;
            color: white;
            border: none;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        uploadBtn.onclick = () => fileInput.click();

        uploadRow.appendChild(fileInput);
        uploadRow.appendChild(uploadBtn);
        textureContainer.appendChild(uploadRow);

        const textureSettingsPanel = document.createElement("div");
        textureSettingsPanel.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: rgba(255,255,255,0.04);
            border: 1px solid #333;
            border-radius: 6px;
            padding: 10px;
        `;

        const textureSettingsTitle = document.createElement("span");
        textureSettingsTitle.textContent = "Ajuste de textura";
        textureSettingsTitle.style.cssText = "font-size: 12px; color: #ddd; font-weight: 700;";
        textureSettingsPanel.appendChild(textureSettingsTitle);

        const modeRow = document.createElement("div");
        modeRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 8px;";
        const modeLabel = document.createElement("span");
        modeLabel.textContent = "Modo";
        modeLabel.style.cssText = "font-size: 11px; color: #aaa;";
        const modeSelect = document.createElement("select");
        modeSelect.style.cssText = "width: 135px; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:4px;";
        modeSelect.innerHTML = `
            <option value="auto">Repetir por tamaño</option>
            <option value="stretch">Estirar por cara</option>
        `;
        modeSelect.onchange = (e) => this.updateDraftTextureSetting("fitMode", e.target.value);
        this.textureFitModeSelect = modeSelect;
        modeRow.appendChild(modeLabel);
        modeRow.appendChild(modeSelect);
        textureSettingsPanel.appendChild(modeRow);

        const textureSettingsGrid = document.createElement("div");
        textureSettingsGrid.style.cssText = "display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;";
        const makeTextureInput = (key, label, step, min = null) => {
            const wrap = document.createElement("label");
            wrap.style.cssText = "display:flex; flex-direction:column; gap:3px; font-size:10px; color:#aaa;";
            const input = document.createElement("input");
            input.type = "number";
            input.step = String(step);
            if (min !== null) input.min = String(min);
            input.style.cssText = "width:100%; box-sizing:border-box; background:#222; color:white; border:1px solid #444; border-radius:4px; padding:4px;";
            input.onchange = (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) this.updateDraftTextureSetting(key, value);
            };
            wrap.textContent = label;
            wrap.appendChild(input);
            this[`textureSettingInput_${key}`] = input;
            return wrap;
        };
        textureSettingsGrid.appendChild(makeTextureInput("tileSize", "Tamaño baldosa", 0.25, 0.1));
        textureSettingsGrid.appendChild(makeTextureInput("repeatX", "Repetir U", 0.25, 0.05));
        textureSettingsGrid.appendChild(makeTextureInput("repeatY", "Repetir V", 0.25, 0.05));
        textureSettingsGrid.appendChild(makeTextureInput("rotation", "Rotación", 5));
        textureSettingsGrid.appendChild(makeTextureInput("offsetX", "Mover U", 0.05));
        textureSettingsGrid.appendChild(makeTextureInput("offsetY", "Mover V", 0.05));
        textureSettingsPanel.appendChild(textureSettingsGrid);

        const patternVariationRow = document.createElement("label");
        patternVariationRow.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px; color:#ddd; cursor:pointer;";
        const patternVariationText = document.createElement("span");
        patternVariationText.textContent = "Variar patrón por bloque";
        const patternVariationInput = document.createElement("input");
        patternVariationInput.type = "checkbox";
        patternVariationInput.onchange = (e) => this.updateDraftTextureSetting("patternVariation", e.target.checked);
        this.textureSettingInput_patternVariation = patternVariationInput;
        patternVariationRow.appendChild(patternVariationText);
        patternVariationRow.appendChild(patternVariationInput);
        textureSettingsPanel.appendChild(patternVariationRow);

        textureContainer.appendChild(textureSettingsPanel);

        this.defaultEditorControlsSlot.appendChild(textureContainer);

        // 5. Dimension Controls
        const dimContainer = document.createElement("div");
        dimContainer.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;
        const dimLabel = document.createElement("span");
        dimLabel.textContent = "Dimensiones (X, Y, Z):";
        dimContainer.appendChild(dimLabel);

        const dimRow = document.createElement("div");
        dimRow.style.cssText = "display: flex; gap: 5px;";

        const createDimInput = (axis, label) => {
            const container = document.createElement("div");
            container.style.cssText = "flex: 1; display: flex; flex-direction: column; gap: 2px;";

            const lbl = document.createElement("span");
            lbl.textContent = label;
            lbl.style.fontSize = "10px";
            lbl.style.color = "#aaa";

            const input = document.createElement("input");
            input.type = "number";
            input.step = "0.5";
            input.min = "0.1";
            input.style.width = "100%";
            input.style.backgroundColor = "#333";
            input.style.color = "white";
            input.style.border = "1px solid #555";
            input.style.borderRadius = "4px";
            input.style.padding = "4px";
            input.onchange = (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                    this.updateDraftScale(axis, val);
                }
            };
            // Store ref to update later
            this[`inputDim${axis}`] = input;

            container.appendChild(lbl);
            container.appendChild(input);
            return container;
        };

        dimRow.appendChild(createDimInput("x", "Ancho"));
        dimRow.appendChild(createDimInput("y", "Alto"));
        dimRow.appendChild(createDimInput("z", "Prof."));

        dimContainer.appendChild(dimRow);

        // Radius row
        const radiusRow = document.createElement("div");
        radiusRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const radiusLbl = document.createElement("span");
        radiusLbl.textContent = "Radio:";
        radiusLbl.style.fontSize = "12px";
        radiusLbl.style.color = "#aaa";
        const radiusInput = document.createElement("input");
        radiusInput.type = "number";
        radiusInput.step = "0.5";
        radiusInput.min = "0.1";
        radiusInput.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        radiusInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.radius = val;
                    if (this.currentDraftItem.type === "sphere") {
                        this.currentDraftItem.scale.x = val * 2;
                        this.currentDraftItem.scale.y = val * 2;
                        this.currentDraftItem.scale.z = val * 2;
                    } else if (this.currentDraftItem.type === "circle") {
                        this.currentDraftItem.scale.x = val * 2;
                        this.currentDraftItem.scale.z = val * 2;
                    } else if (this.currentDraftItem.type === "cylinder" || this.currentDraftItem.type === "tube" || this.currentDraftItem.type === "cone") {
                        this.currentDraftItem.scale.x = val * 2;
                        this.currentDraftItem.scale.z = val * 2;
                    }
                }
            }
        });
        radiusRow.appendChild(radiusLbl);
        radiusRow.appendChild(radiusInput);
        this.inputRadius = radiusInput;
        this.rowRadius = radiusRow;
        dimContainer.appendChild(radiusRow);

        // Length 1 (Height) row
        const length1Row = document.createElement("div");
        length1Row.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const length1Lbl = document.createElement("span");
        length1Lbl.textContent = "Largo 1 (Alto):";
        length1Lbl.style.fontSize = "12px";
        length1Lbl.style.color = "#aaa";
        const length1Input = document.createElement("input");
        length1Input.type = "number";
        length1Input.step = "0.5";
        length1Input.min = "0.1";
        length1Input.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        length1Input.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.y = val;
                }
            }
        });
        length1Row.appendChild(length1Lbl);
        length1Row.appendChild(length1Input);
        this.inputLength1 = length1Input;
        this.rowLength1 = length1Row;
        dimContainer.appendChild(length1Row);

        // Length 2 row
        const length2Row = document.createElement("div");
        length2Row.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const length2Lbl = document.createElement("span");
        length2Lbl.textContent = "Largo 2:";
        length2Lbl.style.fontSize = "12px";
        length2Lbl.style.color = "#aaa";
        const length2Input = document.createElement("input");
        length2Input.type = "number";
        length2Input.step = "0.5";
        length2Input.min = "0.1";
        length2Input.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        length2Input.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.length2 = val;
                }
            }
        });
        length2Row.appendChild(length2Lbl);
        length2Row.appendChild(length2Input);
        this.inputLength2 = length2Input;
        this.rowLength2 = length2Row;
        dimContainer.appendChild(length2Row);

        // Bend Angle X row
        const bendXRow = document.createElement("div");
        bendXRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const bendXLbl = document.createElement("span");
        bendXLbl.textContent = "Doblez Ángulo X (°):";
        bendXLbl.style.fontSize = "12px";
        bendXLbl.style.color = "#aaa";
        const bendXInput = document.createElement("input");
        bendXInput.type = "number";
        bendXInput.step = "15";
        bendXInput.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        bendXInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.bendAngleX = val;
                }
            }
        });
        bendXRow.appendChild(bendXLbl);
        bendXRow.appendChild(bendXInput);
        this.inputBendAngleX = bendXInput;
        this.rowBendAngleX = bendXRow;
        dimContainer.appendChild(bendXRow);

        // Bend Angle Y row
        const bendYRow = document.createElement("div");
        bendYRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const bendYLbl = document.createElement("span");
        bendYLbl.textContent = "Doblez Ángulo Y (°):";
        bendYLbl.style.fontSize = "12px";
        bendYLbl.style.color = "#aaa";
        const bendYInput = document.createElement("input");
        bendYInput.type = "number";
        bendYInput.step = "15";
        bendYInput.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        bendYInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.bendAngleY = val;
                }
            }
        });
        bendYRow.appendChild(bendYLbl);
        bendYRow.appendChild(bendYInput);
        this.inputBendAngleY = bendYInput;
        this.rowBendAngleY = bendYRow;
        dimContainer.appendChild(bendYRow);

        // Spike Radius row
        const spikeRadiusRow = document.createElement("div");
        spikeRadiusRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const spikeRadiusLbl = document.createElement("span");
        spikeRadiusLbl.textContent = "Radio Pinchos:";
        spikeRadiusLbl.style.fontSize = "12px";
        spikeRadiusLbl.style.color = "#aaa";
        const spikeRadiusInput = document.createElement("input");
        spikeRadiusInput.type = "number";
        spikeRadiusInput.step = "0.05";
        spikeRadiusInput.min = "0.01";
        spikeRadiusInput.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        spikeRadiusInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.spikeRadius = val;
                }
            }
        });
        spikeRadiusRow.appendChild(spikeRadiusLbl);
        spikeRadiusRow.appendChild(spikeRadiusInput);
        this.inputSpikeRadius = spikeRadiusInput;
        this.rowSpikeRadius = spikeRadiusRow;
        dimContainer.appendChild(spikeRadiusRow);

        // Spike Height row
        const spikeHeightRow = document.createElement("div");
        spikeHeightRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const spikeHeightLbl = document.createElement("span");
        spikeHeightLbl.textContent = "Alto Pinchos:";
        spikeHeightLbl.style.fontSize = "12px";
        spikeHeightLbl.style.color = "#aaa";
        const spikeHeightInput = document.createElement("input");
        spikeHeightInput.type = "number";
        spikeHeightInput.step = "0.05";
        spikeHeightInput.min = "0.01";
        spikeHeightInput.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        spikeHeightInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.spikeHeight = val;
                }
            }
        });
        spikeHeightRow.appendChild(spikeHeightLbl);
        spikeHeightRow.appendChild(spikeHeightInput);
        this.inputSpikeHeight = spikeHeightInput;
        this.rowSpikeHeight = spikeHeightRow;
        dimContainer.appendChild(spikeHeightRow);

        // Spike Spacing row
        const spikeSpacingRow = document.createElement("div");
        spikeSpacingRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px;";
        const spikeSpacingLbl = document.createElement("span");
        spikeSpacingLbl.textContent = "Separación Pinchos:";
        spikeSpacingLbl.style.fontSize = "12px";
        spikeSpacingLbl.style.color = "#aaa";
        const spikeSpacingInput = document.createElement("input");
        spikeSpacingInput.type = "number";
        spikeSpacingInput.step = "0.05";
        spikeSpacingInput.min = "0.05";
        spikeSpacingInput.style.cssText = "width: 80px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px;";
        spikeSpacingInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                if (this.currentDraftItem) {
                    this.currentDraftItem.scale.spikeSpacing = val;
                }
            }
        });
        spikeSpacingRow.appendChild(spikeSpacingLbl);
        spikeSpacingRow.appendChild(spikeSpacingInput);
        this.inputSpikeSpacing = spikeSpacingInput;
        this.rowSpikeSpacing = spikeSpacingRow;
        dimContainer.appendChild(spikeSpacingRow);

        this.defaultEditorControlsSlot.appendChild(dimContainer);

        // --- NEW: Weapon Controls
        const weaponControlsContainer = document.createElement("div");
        weaponControlsContainer.style.cssText = `
            width: 100%;
            display: none;
            flex-direction: column;
            gap: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;

        const damageRow = document.createElement("div");
        damageRow.style.display = "flex";
        damageRow.style.alignItems = "center";
        damageRow.style.justifyContent = "space-between";

        const damageLabel = document.createElement("span");
        damageLabel.textContent = "Daño:";

        this.damageInput = document.createElement("input");
        this.damageInput.type = "number";
        this.damageInput.min = "0";
        this.damageInput.style.cssText = `
            width: 50px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        this.damageInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.damage = val;
            }
        });

        damageRow.appendChild(damageLabel);
        damageRow.appendChild(this.damageInput);

        const cooldownRow = document.createElement("div");
        cooldownRow.style.display = "flex";
        cooldownRow.style.alignItems = "center";
        cooldownRow.style.justifyContent = "space-between";

        const cooldownLabel = document.createElement("span");
        cooldownLabel.textContent = "Tiempo de Recarga (s):";

        this.cooldownInput = document.createElement("input");
        this.cooldownInput.type = "number";
        this.cooldownInput.step = "0.1";
        this.cooldownInput.min = "0";
        this.cooldownInput.style.cssText = this.damageInput.style.cssText;

        this.cooldownInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.cooldown = val;
            }
        });

        cooldownRow.appendChild(cooldownLabel);
        cooldownRow.appendChild(this.cooldownInput);

        const handRow = document.createElement("div");
        handRow.style.display = "flex";
        handRow.style.alignItems = "center";
        handRow.style.justifyContent = "space-between";

        const handLabel = document.createElement("span");
        handLabel.textContent = "Mano Equipada:";

        this.handSelect = document.createElement("select");
        this.handSelect.style.cssText = `
            width: 100px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        const optionRight = document.createElement("option");
        optionRight.value = "right";
        optionRight.textContent = "Derecha";
        const optionLeft = document.createElement("option");
        optionLeft.value = "left";
        optionLeft.textContent = "Izquierda";

        this.handSelect.appendChild(optionRight);
        this.handSelect.appendChild(optionLeft);

        this.handSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.equippedHand = e.target.value;
            }
        });

        handRow.appendChild(handLabel);
        handRow.appendChild(this.handSelect);

        // --- Max Scope Row ---
        const maxScopeRow = document.createElement("div");
        maxScopeRow.style.display = "flex";
        maxScopeRow.style.alignItems = "center";
        maxScopeRow.style.justifyContent = "space-between";

        const maxScopeLabel = document.createElement("span");
        maxScopeLabel.textContent = "Nivel de Mira (Scope):";

        this.maxScopeSelect = document.createElement("select");
        this.maxScopeSelect.style.cssText = this.handSelect.style.cssText;

        [
            { value: 1, text: "Ninguno (1x)" },
            { value: 2, text: "Mira Corta (x2)" },
            { value: 4, text: "Mira Media (x4)" },
            { value: 5, text: "Mira Media-Alta (x5)" },
            { value: 8, text: "Mira Larga (x8)" },
            { value: 10, text: "Mira Francotirador (x10)" },
            { value: 16, text: "Mira Avanzada (x16)" }
        ].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt.value;
            el.textContent = opt.text;
            this.maxScopeSelect.appendChild(el);
        });

        this.maxScopeSelect.addEventListener("change", (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.maxScope = val;
            }
        });

        maxScopeRow.appendChild(maxScopeLabel);
        maxScopeRow.appendChild(this.maxScopeSelect);

        // --- Recoil Row ---
        const recoilRow = document.createElement("div");
        recoilRow.style.display = "flex";
        recoilRow.style.alignItems = "center";
        recoilRow.style.justifyContent = "space-between";

        const recoilLabel = document.createElement("span");
        recoilLabel.textContent = "Retroceso:";

        this.recoilInput = document.createElement("input");
        this.recoilInput.type = "number";
        this.recoilInput.min = "0";
        this.recoilInput.step = "0.5";
        this.recoilInput.style.cssText = `
            width: 60px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;
        this.recoilInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.recoil = val;
            }
        });

        recoilRow.appendChild(recoilLabel);
        recoilRow.appendChild(this.recoilInput);

        // --- Recoil Mode Row ---
        const recoilModeRow = document.createElement("div");
        recoilModeRow.style.display = "flex";
        recoilModeRow.style.alignItems = "center";
        recoilModeRow.style.justifyContent = "space-between";

        const recoilModeLabel = document.createElement("span");
        recoilModeLabel.textContent = "Modo Retroceso:";

        this.recoilModeSelect = document.createElement("select");
        this.recoilModeSelect.style.cssText = `
            width: 100px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        const optionHybrid = document.createElement("option");
        optionHybrid.value = "hybrid";
        optionHybrid.textContent = "Híbrido";
        const optionRecenter = document.createElement("option");
        optionRecenter.value = "recenter";
        optionRecenter.textContent = "Auto-Centrado";
        const optionManual = document.createElement("option");
        optionManual.value = "manual";
        optionManual.textContent = "Manual";

        this.recoilModeSelect.appendChild(optionHybrid);
        this.recoilModeSelect.appendChild(optionRecenter);
        this.recoilModeSelect.appendChild(optionManual);

        this.recoilModeSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.recoilMode = e.target.value;
            }
        });

        recoilModeRow.appendChild(recoilModeLabel);
        recoilModeRow.appendChild(this.recoilModeSelect);

        // --- Auto-Fire Row ---
        const autoRow = document.createElement("div");
        autoRow.style.display = "flex";
        autoRow.style.alignItems = "center";
        autoRow.style.justifyContent = "space-between";

        const autoLabel = document.createElement("span");
        autoLabel.textContent = "Automático:";

        this.autoInput = document.createElement("input");
        this.autoInput.type = "checkbox";
        this.autoInput.style.cssText = `
            cursor: pointer;
            width: 18px;
            height: 18px;
        `;
        this.autoInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.isAuto = e.target.checked;
            }
        });

        autoRow.appendChild(autoLabel);
        autoRow.appendChild(this.autoInput);

        // --- Shot Speed Row ---
        const speedRow = document.createElement("div");
        speedRow.style.display = "flex";
        speedRow.style.alignItems = "center";
        speedRow.style.justifyContent = "space-between";

        const speedLabel = document.createElement("span");
        speedLabel.textContent = "Velocidad de Disparo:";

        this.speedInput = document.createElement("input");
        this.speedInput.type = "number";
        this.speedInput.min = "1";
        this.speedInput.step = "5";
        this.speedInput.style.cssText = this.recoilInput.style.cssText;
        this.speedInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.shotSpeed = val;
            }
        });

        speedRow.appendChild(speedLabel);
        speedRow.appendChild(this.speedInput);

        // --- Bullet Drop Row ---
        const dropRow = document.createElement("div");
        dropRow.style.display = "flex";
        dropRow.style.alignItems = "center";
        dropRow.style.justifyContent = "space-between";

        const dropLabel = document.createElement("span");
        dropLabel.textContent = "Gravedad (Caída):";

        this.dropInput = document.createElement("input");
        this.dropInput.type = "number";
        this.dropInput.step = "0.1";
        this.dropInput.style.cssText = this.recoilInput.style.cssText;
        this.dropInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.bulletDrop = val;
            }
        });

        dropRow.appendChild(dropLabel);
        dropRow.appendChild(this.dropInput);

        // --- Projectile Type Row ---
        const projectileTypeRow = document.createElement("div");
        projectileTypeRow.style.display = "flex";
        projectileTypeRow.style.alignItems = "center";
        projectileTypeRow.style.justifyContent = "space-between";

        const projectileTypeLabel = document.createElement("span");
        projectileTypeLabel.textContent = "Tipo de Proyectil:";

        this.projectileTypeSelect = document.createElement("select");
        this.projectileTypeSelect.style.cssText = `
            width: 100px;
            background: #333;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px;
        `;

        const optionBullet = document.createElement("option");
        optionBullet.value = "bullet";
        optionBullet.textContent = "Bala";
        const optionBall = document.createElement("option");
        optionBall.value = "ball";
        optionBall.textContent = "Pelota";

        this.projectileTypeSelect.appendChild(optionBullet);
        this.projectileTypeSelect.appendChild(optionBall);

        this.projectileTypeSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.projectileType = e.target.value;
            }
        });

        projectileTypeRow.appendChild(projectileTypeLabel);
        projectileTypeRow.appendChild(this.projectileTypeSelect);

        // --- Tracer Row ---
        const tracerRow = document.createElement("div");
        tracerRow.style.display = "flex";
        tracerRow.style.alignItems = "center";
        tracerRow.style.justifyContent = "space-between";

        const tracerLabel = document.createElement("span");
        tracerLabel.textContent = "Estela de Humo:";

        this.tracerInput = document.createElement("input");
        this.tracerInput.type = "checkbox";
        this.tracerInput.style.cssText = this.autoInput.style.cssText;
        this.tracerInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.hasTracer = e.target.checked;
            }
        });

        tracerRow.appendChild(tracerLabel);
        tracerRow.appendChild(this.tracerInput);

        // --- Trajectory Line Row ---
        const trajectoryRow = document.createElement("div");
        trajectoryRow.style.display = "flex";
        trajectoryRow.style.alignItems = "center";
        trajectoryRow.style.justifyContent = "space-between";

        const trajectoryLabel = document.createElement("span");
        trajectoryLabel.textContent = "Línea de Trayectoria (Roja):";

        this.trajectoryInput = document.createElement("input");
        this.trajectoryInput.type = "checkbox";
        this.trajectoryInput.style.cssText = this.autoInput.style.cssText;
        this.trajectoryInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.hasTrajectoryLine = e.target.checked;
            }
        });

        trajectoryRow.appendChild(trajectoryLabel);
        trajectoryRow.appendChild(this.trajectoryInput);

        // --- Rebote Row ---
        const reboteRow = document.createElement("div");
        reboteRow.style.display = "flex";
        reboteRow.style.alignItems = "center";
        reboteRow.style.justifyContent = "space-between";

        const reboteLabel = document.createElement("span");
        reboteLabel.textContent = "Rebote al chocar:";

        this.reboteInput = document.createElement("input");
        this.reboteInput.type = "checkbox";
        this.reboteInput.style.cssText = this.autoInput.style.cssText;
        this.reboteInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.rebote = e.target.checked;
            }
        });

        reboteRow.appendChild(reboteLabel);
        reboteRow.appendChild(this.reboteInput);

        // --- Impact Effect Row ---
        const impactRow = document.createElement("div");
        impactRow.style.display = "flex";
        impactRow.style.alignItems = "center";
        impactRow.style.justifyContent = "space-between";

        const impactLabel = document.createElement("span");
        impactLabel.textContent = "Impacto (Humo):";

        this.impactInput = document.createElement("input");
        this.impactInput.type = "checkbox";
        this.impactInput.style.cssText = this.autoInput.style.cssText;
        this.impactInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.hasImpactEffect = e.target.checked;
            }
        });

        impactRow.appendChild(impactLabel);
        impactRow.appendChild(this.impactInput);

        // --- Custom Tracer VFX Row ---
        const customTracerRow = document.createElement("div");
        customTracerRow.style.display = "flex";
        customTracerRow.style.alignItems = "center";
        customTracerRow.style.justifyContent = "space-between";

        const customTracerLabel = document.createElement("span");
        customTracerLabel.textContent = "Estela Especial VFX:";

        this.customTracerSelect = document.createElement("select");
        this.customTracerSelect.style.cssText = this.projectileTypeSelect.style.cssText;

        ["Ninguno", "Bubble Explosion", "Cartoon Bang", "Cartoon Blue Flamethrower", "Dollar Bill Shower", "Cartoon Lightning Ball", "Cartoon Blood Splash", "Cartoon Fireball Explosion", "Cartoon Purple Lightning", "Explosión de Gas Azul"].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            this.customTracerSelect.appendChild(el);
        });

        this.customTracerSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.customTracerVFX = e.target.value;
            }
        });

        customTracerRow.appendChild(customTracerLabel);
        customTracerRow.appendChild(this.customTracerSelect);

        // --- Tracer Destroy On Collision Row ---
        const tracerDestroyRow = document.createElement("div");
        tracerDestroyRow.style.display = "flex";
        tracerDestroyRow.style.alignItems = "center";
        tracerDestroyRow.style.justifyContent = "space-between";

        const tracerDestroyLabel = document.createElement("span");
        tracerDestroyLabel.textContent = "Eliminar al colisionar:";

        this.tracerDestroyInput = document.createElement("input");
        this.tracerDestroyInput.type = "checkbox";
        this.tracerDestroyInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.tracerDestroyOnCollision = e.target.checked;
            }
        });

        tracerDestroyRow.appendChild(tracerDestroyLabel);
        tracerDestroyRow.appendChild(this.tracerDestroyInput);

        // --- Tracer Stay Forever Row ---
        const tracerStayForeverRow = document.createElement("div");
        tracerStayForeverRow.style.display = "flex";
        tracerStayForeverRow.style.alignItems = "center";
        tracerStayForeverRow.style.justifyContent = "space-between";

        const tracerStayForeverLabel = document.createElement("span");
        tracerStayForeverLabel.textContent = "Permanecer para siempre:";

        this.tracerStayForeverInput = document.createElement("input");
        this.tracerStayForeverInput.type = "checkbox";
        this.tracerStayForeverInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.tracerStayForever = e.target.checked;
            }
        });

        tracerStayForeverRow.appendChild(tracerStayForeverLabel);
        tracerStayForeverRow.appendChild(this.tracerStayForeverInput);

        // --- Tracer Collision VFX Row ---
        const tracerCollisionRow = document.createElement("div");
        tracerCollisionRow.style.display = "flex";
        tracerCollisionRow.style.alignItems = "center";
        tracerCollisionRow.style.justifyContent = "space-between";

        const tracerCollisionLabel = document.createElement("span");
        tracerCollisionLabel.textContent = "Efecto VFX al colisionar:";

        this.tracerCollisionSelect = document.createElement("select");
        this.tracerCollisionSelect.style.cssText = this.projectileTypeSelect.style.cssText;

        ["Ninguno", "Bubble Explosion", "Cartoon Bang", "Dollar Bill Shower", "Cartoon Blood Splash", "Cartoon Fireball Explosion", "Cartoon Purple Lightning", "Explosión de Gas Azul"].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            this.tracerCollisionSelect.appendChild(el);
        });

        this.tracerCollisionSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.tracerCollisionVFX = e.target.value;
            }
        });

        tracerCollisionRow.appendChild(tracerCollisionLabel);
        tracerCollisionRow.appendChild(this.tracerCollisionSelect);

        // --- Custom Impact VFX Row ---
        const customImpactRow = document.createElement("div");
        customImpactRow.style.display = "flex";
        customImpactRow.style.alignItems = "center";
        customImpactRow.style.justifyContent = "space-between";

        const customImpactLabel = document.createElement("span");
        customImpactLabel.textContent = "Impacto Especial VFX:";

        this.customImpactSelect = document.createElement("select");
        this.customImpactSelect.style.cssText = this.projectileTypeSelect.style.cssText;

        ["Ninguno", "Bubble Explosion", "Cartoon Bang", "Dollar Bill Shower", "Cartoon Blood Splash", "Cartoon Fireball Explosion", "Cartoon Purple Lightning", "Explosión de Gas Azul"].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            this.customImpactSelect.appendChild(el);
        });

        this.customImpactSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.customImpactVFX = e.target.value;
            }
        });

        // --- Player Impulse Up Checkbox Row ---
        const playerImpulseUpRow = document.createElement("div");
        playerImpulseUpRow.style.display = "flex";
        playerImpulseUpRow.style.alignItems = "center";
        playerImpulseUpRow.style.justifyContent = "space-between";

        const playerImpulseUpLabel = document.createElement("span");
        playerImpulseUpLabel.textContent = "Habilitar Salto Cohete (Abajo):";

        this.playerImpulseUpInput = document.createElement("input");
        this.playerImpulseUpInput.type = "checkbox";
        this.playerImpulseUpInput.style.cssText = this.autoInput.style.cssText;
        this.playerImpulseUpInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.hasPlayerImpulseUp = e.target.checked;
            }
        });

        playerImpulseUpRow.appendChild(playerImpulseUpLabel);
        playerImpulseUpRow.appendChild(this.playerImpulseUpInput);

        // --- Player Impulse Up Force Row ---
        const playerImpulseUpForceRow = document.createElement("div");
        playerImpulseUpForceRow.style.display = "flex";
        playerImpulseUpForceRow.style.alignItems = "center";
        playerImpulseUpForceRow.style.justifyContent = "space-between";

        const playerImpulseUpForceLabel = document.createElement("span");
        playerImpulseUpForceLabel.textContent = "Fuerza Salto Cohete:";

        this.playerImpulseUpForceInput = document.createElement("input");
        this.playerImpulseUpForceInput.type = "number";
        this.playerImpulseUpForceInput.step = "1.0";
        this.playerImpulseUpForceInput.style.cssText = this.recoilInput.style.cssText;
        this.playerImpulseUpForceInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.playerImpulseUpForce = val;
            }
        });

        playerImpulseUpForceRow.appendChild(playerImpulseUpForceLabel);
        playerImpulseUpForceRow.appendChild(this.playerImpulseUpForceInput);

        // --- Player Impulse Up Air Reduction Row ---
        const playerImpulseUpAirRedRow = document.createElement("div");
        playerImpulseUpAirRedRow.style.display = "flex";
        playerImpulseUpAirRedRow.style.alignItems = "center";
        playerImpulseUpAirRedRow.style.justifyContent = "space-between";

        const playerImpulseUpAirRedLabel = document.createElement("span");
        playerImpulseUpAirRedLabel.textContent = "Reducción en el Aire (%):";

        this.playerImpulseUpAirRedInput = document.createElement("input");
        this.playerImpulseUpAirRedInput.type = "number";
        this.playerImpulseUpAirRedInput.step = "1.0";
        this.playerImpulseUpAirRedInput.min = "0.0";
        this.playerImpulseUpAirRedInput.max = "100.0";
        this.playerImpulseUpAirRedInput.style.cssText = this.recoilInput.style.cssText;
        this.playerImpulseUpAirRedInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.playerImpulseUpAirReduction = val;
            }
        });

        playerImpulseUpAirRedRow.appendChild(playerImpulseUpAirRedLabel);
        playerImpulseUpAirRedRow.appendChild(this.playerImpulseUpAirRedInput);

        // --- Player Impulse Back Checkbox Row ---
        const playerImpulseBackRow = document.createElement("div");
        playerImpulseBackRow.style.display = "flex";
        playerImpulseBackRow.style.alignItems = "center";
        playerImpulseBackRow.style.justifyContent = "space-between";

        const playerImpulseBackLabel = document.createElement("span");
        playerImpulseBackLabel.textContent = "Habilitar Empuje Atrás (Frente):";

        this.playerImpulseBackInput = document.createElement("input");
        this.playerImpulseBackInput.type = "checkbox";
        this.playerImpulseBackInput.style.cssText = this.autoInput.style.cssText;
        this.playerImpulseBackInput.addEventListener("change", (e) => {
            if (this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.hasPlayerImpulseBack = e.target.checked;
            }
        });

        playerImpulseBackRow.appendChild(playerImpulseBackLabel);
        playerImpulseBackRow.appendChild(this.playerImpulseBackInput);

        // --- Player Impulse Back Force Row ---
        const playerImpulseBackForceRow = document.createElement("div");
        playerImpulseBackForceRow.style.display = "flex";
        playerImpulseBackForceRow.style.alignItems = "center";
        playerImpulseBackForceRow.style.justifyContent = "space-between";

        const playerImpulseBackForceLabel = document.createElement("span");
        playerImpulseBackForceLabel.textContent = "Fuerza Empuje Atrás:";

        this.playerImpulseBackForceInput = document.createElement("input");
        this.playerImpulseBackForceInput.type = "number";
        this.playerImpulseBackForceInput.step = "1.0";
        this.playerImpulseBackForceInput.style.cssText = this.recoilInput.style.cssText;
        this.playerImpulseBackForceInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem && this.currentDraftItem.type === "weapon") {
                this.currentDraftItem.playerImpulseBackForce = val;
            }
        });

        playerImpulseBackForceRow.appendChild(playerImpulseBackForceLabel);
        playerImpulseBackForceRow.appendChild(this.playerImpulseBackForceInput);

        weaponControlsContainer.appendChild(damageRow);
        weaponControlsContainer.appendChild(cooldownRow);
        weaponControlsContainer.appendChild(handRow);
        weaponControlsContainer.appendChild(maxScopeRow);
        weaponControlsContainer.appendChild(recoilRow);
        weaponControlsContainer.appendChild(recoilModeRow);
        weaponControlsContainer.appendChild(autoRow);
        weaponControlsContainer.appendChild(speedRow);
        weaponControlsContainer.appendChild(dropRow);
        weaponControlsContainer.appendChild(projectileTypeRow);
        weaponControlsContainer.appendChild(tracerRow);
        weaponControlsContainer.appendChild(trajectoryRow);
        weaponControlsContainer.appendChild(reboteRow);
        weaponControlsContainer.appendChild(impactRow);
        weaponControlsContainer.appendChild(customTracerRow);
        weaponControlsContainer.appendChild(tracerStayForeverRow);
        weaponControlsContainer.appendChild(tracerDestroyRow);
        weaponControlsContainer.appendChild(tracerCollisionRow);
        weaponControlsContainer.appendChild(customImpactRow);
        weaponControlsContainer.appendChild(playerImpulseUpRow);
        weaponControlsContainer.appendChild(playerImpulseUpForceRow);
        weaponControlsContainer.appendChild(playerImpulseUpAirRedRow);
        weaponControlsContainer.appendChild(playerImpulseBackRow);
        weaponControlsContainer.appendChild(playerImpulseBackForceRow);

        this.defaultEditorControlsSlot.appendChild(weaponControlsContainer);

        // --- NEW: Consumable Controls ---
        const consumableControlsContainer = document.createElement("div");
        consumableControlsContainer.style.cssText = `
            width: 100%;
            display: none;
            flex-direction: column;
            gap: 14px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;

        const createConsumableInputMix = (labelText, min, max, step, initialVal, onChange) => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; flex-direction: column; gap: 6px; text-align: left;";

            const header = document.createElement("div");
            header.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 2px;";

            let mode = "standard";

            const toggleBtn = document.createElement("button");
            toggleBtn.innerHTML = "&#9881;"; // Gear character ⚙
            toggleBtn.style.cssText = "background: none; border: 1px solid #555; color: #aaa; cursor: pointer; padding: 0; font-size: 11px; border-radius: 4px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; outline: none; transition: all 0.2s ease;";
            toggleBtn.title = "Alternar entre barra deslizadora y entrada numérica directa";

            const label = document.createElement("span");
            label.textContent = labelText;
            label.style.cssText = "font-size: 13px; color: #ccc;";

            header.appendChild(toggleBtn);
            header.appendChild(label);
            row.appendChild(header);

            const flexContainer = document.createElement("div");
            flexContainer.style.cssText = "display: flex; align-items: center; gap: 10px;";

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = String(min);
            slider.max = String(max);
            slider.step = String(step);
            slider.value = String(initialVal);
            slider.style.cssText = "flex: 1; cursor: pointer;";

            const numBox = document.createElement("input");
            numBox.type = "number";
            numBox.min = String(min);
            numBox.max = String(max);
            numBox.step = String(step);
            numBox.value = String(initialVal);
            numBox.style.cssText = "width: 70px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px 6px; font-size: 13px; text-align: center;";

            const updateView = () => {
                if (mode === "standard") {
                    slider.style.display = "block";
                    numBox.style.width = "70px";
                    toggleBtn.style.borderColor = "#555";
                    toggleBtn.style.color = "#aaa";
                    toggleBtn.innerHTML = "&#9881;"; // Gear
                } else {
                    slider.style.display = "none";
                    numBox.style.width = "100%"; // Take full width of the row when slider is hidden
                    toggleBtn.style.borderColor = "#44f";
                    toggleBtn.style.color = "#0ff";
                    toggleBtn.innerHTML = "&infin;"; // Infinity (Free text mode)
                }
            };

            toggleBtn.addEventListener("click", () => {
                mode = mode === "standard" ? "free" : "standard";
                updateView();
            });

            slider.addEventListener("input", (e: any) => {
                const val = parseFloat(e.target.value);
                numBox.value = String(val);
                onChange(val);
            });

            numBox.addEventListener("input", (e: any) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) return;

                if (mode === "standard") {
                    if (val < min) val = min;
                    if (val > max) val = max;
                    slider.value = String(val);
                }
                numBox.value = String(val);
                onChange(val);
            });

            flexContainer.appendChild(slider);
            flexContainer.appendChild(numBox);
            row.appendChild(flexContainer);

            updateView();

            return { row, slider, numBox };
        };

        const airLimitMix = createConsumableInputMix("Uso en el Aire (segundos consecutivos):", 1, 30, 0.5, 5, (val) => {
            if (this.currentDraftItem) this.currentDraftItem.airLimit = val;
        });
        this.airLimitSlider = airLimitMix.slider;
        this.airLimitNumBox = airLimitMix.numBox;

        const consumableUseMix = createConsumableInputMix("Uso Consumible (segundos totales):", 5, 300, 1, 30, (val) => {
            if (this.currentDraftItem) {
                this.currentDraftItem.consumableUse = val;
                this.currentDraftItem.maxConsumableUse = val;
            }
        });
        this.consumableUseSlider = consumableUseMix.slider;
        this.consumableUseNumBox = consumableUseMix.numBox;

        const thrustMix = createConsumableInputMix("Fuerza de Impulso:", 5, 50, 0.5, 25, (val) => {
            if (this.currentDraftItem) this.currentDraftItem.thrust = val;
        });
        this.thrustSlider = thrustMix.slider;
        this.thrustNumBox = thrustMix.numBox;

        const vfxRow = document.createElement("div");
        vfxRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; text-align: left;";
        const vfxLabel = document.createElement("span");
        vfxLabel.textContent = "Efecto VFX:";
        vfxLabel.style.color = "#ccc";

        const vfxSelect = document.createElement("select");
        vfxSelect.style.cssText = "padding: 6px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; font-size: 12px; cursor: pointer; flex: 1;";
        const vfxOptions = ["Humo y Fuego", "Sólo Humo", "Sólo Fuego", "Chispas", "Ninguno"];
        vfxOptions.forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            vfxSelect.appendChild(el);
        });
        vfxSelect.addEventListener("change", (e) => {
            if (this.currentDraftItem) this.currentDraftItem.particleVFX = e.target.value;
        });
        this.vfxSelect = vfxSelect;

        vfxRow.appendChild(vfxLabel);
        vfxRow.appendChild(vfxSelect);

        const heightLimitRow = document.createElement("div");
        heightLimitRow.style.cssText = "display: flex; align-items: center; gap: 10px; font-size: 13px; text-align: left; margin-top: 5px; cursor: pointer; user-select: none;";

        const heightLimitCheck = document.createElement("input");
        heightLimitCheck.type = "checkbox";
        heightLimitCheck.checked = true;
        heightLimitCheck.style.cssText = "width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;";
        heightLimitCheck.addEventListener("change", (e: any) => {
            if (this.currentDraftItem) {
                this.currentDraftItem.limitHeightEnabled = e.target.checked;
            }
            heightValueRow.style.display = e.target.checked ? "flex" : "none";
        });
        this.heightLimitCheck = heightLimitCheck;

        const heightLimitLabel = document.createElement("span");
        heightLimitLabel.textContent = "Limitar altura de vuelo";
        heightLimitLabel.style.color = "#ccc";

        heightLimitRow.appendChild(heightLimitCheck);
        heightLimitRow.appendChild(heightLimitLabel);

        heightLimitRow.addEventListener("click", (e) => {
            if (e.target !== heightLimitCheck) {
                heightLimitCheck.checked = !heightLimitCheck.checked;
                heightLimitCheck.dispatchEvent(new Event("change"));
            }
        });

        const heightValueRow = document.createElement("div");
        heightValueRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; text-align: left; margin-left: 26px; margin-top: 2px;";
        const heightValueLabel = document.createElement("span");
        heightValueLabel.textContent = "Altura Máxima (metros):";
        heightValueLabel.style.color = "#aaa";
        const heightValueInput = document.createElement("input");
        heightValueInput.type = "number";
        heightValueInput.min = "1";
        heightValueInput.max = "500";
        heightValueInput.step = "1";
        heightValueInput.value = "20";
        heightValueInput.style.cssText = "width: 70px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px 6px; font-size: 13px; text-align: center;";
        heightValueInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem) {
                this.currentDraftItem.maxFlightHeight = val;
            }
        });
        this.heightValueInput = heightValueInput;
        heightValueRow.appendChild(heightValueLabel);
        heightValueRow.appendChild(heightValueInput);

        // Cooldown checkbox
        const jetpackCooldownRow = document.createElement("div");
        jetpackCooldownRow.style.cssText = "display: flex; align-items: center; gap: 10px; font-size: 13px; text-align: left; margin-top: 5px; cursor: pointer; user-select: none;";

        const cooldownCheck = document.createElement("input");
        cooldownCheck.type = "checkbox";
        cooldownCheck.checked = false; // Desactivado por defecto
        cooldownCheck.style.cssText = "width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;";
        cooldownCheck.addEventListener("change", (e: any) => {
            if (this.currentDraftItem) {
                this.currentDraftItem.cooldownEnabled = e.target.checked;
            }
            cooldownValueRow.style.display = e.target.checked ? "flex" : "none";
        });
        this.cooldownCheck = cooldownCheck;

        const jetpackCooldownLabel = document.createElement("span");
        jetpackCooldownLabel.textContent = "Tiempo de recarga";
        jetpackCooldownLabel.style.color = "#ccc";

        jetpackCooldownRow.appendChild(cooldownCheck);
        jetpackCooldownRow.appendChild(jetpackCooldownLabel);

        jetpackCooldownRow.addEventListener("click", (e) => {
            if (e.target !== cooldownCheck) {
                cooldownCheck.checked = !cooldownCheck.checked;
                cooldownCheck.dispatchEvent(new Event("change"));
            }
        });

        // Cooldown value row
        const cooldownValueRow = document.createElement("div");
        cooldownValueRow.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; text-align: left; margin-left: 26px; margin-top: 2px;";
        const cooldownValueLabel = document.createElement("span");
        cooldownValueLabel.textContent = "Tiempo de Recarga (segundos):";
        cooldownValueLabel.style.color = "#aaa";
        const cooldownValueInput = document.createElement("input");
        cooldownValueInput.type = "number";
        cooldownValueInput.min = "0.5";
        cooldownValueInput.max = "60";
        cooldownValueInput.step = "0.5";
        cooldownValueInput.value = "3";
        cooldownValueInput.style.cssText = "width: 70px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; padding: 4px 6px; font-size: 13px; text-align: center;";
        cooldownValueInput.addEventListener("input", (e: any) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && this.currentDraftItem) {
                this.currentDraftItem.cooldownTime = val;
            }
        });
        this.cooldownValueInput = cooldownValueInput;
        cooldownValueRow.appendChild(cooldownValueLabel);
        cooldownValueRow.appendChild(cooldownValueInput);

        // Pointer follow checkbox
        const jetpackPointerFollowRow = document.createElement("div");
        jetpackPointerFollowRow.style.cssText = "display: flex; align-items: center; gap: 10px; font-size: 13px; text-align: left; margin-top: 5px; cursor: pointer; user-select: none;";

        const pointerFollowCheck = document.createElement("input");
        pointerFollowCheck.type = "checkbox";
        pointerFollowCheck.checked = true; // Activado por defecto
        pointerFollowCheck.style.cssText = "width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;";
        pointerFollowCheck.addEventListener("change", (e: any) => {
            if (this.currentDraftItem) {
                this.currentDraftItem.pointerFollowEnabled = e.target.checked;
            }
        });
        this.pointerFollowCheck = pointerFollowCheck;

        const jetpackPointerFollowLabel = document.createElement("span");
        jetpackPointerFollowLabel.textContent = "Seguimiento del punto al volar estricto";
        jetpackPointerFollowLabel.style.color = "#ccc";

        jetpackPointerFollowRow.appendChild(pointerFollowCheck);
        jetpackPointerFollowRow.appendChild(jetpackPointerFollowLabel);

        jetpackPointerFollowRow.addEventListener("click", (e) => {
            if (e.target !== pointerFollowCheck) {
                pointerFollowCheck.checked = !pointerFollowCheck.checked;
                pointerFollowCheck.dispatchEvent(new Event("change"));
            }
        });

        // Shift flight checkbox
        const jetpackShiftFlightRow = document.createElement("div");
        jetpackShiftFlightRow.style.cssText = "display: flex; align-items: center; gap: 10px; font-size: 13px; text-align: left; margin-top: 5px; cursor: pointer; user-select: none;";

        const shiftFlightCheck = document.createElement("input");
        shiftFlightCheck.type = "checkbox";
        shiftFlightCheck.checked = false; // Desactivado por defecto
        shiftFlightCheck.style.cssText = "width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;";
        shiftFlightCheck.addEventListener("change", (e: any) => {
            if (this.currentDraftItem) {
                this.currentDraftItem.shiftFlightEnabled = e.target.checked;
            }
        });
        this.shiftFlightCheck = shiftFlightCheck;

        const jetpackShiftFlightLabel = document.createElement("span");
        jetpackShiftFlightLabel.textContent = "Seguimiento del punto al volar libre";
        jetpackShiftFlightLabel.style.color = "#ccc";

        jetpackShiftFlightRow.appendChild(shiftFlightCheck);
        jetpackShiftFlightRow.appendChild(jetpackShiftFlightLabel);

        jetpackShiftFlightRow.addEventListener("click", (e) => {
            if (e.target !== shiftFlightCheck) {
                shiftFlightCheck.checked = !shiftFlightCheck.checked;
                shiftFlightCheck.dispatchEvent(new Event("change"));
            }
        });

        consumableControlsContainer.appendChild(airLimitMix.row);
        consumableControlsContainer.appendChild(consumableUseMix.row);
        consumableControlsContainer.appendChild(thrustMix.row);
        consumableControlsContainer.appendChild(vfxRow);
        consumableControlsContainer.appendChild(heightLimitRow);
        consumableControlsContainer.appendChild(heightValueRow);
        consumableControlsContainer.appendChild(jetpackCooldownRow);
        consumableControlsContainer.appendChild(cooldownValueRow);
        consumableControlsContainer.appendChild(jetpackPointerFollowRow);
        consumableControlsContainer.appendChild(jetpackShiftFlightRow);

        this.defaultEditorControlsSlot.appendChild(consumableControlsContainer);
        this.editorConsumableControlsContainer = consumableControlsContainer;

        // --- NEW: Logic Controls ---
        const logicControlsContainer = document.createElement("div");
        logicControlsContainer.style.cssText = `
            width: 100%;
            display: none;
            flex-direction: column;
            gap: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;
        this.defaultEditorControlsSlot.appendChild(logicControlsContainer);
        this.editorLogicControlsContainer = logicControlsContainer;

        // Save References for toggling
        this.editorConstructionControls = controlsContainer;
        this.editorTextureContainer = textureContainer;
        this.editorDimContainer = dimContainer;
        this.editorWeaponControlsContainer = weaponControlsContainer;
        this.editorConsumableControlsContainer = consumableControlsContainer;

        const dragHint = document.createElement("div");
        dragHint.textContent = "Arrastra la imagen superior a tu inventario";
        dragHint.style.fontSize = "12px";
        dragHint.style.color = "#888";
        dragHint.style.marginTop = "auto";
        dragHint.style.textAlign = "center";
        this.panelEditor.appendChild(dragHint);

        container.appendChild(this.panelPlaceholder);
        container.appendChild(this.panelEditor);
    }

    selectItem(baseItem) {
        this.selectedItem = baseItem;

        // Restore default editor controls to original hierarchy before configuring item
        this.restoreDefaultEditorControls();

        // Show Editor
        this.panelPlaceholder.style.display = "none";
        this.panelEditor.style.display = "flex";

        this.editorTitle.textContent = baseItem.name;

        // Init Draft - CRITICAL: Copy scale object to avoid mutation
        const scaleCopy = { ...baseItem.scale };
        this.createDraft(baseItem.id, baseItem.name, baseItem.type, baseItem.color, scaleCopy, baseItem.texturePath, baseItem);

        if (baseItem.type === "weapon") {
            if (this.advancedConfigBtn) this.advancedConfigBtn.style.display = "block";
            this.editorConstructionControls.style.display = "none";
            this.editorTextureContainer.style.display = "none";
            this.editorDimContainer.style.display = "none";
            this.editorWeaponControlsContainer.style.display = "flex";
            this.editorConsumableControlsContainer.style.display = "none";

            this.damageInput.value = baseItem.damage !== undefined ? baseItem.damage : 10;
            this.cooldownInput.value = baseItem.cooldown !== undefined ? baseItem.cooldown : 0.5;
            this.handSelect.value = baseItem.equippedHand !== undefined ? baseItem.equippedHand : "right";
            this.maxScopeSelect.value = baseItem.maxScope !== undefined ? baseItem.maxScope : 1;
            this.recoilInput.value = baseItem.recoil !== undefined ? baseItem.recoil : 5.0;
            this.recoilModeSelect.value = baseItem.recoilMode !== undefined ? baseItem.recoilMode : "hybrid";
            this.autoInput.checked = baseItem.isAuto !== undefined ? baseItem.isAuto : false;
            this.projectileTypeSelect.value = baseItem.projectileType !== undefined ? baseItem.projectileType : "bullet";
            this.speedInput.value = baseItem.shotSpeed !== undefined ? baseItem.shotSpeed : 50.0;
            this.dropInput.value = baseItem.bulletDrop !== undefined ? baseItem.bulletDrop : 1.0;
            this.tracerInput.checked = baseItem.hasTracer !== undefined ? baseItem.hasTracer : false;
            this.trajectoryInput.checked = baseItem.hasTrajectoryLine !== undefined ? baseItem.hasTrajectoryLine : false;

            // Set rebote from item, defaulting to true if it's a "ball", otherwise false
            let defaultRebote = baseItem.projectileType === "ball" ? true : false;
            this.reboteInput.checked = baseItem.rebote !== undefined ? baseItem.rebote : defaultRebote;
            this.impactInput.checked = baseItem.hasImpactEffect !== undefined ? baseItem.hasImpactEffect : false;

            this.customTracerSelect.value = baseItem.customTracerVFX || "Ninguno";
            this.tracerStayForeverInput.checked = baseItem.tracerStayForever || false;
            this.tracerDestroyInput.checked = baseItem.tracerDestroyOnCollision || false;
            this.tracerCollisionSelect.value = baseItem.tracerCollisionVFX || "Ninguno";
            this.customImpactSelect.value = baseItem.customImpactVFX || "Ninguno";

            this.playerImpulseUpInput.checked = baseItem.hasPlayerImpulseUp !== undefined ? baseItem.hasPlayerImpulseUp : false;
            this.playerImpulseUpForceInput.value = baseItem.playerImpulseUpForce !== undefined ? baseItem.playerImpulseUpForce : 15.0;
            this.playerImpulseUpAirRedInput.value = baseItem.playerImpulseUpAirReduction !== undefined ? baseItem.playerImpulseUpAirReduction : 50.0;

            this.playerImpulseBackInput.checked = baseItem.hasPlayerImpulseBack !== undefined ? baseItem.hasPlayerImpulseBack : false;
            this.playerImpulseBackForceInput.value = baseItem.playerImpulseBackForce !== undefined ? baseItem.playerImpulseBackForce : 5.0;
        } else if (baseItem.type === "consumable") {
            if (this.advancedConfigBtn) this.advancedConfigBtn.style.display = "none";
            this.editorConstructionControls.style.display = "none";
            this.editorTextureContainer.style.display = "none";
            this.editorDimContainer.style.display = "none";
            this.editorWeaponControlsContainer.style.display = "none";
            this.editorConsumableControlsContainer.style.display = "flex";

            const airLim = baseItem.airLimit !== undefined ? baseItem.airLimit : 5;
            const consUse = baseItem.consumableUse !== undefined ? baseItem.consumableUse : 30;
            const thr = baseItem.thrust !== undefined ? baseItem.thrust : 25;
            const vfx = baseItem.particleVFX !== undefined ? baseItem.particleVFX : "Humo y Fuego";
            const limHeight = baseItem.limitHeightEnabled !== undefined ? baseItem.limitHeightEnabled : true;
            const maxHt = baseItem.maxFlightHeight !== undefined ? baseItem.maxFlightHeight : 20.0;
            const coolEnabled = baseItem.cooldownEnabled !== undefined ? baseItem.cooldownEnabled : false;
            const coolTime = baseItem.cooldownTime !== undefined ? baseItem.cooldownTime : 3.0;
            const pointerFollow = baseItem.pointerFollowEnabled !== undefined ? baseItem.pointerFollowEnabled : true;
            const shiftFlight = baseItem.shiftFlightEnabled !== undefined ? baseItem.shiftFlightEnabled : false;

            this.airLimitSlider.value = String(airLim);
            this.airLimitNumBox.value = String(airLim);

            this.consumableUseSlider.value = String(consUse);
            this.consumableUseNumBox.value = String(consUse);

            this.thrustSlider.value = String(thr);
            this.thrustNumBox.value = String(thr);

            this.vfxSelect.value = vfx;
            this.heightLimitCheck.checked = limHeight;
            this.heightValueInput.value = String(maxHt);
            this.heightValueInput.parentElement.style.display = limHeight ? "flex" : "none";

            this.cooldownCheck.checked = coolEnabled;
            this.cooldownValueInput.value = String(coolTime);
            this.cooldownValueInput.parentElement.style.display = coolEnabled ? "flex" : "none";

            if (this.pointerFollowCheck) {
                this.pointerFollowCheck.checked = pointerFollow;
            }

            if (this.shiftFlightCheck) {
                this.shiftFlightCheck.checked = shiftFlight;
            }

            if (this.currentDraftItem) {
                this.currentDraftItem.airLimit = airLim;
                this.currentDraftItem.consumableUse = consUse;
                this.currentDraftItem.maxConsumableUse = consUse;
                this.currentDraftItem.thrust = thr;
                this.currentDraftItem.particleVFX = vfx;
                this.currentDraftItem.limitHeightEnabled = limHeight;
                this.currentDraftItem.maxFlightHeight = maxHt;
                this.currentDraftItem.cooldownEnabled = coolEnabled;
                this.currentDraftItem.cooldownTime = coolTime;
                this.currentDraftItem.pointerFollowEnabled = pointerFollow;
                this.currentDraftItem.shiftFlightEnabled = shiftFlight;
            }
        } else {
            if (this.advancedConfigBtn) this.advancedConfigBtn.style.display = "none";
            this.editorConstructionControls.style.display = "flex";
            this.editorTextureContainer.style.display = "flex";
            this.editorDimContainer.style.display = "flex";
            this.editorWeaponControlsContainer.style.display = "none";
            this.editorConsumableControlsContainer.style.display = "none";

            // Reset color picker
            const hex = baseItem.color !== undefined ? "#" + new THREE.Color(baseItem.color).getHexString() : "#ffffff";
            this.colorPicker.value = hex;
            this.updateDraftColor(hex);
        }

        // Reset Texture UI
        const allBtns = this.panelEditor.querySelectorAll(".texture-btn");
        allBtns.forEach(c => c.style.borderColor = "#555");
        const selectedTexturePath = baseItem.texturePath || null;
        let matchedTexture = false;
        allBtns.forEach(btn => {
            const bg = btn.style.backgroundImage || "";
            if (selectedTexturePath && bg.includes(selectedTexturePath)) {
                btn.style.borderColor = "#00FF00";
                matchedTexture = true;
            }
        });
        if (!matchedTexture && allBtns.length > 0) allBtns[0].style.borderColor = "#00FF00";
        this.syncTextureSettingsInputs(baseItem.textureSettings);

        const uploadBtn = this.panelEditor.querySelector("#texture-upload-btn");
        if (uploadBtn) {
            uploadBtn.textContent = "Subir Textura Personal";
            uploadBtn.style.color = "white";
        }

        // Reset Inputs
        if (this.inputDimx) this.inputDimx.value = scaleCopy.x;
        if (this.inputDimy) this.inputDimy.value = scaleCopy.y;
        if (this.inputDimz) this.inputDimz.value = scaleCopy.z;

        // Toggle Custom Inputs based on shape type
        const type = baseItem.type;
        const dimLabel = this.editorDimContainer.querySelector("span");
        const dimRow = this.editorDimContainer.querySelector("div");

        // Hide spike rows by default
        if (this.rowSpikeRadius) this.rowSpikeRadius.style.display = "none";
        if (this.rowSpikeHeight) this.rowSpikeHeight.style.display = "none";
        if (this.rowSpikeSpacing) this.rowSpikeSpacing.style.display = "none";

        if (type === "sphere") {
            if (dimLabel) dimLabel.textContent = "Parámetros de Esfera:";
            if (dimRow) dimRow.style.display = "none";
            this.rowRadius.style.display = "flex";
            this.rowLength1.style.display = "none";
            this.rowLength2.style.display = "none";
            this.rowBendAngleX.style.display = "none";
            this.rowBendAngleY.style.display = "none";
            this.inputRadius.value = scaleCopy.radius || 1.0;
        } else if (type === "cylinder") {
            if (dimLabel) dimLabel.textContent = "Parámetros de Cilindro:";
            if (dimRow) dimRow.style.display = "none";
            this.rowRadius.style.display = "flex";
            this.rowLength1.style.display = "flex";
            this.rowLength2.style.display = "none";
            this.rowBendAngleX.style.display = "none";
            this.rowBendAngleY.style.display = "none";
            this.inputRadius.value = scaleCopy.radius || 1.0;
            this.inputLength1.value = scaleCopy.y || 2.0;
        } else if (type === "cone") {
            if (dimLabel) dimLabel.textContent = "Parámetros de Cono:";
            if (dimRow) dimRow.style.display = "none";
            this.rowRadius.style.display = "flex";
            this.rowLength1.style.display = "flex";
            this.rowLength2.style.display = "none";
            this.rowBendAngleX.style.display = "none";
            this.rowBendAngleY.style.display = "none";
            this.inputRadius.value = scaleCopy.radius || 1.0;
            this.inputLength1.value = scaleCopy.y || 3.0;
        } else if (type === "spiked_floor") {
            if (dimLabel) dimLabel.textContent = "Dimensiones de la Base:";
            if (dimRow) dimRow.style.display = "flex";
            if (this.rowRadius) this.rowRadius.style.display = "none";
            if (this.rowLength1) this.rowLength1.style.display = "none";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
            if (this.rowSpikeRadius) this.rowSpikeRadius.style.display = "flex";
            if (this.rowSpikeHeight) this.rowSpikeHeight.style.display = "flex";
            if (this.rowSpikeSpacing) this.rowSpikeSpacing.style.display = "flex";
            if (this.inputSpikeRadius) this.inputSpikeRadius.value = scaleCopy.spikeRadius || 0.15;
            if (this.inputSpikeHeight) this.inputSpikeHeight.value = scaleCopy.spikeHeight || 0.4;
            if (this.inputSpikeSpacing) this.inputSpikeSpacing.value = scaleCopy.spikeSpacing || 0.5;
        } else if (type === "circle") {
            if (dimLabel) dimLabel.textContent = "Parámetros de Círculo:";
            if (dimRow) dimRow.style.display = "none";
            this.rowRadius.style.display = "flex";
            this.rowLength1.style.display = "flex";
            this.rowLength2.style.display = "none";
            this.rowBendAngleX.style.display = "none";
            this.rowBendAngleY.style.display = "none";
            this.inputRadius.value = scaleCopy.radius || 1.0;
            this.inputLength1.value = scaleCopy.y || 0.05;
        } else if (type === "tube") {
            if (dimLabel) dimLabel.textContent = "Parámetros de Tubo:";
            if (dimRow) dimRow.style.display = "none";
            this.rowRadius.style.display = "flex";
            this.rowLength1.style.display = "flex";
            this.rowLength2.style.display = "flex";
            this.rowBendAngleX.style.display = "flex";
            this.rowBendAngleY.style.display = "flex";
            this.inputRadius.value = scaleCopy.radius || 0.5;
            this.inputLength1.value = scaleCopy.y || 2.0;
            this.inputLength2.value = scaleCopy.length2 || 2.0;
            this.inputBendAngleX.value = scaleCopy.bendAngleX !== undefined ? scaleCopy.bendAngleX : 0;
            this.inputBendAngleY.value = scaleCopy.bendAngleY !== undefined ? scaleCopy.bendAngleY : 90;
        } else {
            if (dimLabel) dimLabel.textContent = "Dimensiones (X, Y, Z):";
            if (dimRow) dimRow.style.display = "flex";
            if (this.rowRadius) this.rowRadius.style.display = "none";
            if (this.rowLength1) this.rowLength1.style.display = "none";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
        }

        // Update Logic Controls
        this.updateLogicControls(baseItem);
    }

    createDraft(id, name, type, color, scale, texturePath = null, baseItem = null) {
        if ((type === "weapon" || type === "consumable") && baseItem && baseItem.clone) {
            this.currentDraftItem = baseItem.clone();
        } else {
            this.currentDraftItem = new MapObjectItem(id, name, type, "", color, scale, texturePath, baseItem?.textureAssetId || null, baseItem?.textureSettings || null);
            if (baseItem && baseItem.logicProperties) {
                this.currentDraftItem.logicProperties = JSON.parse(JSON.stringify(baseItem.logicProperties));
            }
        }

        // Marcar el ID base para que el dragstart del card pueda comparar
        this.currentDraftItem._baseId = id;

        // Init Image
        if (this.editorImg) {
            this.editorImg.src = this.currentDraftItem.iconPath;
        }
    }

    restoreDefaultEditorControls() {
        if (!this.defaultEditorControlsSlot) return;

        // Hide detached section rail and sectioned content
        if (this.sectionRailWrapper) {
            this.sectionRailWrapper.style.display = "none";
        }
        if (this.sectionedEditor) {
            this.sectionedEditor.getContentElement().style.display = "none";
        }
        if (this.editorPreview) {
            this.editorPreview.style.width = "128px";
            this.editorPreview.style.height = "128px";
        }

        // Safely re-attach all control groups to defaultEditorControlsSlot in deterministic order
        if (this.editorConstructionControls) {
            this.defaultEditorControlsSlot.appendChild(this.editorConstructionControls);
        }
        if (this.editorTextureContainer) {
            this.defaultEditorControlsSlot.appendChild(this.editorTextureContainer);
            this.editorTextureContainer.style.borderTop = "1px solid #444";
            this.editorTextureContainer.style.marginTop = "10px";
        }
        if (this.editorDimContainer) {
            this.defaultEditorControlsSlot.appendChild(this.editorDimContainer);
            this.editorDimContainer.style.borderTop = "1px solid #444";
            this.editorDimContainer.style.marginTop = "10px";
        }
        if (this.editorWeaponControlsContainer) {
            this.defaultEditorControlsSlot.appendChild(this.editorWeaponControlsContainer);
        }
        if (this.editorConsumableControlsContainer) {
            this.defaultEditorControlsSlot.appendChild(this.editorConsumableControlsContainer);
        }
        if (this.editorLogicControlsContainer) {
            this.defaultEditorControlsSlot.appendChild(this.editorLogicControlsContainer);
        }

        this.defaultEditorControlsSlot.style.display = "flex";
    }

    setupVehicleSectionedEditor(baseItem) {
        if (!this.sectionedEditor || !this.currentDraftItem) return;

        // Make preview compact for vehicle so editor has maximum height
        if (this.editorPreview) {
            this.editorPreview.style.width = "96px";
            this.editorPreview.style.height = "96px";
        }

        // Hide default slot & logic controls standalone container
        if (this.defaultEditorControlsSlot) {
            this.defaultEditorControlsSlot.style.display = "none";
        }
        if (this.editorLogicControlsContainer) {
            this.editorLogicControlsContainer.style.display = "none";
        }

        // Show external side rail and sectioned content
        if (this.sectionRailWrapper) {
            if (this.sectionedEditor.getRailElement().parentElement !== this.sectionRailWrapper) {
                this.sectionRailWrapper.appendChild(this.sectionedEditor.getRailElement());
            }
            this.sectionRailWrapper.style.display = "flex";
        }
        this.sectionedEditor.getContentElement().style.display = "flex";

        // Build vehicle logic sections 2 to 8
        const logic = new MotorbikeLogic();
        const builtSections = logic.buildSections(this.currentDraftItem.logicProperties, (key, value) => {
            this.currentDraftItem.logicProperties[key] = value;
        });

        // 1. Apariencia y texturas
        const sec1 = document.createElement("div");
        sec1.style.cssText = "display: flex; flex-direction: column; gap: 8px; width: 100%;";
        this.editorConstructionControls.style.display = "flex";
        this.editorTextureContainer.style.display = "flex";
        this.editorTextureContainer.style.borderTop = "none";
        this.editorTextureContainer.style.marginTop = "0";
        sec1.appendChild(this.editorConstructionControls);
        sec1.appendChild(this.editorTextureContainer);

        // 2. Dimensiones y geometría
        const sec2 = document.createElement("div");
        sec2.style.cssText = "display: flex; flex-direction: column; gap: 8px; width: 100%;";
        this.editorDimContainer.style.display = "flex";
        this.editorDimContainer.style.borderTop = "none";
        this.editorDimContainer.style.marginTop = "0";
        sec2.appendChild(this.editorDimContainer);
        sec2.appendChild(builtSections.section2Seats);

        // 8 Clean Sections matching user specifications & icons
        const sections = [
            {
                id: "appearance",
                number: 1,
                title: "Apariencia y texturas",
                subtitle: "Personalización visual de la motocicleta.",
                iconSvg: SECTION_ICONS.palette,
                content: sec1
            },
            {
                id: "dimensions",
                number: 2,
                title: "Dimensiones y geometría",
                subtitle: "Tamaño y forma física del vehículo.",
                iconSvg: SECTION_ICONS.dimensions,
                content: sec2
            },
            {
                id: "driving",
                number: 3,
                title: "Conducción y rendimiento",
                subtitle: "Velocidad, aceleración y maniobrabilidad.",
                iconSvg: SECTION_ICONS.speedometer,
                content: builtSections.section3
            },
            {
                id: "seats",
                number: 4,
                title: "Asientos y controles",
                subtitle: "Ocupantes, animaciones y comportamiento al montar.",
                iconSvg: SECTION_ICONS.seats,
                content: builtSections.section4
            },
            {
                id: "physics",
                number: 5,
                title: "Física, gravedad y estabilidad",
                subtitle: "Equilibrio, saltos y comportamiento en el aire.",
                iconSvg: SECTION_ICONS.physics,
                content: builtSections.section5
            },
            {
                id: "durability",
                number: 6,
                title: "Durabilidad y daños",
                subtitle: "Resistencia del vehículo y consecuencias de los accidentes.",
                iconSvg: SECTION_ICONS.durability,
                content: builtSections.section6
            },
            {
                id: "jetpack",
                number: 7,
                title: "Jetpack y combustible",
                subtitle: "Propulsión adicional y gestión de energía.",
                iconSvg: SECTION_ICONS.jetpack,
                content: builtSections.section7
            },
            {
                id: "effects",
                number: 8,
                title: "Efectos visuales y velocidad",
                subtitle: "Efectos cinematográficos y estelas visibles en el mundo.",
                iconSvg: SECTION_ICONS.effects,
                content: builtSections.section8
            },
            {
                id: "score",
                number: 9,
                title: "Puntaje y acrobacias",
                subtitle: "Tiempo en el aire, giros, piruetas y recompensas.",
                iconSvg: SECTION_ICONS.trophy,
                content: builtSections.section9Score
            }
        ];

        this.sectionedEditor.setSections(sections);
    }

    updateLogicControls(baseItem) {
        this.editorLogicControlsContainer.innerHTML = "";

        const logicTypes = ["spawn_point", "movement_controller", "interaction_button", "interactive_collision", "target", "impulse_jump", "impulse_lateral", "impulse_neon", "gravity_pad", "fuel_zone", "farming_zone", "gravity_sphere", "logic_camera", "camera_panel", "damage_controller", "logic_light"];
        if (!logicTypes.includes(baseItem.type) && !baseItem.logicProperties && baseItem.type !== "motorbike") {
            this.editorLogicControlsContainer.style.display = "none";
            this.restoreDefaultEditorControls();
            return;
        }

        if (!this.currentDraftItem.logicProperties) {
            this.currentDraftItem.logicProperties = baseItem.logicProperties ? { ...baseItem.logicProperties } : {};
        }

        const type = baseItem.type;

        if (type === "motorbike") {
            this.setupVehicleSectionedEditor(baseItem);
            return;
        }

        this.restoreDefaultEditorControls();
        this.editorLogicControlsContainer.style.display = "flex";

        const header = document.createElement("div");
        header.textContent = "Propiedades Lógicas";
        header.style.cssText = "font-weight: bold; color: #ffaa00; border-bottom: 1px dashed #555; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; text-align: left; width: 100%;";
        this.editorLogicControlsContainer.appendChild(header);

        if (type === "spawn_point") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Equipo:", "team", "number", 1);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Capacidad:", "capacity", "number", 1);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Orden:", "order", "number", 1);
        } else if (type === "movement_controller") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Velocidad:", "speed", "number", 2.0);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Bucle Infinito:", "loop", "boolean", true);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Activo al Inicio:", "active", "boolean", true);
        } else if (type === "damage_controller") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Nombre:", "name", "text", "Controlador de Daño");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Habilitar Daño:", "enableDamage", "boolean", true);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Daño Base:", "damage", "number", 10);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Daño Porcentual (%):", "percentDamage", "number", 0);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Muerte Instantánea:", "instantKill", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Límite Máximo Daño:", "maxDamage", "number", 100);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Habilitar Stop:", "enableDamageStopLimit", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Límite Daño Acumulado (Stop):", "damageStopLimit", "number", 100);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Intervalo Cooldown (s):", "damageCooldown", "number", 1.0);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Retroceso (Knockback):", "enableKnockback", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Fuerza Retroceso:", "knockbackForce", "number", 15);
            this.createLogicDraftSelect(this.editorLogicControlsContainer, "Dirección Retroceso:", "knockbackDirection", [
                { value: "automatic", label: "Automático" },
                { value: "upward", label: "Solo hacia Arriba" },
                { value: "away", label: "Alejar del centro" },
                { value: "backward", label: "Empujar hacia atrás" }
            ], "automatic");
        } else if (type === "interaction_button") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Tiempo Retener (s):", "holdTime", "number", 1.0);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Un Solo Uso:", "oneShot", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Modo Pulsación:", "pulsationMode", "boolean", false);
        } else if (type === "gravity_sphere") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Tiempo Retener (s):", "holdTime", "number", 0.5);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Un Solo Uso:", "oneShot", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Modo Pulsación:", "pulsationMode", "boolean", false);
        } else if (type === "logic_light") {
            this.createLogicDraftSelect(this.editorLogicControlsContainer, "Tipo de Luz:", "lightType", [
                { value: "point", label: "Puntual" },
                { value: "spot", label: "Focal" },
                { value: "directional", label: "Direccional" },
                { value: "ambient", label: "Ambiental" }
            ], "point");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Color (Hex):", "color", "text", "#ffffff");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Intensidad:", "intensity", "number", 2.0);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Rango (m):", "distance", "number", 15);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Sombras:", "castShadow", "boolean", true);
        } else if (type === "logic_camera") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Nombre:", "name", "text", "Camara");
            this.createLogicDraftSelect(this.editorLogicControlsContainer, "Modo:", "mode", [
                { value: "fixed", label: "Fija" },
                { value: "free_rotation", label: "Libre solo rotacion" }
            ], "fixed");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "FOV:", "fov", "number", 60);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Distancia foco:", "far", "number", 6);
        } else if (type === "camera_panel") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Nombre:", "name", "text", "Panel de Camaras");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Distancia Render Preview (m):", "previewFar", "number", 80);
            this.createLogicDraftSelect(this.editorLogicControlsContainer, "Intervalo Actualización Previews:", "previewInterval", [
                { value: "0", label: "Tiempo Real (60 FPS)" },
                { value: "0.1", label: "Cada 0.1s" },
                { value: "0.2", label: "Cada 0.2s" },
                { value: "0.5", label: "Cada 0.5s" },
                { value: "1", label: "Cada 1s" },
                { value: "2", label: "Cada 2s" },
                { value: "5", label: "Cada 5s" }
            ], "0");
        } else if (type === "interactive_collision") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Travesable (Sin colisión):", "isTraversable", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Disparar al Tocar:", "triggerOnTouch", "boolean", false);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Disparar al Entrar:", "triggerOnEnter", "boolean", false);
        } else if (type === "target") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Anillos:", "rings", "number", 3);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Daño Base:", "baseDamage", "number", 10);
        } else if (type === "impulse_jump" || type === "impulse_lateral" || type === "impulse_neon") {
            const isJump = type === "impulse_jump";
            const isNeon = type === "impulse_neon";
            const defaultName = isNeon ? "Pad Neón de Impulso" : isJump ? "Pad de Salto" : "Pad de Empuje";
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Nombre:", "name", "text", defaultName);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Fuerza:", "strength", "number", isJump ? 25 : 40);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Recarga (s):", "cooldown", "number", 0.25);
            if (isNeon) {
                const ARROW_DIST_OPTIONS = [
                    { value: "auto", label: "Auto (según ancho)" },
                    { value: "1", label: "1 Flecha (Centrada)" },
                    { value: "2", label: "2 Flechas paralelas" },
                    { value: "3", label: "3 Flechas paralelas" },
                    { value: "4", label: "4 Flechas paralelas" }
                ];
                const ARROW_SPAN_OPTIONS = [
                    { value: "clamped", label: "Proporcional Nítida" },
                    { value: "full", label: "Expandir al carril" }
                ];
                this.createLogicDraftSelect(this.editorLogicControlsContainer, "Distribución Flechas:", "arrowColumnsMode", ARROW_DIST_OPTIONS, "auto");
                this.createLogicDraftSelect(this.editorLogicControlsContainer, "Proporción Flecha:", "arrowSpanMode", ARROW_SPAN_OPTIONS, "clamped");
                this.createLogicDraftInput(this.editorLogicControlsContainer, "Densidad Óvalos:", "ovalDensity", "number", 14);
            } else {
                this.createLogicDraftInput(this.editorLogicControlsContainer, "Mostrar Flecha:", "showImage", "boolean", true);
            }
        } else if (type === "gravity_pad") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Nombre:", "name", "text", "Pad de Gravedad");
            this.createLogicDraftSelect(this.editorLogicControlsContainer, "Orientación:", "gravityOrientation", GRAVITY_ORIENTATION_OPTIONS, "up");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Duración Giro (s):", "transitionDuration", "number", 0.8);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Recarga (s):", "cooldown", "number", 0.35);
        } else if (type === "fuel_zone") {
            new FuelZoneLogic().render(this.editorLogicControlsContainer, this.currentDraftItem.logicProperties, (key, value) => {
                this.currentDraftItem.logicProperties[key] = value;
            });
        } else if (type === "farming_zone") {
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Nombre:", "name", "text", "Zona de Farmeo");
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Intervalo Spawn (s):", "spawnInterval", "number", 1.0);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Items por Spawn:", "itemsPerSpawn", "number", 1);
            this.createLogicDraftInput(this.editorLogicControlsContainer, "Valor de Fuego:", "itemValue", "number", 1);
            this.createLogicDraftGroupSelector(this.editorLogicControlsContainer);
            this.createLogicDraftTextureSelector(this.editorLogicControlsContainer);
        }
    }

    createLogicDraftInput(container, labelText, key, type, defaultValue) {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:5px; width: 100%;";

        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.color = "#aaa";
        label.style.fontSize = "13px";

        if (!this.currentDraftItem.logicProperties) {
            this.currentDraftItem.logicProperties = {};
        }

        if (this.currentDraftItem.logicProperties[key] === undefined) {
            this.currentDraftItem.logicProperties[key] = defaultValue;
        }

        const currentVal = this.currentDraftItem.logicProperties[key];

        const input = document.createElement("input");
        input.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 4px; border-radius: 4px; width: 100px; text-align: right;";

        if (type === "number") {
            input.type = "number";
            input.step = "0.1";
            input.value = currentVal;
            input.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    this.currentDraftItem.logicProperties[key] = val;
                }
            });
        } else if (type === "boolean") {
            input.type = "checkbox";
            input.checked = currentVal;
            input.style.width = "18px";
            input.style.height = "18px";
            input.style.cursor = "pointer";
            input.addEventListener("change", (e) => {
                this.currentDraftItem.logicProperties[key] = e.target.checked;
            });
        } else {
            input.type = "text";
            input.value = currentVal;
            input.style.textAlign = "left";
            input.style.width = "120px";
            input.addEventListener("input", (e) => {
                this.currentDraftItem.logicProperties[key] = e.target.value;
            });
        }

        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    }

    createLogicDraftSelect(container, labelText, key, options, defaultValue) {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:5px; width: 100%;";

        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.color = "#aaa";
        label.style.fontSize = "13px";

        if (!this.currentDraftItem.logicProperties) {
            this.currentDraftItem.logicProperties = {};
        }

        if (this.currentDraftItem.logicProperties[key] === undefined) {
            this.currentDraftItem.logicProperties[key] = defaultValue;
        }

        const select = document.createElement("select");
        select.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 4px; border-radius: 4px; width: 120px;";
        options.forEach((option) => {
            const opt = document.createElement("option");
            opt.value = option.value;
            opt.textContent = option.label;
            if (this.currentDraftItem.logicProperties[key] === option.value) opt.selected = true;
            select.appendChild(opt);
        });
        select.onchange = (e) => {
            this.currentDraftItem.logicProperties[key] = e.target.value;
        };

        row.appendChild(label);
        row.appendChild(select);
        container.appendChild(row);
    }

    createLogicDraftGroupSelector(container) {
        if (!this.currentDraftItem.logicProperties) {
            this.currentDraftItem.logicProperties = {};
        }
        if (this.currentDraftItem.logicProperties.groupId === undefined) {
            this.currentDraftItem.logicProperties.groupId = "Grupo 1";
        }
        const props = this.currentDraftItem.logicProperties;

        const row = document.createElement("div");
        row.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; width: 100%;";

        const labelRow = document.createElement("div");
        labelRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; width: 100%;";

        const label = document.createElement("span");
        label.textContent = "Grupo:";
        label.style.color = "#aaa";
        label.style.fontSize = "13px";
        labelRow.appendChild(label);

        row.appendChild(labelRow);

        // Get existing groups
        const activeGroups = getActiveFarmingGroups(this.game);
        const uniqueGroups = new Set();
        activeGroups.forEach(g => {
            if (g.groupId && g.groupId.trim()) {
                uniqueGroups.add(g.groupId);
            }
        });

        // Add the current draft's groupId to uniqueGroups if it's not empty
        if (props.groupId && props.groupId.trim()) {
            uniqueGroups.add(props.groupId);
        }

        const groupsArray = Array.from(uniqueGroups);

        const selectContainer = document.createElement("div");
        selectContainer.style.cssText = "display: flex; flex-direction: column; gap: 5px; width: 100%;";

        // Mode toggling: if no groups exist, we only show standard text input mode
        if (groupsArray.length === 0) {
            const input = document.createElement("input");
            input.type = "text";
            input.value = props.groupId;
            input.placeholder = "Escribe el nombre del grupo";
            input.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 5px; border-radius: 4px; width: 100%; box-sizing: border-box;";
            input.addEventListener("input", (e) => {
                props.groupId = e.target.value;
            });
            selectContainer.appendChild(input);

            const info = document.createElement("div");
            info.textContent = "No hay grupos creados aún. Escribe un nombre para crearlo al colocar la zona.";
            info.style.cssText = "font-size: 10px; color: #888; margin-top: 2px; line-height: 1.2;";
            selectContainer.appendChild(info);
        } else {
            // Options: "Elegir" (Dropdown) or "Crear" (New group input)
            const modeTabs = document.createElement("div");
            modeTabs.style.cssText = "display: flex; gap: 2px; background: #222; border-radius: 4px; padding: 2px;";

            const tabSelect = document.createElement("button");
            tabSelect.textContent = "Elegir";
            tabSelect.style.cssText = "background: #333; border: none; color: white; padding: 2px 8px; font-size: 10px; border-radius: 3px; cursor: pointer; font-weight: bold;";

            const tabCreate = document.createElement("button");
            tabCreate.textContent = "Crear";
            tabCreate.style.cssText = "background: transparent; border: none; color: #aaa; padding: 2px 8px; font-size: 10px; border-radius: 3px; cursor: pointer;";

            modeTabs.appendChild(tabSelect);
            modeTabs.appendChild(tabCreate);
            labelRow.appendChild(modeTabs);

            const select = document.createElement("select");
            select.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 5px; border-radius: 4px; width: 100%; box-sizing: border-box; cursor: pointer;";

            groupsArray.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g;
                opt.textContent = g;
                if (g === props.groupId) opt.selected = true;
                select.appendChild(opt);
            });

            const inputContainer = document.createElement("div");
            inputContainer.style.cssText = "display: none; flex-direction: column; gap: 4px; width: 100%;";

            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "Nombre del nuevo grupo";
            input.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 5px; border-radius: 4px; width: 100%; box-sizing: border-box;";

            inputContainer.appendChild(input);

            // Set current state based on if props.groupId is one of the existing groups or a new one
            const isExisting = groupsArray.includes(props.groupId);
            if (isExisting) {
                tabSelect.style.background = "#333";
                tabSelect.style.color = "white";
                tabCreate.style.background = "transparent";
                tabCreate.style.color = "#aaa";
                select.style.display = "block";
                inputContainer.style.display = "none";
            } else {
                tabSelect.style.background = "transparent";
                tabSelect.style.color = "#aaa";
                tabCreate.style.background = "#333";
                tabCreate.style.color = "white";
                select.style.display = "none";
                inputContainer.style.display = "flex";
                input.value = props.groupId;
            }

            // Events
            tabSelect.onclick = (e) => {
                e.preventDefault();
                tabSelect.style.background = "#333";
                tabSelect.style.color = "white";
                tabCreate.style.background = "transparent";
                tabCreate.style.color = "#aaa";
                select.style.display = "block";
                inputContainer.style.display = "none";
                props.groupId = select.value;
            };

            tabCreate.onclick = (e) => {
                e.preventDefault();
                tabSelect.style.background = "transparent";
                tabSelect.style.color = "#aaa";
                tabCreate.style.background = "#333";
                tabCreate.style.color = "white";
                select.style.display = "none";
                inputContainer.style.display = "flex";
                props.groupId = input.value.trim() || "Grupo 1";
            };

            select.onchange = (e) => {
                props.groupId = e.target.value;
            };

            input.oninput = (e) => {
                props.groupId = e.target.value.trim() || "Grupo 1";
            };

            selectContainer.appendChild(select);
            selectContainer.appendChild(inputContainer);
        }

        row.appendChild(selectContainer);
        container.appendChild(row);
    }

    createLogicDraftTextureSelector(container) {
        if (!this.currentDraftItem.logicProperties) {
            this.currentDraftItem.logicProperties = {};
        }
        if (this.currentDraftItem.logicProperties.itemTexture === undefined) {
            this.currentDraftItem.logicProperties.itemTexture = "/assets/textures/fuego.png";
        }
        const props = this.currentDraftItem.logicProperties;

        const row = document.createElement("div");
        row.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; width: 100%;";

        const label = document.createElement("span");
        label.textContent = "Textura PNG:";
        label.style.color = "#aaa";
        label.style.fontSize = "13px";
        row.appendChild(label);

        const select = document.createElement("select");
        select.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 5px; border-radius: 4px; width: 100%; box-sizing: border-box; cursor: pointer;";

        const textures = [
            { name: "Fuego", val: "/assets/textures/fuego.png" },
            { name: "Pelota", val: "/assets/textures/pelota.png" },
            ...(this.customTextureAssets || []).map((asset) => ({ name: asset.name, val: asset.fileUrl })),
            { name: "URL / Ruta Personalizada...", val: "__CUSTOM__" }
        ];

        let isCustom = true;
        textures.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.val;
            opt.textContent = t.name;
            if (props.itemTexture === t.val) {
                opt.selected = true;
                isCustom = false;
            }
            select.appendChild(opt);
        });

        if (isCustom && props.itemTexture) {
            select.value = "__CUSTOM__";
        }

        const inputContainer = document.createElement("div");
        inputContainer.style.cssText = isCustom ? "display: flex; margin-top: 4px; width: 100%;" : "display: none; margin-top: 4px; width: 100%;";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Ruta o URL (PNG)";
        input.value = isCustom ? props.itemTexture : "";
        input.style.cssText = "background: #333; border: 1px solid #555; color: white; padding: 5px; border-radius: 4px; width: 100%; box-sizing: border-box;";

        inputContainer.appendChild(input);

        // Events
        select.onchange = (e) => {
            const val = e.target.value;
            if (val === "__CUSTOM__") {
                inputContainer.style.display = "flex";
                props.itemTexture = input.value.trim() || "/assets/textures/fuego.png";
            } else {
                inputContainer.style.display = "none";
                props.itemTexture = val;
            }
        };

        input.oninput = (e) => {
            props.itemTexture = e.target.value.trim() || "/assets/textures/fuego.png";
        };

        row.appendChild(select);
        row.appendChild(inputContainer);
        container.appendChild(row);
    }

    updateDraftColor(hexColor) {
        if (!this.currentDraftItem) return;

        // Update model logic
        this.currentDraftItem.color = parseInt(hexColor.replace("#", "0x"));

        // Regenerate Icon
        this.currentDraftItem.iconPath = this.currentDraftItem.generateIcon();

        // Update Preview
        if (this.editorImg) {
            this.editorImg.src = this.currentDraftItem.iconPath;
        }

        // Also update preview border to match?
        this.editorPreview.style.borderColor = hexColor;
    }

    updateDraftOpacity(opacity) {
        if (!this.currentDraftItem) return;

        if (!this.currentDraftItem.opacity) this.currentDraftItem.opacity = 1.0;

        this.currentDraftItem.opacity = opacity;
    }

    updateDraftTexture(texturePath, textureAssetId = null) {
        if (!this.currentDraftItem) return;
        this.currentDraftItem.texturePath = texturePath;
        this.currentDraftItem.textureAssetId = textureAssetId;
        if (!this.currentDraftItem.textureSettings) {
            this.currentDraftItem.textureSettings = getDefaultTextureSettings();
        }
    }

    syncTextureSettingsInputs(settings = null) {
        const normalized = normalizeTextureSettings(settings);
        if (this.currentDraftItem) {
            this.currentDraftItem.textureSettings = { ...normalized };
        }
        if (this.textureFitModeSelect) this.textureFitModeSelect.value = normalized.fitMode;
        ["tileSize", "repeatX", "repeatY", "offsetX", "offsetY", "rotation"].forEach((key) => {
            const input = this[`textureSettingInput_${key}`];
            if (input) input.value = String(normalized[key]);
        });
        if (this.textureSettingInput_patternVariation) {
            this.textureSettingInput_patternVariation.checked = normalized.patternVariation;
        }
    }

    updateDraftTextureSetting(key, value) {
        if (!this.currentDraftItem) return;
        this.currentDraftItem.textureSettings = normalizeTextureSettings({
            ...(this.currentDraftItem.textureSettings || {}),
            [key]: value
        });
        this.syncTextureSettingsInputs(this.currentDraftItem.textureSettings);
    }

    async refreshCustomTextures() {
        try {
            this.customTextureAssets = await listAssets("mine", "TEXTURE");
        } catch (err) {
            this.customTextureAssets = [];
            console.warn("No se pudieron cargar tus texturas", err);
        }
        this.renderCustomTextureButtons();
    }

    renderCustomTextureButtons() {
        if (!this.customTextureGrid) return;
        this.customTextureGrid.innerHTML = "";

        const assets = this.customTextureAssets || [];
        if (assets.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Aun no has subido texturas.";
            empty.style.cssText = "grid-column: 1 / -1; color: #777; font-size: 11px; padding: 6px 0;";
            this.customTextureGrid.appendChild(empty);
            return;
        }

        assets.forEach((asset) => {
            const btn = document.createElement("div");
            btn.className = "texture-btn custom-texture-btn";
            btn.title = asset.name;
            btn.style.cssText = `
                width: 100%;
                aspect-ratio: 1;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
                background-image: url(${asset.fileUrl});
                background-size: cover;
                background-position: center;
                image-rendering: pixelated;
                position: relative;
            `;
            btn.onclick = () => {
                this.updateDraftTexture(asset.fileUrl, asset.id);
                const allBtns = this.panelEditor.querySelectorAll(".texture-btn");
                allBtns.forEach((candidate) => candidate.style.borderColor = "#555");
                btn.style.borderColor = "#00FF00";
            };
            this.customTextureGrid.appendChild(btn);
        });
    }

    updateDraftScale(axis, value) {
        if (!this.currentDraftItem) return;
        this.currentDraftItem.scale[axis] = value;
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? "flex" : "none";

        if (this.isVisible) {
            // Auto-refresh if Logic Tab is active
            if (this.contentLogic.style.display === "flex") {
                this.refreshLogicList();
            }
        }

        // Pause Game Input / Pointer Lock
        if (this.isVisible) {
            if (this.game.cameraController) {
                this.game.cameraController.setUIOpen(true);
            }
            document.exitPointerLock();
            if (this.game.inputManager) {
                this.game.inputManager.enabled = false;
                if (this.game.inputManager.reset) this.game.inputManager.reset();
                this.game.isMouseDown = false;
            }
        } else {
            if (this.game.cameraController) {
                this.game.cameraController.setUIOpen(false);
            }
            // Resume
            if (this.game.inputManager) {
                this.game.inputManager.enabled = true;
                if (this.game.inputManager.reset) this.game.inputManager.reset();
            }

            // Re-request pointer lock after a small delay to ensure browser handles it
            setTimeout(() => {
                if (this.game.cameraController) {
                    this.game.cameraController.lock();
                } else {
                    try {
                        const promise = document.body.requestPointerLock();
                        if (promise && typeof promise.catch === "function") {
                            promise.catch((err) => {
                                if (err.name !== "NotAllowedError" && err.name !== "SecurityError") {
                                    console.warn("[ConstructionMenu] requestPointerLock failed:", err);
                                }
                            });
                        }
                    } catch (err) {
                        console.warn("[ConstructionMenu] requestPointerLock threw error:", err);
                    }
                }
            }, 100);
        }
    }

    refreshLogicList() {
        if (!this.logicTreePanel) return;

        this.logicTreePanel.innerHTML = "";

        // Use LogicSystem to scan
        const logicObjects = this.logicSystem.scanScene(this.game.sceneManager.scene);

        if (logicObjects.length === 0) {
            this.logicTreePanel.innerHTML = "<div style=\"color:#666; text-align:center; padding:10px;\">No hay objetos lógicos en la escena.</div>";
            const info = document.createElement("div");
            info.style.cssText = "color:#888; font-size:12px; text-align:center; margin-top:10px; padding:10px;";
            info.innerHTML = "Aplica lógica con herramientas<br>(ej. Control de Movimiento)";
            this.logicTreePanel.appendChild(info);
            return;
        }

        // Group by Logic Type
        const groups = {};
        logicObjects.forEach(obj => {
            let type = "other";

            // Determine primary logic category
            if (obj.userData.mapObjectType === "spawn_point") {
                type = "spawn_point";
            } else if (["impulse_jump", "impulse_lateral", "impulse_neon", "gravity_pad", "fuel_zone", "farming_zone", "gravity_sphere"].includes(obj.userData.mapObjectType)) {
                type = "interactive_zones";
            } else if (
                obj.userData.logicProperties &&
                (obj.userData.logicProperties.waypoints ||
                    (Array.isArray(obj.userData.logicProperties.sequences) && obj.userData.logicProperties.sequences.length > 0))
            ) {
                type = "movement_object";
            } else if (obj.userData.mapObjectType === "damage_controller" || (obj.userData.logicProperties && obj.userData.logicProperties.enableDamage === true)) {
                type = "damage_controller";
            } else {
                // Fallback to base type if it has some other unknown logic
                type = obj.userData.mapObjectType || "Desconocido";
            }

            if (!groups[type]) groups[type] = [];
            groups[type].push(obj);
        });

        // Render Groups
        for (const [type, objs] of Object.entries(groups)) {
            // Group Header
            const groupDetails = document.createElement("details");
            groupDetails.open = true;
            groupDetails.style.cssText = "background: #333; border-radius: 4px; margin-bottom: 5px;";

            const summary = document.createElement("summary");
            summary.textContent = `${this.logicSystem.getHumanReadableName(type)} (${objs.length})`;
            summary.style.cssText = "padding: 8px; cursor: pointer; font-weight: bold; user-select: none;";

            groupDetails.appendChild(summary);

            const list = document.createElement("div");
            list.style.cssText = "display: flex; flex-direction: column; padding: 5px; gap: 2px;";

            objs.forEach((obj, index) => {
                const itemRow = document.createElement("div");

                // Determine Name: Use signalName if available, otherwise name, otherwise customName, otherwise type-based default
                let displayName = "";
                if (obj.userData.logicProperties) {
                    if (obj.userData.logicProperties.signalName) displayName = obj.userData.logicProperties.signalName;
                    else if (obj.userData.logicProperties.name) displayName = obj.userData.logicProperties.name;
                }
                if (!displayName && obj.userData.customName) {
                    displayName = obj.userData.customName;
                }
                if (!displayName) {
                    const baseName = this.getHumanReadableName(obj.userData.mapObjectType) || "Objeto";
                    displayName = `${baseName} #${index + 1}`;
                }

                itemRow.textContent = displayName;
                itemRow.style.cssText = "padding: 6px; background: #2a2a2a; cursor: pointer; border-radius: 4px; font-size: 14px; user-select: none;";

                // Pre-highlight if selected
                if (this.selectedLogicObject === obj) {
                    itemRow.style.background = "#555";
                }

                itemRow.onmouseover = () => {
                    // Don't change if currently editing (input exists)
                    if (itemRow.querySelector("input")) return;
                    itemRow.style.background = "#444";
                };
                itemRow.onmouseout = () => {
                    if (itemRow.querySelector("input")) return;
                    if (this.selectedLogicObject !== obj) itemRow.style.background = "#2a2a2a";
                    else itemRow.style.background = "#555";
                };

                // Single Click: Select
                itemRow.onclick = () => {
                    if (itemRow.querySelector("input")) return;

                    // Visual Selection
                    const allRows = this.logicTreePanel.querySelectorAll("div div");
                    allRows.forEach(r => r.style.background = "#2a2a2a");
                    itemRow.style.background = "#555";

                    this.selectedLogicObject = obj;
                    this.renderLogicProperties(obj);
                };

                // Double Click: Rename
                itemRow.ondblclick = (e) => {
                    e.stopPropagation();

                    // Create Input
                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = displayName;
                    input.style.cssText = `
                        width: 100%; 
                        background: #111; 
                        color: white; 
                        border: 1px solid #00FF00; 
                        padding: 2px 4px; 
                        font-size: 14px; 
                        border-radius: 2px;
                        outline: none;
                    `;

                    // Replace content
                    itemRow.textContent = "";
                    itemRow.appendChild(input);
                    input.focus();
                    // Select all text
                    input.select();

                    // Prevent click propagation from input so it doesn't trigger row onClick
                    input.onclick = (ev) => ev.stopPropagation();

                    const confirm = () => {
                        let newName = input.value.trim();
                        if (!newName) {
                            const baseName = this.getHumanReadableName(obj.userData.mapObjectType) || "Objeto";
                            newName = `${baseName} #${index + 1}`;
                        }

                        // Update Logic Props
                        if (!obj.userData.logicProperties) obj.userData.logicProperties = {};

                        // Set requested properties
                        obj.userData.logicProperties.signalName = newName;
                        obj.userData.logicProperties.name = newName;

                        // Refresh to show new name and restore UI
                        this.refreshLogicList();

                        // Refresh properties panel if currently selected
                        if (this.selectedLogicObject === obj) {
                            this.renderLogicProperties(obj);
                        }
                    };

                    input.onblur = confirm;
                    input.onkeydown = (ev) => {
                        ev.stopPropagation();
                        if (ev.key === "Enter") {
                            confirm();
                        }
                    };
                };

                list.appendChild(itemRow);
            });

            groupDetails.appendChild(list);
            this.logicTreePanel.appendChild(groupDetails);
        }
    }

    getHumanReadableName(type) {
        return this.logicSystem ? this.logicSystem.getHumanReadableName(type) : type;
    }

    renderLogicProperties(object) {
        if (!this.logicPropertiesPanel) return;
        // Delegate to Logic System
        this.logicSystem.renderPanel(this.logicPropertiesPanel, object, () => {
            this.refreshLogicList();
        });
    }

    selectLogicObject(targetObject) {
        if (!targetObject) return;

        // 1. Switch to Logic Tab
        this.switchTab("logic");

        // 2. Ensure list is fresh
        this.refreshLogicList();

        // 3. Find and Highlight in Tree
        this.selectedLogicObject = targetObject;

        // Render Properties
        this.renderLogicProperties(targetObject);

        // Re-call refreshLogicList to apply the visual highlight
        this.refreshLogicList();
    }

    startPickingTarget(controllerObj) {
        if (!controllerObj) return;

        this.isPickingTarget = true;
        this.pickingController = controllerObj;
        this.container.style.display = "none"; // Hide menu

        // We also need to hide LogicToolbar if it's open (which it likely is)
        if (this.logicSystem) {
            this.logicSystem.toolbar.hide();
        }

        alert("Modo Vinculación: Haz clic derecho sobre el objeto objetivo para vincularlo.");
    }
}
