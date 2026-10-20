// @ts-nocheck

import { renderFuelZoneBorder } from "./logic_items/FuelZoneLogic"
import { normalizeFuelZone } from "../fuel/FuelZoneSettings"

import * as THREE from "three"
import { StairsUtils } from "../utils/StairsUtils"
import { RampUtils } from "../utils/RampUtils"
import { LogicItemsManager } from "./logic_items/LogicItemsManager"
import { listAssets, uploadAsset } from "../platform/api"
import { applyMapObjectTexture, normalizeTextureSettings } from "../utils/TextureMapping"
import { createCurvedGeometry, normalizeCurvature, patchCurvature, resolveCurvature, supportsCurvature, curveAngleRange } from "../utils/CurvatureUtils"
import { TransformGizmo } from "../editor/TransformGizmo"
import { updateImpulsePadVisuals } from "../fx/NeonImpulseVisual"

export class ObjectInspector {
    constructor(gameInstance) {
        this.game = gameInstance
        this.isVisible = false
        this.selectedObject = null
        this.customTextureAssets = []
        this.allowDynamicSwitch = true
        this.isCollapsed = false
        this.spikeTextureSelectionMode = false
        this.fuelActiveSubElement = 'zone'
        this.fuelSubElementButtons = new Map()

        this.setupUI()
        this.transformGizmo = new TransformGizmo(this.game, this)
        void this.refreshCustomTextures()
    }

    setupUI() {
        // Main Container
        this.container = document.createElement('div')
        this.container.id = 'object-inspector'
        this.container.style.cssText = `
            position: relative;
            width: 100%;
            height: auto;
            background: transparent;
            border: none;
            border-radius: 0;
            display: none;
            flex-direction: column;
            color: white;
            font-family: sans-serif;
            padding: 10px 14px;
            box-sizing: border-box;
            box-shadow: none;
            overflow-y: visible;
        `

        // Header interno ocultado ya que EditorExplorer provee el encabezado y botones
        const header = document.createElement('div')
        header.style.display = 'none'
        this.title = document.createElement('h3')
        this.title.style.margin = "0"
        this.title.textContent = "Inspector"

        // Buttons container
        const btnContainer = document.createElement('div')
        btnContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `

        // Toggle Collapse Button
        this.collapseBtn = document.createElement('span')
        this.collapseBtn.textContent = "▲"
        this.collapseBtn.style.cursor = "pointer"
        this.collapseBtn.style.fontSize = "16px"
        this.collapseBtn.style.color = "#aaa"
        this.collapseBtn.title = "Minimizar / Maximizar"
        this.collapseBtn.onclick = () => this.toggleCollapse()

        const closeBtn = document.createElement('span')
        closeBtn.textContent = "✕"
        closeBtn.style.cursor = "pointer"
        closeBtn.style.fontSize = "20px"
        closeBtn.onclick = () => this.hide()

        btnContainer.appendChild(this.collapseBtn)
        btnContainer.appendChild(closeBtn)

        header.appendChild(this.title)
        header.appendChild(btnContainer)
        this.container.appendChild(header)

        // Properties Container
        this.content = document.createElement('div')
        this.content.style.display = "flex"
        this.content.style.flexDirection = "column"
        this.content.style.gap = "15px"
        this.container.appendChild(this.content)

        // 1. Position Controls
        this.positionSection = this.createSection("Posición", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;`

            this.inputPosX = this.createNumberInput("X", (v) => this.updatePosition('x', v), -Infinity, 0.5, "#FF4444")
            this.inputPosY = this.createNumberInput("Y", (v) => this.updatePosition('y', v), -Infinity, 0.5, "#44FF44")
            this.inputPosZ = this.createNumberInput("Z", (v) => this.updatePosition('z', v), -Infinity, 0.5, "#4444FF")

            row.appendChild(this.inputPosX.container)
            row.appendChild(this.inputPosY.container)
            row.appendChild(this.inputPosZ.container)
            section.appendChild(row)

            // Nudge Buttons (Careful Move)
            const nudgeContainer = document.createElement('div')
            // ... (rest of nudge logic)
            nudgeContainer.style.marginTop = "10px"
            nudgeContainer.style.display = "grid"
            nudgeContainer.style.gridTemplateColumns = "repeat(3, 1fr)" // X, Y, Z columns
            nudgeContainer.style.gap = "5px"

            // Helpers for buttons
            const createNudgeGroup = (axis, color) => {
                const group = document.createElement('div')
                group.style.display = "flex"
                group.style.flexDirection = "column"
                group.style.gap = "2px"
                group.style.borderTop = `2px solid ${color}`
                group.style.paddingTop = "2px"

                const btnPlus = document.createElement('button')
                // ...
                btnPlus.textContent = `+${axis}`
                btnPlus.style.cssText = `background: #444; color: white; border: none; padding: 4px; cursor: pointer; border-radius: 3px; font-size: 10px;`
                btnPlus.onclick = () => this.nudge(axis, 0.1)

                const btnMinus = document.createElement('button')
                btnMinus.textContent = `-${axis}`
                btnMinus.style.cssText = `background: #444; color: white; border: none; padding: 4px; cursor: pointer; border-radius: 3px; font-size: 10px;`
                btnMinus.onclick = () => this.nudge(axis, -0.1)

                group.appendChild(btnPlus)
                group.appendChild(btnMinus)
                return group
            }

            nudgeContainer.appendChild(createNudgeGroup('X', '#FF4444'))
            nudgeContainer.appendChild(createNudgeGroup('Y', '#44FF44'))
            nudgeContainer.appendChild(createNudgeGroup('Z', '#4444FF'))
            section.appendChild(nudgeContainer)
        })

        // 1.5 Rotation Controls
        this.rotationSection = this.createSection("Rotación (Grados)", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;`

            this.inputRotX = this.createNumberInput("X°", (v) => this.updateRotation('x', v), -Infinity, 15, "#FF4444")
            this.inputRotY = this.createNumberInput("Y°", (v) => this.updateRotation('y', v), -Infinity, 15, "#44FF44")
            this.inputRotZ = this.createNumberInput("Z°", (v) => this.updateRotation('z', v), -Infinity, 15, "#4444FF")

            row.appendChild(this.inputRotX.container)
            row.appendChild(this.inputRotY.container)
            row.appendChild(this.inputRotZ.container)
            section.appendChild(row)

            // Nudge Buttons (Rotate 90)
            const nudgeContainer = document.createElement('div')
            nudgeContainer.style.marginTop = "10px"
            nudgeContainer.style.display = "grid"
            nudgeContainer.style.gridTemplateColumns = "repeat(3, 1fr)"
            nudgeContainer.style.gap = "5px"

            const createRotNudgeGroup = (axis, color) => {
                const group = document.createElement('div')
                group.style.display = "flex"
                group.style.flexDirection = "column"
                group.style.gap = "2px"
                group.style.borderTop = `2px solid ${color}`
                group.style.paddingTop = "2px"

                const btnPlus = document.createElement('button')
                btnPlus.textContent = `+90°`
                btnPlus.style.cssText = `background: #444; color: white; border: none; padding: 4px; cursor: pointer; border-radius: 3px; font-size: 10px;`
                btnPlus.onclick = () => this.nudgeRotation(axis, 90)

                const btnMinus = document.createElement('button')
                btnMinus.textContent = `-90°`
                btnMinus.style.cssText = `background: #444; color: white; border: none; padding: 4px; cursor: pointer; border-radius: 3px; font-size: 10px;`
                btnMinus.onclick = () => this.nudgeRotation(axis, -90)

                group.appendChild(btnPlus)
                group.appendChild(btnMinus)
                return group
            }

            nudgeContainer.appendChild(createRotNudgeGroup('X', '#FF4444'))
            nudgeContainer.appendChild(createRotNudgeGroup('Y', '#44FF44'))
            nudgeContainer.appendChild(createRotNudgeGroup('Z', '#4444FF'))
            section.appendChild(nudgeContainer)
        })

        this.curvatureSection = this.createSection("Curvatura", (section) => {
            const label = document.createElement('label')
            label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px'
            this.curvatureToggle = document.createElement('input')
            this.curvatureToggle.type = 'checkbox'
            this.curvatureToggle.onchange = () => this.updateCurvature({ enabled: this.curvatureToggle.checked })
            label.append(this.curvatureToggle, document.createTextNode('Activar curvatura'))
            section.appendChild(label)
            this.curvatureFields = document.createElement('div')
            this.curvatureFields.style.cssText = 'display:grid;gap:8px;margin-top:10px'
            const hint = document.createElement('div')
            hint.style.cssText = 'font-size:11px;color:#9acfff;line-height:1.5'
            hint.textContent = 'R: Mover → Escalar → Rotar → Curvatura. El arco ámbar identifica la curva activa. Arrastra su flecha en ambos sentidos; conserva los ejes elegidos. Para cambiar dónde se dobla, usa Mover punto de doblez: arrastra el punto celeste o haz clic y arrastra sobre la pared. Las curvas se combinan en el orden de la lista.'
            this.curvatureFields.appendChild(hint)
            const makeSelect = (title, entries, change) => {
                const row = document.createElement('label')
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:12px'
                row.appendChild(document.createTextNode(title))
                const select = document.createElement('select')
                select.style.cssText = 'background:#222;color:white;border:1px solid #555;border-radius:4px;padding:5px'
                entries.forEach(([value, text]) => select.add(new Option(text, value)))
                select.onchange = () => change(select.value)
                row.appendChild(select)
                this.curvatureFields.appendChild(row)
                return select
            }
            this.curvatureLayerSelect = makeSelect('Curva activa', [], value => this.updateCurvature({ activeLayer: Number(value) }))
            const layerActions = document.createElement('div')
            layerActions.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap'
            const layerButton = (text, action) => {
                const b = document.createElement('button')
                b.textContent = text
                b.style.cssText = 'background:#352a18;color:#ffcd76;border:1px solid #85612e;border-radius:4px;padding:6px;cursor:pointer'
                b.onclick = action
                layerActions.appendChild(b)
                return b
            }
            layerButton('+ Añadir curva', () => {
                const curve = normalizeCurvature(this.selectedObject.userData.originalScale.curvature)
                this.updateCurvature({ layers: [...curve.layers, { axis: curve.axis, direction: curve.direction, angle: 0, origin: curve.origin }], activeLayer: curve.layers.length })
            })
            this.curvatureRemoveButton = layerButton('Eliminar curva', () => {
                const curve = normalizeCurvature(this.selectedObject.userData.originalScale.curvature)
                if (curve.layers.length < 2) return
                this.updateCurvature({ layers: curve.layers.filter((_, index) => index !== curve.activeLayer), activeLayer: Math.max(0, curve.activeLayer - 1) })
            })
            const moveLayer = delta => {
                const curve = normalizeCurvature(this.selectedObject.userData.originalScale.curvature)
                const next = curve.activeLayer + delta
                if (next < 0 || next >= curve.layers.length) return
                ;[curve.layers[next], curve.layers[curve.activeLayer]] = [curve.layers[curve.activeLayer], curve.layers[next]]
                this.updateCurvature({ layers: curve.layers, activeLayer: next })
            }
            this.curvatureUpButton = layerButton('Subir', () => moveLayer(-1))
            this.curvatureDownButton = layerButton('Bajar', () => moveLayer(1))
            this.curvatureFields.appendChild(layerActions)
            this.curvatureAxis = makeSelect('Recorrido', [['x', 'Ancho · X'], ['y', 'Alto · Y'], ['z', 'Profundidad · Z']], axis => {
                const curve = normalizeCurvature(this.selectedObject.userData.originalScale.curvature)
                this.updateCurvature({ axis, direction: axis === curve.direction ? (axis === 'z' ? 'x' : 'z') : curve.direction })
            })
            this.curvatureDirection = makeSelect('Doblar hacia', [['x', 'Izq. / der. · X'], ['y', 'Arriba / abajo · Y'], ['z', 'Dentro / fuera · Z']], direction => this.updateCurvature({ direction }))
            this.curvatureOrigin = this.createNumberInput('Punto de doblez (%) · 0 inicio / 50 centro / 100 fin', value => this.updateCurvature({ origin: value / 100 }), 0, 1, '#48ddff')
            this.curvatureOrigin.input.max = '100'
            this.curvatureOrigin.input.setAttribute('aria-label', 'Punto de doblez (%)')
            this.curvatureFields.appendChild(this.curvatureOrigin.container)
            this.curvatureAngle = this.createNumberInput('Ángulo (°)', angle => this.updateCurvature({ angle }), -360, 1, '#66ccff')
            this.curvatureAngle.input.max = '360'
            this.curvatureAngle.input.setAttribute('aria-label', 'Ángulo de curvatura')
            this.curvatureFields.appendChild(this.curvatureAngle.container)
            this.curvatureStatus = document.createElement('div')
            this.curvatureStatus.style.cssText = 'font-size:11px;color:#aaa;line-height:1.5'
            this.curvatureFields.appendChild(this.curvatureStatus)
            const actions = document.createElement('div')
            actions.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap'
            const button = (text, action) => {
                const b = document.createElement('button')
                b.textContent = text
                b.style.cssText = 'background:#16334c;color:#d4eaff;border:1px solid #345d7b;border-radius:4px;padding:6px;cursor:pointer'
                b.onclick = action
                actions.appendChild(b)
                return b
            }
            this.curvatureEditButton = button('Ajustar ángulo', () => this.transformGizmo.setCurvatureOriginEditing(false))
            this.curvatureOriginButton = button('Mover punto de doblez', () => this.transformGizmo.setCurvatureOriginEditing(true))
            button('Centrar punto', () => this.updateCurvature({ origin: 0.5 }))
            this.curvatureCircleButton = button('Círculo 360°', () => this.updateCurvature({ angle: 360 }))
            button('Enderezar curva', () => this.updateCurvature({ angle: 0 }))
            this.curvatureFields.appendChild(actions)
            const modes = document.createElement('div')
            modes.style.cssText = 'display:flex;gap:5px;margin-top:8px'
            ;[['translate', 'Mover'], ['scale', 'Escalar'], ['rotate', 'Rotar']].forEach(([mode, title]) => {
                const b = document.createElement('button')
                b.textContent = title
                b.style.cssText = 'flex:1;background:#222;color:#ddd;border:1px solid #555;padding:5px;border-radius:4px;cursor:pointer'
                b.onclick = () => { this.transformGizmo.setMode(mode); this.transformGizmo.update(); this.syncCurvatureInputs() }
                modes.appendChild(b)
            })
            this.curvatureFields.appendChild(modes)
            section.appendChild(this.curvatureFields)
        })

        // 2. Dimensions/Scale Controls
         this.dimensionsSection = this.createSection("Dimensiones", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;`

            this.inputScaleX = this.createNumberInput("Ancho", (v) => this.updateDimensions('x', v), 0.1, 0.5, "#FF4444")
            this.inputScaleY = this.createNumberInput("Alto", (v) => this.updateDimensions('y', v), 0.1, 0.5, "#44FF44")
            this.inputScaleZ = this.createNumberInput("Prof.", (v) => this.updateDimensions('z', v), 0.1, 0.5, "#4444FF")

            row.appendChild(this.inputScaleX.container)
            row.appendChild(this.inputScaleY.container)
            row.appendChild(this.inputScaleZ.container)
            section.appendChild(row)

            // Custom rows for new geometries
            const createCustomRow = (labelText) => {
                const r = document.createElement("div");
                r.style.cssText = "display: none; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px; font-size: 12px; color: #ccc;";
                const lbl = document.createElement("span");
                lbl.textContent = labelText;
                const input = document.createElement("input");
                input.type = "number";
                input.style.cssText = "width: 70px; background: #222; color: white; border: 1px solid #444; border-radius: 4px; padding: 4px; font-size: 11px;";
                r.appendChild(lbl);
                r.appendChild(input);
                return { row: r, input };
            };

            const rRad = createCustomRow("Radio:");
            rRad.input.step = "0.5";
            rRad.input.min = "0.1";
            rRad.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && this.selectedObject) {
                    this.selectedObject.userData.originalScale.radius = val;
                    const type = this.selectedObject.userData.mapObjectType;
                    if (type === "sphere") {
                        this.selectedObject.userData.originalScale.x = val * 2;
                        this.selectedObject.userData.originalScale.y = val * 2;
                        this.selectedObject.userData.originalScale.z = val * 2;
                    } else if (type === "circle") {
                        this.selectedObject.userData.originalScale.x = val * 2;
                        this.selectedObject.userData.originalScale.z = val * 2;
                    } else if (type === "cylinder" || type === "tube" || type === "cone") {
                        this.selectedObject.userData.originalScale.x = val * 2;
                        this.selectedObject.userData.originalScale.z = val * 2;
                    }
                    this.updateDimensions('x', this.selectedObject.userData.originalScale.x, true);
                }
            };
            section.appendChild(rRad.row);
            this.rowRadius = rRad.row;
            this.inputRadius = rRad.input;

            const rLen1 = createCustomRow("Largo 1 (Alto):");
            rLen1.input.step = "0.5";
            rLen1.input.min = "0.1";
            rLen1.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && this.selectedObject) {
                    const type = this.selectedObject.userData.mapObjectType;
                    if (type === "tube") {
                        const scale = this.selectedObject.userData.originalScale;
                        const segments = getTubeSegments(scale);
                        const idx = parseInt(this.selectSegmentDropdown.value) || 0;
                        if (segments[idx]) {
                            segments[idx].length = val;
                            if (idx === 0) scale.y = val;
                            this.updateDimensions('y', scale.y, true);
                        }
                    } else {
                        this.updateDimensions('y', val, true);
                    }
                }
            };
            section.appendChild(rLen1.row);
            this.rowLength1 = rLen1.row;
            this.inputLength1 = rLen1.input;

            const rLen2 = createCustomRow("Largo 2:");
            rLen2.input.step = "0.5";
            rLen2.input.min = "0.1";
            rLen2.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && this.selectedObject) {
                    this.selectedObject.userData.originalScale.length2 = val;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                }
            };
            section.appendChild(rLen2.row);
            this.rowLength2 = rLen2.row;
            this.inputLength2 = rLen2.input;

            const rBendX = createCustomRow("Doblez Ángulo X (°):");
            rBendX.input.step = "15";
            rBendX.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && this.selectedObject) {
                    const type = this.selectedObject.userData.mapObjectType;
                    if (type === "tube") {
                        const scale = this.selectedObject.userData.originalScale;
                        const segments = getTubeSegments(scale);
                        const idx = parseInt(this.selectSegmentDropdown.value) || 0;
                        if (segments[idx]) {
                            segments[idx].bendAngleX = val;
                            this.updateDimensions('y', scale.y, true);
                        }
                    } else {
                        this.selectedObject.userData.originalScale.bendAngleX = val;
                        this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                    }
                }
            };
            section.appendChild(rBendX.row);
            this.rowBendAngleX = rBendX.row;
            this.inputBendAngleX = rBendX.input;

            const rBendY = createCustomRow("Doblez Ángulo Y (°):");
            rBendY.input.step = "15";
            rBendY.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && this.selectedObject) {
                    const type = this.selectedObject.userData.mapObjectType;
                    if (type === "tube") {
                        const scale = this.selectedObject.userData.originalScale;
                        const segments = getTubeSegments(scale);
                        const idx = parseInt(this.selectSegmentDropdown.value) || 0;
                        if (segments[idx]) {
                            segments[idx].bendAngleY = val;
                            this.updateDimensions('y', scale.y, true);
                        }
                    } else {
                        this.selectedObject.userData.originalScale.bendAngleY = val;
                        this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                    }
                }
            };
            section.appendChild(rBendY.row);
            this.rowBendAngleY = rBendY.row;
            this.inputBendAngleY = rBendY.input;

            const rSpikeRad = createCustomRow("Radio Pinchos:");
            rSpikeRad.input.step = "0.05";
            rSpikeRad.input.min = "0.01";
            rSpikeRad.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && this.selectedObject) {
                    this.selectedObject.userData.originalScale.spikeRadius = val;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                }
            };
            section.appendChild(rSpikeRad.row);
            this.rowSpikeRadius = rSpikeRad.row;
            this.inputSpikeRadius = rSpikeRad.input;

            const rSpikeHt = createCustomRow("Alto Pinchos:");
            rSpikeHt.input.step = "0.05";
            rSpikeHt.input.min = "0.01";
            rSpikeHt.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && this.selectedObject) {
                    this.selectedObject.userData.originalScale.spikeHeight = val;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                }
            };
            section.appendChild(rSpikeHt.row);
            this.rowSpikeHeight = rSpikeHt.row;
            this.inputSpikeHeight = rSpikeHt.input;

            const rSpikeSp = createCustomRow("Separación Pinchos:");
            rSpikeSp.input.step = "0.05";
            rSpikeSp.input.min = "0.05";
            rSpikeSp.input.onchange = (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && this.selectedObject) {
                    this.selectedObject.userData.originalScale.spikeSpacing = val;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                }
            };
            section.appendChild(rSpikeSp.row);
            this.rowSpikeSpacing = rSpikeSp.row;
            this.inputSpikeSpacing = rSpikeSp.input;

            // Spike Color Row
            const rSpikeColor = createCustomRow("Color Pinchos:");
            const spikeColorPicker = document.createElement("input");
            spikeColorPicker.type = "color";
            spikeColorPicker.style.cssText = "width: 70px; background: #222; border: 1px solid #444; border-radius: 4px; padding: 2px; cursor: pointer;";
            rSpikeColor.row.replaceChild(spikeColorPicker, rSpikeColor.input);
            spikeColorPicker.addEventListener("input", (e: any) => {
                if (this.selectedObject) {
                    this.selectedObject.userData.originalScale.spikeColor = e.target.value;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                }
            });
            section.appendChild(rSpikeColor.row);
            this.rowSpikeColor = rSpikeColor.row;
            this.inputSpikeColor = spikeColorPicker;

            // Spike Texture Row
            const rSpikeTex = createCustomRow("Textura Pinchos:");
            
            const spikeTexContainer = document.createElement("div");
            spikeTexContainer.style.cssText = "display: flex; align-items: center; gap: 5px;";
            
            const spikeTexLabel = document.createElement("span");
            spikeTexLabel.style.cssText = "font-size: 11px; color: #aaa; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
            spikeTexLabel.textContent = "Ninguna";
            
            const spikeTexBtn = document.createElement("button");
            spikeTexBtn.type = "button";
            spikeTexBtn.textContent = "Seleccionar";
            spikeTexBtn.style.cssText = "background: #444; color: white; border: 1px solid #555; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;";
            
            const spikeTexClearBtn = document.createElement("button");
            spikeTexClearBtn.type = "button";
            spikeTexClearBtn.textContent = "✖";
            spikeTexClearBtn.title = "Quitar textura";
            spikeTexClearBtn.style.cssText = "background: #cc3333; color: white; border: none; border-radius: 4px; padding: 3px 6px; font-size: 11px; cursor: pointer; display: none;";
            
            spikeTexBtn.onclick = () => {
                this.spikeTextureSelectionMode = !this.spikeTextureSelectionMode;
                this.syncTransformInputs();
            };
            
            spikeTexClearBtn.onclick = () => {
                if (this.selectedObject) {
                    this.selectedObject.userData.originalScale.spikeTexturePath = null;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                    this.spikeTextureSelectionMode = false;
                    this.syncTransformInputs();
                    if (this.game && this.game.broadcastObjectUpdate) {
                        this.game.broadcastObjectUpdate(this.selectedObject);
                    }
                }
            };
            
            spikeTexContainer.appendChild(spikeTexLabel);
            spikeTexContainer.appendChild(spikeTexBtn);
            spikeTexContainer.appendChild(spikeTexClearBtn);
            
            rSpikeTex.row.replaceChild(spikeTexContainer, rSpikeTex.input);
            section.appendChild(rSpikeTex.row);
            this.rowSpikeTexture = rSpikeTex.row;
            this.inputSpikeTexture = spikeTexLabel; 
            this.btnSpikeTexture = spikeTexBtn; 
            this.btnSpikeTextureClear = spikeTexClearBtn;

            // Tube Multi-segment Controls
            const tubeRow = document.createElement("div");
            tubeRow.style.cssText = "display: none; flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;";
            
            const tubeTitle = document.createElement("span");
            tubeTitle.textContent = "Editar Dobleces de Tubo:";
            tubeTitle.style.cssText = "font-size: 11px; font-weight: bold; color: orange;";
            tubeRow.appendChild(tubeTitle);

            const editBendsCheckRow = document.createElement("div");
            editBendsCheckRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 5px;";
            const editBendsLbl = document.createElement("span");
            editBendsLbl.textContent = "Editar Dobleces con Gizmo:";
            editBendsLbl.style.fontSize = "11px";
            const editBendsChk = document.createElement("input");
            editBendsChk.type = "checkbox";
            editBendsChk.addEventListener("change", () => {
                this.updateGizmoAttachment();
            });
            editBendsCheckRow.appendChild(editBendsLbl);
            editBendsCheckRow.appendChild(editBendsChk);
            tubeRow.appendChild(editBendsCheckRow);
            this.chkEditBends = editBendsChk;

            const segSelectRow = document.createElement("div");
            segSelectRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 5px;";
            const segSelectLbl = document.createElement("span");
            segSelectLbl.textContent = "Seleccionar Tramo:";
            segSelectLbl.style.fontSize = "11px";
            const segSelectDropdown = document.createElement("select");
            segSelectDropdown.style.cssText = "width: 120px; background: #222; color: white; border: 1px solid #444; border-radius: 4px; padding: 2px; font-size: 11px;";
            segSelectDropdown.addEventListener("change", () => {
                this.syncTransformInputs();
                this.updateGizmoAttachment();
            });
            segSelectRow.appendChild(segSelectLbl);
            segSelectRow.appendChild(segSelectDropdown);
            tubeRow.appendChild(segSelectRow);
            this.selectSegmentDropdown = segSelectDropdown;

            const segActionsRow = document.createElement("div");
            segActionsRow.style.cssText = "display: flex; gap: 5px; margin-top: 5px;";
            const addSegBtn = document.createElement("button");
            addSegBtn.textContent = "+ Agregar Doblez";
            addSegBtn.style.cssText = "flex: 1; background: #22c55e; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 10px; cursor: pointer;";
            addSegBtn.addEventListener("click", () => {
                if (this.selectedObject) {
                    const scale = this.selectedObject.userData.originalScale;
                    const segments = getTubeSegments(scale);
                    const lastSeg = segments[segments.length - 1] || { length: 2.0, bendAngleX: 0, bendAngleY: 90 };
                    segments.push({
                        length: 2.0,
                        bendAngleX: 45,
                        bendAngleY: 0,
                        color: lastSeg.color !== undefined ? lastSeg.color : undefined,
                        opacity: lastSeg.opacity !== undefined ? lastSeg.opacity : undefined,
                        texturePath: lastSeg.texturePath || null,
                        textureSettings: lastSeg.textureSettings ? JSON.parse(JSON.stringify(lastSeg.textureSettings)) : undefined
                    });
                    scale.segments = segments;
                    
                    this.updateDimensions('y', scale.y, true);
                    this.syncTubeSegmentDropdown();
                    this.selectSegmentDropdown.value = String(segments.length - 1);
                    this.selectSegmentDropdown.dispatchEvent(new Event("change"));
                }
            });
            const delSegBtn = document.createElement("button");
            delSegBtn.textContent = "- Eliminar Doblez";
            delSegBtn.style.cssText = "flex: 1; background: #ef4444; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 10px; cursor: pointer;";
            delSegBtn.addEventListener("click", () => {
                if (this.selectedObject) {
                    const scale = this.selectedObject.userData.originalScale;
                    const segments = getTubeSegments(scale);
                    const idx = parseInt(this.selectSegmentDropdown.value) || 0;
                    if (segments.length > 1) {
                        segments.splice(idx, 1);
                        scale.segments = segments;
                        this.updateDimensions('y', scale.y, true);
                        this.syncTubeSegmentDropdown();
                        this.selectSegmentDropdown.value = String(Math.max(0, idx - 1));
                        this.selectSegmentDropdown.dispatchEvent(new Event("change"));
                    }
                }
            });
            segActionsRow.appendChild(addSegBtn);
            segActionsRow.appendChild(delSegBtn);
            tubeRow.appendChild(segActionsRow);

            // X Slider Row
            const sliderXRow = document.createElement("div");
            sliderXRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-top: 5px;";
            const sliderXLbl = document.createElement("span");
            sliderXLbl.textContent = "Doblez X (Deslizar):";
            sliderXLbl.style.fontSize = "11px";
            const sliderXInput = document.createElement("input");
            sliderXInput.type = "range";
            sliderXInput.min = "-180";
            sliderXInput.max = "180";
            sliderXInput.step = "5";
            sliderXInput.style.cssText = "flex: 1; accent-color: orange;";
            sliderXInput.addEventListener("input", (e: any) => {
                const val = parseInt(e.target.value);
                if (this.selectedObject) {
                    const scale = this.selectedObject.userData.originalScale;
                    const segments = getTubeSegments(scale);
                    const idx = parseInt(this.selectSegmentDropdown.value) || 0;
                    if (segments[idx]) {
                        segments[idx].bendAngleX = val;
                        if (this.inputBendAngleX) this.inputBendAngleX.value = val;
                        this.updateDimensions('y', scale.y, true);
                    }
                }
            });
            sliderXRow.appendChild(sliderXLbl);
            sliderXRow.appendChild(sliderXInput);
            tubeRow.appendChild(sliderXRow);
            this.sliderBendX = sliderXInput;
            this.rowSliderBendX = sliderXRow;

            // Y Slider Row
            const sliderYRow = document.createElement("div");
            sliderYRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-top: 5px;";
            const sliderYLbl = document.createElement("span");
            sliderYLbl.textContent = "Doblez Y (Deslizar):";
            sliderYLbl.style.fontSize = "11px";
            const sliderYInput = document.createElement("input");
            sliderYInput.type = "range";
            sliderYInput.min = "-180";
            sliderYInput.max = "180";
            sliderYInput.step = "5";
            sliderYInput.style.cssText = "flex: 1; accent-color: orange;";
            sliderYInput.addEventListener("input", (e: any) => {
                const val = parseInt(e.target.value);
                if (this.selectedObject) {
                    const scale = this.selectedObject.userData.originalScale;
                    const segments = getTubeSegments(scale);
                    const idx = parseInt(this.selectSegmentDropdown.value) || 0;
                    if (segments[idx]) {
                        segments[idx].bendAngleY = val;
                        if (this.inputBendAngleY) this.inputBendAngleY.value = val;
                        this.updateDimensions('y', scale.y, true);
                    }
                }
            });
            sliderYRow.appendChild(sliderYLbl);
            sliderYRow.appendChild(sliderYInput);
            tubeRow.appendChild(sliderYRow);
            this.sliderBendY = sliderYInput;
            this.rowSliderBendY = sliderYRow;

            section.appendChild(tubeRow);
            this.rowTubeBends = tubeRow;
        })

        // 2.5 Fuel Zone Components Controls
        this.fuelZoneSection = this.createSection("⛽ Componentes de Zona de Gasolina", (section) => {
            this.fuelZoneSectionContent = section;
        });
        this.fuelZoneSection.style.display = "none";

        // 3. Color Controls
        this.colorSection = this.createSection("Color", (section) => {
            const row = document.createElement('div')
            row.style.display = "flex"
            row.style.alignItems = "center"
            row.style.gap = "10px"

            this.colorPicker = document.createElement('input')
            this.colorPicker.type = "color"
            this.colorPicker.style.border = "none"
            this.colorPicker.style.width = "40px"
            this.colorPicker.style.height = "40px"
            this.colorPicker.style.cursor = "pointer"
            this.colorPicker.addEventListener('input', (e) => this.updateColor(e.target.value))

            row.appendChild(this.colorPicker)

            // Opacity Slider
            const opacityContainer = document.createElement('div')
            opacityContainer.style.cssText = "display: flex; align-items: center; gap: 5px; margin-left: 10px;"

            const opacityLabel = document.createElement('label')
            opacityLabel.textContent = "Op:"
            opacityLabel.style.fontSize = "12px"
            opacityLabel.style.color = "#ccc"

            this.opacitySlider = document.createElement('input')
            this.opacitySlider.type = "range"
            this.opacitySlider.min = "0"
            this.opacitySlider.max = "1"
            this.opacitySlider.step = "0.1"
            this.opacitySlider.style.width = "60px"
            this.opacitySlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value)
                this.updateTransparency(val)
                this.opacityNumber.value = Math.round(val * 100)
            })

            opacityContainer.appendChild(opacityLabel)
            opacityContainer.appendChild(this.opacitySlider)

            // Percentage Input
            this.opacityNumber = document.createElement('input')
            this.opacityNumber.type = "number"
            this.opacityNumber.min = "0"
            this.opacityNumber.max = "100"
            this.opacityNumber.style.width = "40px"
            this.opacityNumber.style.marginLeft = "5px"
            this.opacityNumber.style.background = "#333"
            this.opacityNumber.style.color = "white"
            this.opacityNumber.style.border = "none"
            this.opacityNumber.style.fontSize = "12px"
            this.opacityNumber.value = "100"

            this.opacityNumber.addEventListener('input', (e) => {
                let val = parseInt(e.target.value)
                if (isNaN(val)) val = 100
                if (val < 0) val = 0
                if (val > 100) val = 100

                const normalized = val / 100.0
                this.updateTransparency(normalized)
                this.opacitySlider.value = normalized
            })

            opacityContainer.appendChild(this.opacityNumber)
            row.appendChild(opacityContainer)

            section.appendChild(row)

            // Palette (Reuse generic logic or simple one)
            const palette = document.createElement('div')
            palette.style.cssText = `display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;`
            const colors = ["#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF"]
            colors.forEach(c => {
                const s = document.createElement('div')
                s.style.cssText = `width: 20px; height: 20px; background: ${c}; cursor: pointer; border: 1px solid #555;`
                s.onclick = () => {
                    this.colorPicker.value = c
                    this.updateColor(c)
                }
                palette.appendChild(s)
            })
            section.appendChild(palette)
            this.fuelBorderControls = document.createElement('div')
            section.appendChild(this.fuelBorderControls)
        })

        // 4. Texture Controls
        this.textureSection = this.createSection("Textura", (section) => {
            this.textureGrid = document.createElement('div')
            this.textureGrid.style.cssText = `display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px;`
            this.renderTextures(this.textureGrid)
            section.appendChild(this.textureGrid)

            const uploadedLabel = document.createElement('div')
            uploadedLabel.textContent = "Texturas subidas"
            uploadedLabel.style.cssText = "font-size: 11px; color: #999; margin: 6px 0 5px;"
            section.appendChild(uploadedLabel)

            this.customTextureGrid = document.createElement('div')
            this.customTextureGrid.style.cssText = `display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px; min-height: 32px;`
            this.renderUploadedTextures(this.customTextureGrid)
            section.appendChild(this.customTextureGrid)

            // Upload
            const uploadBtn = document.createElement('button')
            uploadBtn.textContent = "Cargar Textura..."
            uploadBtn.style.cssText = `width: 100%; padding: 5px; cursor: pointer; background: #333; color: white; border: 1px solid #555; border-radius: 4px;`

            const fileInput = document.createElement('input')
            fileInput.type = "file"
            fileInput.accept = "image/*"
            fileInput.style.display = "none"
            fileInput.onchange = async (e) => {
                const file = e.target.files[0]
                if (file) {
                    const originalText = uploadBtn.textContent
                    uploadBtn.textContent = "Subiendo..."
                    uploadBtn.disabled = true
                    try {
                        const asset = await uploadAsset(file, {
                            kind: "TEXTURE",
                            visibility: "UNLISTED",
                            name: file.name,
                            metadata: { source: "object-inspector" }
                        })
                        this.updateTexture(asset.fileUrl, asset.id)
                        this.customTextureAssets = [asset, ...(this.customTextureAssets || []).filter((item) => item.id !== asset.id)]
                        this.renderUploadedTextures(this.customTextureGrid)
                        uploadBtn.textContent = "Textura cargada"
                    } catch (err) {
                        console.error("No se pudo subir la textura", err)
                        alert(err instanceof Error ? err.message : "No se pudo subir la textura")
                        uploadBtn.textContent = originalText
                    } finally {
                        uploadBtn.disabled = false
                        fileInput.value = ""
                    }
                }
            }
            uploadBtn.onclick = () => fileInput.click()

            section.appendChild(fileInput)
            section.appendChild(uploadBtn)

            const settingsPanel = document.createElement('div')
            settingsPanel.style.cssText = `
                display: flex; flex-direction: column; gap: 8px; margin-top: 10px;
                background: rgba(255,255,255,0.04); border: 1px solid #333;
                border-radius: 6px; padding: 8px;
            `

            const modeRow = document.createElement('div')
            modeRow.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:8px;`
            const modeLabel = document.createElement('span')
            modeLabel.textContent = "Modo"
            modeLabel.style.cssText = "font-size:11px; color:#aaa;"
            this.textureFitModeSelect = document.createElement('select')
            this.textureFitModeSelect.style.cssText = `width: 132px; background:#222; color:white; border:1px solid #444; border-radius:4px; padding:4px; font-size:11px;`
            this.textureFitModeSelect.innerHTML = `
                <option value="auto">Repetir por tamaño</option>
                <option value="stretch">Estirar por cara</option>
            `
            this.textureFitModeSelect.onchange = (e) => this.updateTextureSetting("fitMode", e.target.value)
            modeRow.appendChild(modeLabel)
            modeRow.appendChild(this.textureFitModeSelect)
            settingsPanel.appendChild(modeRow)

            const settingsGrid = document.createElement('div')
            settingsGrid.style.cssText = `display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:6px;`
            const makeTextureInput = (key, label, step, min = null) => {
                const wrap = document.createElement('label')
                wrap.style.cssText = `display:flex; flex-direction:column; gap:3px; color:#aaa; font-size:10px;`
                const input = document.createElement('input')
                input.type = "number"
                input.step = String(step)
                if (min !== null) input.min = String(min)
                input.style.cssText = `width:100%; box-sizing:border-box; background:#222; color:white; border:1px solid #444; border-radius:4px; padding:4px; font-size:11px;`
                input.onchange = (e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value)) this.updateTextureSetting(key, value)
                }
                wrap.textContent = label
                wrap.appendChild(input)
                this[`textureSettingInput_${key}`] = input
                return wrap
            }
            settingsGrid.appendChild(makeTextureInput("tileSize", "Baldosa", 0.25, 0.1))
            settingsGrid.appendChild(makeTextureInput("repeatX", "Repetir U", 0.25, 0.05))
            settingsGrid.appendChild(makeTextureInput("repeatY", "Repetir V", 0.25, 0.05))
            settingsGrid.appendChild(makeTextureInput("rotation", "Rotación", 5))
            settingsGrid.appendChild(makeTextureInput("globalRotation", "Rotación Global", 5))
            settingsGrid.appendChild(makeTextureInput("offsetX", "Mover U", 0.05))
            settingsGrid.appendChild(makeTextureInput("offsetY", "Mover V", 0.05))
            settingsPanel.appendChild(settingsGrid)

            const patternVariationRow = document.createElement('label')
            patternVariationRow.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:8px; color:#ddd; font-size:11px; cursor:pointer;`
            const patternVariationText = document.createElement('span')
            patternVariationText.textContent = "Variar patrón por bloque"
            const patternVariationInput = document.createElement('input')
            patternVariationInput.type = "checkbox"
            patternVariationInput.onchange = (e) => this.updateTextureSetting("patternVariation", e.target.checked)
            this.textureSettingInput_patternVariation = patternVariationInput
            patternVariationRow.appendChild(patternVariationText)
            patternVariationRow.appendChild(patternVariationInput)
            settingsPanel.appendChild(patternVariationRow)

            section.appendChild(settingsPanel)
        })

        // 4.5 Visibility Controls (Invisible but Collidable)
        this.visibilitySection = this.createSection("Visibilidad", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: flex; align-items: center; gap: 10px;`

            this.chkInvisible = document.createElement('input')
            this.chkInvisible.type = 'checkbox'
            this.chkInvisible.id = 'chk-obj-invisible'
            this.chkInvisible.style.transform = "scale(1.2)"
            this.chkInvisible.onchange = (e) => this.updateInvisible(e.target.checked)

            const label = document.createElement('label')
            label.textContent = "Invisible (Solo Colisión)"
            label.htmlFor = 'chk-obj-invisible'
            label.style.fontSize = "12px"
            label.style.cursor = "pointer"
            label.style.color = "#ccc"

            row.appendChild(this.chkInvisible)
            row.appendChild(label)
            section.appendChild(row)
        })

        // 5. Logic Properties (Dynamic)
        this.logicSectionWrapper = this.createSection("Lógica de Juego", (section) => {
            this.logicContainer = document.createElement('div')
            this.logicContainer.style.display = 'flex'
            this.logicContainer.style.flexDirection = 'column'
            this.logicContainer.style.gap = '5px'
            section.appendChild(this.logicContainer)
        })
        this.logicSectionWrapper.style.display = 'none'

        // Preferencia de Cambio Rápido
        this.preferenceSection = this.createSection("Preferencia", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: flex; align-items: center; gap: 8px;`

            this.chkDynamicSwitch = document.createElement('input')
            this.chkDynamicSwitch.type = 'checkbox'
            this.chkDynamicSwitch.id = 'chk-dynamic-switch'
            this.chkDynamicSwitch.style.transform = "scale(1.1)"
            this.chkDynamicSwitch.checked = this.allowDynamicSwitch
            this.chkDynamicSwitch.onchange = (e) => {
                this.allowDynamicSwitch = e.target.checked
            }

            const label = document.createElement('label')
            label.textContent = "Cambio rápido (Clic Derecho)"
            label.htmlFor = 'chk-dynamic-switch'
            label.style.fontSize = "11px"
            label.style.cursor = "pointer"
            label.style.color = "#ccc"

            row.appendChild(this.chkDynamicSwitch)
            row.appendChild(label)
            section.appendChild(row)
        })

        // Nombre Personalizado / Identificación
        this.identificationSection = this.createSection("Identificación", (section) => {
            this.inputCustomName = document.createElement('input')
            this.inputCustomName.type = "text"
            this.inputCustomName.placeholder = "Nombre del objeto"
            this.inputCustomName.style.cssText = `
                width: 100%; background: #222; color: white; border: 1px solid #444; 
                border-radius: 4px; padding: 6px; font-size: 12px; box-sizing: border-box;
            `
            this.inputCustomName.oninput = (e) => {
                if (this.selectedObject) {
                    const newName = e.target.value;
                    this.selectedObject.userData.customName = newName;
                    this.title.textContent = `Propiedades: ${newName || this.selectedObject.userData.mapObjectType || "Objeto"}`;
                }
            }
            section.appendChild(this.inputCustomName)
        })

        // 4.6 Danger Zone
        this.actionsSection = this.createSection("Acciones", (section) => {
            const btnDelete = document.createElement('button')
            btnDelete.textContent = "Eliminar Objeto"
            btnDelete.style.cssText = `width: 100%; padding: 8px; cursor: pointer; background: #cc3333; color: white; border: none; border-radius: 4px; font-weight: bold;`
            btnDelete.onclick = () => this.deleteSelected()
            section.appendChild(btnDelete)
        })
            // Move the logic section into the main content
            // Note: createSection appends to this.content immediately.
            // So I need to capture the section element wrapper if I want to hide it whole.
            // My createSection implementation doesn't return the wrapper easily to `this`.
            // I will modify createSection slightly or just access the last child.
            // Actually, I can just modify `createSection` to return the section element.

            // Stop propagation of events to prevent game interaction when over the UI
            ;['mousedown', 'mouseup', 'click', 'wheel', 'keydown', 'keyup'].forEach(eventType => {
                this.container.addEventListener(eventType, (e) => {
                    const typing = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' ||
                        e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement || e.target.isContentEditable
                    if (eventType === 'keydown' && e.key.toLowerCase() === 'r' && !typing && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault()
                        this.cycleTransformMode()
                    }
                    e.stopPropagation()
                })
            })

        if (this.game?.editorExplorer?.propertiesContentContainer) {
            this.game.editorExplorer.propertiesContentContainer.appendChild(this.container);
        } else if (typeof document !== 'undefined' && document.body && !this.game) {
            document.body.appendChild(this.container);
        }
    }

    createSection(title, contentBuilder) {
        const section = document.createElement('div')
        section.style.cssText = `border: 1px solid #333; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05);`

        const lbl = document.createElement('div')
        lbl.textContent = title
        lbl.style.cssText = `font-size: 12px; color: #aaa; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;`
        section.appendChild(lbl)
        section._titleElement = lbl

        contentBuilder(section)
        this.content.appendChild(section)
        return section
    }

    createNumberInput(label, onChange, min = -Infinity, step = 0.5, color = null) {
        const container = document.createElement('div')
        container.style.cssText = `display: flex; flex-direction: column; gap: 2px;`
        if (color) {
            container.style.borderLeft = `3px solid ${color}`
            container.style.paddingLeft = "4px"
        }

        const lbl = document.createElement('span')
        lbl.textContent = label
        lbl.style.fontSize = "10px"
        lbl.style.color = color ? color : "#888"

        const input = document.createElement('input')
        input.type = "number"
        input.step = step.toString()
        if (min !== -Infinity) input.min = min
        input.style.cssText = `
            width: 100%; background: #222; color: white; border: 1px solid #444; 
            border-radius: 4px; padding: 4px; font-size: 11px;
        `
        input.onchange = (e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
        }

        container.appendChild(lbl)
        container.appendChild(input)
        return { container, input }
    }

    renderTextures(container) {
        const textures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "/assets/textures/obj/brick.png" },
            { name: "Concreto", path: "/assets/textures/obj/concrete.png" },
            { name: "Madera", path: "/assets/textures/obj/wood.png" },
            { name: "Hierro", path: "/assets/textures/obj/hierro.png" }
        ];

        textures.forEach(tex => {
            const t = document.createElement('div')
            t.title = tex.name
            t.style.cssText = `
                aspect-ratio: 1; border: 1px solid #444; cursor: pointer; border-radius: 4px;
                background-color: ${tex.color || 'transparent'};
                background-size: cover; background-position: center;
            `
            if (tex.path) t.style.backgroundImage = `url(${tex.path})`

            t.onclick = () => this.updateTexture(tex.path, null)
            container.appendChild(t)
        })
    }

    async refreshCustomTextures() {
        try {
            this.customTextureAssets = await listAssets("mine", "TEXTURE")
        } catch (err) {
            this.customTextureAssets = []
            console.warn("No se pudieron cargar tus texturas", err)
        }
        this.renderUploadedTextures(this.customTextureGrid)
    }

    renderUploadedTextures(container) {
        if (!container) return
        container.innerHTML = ""
        const assets = this.customTextureAssets || []
        if (!assets.length) {
            const empty = document.createElement('div')
            empty.textContent = "Sin texturas subidas."
            empty.style.cssText = "grid-column: 1 / -1; color: #777; font-size: 11px; padding: 6px 0;"
            container.appendChild(empty)
            return
        }

        assets.forEach(asset => {
            const t = document.createElement('div')
            t.title = asset.name
            t.style.cssText = `
                aspect-ratio: 1; border: 1px solid #444; cursor: pointer; border-radius: 4px;
                background-image: url(${asset.fileUrl});
                background-size: cover; background-position: center; image-rendering: pixelated;
            `
            t.onclick = () => this.updateTexture(asset.fileUrl, asset.id)
            container.appendChild(t)
        })
    }

    getEnvironmentGroup(mapObjectType, groupId) {
        if (!this.game || !this.game.environmentConfig) return null;
        let list = [];
        if (mapObjectType === "environment_ground") {
            list = this.game.environmentConfig.groundGroups || [];
        } else if (mapObjectType === "environment_ceiling") {
            list = this.game.environmentConfig.ceilingGroups || [];
        } else if (mapObjectType === "environment_wall") {
            list = this.game.environmentConfig.invisibleWallsGroups || [];
        }
        return list.find(g => g.id === groupId);
    }

    findEnvironmentMesh(mapObjectType, groupId) {
        if (!this.game) return null;
        let found = null;
        if (mapObjectType === "environment_ground" || mapObjectType === "environment_ceiling") {
            if (this.game.groundGroup) {
                this.game.groundGroup.traverse((child) => {
                    if (child.userData && child.userData.mapObjectType === mapObjectType && child.userData.groupId === groupId) {
                        found = child;
                    }
                });
            }
        } else if (mapObjectType === "environment_wall") {
            if (Array.isArray(this.game.invisibleWallMeshes)) {
                this.game.invisibleWallMeshes.forEach((mesh) => {
                    if (mesh.userData && mesh.userData.mapObjectType === mapObjectType && mesh.userData.groupId === groupId) {
                        found = mesh;
                    }
                });
            }
        }
        return found;
    }

    rebuildEnvironment(mapObjectType, groupId) {
        if (!this.game) return;
        this.game.updateEnvironmentConfig(this.game.environmentConfig);
        const newMesh = this.findEnvironmentMesh(mapObjectType, groupId);
        if (newMesh) {
            this.selectedObject = newMesh;
        }
    }

    show(object, hitPart = null) {
        if (!object) return
        if (this.game?.editorExplorer?.propertiesContentContainer) {
            if (this.container.parentElement !== this.game.editorExplorer.propertiesContentContainer) {
                if (this.container.parentElement && typeof this.container.parentElement.removeChild === 'function') {
                    this.container.parentElement.removeChild(this.container);
                }
                this.game.editorExplorer.propertiesContentContainer.appendChild(this.container);
            }
        }
        if (this.transformGizmo?.target && this.selectedObject !== object) this.transformGizmo.detach()
        this.selectedObject = object
        this.isVisible = true
        this.container.style.display = 'flex'

        if (object.userData.mapObjectType === "fuel_zone") {
            if (hitPart?.userData?.isFuelBar || hitPart?.parent?.userData?.isFuelBar) {
                this.fuelActiveSubElement = 'bar';
            } else if (hitPart?.userData?.isFuelIndicator || hitPart?.parent?.userData?.isFuelIndicator) {
                this.fuelActiveSubElement = 'indicator';
            } else if (!['zone', 'bar', 'indicator'].includes(this.fuelActiveSubElement)) {
                this.fuelActiveSubElement = 'zone';
            }
        } else {
            this.fuelActiveSubElement = 'zone';
        }

        const isEnv = object.userData.mapObjectType?.startsWith("environment_");
        const isGroupPivot = !!object.userData.isEditorGroupPivot;
        
        if (isEnv) {
            if (this.positionSection) this.positionSection.style.display = "none";
            if (this.rotationSection) this.rotationSection.style.display = "none";
            if (this.dimensionsSection) this.dimensionsSection.style.display = "none";
            if (this.visibilitySection) this.visibilitySection.style.display = "none";
            if (this.logicSectionWrapper) this.logicSectionWrapper.style.display = "none";
            if (this.preferenceSection) this.preferenceSection.style.display = "none";
            if (this.identificationSection) this.identificationSection.style.display = "none";
            if (this.actionsSection) this.actionsSection.style.display = "none";
            if (this.transformGizmo) this.transformGizmo.detach();
        } else if (isGroupPivot) {
            if (this.positionSection) this.positionSection.style.display = "block";
            if (this.rotationSection) this.rotationSection.style.display = "block";
            if (this.dimensionsSection) this.dimensionsSection.style.display = "none";
            if (this.visibilitySection) this.visibilitySection.style.display = "none";
            if (this.logicSectionWrapper) this.logicSectionWrapper.style.display = "none";
            if (this.preferenceSection) this.preferenceSection.style.display = "none";
            if (this.identificationSection) this.identificationSection.style.display = "block";
            if (this.actionsSection) this.actionsSection.style.display = "block";
        } else {
            if (this.positionSection) this.positionSection.style.display = "block";
            if (this.rotationSection) this.rotationSection.style.display = "block";
            if (this.dimensionsSection) this.dimensionsSection.style.display = "block";
            if (this.visibilitySection) this.visibilitySection.style.display = "block";
            if (this.preferenceSection) this.preferenceSection.style.display = "block";
            if (this.identificationSection) this.identificationSection.style.display = "block";
            if (this.actionsSection) this.actionsSection.style.display = "block";
        }

        // Populate Data
        const objName = object.userData.customName || object.userData.mapObjectType || "Objeto"
        const selectionCount = this.game?.editorSelection?.getCount?.() || 1;
        this.title.textContent = selectionCount > 1 ? `[${selectionCount} seleccionados] ${isGroupPivot ? `(Grupo: ${objName})` : `(${objName})`}` : (isGroupPivot ? `Grupo: ${objName}` : `Propiedades: ${objName}`);
        if (this.inputCustomName) {
            this.inputCustomName.value = object.userData.customName || ""
        }

        if (this.game?.editorSelection) {
            const explorerNodeId = object.userData?.groupId || object.userData?.uuid;
            if (explorerNodeId && !this.game.editorSelection.isSelected(explorerNodeId)) {
                this.game.editorSelection.selectSingle(explorerNodeId, "inspector");
            }
        } else if (this.game?.editorExplorer) {
            const explorerNodeId = object.userData?.groupId || object.userData?.uuid;
            if (explorerNodeId && this.game.editorExplorer.selectedNodeId !== explorerNodeId) {
                this.game.editorExplorer.selectNode(explorerNodeId, false);
            }
        }

        if (this.chkDynamicSwitch) {
            this.chkDynamicSwitch.checked = this.allowDynamicSwitch
        }

        if (this.isCollapsed) {
            this.content.style.display = "none"
        } else {
            this.content.style.display = "flex"
        }

        if (!isEnv) {
            this.syncTransformInputs()
        }

        let groupColor = null;
        let op = 1.0;
        let texSettings = object.userData.textureSettings;

        if (isEnv) {
            const group = this.getEnvironmentGroup(object.userData.mapObjectType, object.userData.groupId);
            if (group) {
                groupColor = group.color || group.color3D;
                op = (group.opacity !== undefined) ? group.opacity : 1.0;
                texSettings = group.textureSettings;
            }
        } else {
            op = (object.userData.opacity !== undefined) ? object.userData.opacity : 1.0;
        }

        this.fuelBorderControls.replaceChildren()
        this.fuelBorderControls.style.display = 'none'

        if (object.userData.mapObjectType === 'fuel_zone') {
            if (this.fuelZoneSection) {
                this.fuelZoneSection.style.display = 'block';
                this.renderFuelZoneUI();
            }
        } else {
            if (this.fuelZoneSection) this.fuelZoneSection.style.display = 'none';
        }
        // Color
        if (groupColor) {
            this.colorPicker.value = groupColor.startsWith("#") ? groupColor : '#' + groupColor;
        } else if (object.material && object.material.color) {
            this.colorPicker.value = '#' + object.material.color.getHexString()
        }

        // Opacity
        if (this.opacitySlider) {
            this.opacitySlider.value = op
            if (this.opacityNumber) this.opacityNumber.value = Math.round(op * 100)
        }

        // Invisible
        if (object.userData.invisible) {
            this.chkInvisible.checked = true
        } else {
            this.chkInvisible.checked = false
        }

        if (object.userData.mapObjectType !== "tube") {
            this.syncTextureSettingsInputs(texSettings)
        }

        // Logic Properties
        if (!isEnv && object.userData.logicProperties) {
            this.logicSectionWrapper.style.display = 'block'
            this.renderLogicProperties(object.userData.logicProperties)
        } else {
            this.logicSectionWrapper.style.display = 'none'
        }

        // 6. Link to Logic Panel (New)
        // Check if object has modifiers that should be edited in Logic Panel
        const hasLogicParams = !isEnv && object.userData.logicProperties && (
            object.userData.logicProperties.waypoints ||
            (Array.isArray(object.userData.logicProperties.sequences) && object.userData.logicProperties.sequences.length > 0) ||
            object.userData.mapObjectType === 'movement_controller' ||
            object.userData.mapObjectType === 'spawn_point' ||
            object.userData.mapObjectType === 'interaction_button' ||
            object.userData.mapObjectType === 'gravity_sphere' ||
            object.userData.mapObjectType === 'logic_camera' ||
            object.userData.mapObjectType === 'camera_panel' ||
            object.userData.mapObjectType === 'impulse_jump' ||
            object.userData.mapObjectType === 'impulse_lateral' ||
            object.userData.mapObjectType === 'impulse_neon' ||
            object.userData.mapObjectType === 'gravity_pad' ||
            object.userData.mapObjectType === 'fuel_zone' ||
            object.userData.mapObjectType === 'farming_zone'
        )

        if (hasLogicParams) {
            // Remove existing button if any (for safety, though rebuild happens somewhat)
            // Actually, we should probably append this to the Logic Section or a new footer.
            // Let's append to logicSectionWrapper

            // Check if button already exists in logicSection (container)
            if (!this.editLogicBtn) {
                this.editLogicBtn = document.createElement('button')
                this.editLogicBtn.textContent = "⚙ Editar Lógica Avanzada"
                this.editLogicBtn.style.cssText = `
                    width: 100%; margin-top: 10px; padding: 8px; 
                    background: #552200; color: orange; border: 1px solid orange; 
                    cursor: pointer; border-radius: 4px; font-size: 11px;
                `
                this.editLogicBtn.onclick = () => this.openLogicPanel()
                this.logicSectionWrapper.appendChild(this.editLogicBtn)
            }
            this.editLogicBtn.style.display = "block"
        } else {
            if (this.editLogicBtn) this.editLogicBtn.style.display = "none"
        }

        if (!isEnv && object.userData.mapObjectType === "tube") {
            if (this.rowTubeBends) this.rowTubeBends.style.display = "flex";
            this.syncTubeSegmentDropdown();
            if (this.chkEditBends) this.chkEditBends.checked = false;
        } else {
            if (this.rowTubeBends) this.rowTubeBends.style.display = "none";
        }

        // Disable Game Input - REMOVED to allow movement
        // if (this.game.inputManager) this.game.inputManager.enabled = false
        if (this.game?.updateEditorInteractionMode) {
            this.game.updateEditorInteractionMode()
        } else {
            document.exitPointerLock()
            if (this.game?.cameraController) this.game.cameraController.setUIOpen(true)
        }

        this.updateGizmoAttachment()
        this.syncCurvatureInputs()

        if (object.userData.mapObjectType === "logic_camera") {
            this.game?.logicCameraSystem?.showCameraPreview?.(object)
        } else {
            this.game?.logicCameraSystem?.closeCameraPreview?.()
        }
    }

    hide() {
        this.isVisible = false
        this.container.style.display = 'none'

        this.game?.logicCameraSystem?.closeCameraPreview?.()

        if (this.game?.updateEditorInteractionMode) {
            this.game.updateEditorInteractionMode()
        } else if (this.game?.cameraController) {
            this.game.cameraController.setUIOpen(false)
        }
    }

    detachAndClear() {
        this.transformGizmo.detach()
        this.selectedObject = null
        this.isVisible = false
        this.container.style.display = 'none'
        this.game?.logicCameraSystem?.closeCameraPreview?.()
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed
        if (this.isCollapsed) {
            this.content.style.display = "none"
            if (this.collapseBtn) this.collapseBtn.textContent = "▼"
            this.container.style.maxHeight = "50px"
        } else {
            this.content.style.display = "flex"
            if (this.collapseBtn) this.collapseBtn.textContent = "▲"
            this.container.style.maxHeight = "90vh"
        }
    }

    syncTransformInputs(dimensionsOverride = null) {
        if (!this.selectedObject) return

        if (this.positionSection?._titleElement) {
            if (this.selectedObject?.userData?.mapObjectType === "fuel_zone" && this.fuelActiveSubElement === "bar") {
                this.positionSection._titleElement.textContent = "POSICIÓN (BARRA DE RESERVA)";
            } else if (this.selectedObject?.userData?.mapObjectType === "fuel_zone" && this.fuelActiveSubElement === "indicator") {
                this.positionSection._titleElement.textContent = "POSICIÓN (INDICADOR FLOTANTE)";
            } else {
                this.positionSection._titleElement.textContent = "POSICIÓN";
            }
        }
        if (this.dimensionsSection?._titleElement) {
            if (this.selectedObject?.userData?.mapObjectType === "fuel_zone" && this.fuelActiveSubElement === "bar") {
                this.dimensionsSection._titleElement.textContent = "DIMENSIONES (BARRA: LARGO / ALTO / GROSOR)";
            } else if (this.selectedObject?.userData?.mapObjectType === "fuel_zone" && this.fuelActiveSubElement === "indicator") {
                this.dimensionsSection._titleElement.textContent = "DIMENSIONES (INDICADOR: ESCALA)";
            } else {
                this.dimensionsSection._titleElement.textContent = "DIMENSIONES";
            }
        }

        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = normalizeFuelZone(this.selectedObject.userData.logicProperties);
            if (this.fuelActiveSubElement === "bar") {
                this.inputPosX.input.value = props.fuelBarOffsetX.toFixed(2);
                this.inputPosY.input.value = props.fuelBarOffsetY.toFixed(2);
                this.inputPosZ.input.value = props.fuelBarOffsetZ.toFixed(2);

                this.inputRotX.input.value = (props.fuelBarRotationX || 0).toFixed(1);
                this.inputRotY.input.value = (props.fuelBarRotationY || 0).toFixed(1);
                this.inputRotZ.input.value = (props.fuelBarRotationZ || 0).toFixed(1);

                this.inputScaleX.input.value = props.fuelBarWidth.toFixed(2);
                this.inputScaleY.input.value = props.fuelBarHeight.toFixed(2);
                this.inputScaleZ.input.value = props.fuelBarDepth.toFixed(2);
            } else if (this.fuelActiveSubElement === "indicator") {
                this.inputPosX.input.value = props.fuelIndicatorOffsetX.toFixed(2);
                this.inputPosY.input.value = props.fuelIndicatorOffsetY.toFixed(2);
                this.inputPosZ.input.value = props.fuelIndicatorOffsetZ.toFixed(2);

                this.inputRotX.input.value = (props.fuelIndicatorRotationX || 0).toFixed(1);
                this.inputRotY.input.value = (props.fuelIndicatorRotationY || 0).toFixed(1);
                this.inputRotZ.input.value = (props.fuelIndicatorRotationZ || 0).toFixed(1);

                this.inputScaleX.input.value = props.fuelIndicatorWidth.toFixed(2);
                this.inputScaleY.input.value = props.fuelIndicatorHeight.toFixed(2);
                this.inputScaleZ.input.value = "1.00";
            }
            return;
        }

        this.inputPosX.input.value = this.selectedObject.position.x.toFixed(2)
        this.inputPosY.input.value = this.selectedObject.position.y.toFixed(2)
        this.inputPosZ.input.value = this.selectedObject.position.z.toFixed(2)

        this.inputRotX.input.value = (this.selectedObject.rotation.x * (180 / Math.PI)).toFixed(1)
        this.inputRotY.input.value = (this.selectedObject.rotation.y * (180 / Math.PI)).toFixed(1)
        this.inputRotZ.input.value = (this.selectedObject.rotation.z * (180 / Math.PI)).toFixed(1)

        const dims = dimensionsOverride || this.selectedObject.userData.originalScale || { x: 1, y: 1, z: 1 }
        this.inputScaleX.input.value = Number(dims.x).toFixed(2)
        this.inputScaleY.input.value = Number(dims.y).toFixed(2)
        this.inputScaleZ.input.value = Number(dims.z).toFixed(2)

        const type = this.selectedObject.userData.mapObjectType;
        const dimRow = this.dimensionsSection.querySelector("div");

        // Hide spike rows by default
        if (this.rowSpikeRadius) this.rowSpikeRadius.style.display = "none";
        if (this.rowSpikeHeight) this.rowSpikeHeight.style.display = "none";
        if (this.rowSpikeSpacing) this.rowSpikeSpacing.style.display = "none";
        if (this.rowSpikeColor) this.rowSpikeColor.style.display = "none";
        if (this.rowSpikeTexture) this.rowSpikeTexture.style.display = "none";

        // Handle visual tube editing rotation writeback
        if (type === "tube" && this.chkEditBends?.checked) {
            const selectedSegIndex = parseInt(this.selectSegmentDropdown?.value || "0") || 0;
            if (selectedSegIndex > 0) {
                let targetGroup = null;
                this.selectedObject.traverse((child: any) => {
                    if (child.isGroup && child.userData.isTubeGroup && child.userData.segmentIndex === selectedSegIndex) {
                        targetGroup = child;
                    }
                });

                if (targetGroup) {
                    const euler = new THREE.Euler().setFromQuaternion(targetGroup.quaternion, "YXZ");
                    const bendAngleX = Math.round(euler.x * 180 / Math.PI);
                    const bendAngleY = Math.round(euler.y * 180 / Math.PI);

                    const segments = getTubeSegments(dims);
                    if (segments[selectedSegIndex]) {
                        segments[selectedSegIndex].bendAngleX = bendAngleX;
                        segments[selectedSegIndex].bendAngleY = bendAngleY;
                    }
                }
            }
        }

        if (type === "sphere") {
            if (dimRow) dimRow.style.display = "none";
            if (this.rowRadius) this.rowRadius.style.display = "flex";
            if (this.rowLength1) this.rowLength1.style.display = "none";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
            if (this.inputRadius) this.inputRadius.value = dims.radius || dims.x / 2 || 1.0;
        } else if (type === "cylinder") {
            if (dimRow) dimRow.style.display = "none";
            if (this.rowRadius) this.rowRadius.style.display = "flex";
            if (this.rowLength1) this.rowLength1.style.display = "flex";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
            if (this.inputRadius) this.inputRadius.value = dims.radius || dims.x / 2 || 1.0;
            if (this.inputLength1) this.inputLength1.value = dims.y || 1.0;
        } else if (type === "cone") {
            if (dimRow) dimRow.style.display = "none";
            if (this.rowRadius) this.rowRadius.style.display = "flex";
            if (this.rowLength1) this.rowLength1.style.display = "flex";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
            if (this.inputRadius) this.inputRadius.value = dims.radius || dims.x / 2 || 1.0;
            if (this.inputLength1) this.inputLength1.value = dims.y || 3.0;
        } else if (type === "spiked_floor") {
            if (dimRow) dimRow.style.display = "grid";
            if (this.rowRadius) this.rowRadius.style.display = "none";
            if (this.rowLength1) this.rowLength1.style.display = "none";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
            if (this.rowSpikeRadius) this.rowSpikeRadius.style.display = "flex";
            if (this.rowSpikeHeight) this.rowSpikeHeight.style.display = "flex";
            if (this.rowSpikeSpacing) this.rowSpikeSpacing.style.display = "flex";
            if (this.rowSpikeColor) this.rowSpikeColor.style.display = "flex";
            if (this.rowSpikeTexture) this.rowSpikeTexture.style.display = "flex";
            if (this.inputSpikeRadius) this.inputSpikeRadius.value = dims.spikeRadius || 0.15;
            if (this.inputSpikeHeight) this.inputSpikeHeight.value = dims.spikeHeight || 0.4;
            if (this.inputSpikeSpacing) this.inputSpikeSpacing.value = dims.spikeSpacing || 0.5;
            if (this.inputSpikeColor) this.inputSpikeColor.value = dims.spikeColor || "#dc2626";

            if (this.inputSpikeTexture) {
                const currentPath = dims.spikeTexturePath;
                if (currentPath) {
                    const parts = currentPath.split("/");
                    const filename = parts[parts.length - 1];
                    this.inputSpikeTexture.textContent = filename || "Asignada";
                    if (this.btnSpikeTextureClear) this.btnSpikeTextureClear.style.display = "inline-block";
                } else {
                    this.inputSpikeTexture.textContent = "Ninguna";
                    if (this.btnSpikeTextureClear) this.btnSpikeTextureClear.style.display = "none";
                }
            }

            if (this.btnSpikeTexture) {
                if (this.spikeTextureSelectionMode) {
                    this.btnSpikeTexture.textContent = "Click en textura...";
                    this.btnSpikeTexture.style.background = "#ff9800";
                    this.btnSpikeTexture.style.borderColor = "#ff9800";
                } else {
                    this.btnSpikeTexture.textContent = "Seleccionar";
                    this.btnSpikeTexture.style.background = "#444";
                    this.btnSpikeTexture.style.borderColor = "#555";
                }
            }
        } else if (type === "circle") {
            if (dimRow) dimRow.style.display = "none";
            if (this.rowRadius) this.rowRadius.style.display = "flex";
            if (this.rowLength1) this.rowLength1.style.display = "flex";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
            if (this.inputRadius) this.inputRadius.value = dims.radius || dims.x / 2 || 1.0;
            if (this.inputLength1) this.inputLength1.value = dims.y || 0.05;
        } else if (type === "tube") {
            if (dimRow) dimRow.style.display = "none";
            if (this.rowRadius) this.rowRadius.style.display = "flex";
            if (this.rowLength1) this.rowLength1.style.display = "flex";
            if (this.rowLength2) this.rowLength2.style.display = "none"; // Hide standard Largo 2

            const segments = getTubeSegments(dims);
            const val = this.selectSegmentDropdown?.value || "all";

            let segColor, segOpacity, segTexSettings;

            if (val === "all") {
                if (this.rowLength1) this.rowLength1.style.display = "none";
                if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
                if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
                if (this.rowSliderBendX) this.rowSliderBendX.style.display = "none";
                if (this.rowSliderBendY) this.rowSliderBendY.style.display = "none";
                if (this.chkEditBends?.parentElement) this.chkEditBends.parentElement.style.display = "none";

                // In "all" mode, use base properties
                segColor = this.selectedObject.userData.color || 0xffffff;
                segOpacity = this.selectedObject.userData.opacity !== undefined ? this.selectedObject.userData.opacity : 1.0;
                segTexSettings = this.selectedObject.userData.textureSettings || {};
            } else {
                if (this.rowLength1) this.rowLength1.style.display = "flex";
                if (this.chkEditBends?.parentElement) this.chkEditBends.parentElement.style.display = "flex";
                const idx = parseInt(val) || 0;
                const seg = segments[idx] || { length: 2.0, bendAngleX: 0, bendAngleY: 0 };

                if (this.inputRadius) this.inputRadius.value = dims.radius || 0.5;
                if (this.inputLength1) {
                    const label = this.rowLength1.querySelector("span");
                    if (label) label.textContent = idx === 0 ? "Largo 1 (Base):" : `Largo tramo ${idx + 1}:`;
                    this.inputLength1.value = seg.length || 2.0;
                }

                if (idx === 0) {
                    if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
                    if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
                    if (this.rowSliderBendX) this.rowSliderBendX.style.display = "none";
                    if (this.rowSliderBendY) this.rowSliderBendY.style.display = "none";
                } else {
                    if (this.rowBendAngleX) this.rowBendAngleX.style.display = "flex";
                    if (this.rowBendAngleY) this.rowBendAngleY.style.display = "flex";
                    if (this.rowSliderBendX) this.rowSliderBendX.style.display = "flex";
                    if (this.rowSliderBendY) this.rowSliderBendY.style.display = "flex";
                    if (this.inputBendAngleX) this.inputBendAngleX.value = seg.bendAngleX !== undefined ? seg.bendAngleX : 0;
                    if (this.inputBendAngleY) this.inputBendAngleY.value = seg.bendAngleY !== undefined ? seg.bendAngleY : 0;
                    if (this.sliderBendX) this.sliderBendX.value = String(seg.bendAngleX !== undefined ? seg.bendAngleX : 0);
                    if (this.sliderBendY) this.sliderBendY.value = String(seg.bendAngleY !== undefined ? seg.bendAngleY : 0);
                }

                // In segment mode, resolve segment properties falling back to base
                segColor = seg.color !== undefined ? seg.color : (this.selectedObject.userData.color || 0xffffff);
                segOpacity = seg.opacity !== undefined ? seg.opacity : (this.selectedObject.userData.opacity !== undefined ? this.selectedObject.userData.opacity : 1.0);
                segTexSettings = { ...(this.selectedObject.userData.textureSettings || {}), ...(seg.textureSettings || {}) };
            }

            // Sync visual property inputs
            if (this.colorPicker) {
                this.colorPicker.value = "#" + new THREE.Color(segColor).getHexString();
            }
            if (this.opacitySlider) {
                this.opacitySlider.value = segOpacity;
            }
            if (this.opacityNumber) {
                this.opacityNumber.value = Math.round(segOpacity * 100);
            }
            this.syncTextureSettingsInputs(segTexSettings);
        } else {
            if (dimRow) dimRow.style.display = "grid";
            if (this.rowRadius) this.rowRadius.style.display = "none";
            if (this.rowLength1) this.rowLength1.style.display = "none";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
        }
    }

    syncCurvatureInputs() {
        const object = this.selectedObject
        const supported = object && supportsCurvature(object.userData.mapObjectType)
        this.curvatureSection.style.display = supported ? 'block' : 'none'
        if (!supported) return
        const dims = object.userData.originalScale
        const curve = resolveCurvature(object.userData.mapObjectType, dims)
        this.curvatureToggle.checked = curve.enabled
        this.curvatureFields.style.display = curve.enabled ? 'grid' : 'none'
        const options = curve.layers.map((layer, index) => [`${index}`, `${index + 1}. ${layer.axis.toUpperCase()} → ${layer.direction.toUpperCase()} · ${layer.angle.toFixed(1)}° · ${(layer.origin * 100).toFixed(1)}%`])
        const signature = JSON.stringify(options)
        if (this.curvatureLayerSelect.dataset.options !== signature) {
            this.curvatureLayerSelect.replaceChildren(...options.map(([value, label]) => new Option(label, value)))
            this.curvatureLayerSelect.dataset.options = signature
        }
        this.curvatureLayerSelect.value = String(curve.activeLayer)
        this.curvatureRemoveButton.disabled = curve.layers.length <= 1
        this.curvatureUpButton.disabled = curve.activeLayer === 0
        this.curvatureDownButton.disabled = curve.activeLayer === curve.layers.length - 1
        this.curvatureAxis.value = curve.axis
        this.curvatureDirection.value = curve.direction
        Array.from(this.curvatureDirection.options).forEach(option => { option.disabled = option.value === curve.axis })
        const range = curveAngleRange(object.userData.mapObjectType, dims)
        const limited = range.min > -360 || range.max < 360
        this.curvatureAngle.input.min = String(range.min)
        this.curvatureAngle.input.max = String(range.max)
        this.curvatureAngle.input.value = curve.angle.toFixed(1)
        this.curvatureOrigin.input.value = (curve.origin * 100).toFixed(1)
        this.curvatureCircleButton.disabled = range.max < 360
        this.curvatureCircleButton.style.opacity = range.max < 360 ? '0.4' : '1'
        this.curvatureCircleButton.title = range.max < 360 ? 'Aumenta el recorrido o reduce el grosor o las curvas previas para cerrar el círculo.' : 'Unir los extremos del objeto'
        const editing = this.transformGizmo.curvatureActive
        const movingOrigin = editing && this.transformGizmo.curvatureOriginEditing
        this.curvatureEditButton.textContent = editing && !movingOrigin ? 'Ángulo activo' : 'Ajustar ángulo'
        this.curvatureEditButton.style.borderColor = editing && !movingOrigin ? '#ffbd45' : '#345d7b'
        this.curvatureOriginButton.textContent = movingOrigin ? 'Moviendo punto de doblez' : 'Mover punto de doblez'
        this.curvatureOriginButton.style.borderColor = movingOrigin ? '#48ddff' : '#345d7b'
        this.curvatureStatus.textContent = `Curva ${curve.activeLayer + 1} de ${curve.layers.length} · ${curve.angle.toFixed(1)}° · Punto ${(curve.origin * 100).toFixed(1)}% · ${movingOrigin ? 'Moviendo punto' : editing ? 'Editando ángulo' : 'Conservada'}` +
            (limited ? ` · Límites ${range.min.toFixed(1)}° a ${range.max.toFixed(1)}° por el grosor y las curvas previas.` : (curve.layers.length === 1 ? ' · ±360° cierra el círculo.' : ' · Se combina con las demás curvas.'))
    }

    updateCurvature(patch, commit = true) {
        const object = this.selectedObject
        if (!object || !supportsCurvature(object.userData.mapObjectType)) return
        const dims = object.userData.originalScale
        dims.curvature = resolveCurvature(object.userData.mapObjectType, {
            ...dims, curvature: patchCurvature(dims.curvature, patch)
        })
        if (!dims.curvature.enabled && this.transformGizmo.curvatureActive) this.transformGizmo.setMode('translate')
        this.updateDimensions('x', dims.x, false)
        this.syncCurvatureInputs()
        if (commit) this.refreshPhysicsAndVisuals()
    }

    cycleTransformMode() {
        return this.transformGizmo.cycleMode()
    }

    updateGizmo() {
        this.transformGizmo.update()
    }

    applyGizmoTransform(target, mode) {
        if (!this.selectedObject || !target) return;

        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = this.selectedObject.userData.logicProperties;
            const dims = this.selectedObject.userData.originalScale || { x: 1, y: 1, z: 1 };
            if (this.fuelActiveSubElement === "bar") {
                if (mode === "translate") {
                    props.fuelBarOffsetX = Number(target.position.x.toFixed(2));
                    props.fuelBarOffsetY = Number((target.position.y - dims.y / 2).toFixed(2));
                    props.fuelBarOffsetZ = Number(target.position.z.toFixed(2));
                } else if (mode === "rotate") {
                    const euler = new THREE.Euler().setFromQuaternion(target.quaternion, 'YXZ');
                    props.fuelBarRotationX = Number(THREE.MathUtils.radToDeg(euler.x).toFixed(1));
                    props.fuelBarRotationY = Number(THREE.MathUtils.radToDeg(euler.y).toFixed(1));
                    props.fuelBarRotationZ = Number(THREE.MathUtils.radToDeg(euler.z).toFixed(1));
                }
            } else if (this.fuelActiveSubElement === "indicator") {
                if (mode === "translate") {
                    props.fuelIndicatorOffsetX = Number(target.position.x.toFixed(2));
                    props.fuelIndicatorOffsetY = Number((target.position.y - dims.y / 2).toFixed(2));
                    props.fuelIndicatorOffsetZ = Number(target.position.z.toFixed(2));
                } else if (mode === "rotate") {
                    const euler = new THREE.Euler().setFromQuaternion(target.quaternion, 'YXZ');
                    props.fuelIndicatorRotationX = Number(THREE.MathUtils.radToDeg(euler.x).toFixed(1));
                    props.fuelIndicatorRotationY = Number(THREE.MathUtils.radToDeg(euler.y).toFixed(1));
                    props.fuelIndicatorRotationZ = Number(THREE.MathUtils.radToDeg(euler.z).toFixed(1));
                }
            }
            this.syncTransformInputs();
            return;
        }
    }

    applyGizmoDimensions(dimensions, previousDimensions = null) {
        if (!this.selectedObject || !dimensions) return

        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = this.selectedObject.userData.logicProperties;
            if (this.fuelActiveSubElement === "bar") {
                props.fuelBarWidth = Math.max(0.05, Number(dimensions.x) || props.fuelBarWidth || 1.8);
                props.fuelBarHeight = Math.max(0.01, Number(dimensions.y) || props.fuelBarHeight || 0.09);
                props.fuelBarDepth = Math.max(0.01, Number(dimensions.z) || props.fuelBarDepth || 0.06);
                if (this.selectedObject.fuelZoneVisual?.barRoot) {
                    this.selectedObject.fuelZoneVisual.barRoot.userData.customDimensions = {
                        x: props.fuelBarWidth,
                        y: props.fuelBarHeight,
                        z: props.fuelBarDepth
                    };
                }
            } else if (this.fuelActiveSubElement === "indicator") {
                props.fuelIndicatorWidth = Math.max(0.1, Number(dimensions.x) || props.fuelIndicatorWidth || 2.8);
                props.fuelIndicatorHeight = Math.max(0.1, Number(dimensions.y) || props.fuelIndicatorHeight || 1.4);
                if (this.selectedObject.fuelZoneVisual?.label) {
                    this.selectedObject.fuelZoneVisual.label.userData.customDimensions = {
                        x: props.fuelIndicatorWidth,
                        y: props.fuelIndicatorHeight,
                        z: 1.0
                    };
                }
            }
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncTransformInputs();
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
            return;
        }

        const prev = previousDimensions || this.selectedObject.userData.originalScale || { x: 1, y: 1, z: 1 }
        const next = {
            x: Math.max(0.1, Number(dimensions.x) || prev.x || 1),
            y: Math.max(0.1, Number(dimensions.y) || prev.y || 1),
            z: Math.max(0.1, Number(dimensions.z) || prev.z || 1)
        }

        this.updateDimensions('x', next.x, false)
        this.updateDimensions('y', next.y, false)
        this.updateDimensions('z', next.z, false)
        this.syncTransformInputs()
        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    previewGizmoDimensions(dimensions) {
        if (!this.selectedObject || !dimensions) return

        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = this.selectedObject.userData.logicProperties;
            if (this.fuelActiveSubElement === "bar") {
                props.fuelBarWidth = Math.max(0.05, Number(dimensions.x) || props.fuelBarWidth || 1.8);
                props.fuelBarHeight = Math.max(0.01, Number(dimensions.y) || props.fuelBarHeight || 0.09);
                props.fuelBarDepth = Math.max(0.01, Number(dimensions.z) || props.fuelBarDepth || 0.06);
            } else if (this.fuelActiveSubElement === "indicator") {
                props.fuelIndicatorWidth = Math.max(0.1, Number(dimensions.x) || props.fuelIndicatorWidth || 2.8);
                props.fuelIndicatorHeight = Math.max(0.1, Number(dimensions.y) || props.fuelIndicatorHeight || 1.4);
            }
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncTransformInputs(dimensions);
            this.syncFuelZoneUI();
            return;
        }

        this.updateDimensions('x', dimensions.x, false)
        this.updateDimensions('y', dimensions.y, false)
        this.updateDimensions('z', dimensions.z, false)
        this.syncTransformInputs(dimensions)
    }

    destroy() {
        this.transformGizmo.dispose()
        this.container.remove()
    }

    updatePosition(axis, value) {
        if (!this.selectedObject) return
        if (this.selectedObject.userData.isEditorGroupPivot && this.game?.editorGroupManager) {
            const groupId = this.selectedObject.userData.groupId;
            const newPos = this.selectedObject.position.clone();
            newPos[axis] = value;
            this.game.editorGroupManager.applyGroupTransform(
                groupId,
                newPos,
                this.selectedObject.quaternion.clone(),
                (id) => this.game.sceneManager.scene.children.find(c => c.userData?.uuid === id) || null,
                (obj) => {
                    if (obj.userData?.rigidBody) {
                        obj.userData.rigidBody.setTranslation(obj.position, true);
                        obj.userData.rigidBody.setRotation(obj.quaternion, true);
                    }
                    this.game?.broadcastObjectUpdate?.(obj);
                }
            );
            this.selectedObject.position.copy(newPos);
            this.transformGizmo.update();
            return;
        }
        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = this.selectedObject.userData.logicProperties;
            const key = this.fuelActiveSubElement === "bar"
                ? (axis === "x" ? "fuelBarOffsetX" : axis === "y" ? "fuelBarOffsetY" : "fuelBarOffsetZ")
                : (axis === "x" ? "fuelIndicatorOffsetX" : axis === "y" ? "fuelIndicatorOffsetY" : "fuelIndicatorOffsetZ");
            props[key] = Number(value) || 0;
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
            return;
        }
        this.selectedObject.position[axis] = value
        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    nudge(axisAxis, amount) {
        if (!this.selectedObject) return
        const axis = axisAxis.toLowerCase()
        if (this.selectedObject.userData.isEditorGroupPivot && this.game?.editorGroupManager) {
            this.updatePosition(axis, this.selectedObject.position[axis] + amount);
            if (axis === 'x') this.inputPosX.input.value = this.selectedObject.position.x.toFixed(2);
            if (axis === 'y') this.inputPosY.input.value = this.selectedObject.position.y.toFixed(2);
            if (axis === 'z') this.inputPosZ.input.value = this.selectedObject.position.z.toFixed(2);
            return;
        }
        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = this.selectedObject.userData.logicProperties;
            const key = this.fuelActiveSubElement === "bar"
                ? (axis === "x" ? "fuelBarOffsetX" : axis === "y" ? "fuelBarOffsetY" : "fuelBarOffsetZ")
                : (axis === "x" ? "fuelIndicatorOffsetX" : axis === "y" ? "fuelIndicatorOffsetY" : "fuelIndicatorOffsetZ");
            props[key] = Number(((props[key] || 0) + amount).toFixed(2));
            if (axis === 'x') this.inputPosX.input.value = props[key].toFixed(2);
            if (axis === 'y') this.inputPosY.input.value = props[key].toFixed(2);
            if (axis === 'z') this.inputPosZ.input.value = props[key].toFixed(2);
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
            return;
        }
        this.selectedObject.position[axis] += amount
        // Update input
        if (axis === 'x') this.inputPosX.input.value = this.selectedObject.position.x.toFixed(2)
        if (axis === 'y') this.inputPosY.input.value = this.selectedObject.position.y.toFixed(2)
        if (axis === 'z') this.inputPosZ.input.value = this.selectedObject.position.z.toFixed(2)

        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    updateRotation(axis, valueDegrees) {
        if (!this.selectedObject) return
        if (this.selectedObject.userData.isEditorGroupPivot && this.game?.editorGroupManager) {
            const groupId = this.selectedObject.userData.groupId;
            const radians = valueDegrees * (Math.PI / 180);
            const euler = new THREE.Euler().setFromQuaternion(this.selectedObject.quaternion, 'YXZ');
            euler[axis] = radians;
            const targetQuat = new THREE.Quaternion().setFromEuler(euler);

            this.game.editorGroupManager.applyGroupTransform(
                groupId,
                this.selectedObject.position.clone(),
                targetQuat,
                (id) => this.game.sceneManager.scene.children.find(c => c.userData?.uuid === id) || null,
                (obj) => {
                    if (obj.userData?.rigidBody) {
                        obj.userData.rigidBody.setTranslation(obj.position, true);
                        obj.userData.rigidBody.setRotation(obj.quaternion, true);
                    }
                    this.game?.broadcastObjectUpdate?.(obj);
                }
            );
            this.selectedObject.quaternion.copy(targetQuat);
            this.selectedObject.rotation.setFromQuaternion(targetQuat);
            this.transformGizmo.update();
            return;
        }
        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && (this.fuelActiveSubElement === "bar" || this.fuelActiveSubElement === "indicator")) {
            const props = this.selectedObject.userData.logicProperties;
            const key = this.fuelActiveSubElement === "bar"
                ? (axis === "x" ? "fuelBarRotationX" : axis === "y" ? "fuelBarRotationY" : "fuelBarRotationZ")
                : (axis === "x" ? "fuelIndicatorRotationX" : axis === "y" ? "fuelIndicatorRotationY" : "fuelIndicatorRotationZ");
            props[key] = Number(valueDegrees) || 0;
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
            return;
        }
        // Convert to radians
        const radians = valueDegrees * (Math.PI / 180)
        this.selectedObject.rotation[axis] = radians
        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    nudgeRotation(axisAxis, amountDegrees) {
        if (!this.selectedObject) return
        const axis = axisAxis.toLowerCase()
        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && (this.fuelActiveSubElement === "bar" || this.fuelActiveSubElement === "indicator")) {
            const props = this.selectedObject.userData.logicProperties;
            const key = this.fuelActiveSubElement === "bar"
                ? (axis === "x" ? "fuelBarRotationX" : axis === "y" ? "fuelBarRotationY" : "fuelBarRotationZ")
                : (axis === "x" ? "fuelIndicatorRotationX" : axis === "y" ? "fuelIndicatorRotationY" : "fuelIndicatorRotationZ");
            const current = props[key] || 0;
            const next = Math.round(current + amountDegrees);
            props[key] = next;
            if (axis === 'x') this.inputRotX.input.value = next.toFixed(1);
            if (axis === 'y') this.inputRotY.input.value = next.toFixed(1);
            if (axis === 'z') this.inputRotZ.input.value = next.toFixed(1);
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
            return;
        }
        // Add degrees, handle wrapping logic if we want, or just let Three.js handle > 360
        this.selectedObject.rotation[axis] += amountDegrees * (Math.PI / 180)

        // Update inputs (Convert back to degrees)
        const deg = this.selectedObject.rotation[axis] * (180 / Math.PI)

        if (axis === 'x') this.inputRotX.input.value = deg.toFixed(1)
        if (axis === 'y') this.inputRotY.input.value = deg.toFixed(1)
        if (axis === 'z') this.inputRotZ.input.value = deg.toFixed(1)

        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    updateDimensions(axis, value, shouldRefresh = true) {
        if (!this.selectedObject) return
        if (this.selectedObject.userData.mapObjectType === "fuel_zone" && this.fuelActiveSubElement !== "zone") {
            const props = this.selectedObject.userData.logicProperties;
            value = Math.max(0.01, Number(value) || 0.1);
            if (this.fuelActiveSubElement === "bar") {
                if (axis === "x") props.fuelBarWidth = value;
                else if (axis === "y") props.fuelBarHeight = value;
                else if (axis === "z") props.fuelBarDepth = value;
                if (this.selectedObject.fuelZoneVisual?.barRoot) {
                    this.selectedObject.fuelZoneVisual.barRoot.userData.customDimensions = {
                        x: props.fuelBarWidth,
                        y: props.fuelBarHeight,
                        z: props.fuelBarDepth
                    };
                }
            } else if (this.fuelActiveSubElement === "indicator") {
                if (axis === "x") props.fuelIndicatorWidth = value;
                else if (axis === "y") props.fuelIndicatorHeight = value;
                else props.fuelIndicatorScale = value;
                if (this.selectedObject.fuelZoneVisual?.label) {
                    this.selectedObject.fuelZoneVisual.label.userData.customDimensions = {
                        x: props.fuelIndicatorWidth,
                        y: props.fuelIndicatorHeight,
                        z: 1.0
                    };
                }
            }
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
            return;
        }
        value = Math.max(0.1, Number(value) || 0.1)

        // Update userData dimensions
        if (!this.selectedObject.userData.originalScale) this.selectedObject.userData.originalScale = { x: 1, y: 1, z: 1 }

        const oldVal = this.selectedObject.userData.originalScale[axis]
        this.selectedObject.userData.originalScale[axis] = value

        // Anchor Logic: If resizing Height (Y) of a Ladder, keep bottom fixed.
        // Ladder grows from center by default.
        // If height increases by D, center moves up by D/2 to keep bottom fixed.
        if (this.selectedObject.userData.mapObjectType === 'ladder' && axis === 'y') {
            const diff = value - oldVal
            this.selectedObject.position.y += diff / 2
            // Update Input UI for Position if visible? 
            if (this.inputPosY && this.inputPosY.input) {
                this.inputPosY.input.value = this.selectedObject.position.y.toFixed(2)
            }
        }

        // We need to REGENERATE the geometry to match dimensions
        // This is complex because we need to know the type...
        // For now, let's just scale the mesh if simple? 
        // No, MapObjectItem logic uses Geometry params. 
        // Let's try to rescale the mesh geometry directly or replace it.

        // Easier: Just modify scale. But our system sets scale to 1,1,1 and uses geometry for size.
        // So we should verify if we can just scale the mesh.
        // If we scale the mesh, physics must match.

        // Let's rely on refreshPhysicsAndVisuals to rebuild or resize.
        // For a simple resize without full rebuild:
        // We can't resize BoxGeometry easily. We replace it.

        const oldGeo = this.selectedObject.geometry
        const dims = this.selectedObject.userData.originalScale

        let newGeo
        // Detect type (Naively)
        if (this.selectedObject.userData.mapObjectType === 'motorbike') {
            this.selectedObject.resizeMotorbike?.(dims);
        } else if (this.selectedObject.userData.mapObjectType === 'ramp') {
            newGeo = RampUtils.createGeometry(dims)
        } else if (this.selectedObject.userData.mapObjectType === 'stairs') {
            // Rebuild Stairs
            const steps = StairsUtils.calculateSteps(dims)

            // Get existing material from first child
            let material
            if (this.selectedObject.children.length > 0) {
                material = this.selectedObject.children[0].material
            } else {
                material = new THREE.MeshStandardMaterial({ color: this.selectedObject.userData.color })
            }

            // The transform gizmo lives outside the object, so children here are rebuildable visuals.
            const toRemove = [...this.selectedObject.children]
            toRemove.forEach(c => {
                if (c.geometry) c.geometry.dispose()
                this.selectedObject.remove(c)
            })

            const stepGeo = new THREE.BoxGeometry(steps[0].size.x, steps[0].size.y, steps[0].size.z)

            steps.forEach(step => {
                const mesh = new THREE.Mesh(stepGeo, material)
                mesh.position.set(step.position.x, step.position.y, step.position.z)
                mesh.castShadow = true
                mesh.receiveShadow = true
                this.selectedObject.add(mesh)
            })

        } else if (this.selectedObject.userData.mapObjectType === 'ladder') {
            // Rebuild Ladder
            const height = dims.y
            const width = dims.x

            const toRemove = [...this.selectedObject.children]
            toRemove.forEach(c => {
                if (c.geometry) c.geometry.dispose()
                this.selectedObject.remove(c)
            })

            const mat = new THREE.MeshStandardMaterial({ color: this.selectedObject.userData.color || 0x555555, roughness: 0.7 })

            // Rails
            const railGeo = new THREE.BoxGeometry(0.1, height, 0.1)
            const leftRail = new THREE.Mesh(railGeo, mat)
            leftRail.position.set(-width / 2, 0, 0)
            leftRail.castShadow = true; leftRail.receiveShadow = true

            const rightRail = new THREE.Mesh(railGeo, mat)
            rightRail.position.set(width / 2, 0, 0)
            rightRail.castShadow = true; rightRail.receiveShadow = true

            this.selectedObject.add(leftRail)
            this.selectedObject.add(rightRail)

            // Rungs
            const rungCount = Math.floor(height / 0.4)
            const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, width, 8)
            rungGeo.rotateZ(Math.PI / 2)

            for (let i = 0; i < rungCount; i++) {
                const rung = new THREE.Mesh(rungGeo, mat)
                // Start from bottom (-height/2) + first step
                rung.position.set(0, -height / 2 + (i + 1) * 0.4, 0)
                rung.castShadow = true
                this.selectedObject.add(rung)
            }

            // Delegate bounds update to CharacterController logic (cleaner & tighter)
            this.selectedObject.userData.needsBoundsUpdate = true


        } else if (this.selectedObject.userData.mapObjectType === 'sphere') {
            const radius = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
            newGeo = new THREE.SphereGeometry(radius, 32, 32);
        } else if (this.selectedObject.userData.mapObjectType === 'cylinder') {
            const radius = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
            const height = dims.y || 1.0;
            newGeo = new THREE.CylinderGeometry(radius, radius, height, 32);
        } else if (this.selectedObject.userData.mapObjectType === 'cone') {
            const radius = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
            const height = dims.y || 3.0;
            newGeo = new THREE.ConeGeometry(radius, height, 32);
        } else if (this.selectedObject.userData.mapObjectType === 'spiked_floor') {
            const toRemove = [...this.selectedObject.children];
            toRemove.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                this.selectedObject.remove(c);
            });

            // Base floor box
            const baseGeo = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
            const material = new THREE.MeshStandardMaterial({
                color: this.selectedObject.userData.color !== undefined ? this.selectedObject.userData.color : 0xffffff,
                transparent: this.selectedObject.userData.opacity !== undefined && this.selectedObject.userData.opacity < 1.0,
                opacity: this.selectedObject.userData.opacity !== undefined ? this.selectedObject.userData.opacity : 1.0
            });
            const baseMesh = new THREE.Mesh(baseGeo, material);
            baseMesh.castShadow = true;
            baseMesh.receiveShadow = true;
            this.selectedObject.add(baseMesh);

            // Reapply texture if present
            if (this.selectedObject.userData.texturePath) {
                const loader = new THREE.TextureLoader();
                loader.load(this.selectedObject.userData.texturePath, (texture) => {
                    applyMapObjectTexture(baseMesh, texture, dims, this.selectedObject.userData.textureSettings);
                });
            }

            // Spikes (cones)
            const spikeRadius = dims.spikeRadius !== undefined ? dims.spikeRadius : 0.15;
            const spikeHeight = dims.spikeHeight !== undefined ? dims.spikeHeight : 0.4;
            const spikeSpacing = dims.spikeSpacing !== undefined ? dims.spikeSpacing : 0.5;
            const spikeColor = dims.spikeColor !== undefined ? dims.spikeColor : "#dc2626";
            const spikeTexturePath = dims.spikeTexturePath || null;

            const buffer = spikeRadius * 1.5;
            const availableW = dims.x - 2 * buffer;
            const availableD = dims.z - 2 * buffer;

            const numX = availableW > 0 ? Math.max(1, Math.floor(availableW / spikeSpacing) + 1) : 1;
            const numZ = availableD > 0 ? Math.max(1, Math.floor(availableD / spikeSpacing) + 1) : 1;

            const spikeGeo = new THREE.ConeGeometry(spikeRadius, spikeHeight, 8);
            const spikeMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(spikeColor),
                roughness: 0.8
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
                    spike.userData.isSpike = true;
                    spike.position.set(xPos, dims.y / 2 + spikeHeight / 2, zPos);
                    spike.castShadow = true;
                    spike.receiveShadow = true;
                    this.selectedObject.add(spike);
                }
            }

            // Apply texture to spikes if present
            if (spikeTexturePath) {
                const loader = new THREE.TextureLoader();
                loader.load(spikeTexturePath, (texture) => {
                    this.selectedObject.children.forEach(c => {
                        if (c.userData && c.userData.isSpike) {
                            c.material.map = texture.clone();
                            c.material.map.wrapS = THREE.RepeatWrapping;
                            c.material.map.wrapT = THREE.RepeatWrapping;
                            c.material.map.repeat.set(1, 1);
                            c.material.needsUpdate = true;
                        }
                    });
                });
            }
        } else if (this.selectedObject.userData.mapObjectType === 'circle') {
            const radius = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
            const height = dims.y || 0.05;
            newGeo = new THREE.CylinderGeometry(radius, radius, height, 32);
        } else if (this.selectedObject.userData.mapObjectType === 'tube') {
            const radius = dims.radius !== undefined ? dims.radius : 0.5;
            const segments = getTubeSegments(dims);

            const toRemove = [...this.selectedObject.children];
            toRemove.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                this.selectedObject.remove(c);
            });

            // Rebuild visual segments recursively
            let parentGroup = this.selectedObject;

            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                const segLength = seg.length || 2.0;

                const segColor = seg.color !== undefined ? seg.color : (this.selectedObject.userData.color || 0xffffff);
                const segOpacity = seg.opacity !== undefined ? seg.opacity : (this.selectedObject.userData.opacity !== undefined ? this.selectedObject.userData.opacity : 1.0);
                const segTexSettings = seg.textureSettings || this.selectedObject.userData.textureSettings;

                const material = new THREE.MeshStandardMaterial({
                    color: segColor,
                    transparent: segOpacity < 1.0,
                    opacity: segOpacity
                });

                const cylGeo = new THREE.CylinderGeometry(radius, radius, segLength, 32);
                const mesh = new THREE.Mesh(cylGeo, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.isTubeSegment = true;
                mesh.userData.segmentIndex = i;
                mesh.position.set(0, segLength / 2, 0);
                parentGroup.add(mesh);

                const segTexPath = seg.texturePath || this.selectedObject.userData.texturePath;
                if (segTexPath) {
                    const loader = new THREE.TextureLoader();
                    loader.load(segTexPath, (texture) => {
                        applyMapObjectTexture(mesh, texture, dims, segTexSettings);
                    });
                }

                let elbowMesh: THREE.Mesh | null = null;
                if (i < segments.length - 1) {
                    const elbowGeo = new THREE.SphereGeometry(radius, 32, 32);
                    elbowMesh = new THREE.Mesh(elbowGeo, material);
                    elbowMesh.castShadow = true;
                    elbowMesh.receiveShadow = true;
                    elbowMesh.userData.isTubeElbow = true;
                    elbowMesh.userData.segmentIndex = i;
                    elbowMesh.position.set(0, segLength, 0);
                    parentGroup.add(elbowMesh);

                    if (segTexPath) {
                        const loader = new THREE.TextureLoader();
                        loader.load(segTexPath, (texture) => {
                            if (elbowMesh) applyMapObjectTexture(elbowMesh, texture, dims, segTexSettings);
                        });
                    }

                    const nextSeg = segments[i + 1];
                    const childGroup = new THREE.Group();
                    childGroup.position.set(0, segLength, 0);
                    childGroup.rotation.set(
                        (nextSeg.bendAngleX || 0) * Math.PI / 180,
                        (nextSeg.bendAngleY || 0) * Math.PI / 180,
                        0,
                        "YXZ"
                    );
                    childGroup.userData.isTubeGroup = true;
                    childGroup.userData.segmentIndex = i + 1;
                    parentGroup.add(childGroup);
                    parentGroup = childGroup;
                }
            }
        } else {
            // Default Box
            newGeo = new THREE.BoxGeometry(dims.x, dims.y, dims.z)
        }

        const curvedGeometry = createCurvedGeometry(this.selectedObject.userData.mapObjectType, dims, this.selectedObject.userData.textureSettings)
        if (curvedGeometry) {
            newGeo?.dispose()
            newGeo = curvedGeometry
            dims.curvature = resolveCurvature(this.selectedObject.userData.mapObjectType, dims)
        }
        if (newGeo) {
            this.selectedObject.geometry.dispose()
            this.selectedObject.geometry = newGeo
        }

        if (this.selectedObject.userData.texturePath && !curvedGeometry) {
            this.reapplySelectedTexture()
        }
        if (this.selectedObject.userData.mapObjectType === "impulse_neon") {
            this.selectedObject.userData.neonVisual?.update(dims);
        } else if (this.selectedObject.userData.mapObjectType === "impulse_jump" || this.selectedObject.userData.mapObjectType === "impulse_lateral") {
            updateImpulsePadVisuals(this.selectedObject, dims);
        }
        this.selectedObject.fuelZoneVisual?.update(0, [])
        this.syncCurvatureInputs()
        this.transformGizmo.update()
        this.syncTransformInputs()
        if (shouldRefresh) this.refreshPhysicsAndVisuals()
    }

    updateColor(hex) {
        if (!this.selectedObject) return

        const isEnv = this.selectedObject.userData.mapObjectType?.startsWith("environment_");
        if (isEnv) {
            const mapObjectType = this.selectedObject.userData.mapObjectType;
            const groupId = this.selectedObject.userData.groupId;
            const group = this.getEnvironmentGroup(mapObjectType, groupId);
            if (group) {
                group.color = hex;
                group.color3D = hex;
                this.rebuildEnvironment(mapObjectType, groupId);
            }
            return;
        }

        const colorNum = parseInt(hex.replace('#', '0x'));

        if (this.selectedObject.userData.mapObjectType === "tube") {
            const scale = this.selectedObject.userData.originalScale;
            const segments = getTubeSegments(scale);
            const val = this.selectSegmentDropdown?.value || "all";
            if (val === "all") {
                this.selectedObject.userData.color = colorNum;
                segments.forEach(seg => {
                    delete seg.color;
                });
            } else {
                const idx = parseInt(val) || 0;
                if (segments[idx]) {
                    segments[idx].color = colorNum;
                }
            }
            this.updateDimensions('y', scale.y, true);
            if (this.game && this.game.broadcastObjectUpdate) {
                this.game.broadcastObjectUpdate(this.selectedObject);
            }
            return;
        }

        this.selectedObject.userData.color = colorNum
        this.selectedObject.fuelZoneVisual?.update(0, [])

        if (this.selectedObject.material) {
            this.selectedObject.material.color.set(hex)
        }
        // If Group (Stairs, Spiked Floor)
        if (this.selectedObject.isGroup) {
            this.selectedObject.children.forEach(c => {
                if (c.material && (!c.userData || !c.userData.isSpike)) {
                    c.material.color.set(hex)
                }
            })
        }
        
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
        }
    }

    updateTexture(pathOrDataUrl, assetId = null) {
        if (!this.selectedObject) return

        if (this.spikeTextureSelectionMode) {
            this.selectedObject.userData.originalScale.spikeTexturePath = pathOrDataUrl;
            this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
            this.spikeTextureSelectionMode = false;
            this.syncTransformInputs();
            if (this.game && this.game.broadcastObjectUpdate) {
                this.game.broadcastObjectUpdate(this.selectedObject);
            }
            return;
        }

        const isEnv = this.selectedObject.userData.mapObjectType?.startsWith("environment_");
        if (isEnv) {
            const mapObjectType = this.selectedObject.userData.mapObjectType;
            const groupId = this.selectedObject.userData.groupId;
            const group = this.getEnvironmentGroup(mapObjectType, groupId);
            if (group) {
                group.texturePath = pathOrDataUrl;
                group.textureAssetId = assetId;
                if (!group.textureSettings) {
                    group.textureSettings = normalizeTextureSettings(null);
                }
                this.rebuildEnvironment(mapObjectType, groupId);
            }
            return;
        }

        // Redirection to segment texture if it is a tube
        if (this.selectedObject.userData.mapObjectType === "tube") {
            const scale = this.selectedObject.userData.originalScale;
            const segments = getTubeSegments(scale);
            const val = this.selectSegmentDropdown?.value || "all";
            if (val === "all") {
                this.selectedObject.userData.texturePath = pathOrDataUrl;
                this.selectedObject.userData.textureAssetId = assetId;
                segments.forEach(seg => {
                    delete seg.texturePath;
                });
            } else {
                const idx = parseInt(val) || 0;
                if (segments[idx]) {
                    segments[idx].texturePath = pathOrDataUrl;
                }
            }
            this.updateDimensions('y', scale.y, true);
            if (this.game && this.game.broadcastObjectUpdate) {
                this.game.broadcastObjectUpdate(this.selectedObject);
            }
            return;
        }

        this.selectedObject.userData.texturePath = pathOrDataUrl
        this.selectedObject.userData.textureAssetId = assetId
        this.selectedObject.userData.textureSettings = normalizeTextureSettings(this.selectedObject.userData.textureSettings)

        if (pathOrDataUrl) {
            this.reapplySelectedTexture()
        } else {
            // Remove
            const remove = (mesh) => {
                if (mesh.material) {
                    mesh.material.map = null
                    mesh.material.needsUpdate = true
                }
            }
            if (this.selectedObject.isGroup) {
                this.selectedObject.children.forEach(remove)
            } else {
                remove(this.selectedObject)
            }
        }
        
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
        }
    }

    syncTextureSettingsInputs(settings = null) {
        const normalized = normalizeTextureSettings(settings)
        if (this.selectedObject) {
            if (this.selectedObject.userData.mapObjectType === "tube") {
                if (!this.selectedObject.userData.textureSettings) {
                    this.selectedObject.userData.textureSettings = normalizeTextureSettings(null);
                }
            } else {
                this.selectedObject.userData.textureSettings = { ...normalized }
            }
        }
        if (this.textureFitModeSelect) this.textureFitModeSelect.value = normalized.fitMode
        ;["tileSize", "repeatX", "repeatY", "offsetX", "offsetY", "rotation", "globalRotation"].forEach((key) => {
            const input = this[`textureSettingInput_${key}`]
            if (input) input.value = String(normalized[key])
        })
        if (this.textureSettingInput_patternVariation) {
            this.textureSettingInput_patternVariation.checked = normalized.patternVariation
        }
    }

    updateTextureSetting(key, value) {
        if (!this.selectedObject) return

        const isEnv = this.selectedObject.userData.mapObjectType?.startsWith("environment_");
        if (isEnv) {
            const mapObjectType = this.selectedObject.userData.mapObjectType;
            const groupId = this.selectedObject.userData.groupId;
            const group = this.getEnvironmentGroup(mapObjectType, groupId);
            if (group) {
                if (!group.textureSettings) {
                    group.textureSettings = normalizeTextureSettings(null);
                }
                group.textureSettings[key] = value;
                this.rebuildEnvironment(mapObjectType, groupId);
            }
            return;
        }

        if (this.selectedObject.userData.mapObjectType === "tube") {
            const scale = this.selectedObject.userData.originalScale;
            const segments = getTubeSegments(scale);
            const val = this.selectSegmentDropdown?.value || "all";
            if (val === "all") {
                this.selectedObject.userData.textureSettings = normalizeTextureSettings({
                    ...(this.selectedObject.userData.textureSettings || {}),
                    [key]: value
                });
                segments.forEach(seg => {
                    if (seg.textureSettings) {
                        delete seg.textureSettings[key];
                    }
                });
            } else {
                const idx = parseInt(val) || 0;
                if (segments[idx]) {
                    if (!segments[idx].textureSettings) {
                        segments[idx].textureSettings = {};
                    }
                    segments[idx].textureSettings[key] = value;
                }
            }
            this.updateDimensions('y', scale.y, true);

            // Sync visual inputs for the active selection
            const activeSeg = segments[val === "all" ? 0 : parseInt(val)] || {};
            const activeSettings = {
                ...(this.selectedObject.userData.textureSettings || {}),
                ...(activeSeg.textureSettings || {})
            };
            this.syncTextureSettingsInputs(activeSettings);

            if (this.game && this.game.broadcastObjectUpdate) {
                this.game.broadcastObjectUpdate(this.selectedObject);
            }
            return;
        }

        this.selectedObject.userData.textureSettings = normalizeTextureSettings({
            ...(this.selectedObject.userData.textureSettings || {}),
            [key]: value
        })
        this.syncTextureSettingsInputs(this.selectedObject.userData.textureSettings)
        if (supportsCurvature(this.selectedObject.userData.mapObjectType) && this.selectedObject.userData.originalScale?.curvature?.enabled) {
            this.updateDimensions('x', this.selectedObject.userData.originalScale.x, false)
        }
        if (this.selectedObject.userData.texturePath) {
            this.reapplySelectedTexture()
        }
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject)
        }
    }

    reapplySelectedTexture() {
        if (!this.selectedObject) return;

        if (this.selectedObject.userData.mapObjectType === "tube") {
            const scale = this.selectedObject.userData.originalScale || {};
            this.updateDimensions('y', scale.y, true);
            return;
        }

        if (!this.selectedObject.userData.texturePath) return
        const loader = new THREE.TextureLoader()
        const target = this.selectedObject
        loader.load(target.userData.texturePath, (tex) => {
            applyMapObjectTexture(
                target,
                tex,
                target.userData.originalScale || { x: 1, y: 1, z: 1 },
                target.userData.textureSettings
            )
        })
    }

    updateTransparency(opacity) {
        if (!this.selectedObject) return

        const isEnv = this.selectedObject.userData.mapObjectType?.startsWith("environment_");
        if (isEnv) {
            const mapObjectType = this.selectedObject.userData.mapObjectType;
            const groupId = this.selectedObject.userData.groupId;
            const group = this.getEnvironmentGroup(mapObjectType, groupId);
            if (group) {
                group.opacity = opacity;
                group.transparent = opacity < 1.0;
                this.rebuildEnvironment(mapObjectType, groupId);
            }
            return;
        }

        if (this.selectedObject.userData.mapObjectType === "tube") {
            const scale = this.selectedObject.userData.originalScale;
            const segments = getTubeSegments(scale);
            const val = this.selectSegmentDropdown?.value || "all";
            if (val === "all") {
                this.selectedObject.userData.opacity = opacity;
                segments.forEach(seg => {
                    delete seg.opacity;
                });
            } else {
                const idx = parseInt(val) || 0;
                if (segments[idx]) {
                    segments[idx].opacity = opacity;
                }
            }
            this.updateDimensions('y', scale.y, true);
            if (this.game && this.game.broadcastObjectUpdate) {
                this.game.broadcastObjectUpdate(this.selectedObject);
            }
            return;
        }

        this.selectedObject.userData.opacity = opacity

        // If "Invisible" is checked, we don't apply manual opacity override in editor
        // because it uses fixed 0.3 for feedback.
        if (this.selectedObject.userData.invisible) return

        const apply = (mesh) => {
            if (mesh.material) {
                mesh.material.transparent = opacity < 1.0
                mesh.material.opacity = opacity
                mesh.material.needsUpdate = true
            }
        }

        if (this.selectedObject.isGroup) {
            this.selectedObject.children.forEach(apply)
        } else {
            apply(this.selectedObject)
        }
        
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
        }
    }

    updateInvisible(isInvisible) {
        if (!this.selectedObject) return

        this.selectedObject.userData.invisible = isInvisible

        // Visual Feedback for Editor
        if (isInvisible) {
            // User Request: No color, no texture, no shadow, no existence (except collision)
            // So we hide it completely.
            this.selectedObject.visible = false

            // Note: InteractionManager/Inspector might lose selection if it relies on Raycast against visible objects.
            // But user explicitly asked for this behavior.
        } else {
            // Restore visibility with custom opacity
            this.selectedObject.visible = true

            const targetOpacity = (this.selectedObject.userData.opacity !== undefined) ? this.selectedObject.userData.opacity : 1.0
            const isTransparent = targetOpacity < 1.0

            if (this.selectedObject.material) {
                this.selectedObject.material.transparent = isTransparent
                this.selectedObject.material.opacity = targetOpacity
                this.selectedObject.material.needsUpdate = true
            }

            if (this.selectedObject.isGroup) {
                const targetOpacity = (this.selectedObject.userData.opacity !== undefined) ? this.selectedObject.userData.opacity : 1.0
                const isTransparent = targetOpacity < 1.0

                this.selectedObject.children.forEach(c => {
                    if (c.material) {
                        c.material.transparent = isTransparent
                        c.material.opacity = targetOpacity
                        c.material.needsUpdate = true
                    }
                })
            }
        }

        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
        }
    }

    refreshPhysicsAndVisuals() {
        if (!this.game || !this.selectedObject) return

        if (this.selectedObject.userData.isEditorGroupPivot) {
            if (this.game.editorGroupManager?.isCouplingMode()) {
                this.game.editorGroupManager.updateCouplingVisuals((id) => this.game.sceneManager.scene.children.find(c => c.userData?.uuid === id) || null);
            }
            return;
        }

        // If it's a tube or spiked_floor, regenerate visual meshes on drag end to ensure perfect alignment!
        if (this.selectedObject.userData.mapObjectType === "tube" || this.selectedObject.userData.mapObjectType === "spiked_floor") {
            this.updateDimensions('y', this.selectedObject.userData.originalScale.y, false);
        }

        // Calls a method in Game to regenerate body
        if (this.game.regenerateObjectPhysics) {
            this.game.regenerateObjectPhysics(this.selectedObject)
        }
        
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
        }

        if (this.game.editorGroupManager?.isCouplingMode()) {
            this.game.editorGroupManager.updateCouplingVisuals((id) => this.game.sceneManager.scene.children.find(c => c.userData?.uuid === id) || null);
        }
    }

    renderLogicProperties(props) {
        if (!this.logicItemsManager) {
            this.logicItemsManager = new LogicItemsManager(this.game, this.game?.constructionMenu?.logicSystem)
        }

        const updateProp = (key, value) => {
            if (this.selectedObject && this.selectedObject.userData.logicProperties) {
                this.selectedObject.userData.logicProperties[key] = value
                console.log(`Updated Logic Prop [${key}]:`, value)
                
                // Recalculate multipliers if 'rings' changes
                if (key === 'rings') {
                    const val = parseInt(value);
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
                    this.selectedObject.userData.logicProperties.ringMultipliers = newMults;
                }

                // If target visual update function exists, call it
                if (typeof this.selectedObject.updateTargetVisuals === 'function') {
                    this.selectedObject.updateTargetVisuals();
                }

                if (typeof this.selectedObject.updateLogicCameraVisuals === 'function') {
                    this.selectedObject.updateLogicCameraVisuals();
                }

                if (typeof this.selectedObject.updateLightVisuals === 'function') {
                    this.selectedObject.updateLightVisuals();
                }

                if (this.game && this.game.broadcastObjectUpdate) {
                    this.game.broadcastObjectUpdate(this.selectedObject);
                }
            }
        }

        this.logicItemsManager.renderAll(this.logicContainer, props, updateProp)
    }
    openLogicPanel() {
        if (!this.selectedObject || !this.game || !this.game.constructionMenu) return

        const target = this.selectedObject

        // Hide Inspector
        this.hide()

        // Open Construction Menu -> Logic Panel -> Select Object
        this.game.constructionMenu.toggle() // Ensure it opens (toggle works if closed)
        if (!this.game.constructionMenu.isVisible) {
            this.game.constructionMenu.toggle()
        }

        this.game.constructionMenu.selectLogicObject(target)
    }

    deleteSelected() {
        if (!this.selectedObject || !this.game) return

        if (this.selectedObject.userData.isEditorGroupPivot) {
            const groupId = this.selectedObject.userData.groupId;
            this.game.editorHierarchy?.removeNode(groupId, false);
            this.game.editorGroupManager?.removeGroupProxy(groupId);
            this.hide();
            this.game.editorExplorer?.renderTree();
            return;
        }

        const uuid = this.selectedObject.userData.uuid
        
        // Red
        if (this.game.networkManager && this.game.gameMode === 'editor') {
            this.game.networkManager.sendEditorRemove(uuid)
        }
        
        // Destrucción local
        this.game.deleteObjectByUuid(uuid)
    }

    syncTubeSegmentDropdown() {
        if (!this.selectedObject || !this.selectSegmentDropdown) return;
        const scale = this.selectedObject.userData.originalScale || {};
        const segments = getTubeSegments(scale);
        
        const prevVal = this.selectSegmentDropdown.value;
        this.selectSegmentDropdown.innerHTML = "";

        const allOpt = document.createElement("option");
        allOpt.value = "all";
        allOpt.textContent = "Todos los tramos";
        this.selectSegmentDropdown.appendChild(allOpt);

        segments.forEach((seg, i) => {
            const opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = i === 0 ? "Tramo 1 (Base)" : `Tramo ${i + 1}`;
            this.selectSegmentDropdown.appendChild(opt);
        });

        if (prevVal === "all" || (prevVal !== "" && parseInt(prevVal) < segments.length)) {
            this.selectSegmentDropdown.value = prevVal;
        } else {
            this.selectSegmentDropdown.value = "all";
        }
    }

    updateGizmoAttachment() {
        if (!this.selectedObject) return;

        if (this.selectedObject.userData.mapObjectType === "tube" && this.chkEditBends?.checked) {
            const val = this.selectSegmentDropdown?.value || "all";
            if (val !== "all") {
                const selectedSegIndex = parseInt(val) || 0;
                if (selectedSegIndex > 0) {
                    let targetGroup = null;
                    this.selectedObject.traverse((child: any) => {
                        if (child.isGroup && child.userData.isTubeGroup && child.userData.segmentIndex === selectedSegIndex) {
                            targetGroup = child;
                        }
                    });

                    if (targetGroup) {
                        this.transformGizmo.attach(targetGroup);
                        this.transformGizmo.setMode("rotate");
                        return;
                    }
                }
            }
        }

        if (this.selectedObject.userData.mapObjectType === "fuel_zone") {
            const visual = this.selectedObject.fuelZoneVisual;
            const props = normalizeFuelZone(this.selectedObject.userData.logicProperties);
            if (this.fuelActiveSubElement === "bar" && visual?.barRoot) {
                visual.barRoot.userData.customDimensions = {
                    x: props.fuelBarWidth,
                    y: props.fuelBarHeight,
                    z: props.fuelBarDepth
                };
                this.transformGizmo.attach(visual.barRoot);
                return;
            } else if (this.fuelActiveSubElement === "indicator" && visual?.label) {
                visual.label.userData.customDimensions = {
                    x: props.fuelIndicatorWidth,
                    y: props.fuelIndicatorHeight,
                    z: 1.0
                };
                this.transformGizmo.attach(visual.label);
                return;
            }
        }

        this.transformGizmo.attach(this.selectedObject);
    }

    setFuelActiveSubElement(subElement) {
        this.fuelActiveSubElement = subElement;
        this.updateGizmoAttachment();
        this.syncTransformInputs();
        this.syncFuelZoneUI();
    }

    renderFuelZoneUI() {
        if (!this.selectedObject || this.selectedObject.userData.mapObjectType !== "fuel_zone") return;
        const container = this.fuelZoneSectionContent;
        if (!container) return;
        container.replaceChildren();

        const props = normalizeFuelZone(this.selectedObject.userData.logicProperties);
        this.selectedObject.userData.logicProperties = props;

        // Sub-element selector toolbar
        const toolbar = document.createElement("div");
        toolbar.style.cssText = "display:flex;gap:4px;margin-bottom:12px;background:#0c1a17;padding:4px;border-radius:6px;border:1px solid #1f4239;";

        const tabs = [
            { id: 'zone', label: '🟩 Zona Base', desc: 'Plataforma' },
            { id: 'bar', label: '⛽ Barra Reserva', desc: 'Largo y Pos' },
            { id: 'indicator', label: '💬 Cartel Flotante', desc: 'Texto y Escala' }
        ];

        this.fuelSubElementButtons = new Map();
        tabs.forEach(tab => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.innerHTML = `<div style="font-weight:bold;font-size:11px;">${tab.label}</div><div style="font-size:9px;opacity:0.75;">${tab.desc}</div>`;
            btn.style.cssText = "flex:1;padding:6px 4px;border:1px solid transparent;border-radius:4px;cursor:pointer;text-align:center;transition:all 0.15s ease;color:#aaa;background:transparent;";
            btn.onclick = () => this.setFuelActiveSubElement(tab.id);
            toolbar.appendChild(btn);
            this.fuelSubElementButtons.set(tab.id, btn);
        });
        container.appendChild(toolbar);

        this.fuelSubElementPanels = document.createElement("div");
        this.fuelSubElementPanels.style.cssText = "display:flex;flex-direction:column;gap:10px;";
        container.appendChild(this.fuelSubElementPanels);

        this.syncFuelZoneUI();
    }

    syncFuelZoneUI() {
        if (!this.selectedObject || this.selectedObject.userData.mapObjectType !== "fuel_zone" || !this.fuelSubElementPanels) return;
        const props = normalizeFuelZone(this.selectedObject.userData.logicProperties);

        // Update button active styles
        this.fuelSubElementButtons?.forEach((btn, id) => {
            const active = id === this.fuelActiveSubElement;
            btn.style.background = active ? "#143d35" : "#182626";
            btn.style.borderColor = active ? "#42ffd2" : "#2b4742";
            btn.style.color = active ? "#a6ffeb" : "#8cb5ac";
            btn.style.boxShadow = active ? "0 0 8px rgba(66,255,210,0.3)" : "none";
        });

        const panel = this.fuelSubElementPanels;
        panel.replaceChildren();

        const updateProp = (key, val) => {
            if (!this.selectedObject) return;
            this.selectedObject.userData.logicProperties[key] = val;
            this.selectedObject.fuelZoneVisual?.update(0, []);
            this.syncTransformInputs();
            this.syncFuelZoneUI();
            this.transformGizmo.update();
            this.game?.broadcastObjectUpdate?.(this.selectedObject);
        };

        const createNudgeRow = (label, key, val, step, min, max, unit = "m") => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:#ccc;";
            const lbl = document.createElement("span");
            lbl.textContent = label;
            const controls = document.createElement("div");
            controls.style.cssText = "display:flex;align-items:center;gap:3px;";

            const input = document.createElement("input");
            input.type = "number";
            input.step = String(step);
            if (min !== undefined) input.min = String(min);
            if (max !== undefined) input.max = String(max);
            input.value = String(val);
            input.style.cssText = "width:65px;background:#222;color:white;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px;";
            input.onchange = () => updateProp(key, input.valueAsNumber);

            const btnMinus = document.createElement("button");
            btnMinus.textContent = `-${step}`;
            btnMinus.style.cssText = "background:#333;color:white;border:none;padding:3px 5px;border-radius:3px;cursor:pointer;font-size:10px;";
            btnMinus.onclick = () => updateProp(key, Number((props[key] - step).toFixed(2)));

            const btnPlus = document.createElement("button");
            btnPlus.textContent = `+${step}`;
            btnPlus.style.cssText = "background:#333;color:white;border:none;padding:3px 5px;border-radius:3px;cursor:pointer;font-size:10px;";
            btnPlus.onclick = () => updateProp(key, Number((props[key] + step).toFixed(2)));

            controls.append(btnMinus, input, btnPlus);
            row.append(lbl, controls);
            return row;
        };

        const createColorRow = (labelText, key, val) => {
            const row = document.createElement("label");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:#ccc;cursor:pointer;";
            const lbl = document.createElement("span");
            lbl.textContent = labelText;
            const input = document.createElement("input");
            input.type = "color";
            input.value = val;
            input.style.cssText = "border:none;background:transparent;width:32px;height:24px;cursor:pointer;";
            input.onchange = () => updateProp(key, input.value);
            row.append(lbl, input);
            return row;
        };

        const createSliderRow = (labelText, key, val, min, max, step) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:#ccc;";
            const lbl = document.createElement("span");
            lbl.textContent = labelText;
            const container = document.createElement("div");
            container.style.cssText = "display:flex;align-items:center;gap:6px;";
            const input = document.createElement("input");
            input.type = "range";
            input.min = String(min); input.max = String(max); input.step = String(step);
            input.value = String(val);
            input.style.cssText = "width:75px;cursor:pointer;";
            const valDisplay = document.createElement("span");
            valDisplay.style.cssText = "font-size:11px;min-width:28px;color:#42ffd2;text-align:right;";
            valDisplay.textContent = Number(val).toFixed(2);
            input.oninput = () => {
                valDisplay.textContent = Number(input.valueAsNumber).toFixed(2);
            };
            input.onchange = () => updateProp(key, input.valueAsNumber);
            container.append(input, valDisplay);
            row.append(lbl, container);
            return row;
        };

        const createSelectRow = (labelText, key, val, options) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:#ccc;";
            const lbl = document.createElement("span");
            lbl.textContent = labelText;
            const select = document.createElement("select");
            select.style.cssText = "background:#222;color:#a5ebe0;border:1px solid #444;border-radius:4px;padding:3px 6px;font-size:11px;max-width:160px;";
            options.forEach(([optVal, optText]) => {
                const o = document.createElement("option");
                o.value = optVal;
                o.textContent = optText;
                if (optVal === val) o.selected = true;
                select.appendChild(o);
            });
            select.onchange = () => updateProp(key, select.value);
            row.append(lbl, select);
            return row;
        };

        const createCheckboxRow = (labelText, key, val) => {
            const row = document.createElement("label");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:#ccc;cursor:pointer;";
            const lbl = document.createElement("span");
            lbl.textContent = labelText;
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!val;
            input.onchange = () => updateProp(key, input.checked);
            row.append(lbl, input);
            return row;
        };

        if (this.fuelActiveSubElement === "bar") {
            const banner = document.createElement("div");
            banner.style.cssText = "padding:6px 8px;background:#102e28;border-left:3px solid #42ffd2;color:#78ffd6;font-size:11px;border-radius:3px;line-height:1.4;";
            banner.textContent = "⛽ Edición de Barra de Reserva: Puedes moverla y rotarla en el visor 3D con el Gizmo (R para alternar Mover / Rotar / Escalar) o con estos controles:";
            panel.appendChild(banner);

            const chkRow = document.createElement("label");
            chkRow.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12px;color:#ddd;cursor:pointer;";
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.checked = props.showFuelBar;
            chk.onchange = () => updateProp("showFuelBar", chk.checked);
            chkRow.append(chk, document.createTextNode("Mostrar barra de reserva"));
            panel.appendChild(chkRow);

            // 1. Orientación y Dirección de Llenado
            const dirTitle = document.createElement("div");
            dirTitle.textContent = "Orientación de Llenado";
            dirTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(dirTitle);

            panel.appendChild(createSelectRow("Dirección", "fuelBarDirection", props.fuelBarDirection || 'horizontal', [
                ['horizontal', 'Horizontal: Izq a Der'],
                ['horizontal-rl', 'Horizontal: Der a Izq'],
                ['vertical', 'Vertical: Abajo a Arriba (Tótem/Columna)'],
                ['vertical-tb', 'Vertical: Arriba a Abajo']
            ]));

            // 2. Colores y Apariencia
            const styleTitle = document.createElement("div");
            styleTitle.textContent = "Colores y Brillo Emisivo (Lleno / Bajo / Vacío / Recarga)";
            styleTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(styleTitle);

            panel.appendChild(createColorRow("Color lleno / normal", "fuelBarColor", props.fuelBarColor || '#00cc22'));
            panel.appendChild(createColorRow("Color nivel bajo", "fuelBarLowColor", props.fuelBarLowColor || '#ffcc00'));
            panel.appendChild(createSliderRow("Umbral nivel bajo (% reserva)", "fuelBarLowThreshold", props.fuelBarLowThreshold ?? 0.25, 0.05, 0.75, 0.05));
            panel.appendChild(createColorRow("Color agotado / vacío", "fuelBarEmptyColor", props.fuelBarEmptyColor || '#ff1111'));
            panel.appendChild(createColorRow("Color recargando (parpadeante)", "fuelBarActiveColor", props.fuelBarActiveColor || '#00ff11'));
            panel.appendChild(createSliderRow("Brillo / Glow emisivo", "fuelBarEmissive", props.fuelBarEmissive ?? 0.8, 0, 2.5, 0.05));

            // 3. Contenedor y Chasis Exterior
            const frameTitle = document.createElement("div");
            frameTitle.textContent = "Chasis y Contenedor Exterior";
            frameTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(frameTitle);

            panel.appendChild(createCheckboxRow("Mostrar fondo/envolvente", "fuelBarBgVisible", props.fuelBarBgVisible !== false));
            panel.appendChild(createSliderRow("Opacidad del fondo", "fuelBarBgOpacity", props.fuelBarBgOpacity ?? 0.35, 0, 1, 0.05));
            panel.appendChild(createColorRow("Color del fondo", "fuelBarBgColor", props.fuelBarBgColor || '#071b18'));
            panel.appendChild(createCheckboxRow("Bordes nítidos del chasis", "fuelBarBorderVisible", props.fuelBarBorderVisible !== false));

            // 4. Dimensiones
            const dimTitle = document.createElement("div");
            dimTitle.textContent = "Dimensiones de la Barra (m)";
            dimTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(dimTitle);

            panel.appendChild(createNudgeRow("Ancho / Largo (X)", "fuelBarWidth", props.fuelBarWidth, 0.2, 0.01, 50));
            panel.appendChild(createNudgeRow("Alto (Y)", "fuelBarHeight", props.fuelBarHeight, 0.02, 0.01, 50));
            panel.appendChild(createNudgeRow("Grosor / Fondo (Z)", "fuelBarDepth", props.fuelBarDepth, 0.02, 0.01, 50));

            // 5. Posición y Rotación 3D
            const posTitle = document.createElement("div");
            posTitle.textContent = "Posición y Rotación 3D";
            posTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(posTitle);

            panel.appendChild(createNudgeRow("Desplazamiento X", "fuelBarOffsetX", props.fuelBarOffsetX, 0.2, -50, 50));
            panel.appendChild(createNudgeRow("Altura sobre zona Y", "fuelBarOffsetY", props.fuelBarOffsetY, 0.05, -50, 50));
            panel.appendChild(createNudgeRow("Desplazamiento Z", "fuelBarOffsetZ", props.fuelBarOffsetZ, 0.2, -50, 50));
            panel.appendChild(createNudgeRow("Rotación X (°)", "fuelBarRotationX", props.fuelBarRotationX || 0, 15, -360, 360, "°"));
            panel.appendChild(createNudgeRow("Rotación Y (°)", "fuelBarRotationY", props.fuelBarRotationY || 0, 15, -360, 360, "°"));
            panel.appendChild(createNudgeRow("Rotación Z (°)", "fuelBarRotationZ", props.fuelBarRotationZ || 0, 15, -360, 360, "°"));

            const resetBtn = document.createElement("button");
            resetBtn.textContent = "↺ Restablecer barra a valores por defecto";
            resetBtn.style.cssText = "background:#182e2b;color:#a5ebe0;border:1px solid #3d635c;padding:6px;border-radius:4px;cursor:pointer;font-size:11px;margin-top:4px;";
            resetBtn.onclick = () => {
                const defaults = {
                    fuelBarWidth: 1.8,
                    fuelBarHeight: 0.09,
                    fuelBarDepth: 0.06,
                    fuelBarOffsetX: 0,
                    fuelBarOffsetY: 0.32,
                    fuelBarOffsetZ: 0,
                    fuelBarRotationX: 0,
                    fuelBarRotationY: 0,
                    fuelBarRotationZ: 0,
                    fuelBarDirection: 'horizontal',
                    fuelBarColor: '#00cc22',
                    fuelBarLowColor: '#ffcc00',
                    fuelBarLowThreshold: 0.25,
                    fuelBarActiveColor: '#00ff11',
                    fuelBarEmptyColor: '#ff1111',
                    fuelBarEmissive: 0.8,
                    fuelBarBgVisible: true,
                    fuelBarBgOpacity: 0.35,
                    fuelBarBgColor: '#071b18',
                    fuelBarBorderVisible: true
                };
                Object.assign(props, defaults);
                this.selectedObject.userData.logicProperties = props;
                this.selectedObject.fuelZoneVisual?.update(0, []);
                this.syncTransformInputs();
                this.syncFuelZoneUI();
                this.transformGizmo.update();
                this.game?.broadcastObjectUpdate?.(this.selectedObject);
            };
            panel.appendChild(resetBtn);

        } else if (this.fuelActiveSubElement === "indicator") {
            const banner = document.createElement("div");
            banner.style.cssText = "padding:6px 8px;background:#102e28;border-left:3px solid #42ffd2;color:#78ffd6;font-size:11px;border-radius:3px;line-height:1.4;";
            banner.textContent = "💬 Edición de Indicador Flotante (Cartel): Puedes moverlo y escalarlo en el visor 3D con el Gizmo o modificar su altura, escala y texto aquí:";
            panel.appendChild(banner);

            const chkRow = document.createElement("label");
            chkRow.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12px;color:#ddd;cursor:pointer;";
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.checked = props.showFuelIndicator;
            chk.onchange = () => updateProp("showFuelIndicator", chk.checked);
            chkRow.append(chk, document.createTextNode("Mostrar cartel flotante"));
            panel.appendChild(chkRow);

            const flagsRow = document.createElement("div");
            flagsRow.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;";
            [
                ["showFuelStatus", "Estado (Gasolina)"],
                ["showFuelReserve", "Combustible disp."],
                ["showFuelRate", "Caudal por segundo"],
                ["showFuelEffects", "Estelas de flujo 3D"]
            ].forEach(([key, text]) => {
                const l = document.createElement("label");
                l.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;color:#ccc;cursor:pointer;";
                const c = document.createElement("input");
                c.type = "checkbox";
                c.checked = props[key];
                c.onchange = () => updateProp(key, c.checked);
                l.append(c, document.createTextNode(text));
                flagsRow.appendChild(l);
            });
            panel.appendChild(flagsRow);

            // Modo del Cartel (Billboard vs Surface)
            const modeTitle = document.createElement("div");
            modeTitle.textContent = "Modo de Visualización";
            modeTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(modeTitle);

            const modeRow = document.createElement("div");
            modeRow.style.cssText = "display:flex;gap:6px;margin:2px 0 6px 0;";
            const modes = [
                { id: "billboard", label: "Flotante (Cámara)", desc: "Gira para mirar siempre a la cámara" },
                { id: "surface", label: "Fijo en Superficie", desc: "Plano 3D orientable para fijar en paredes/suelo" }
            ];
            modes.forEach(m => {
                const btn = document.createElement("button");
                btn.textContent = m.label;
                btn.title = m.desc;
                const isActive = (props.fuelIndicatorMode || "billboard") === m.id;
                btn.style.cssText = `flex:1;padding:5px 4px;font-size:10px;border-radius:4px;cursor:pointer;border:1px solid ${isActive ? '#42ffd2' : '#2d4f48'};background:${isActive ? '#1c4d44' : '#102422'};color:${isActive ? '#fff' : '#85bfb5'};font-weight:${isActive ? 'bold' : 'normal'};`;
                btn.onclick = () => updateProp("fuelIndicatorMode", m.id);
                modeRow.appendChild(btn);
            });
            panel.appendChild(modeRow);

            const scaleTitle = document.createElement("div");
            scaleTitle.textContent = "Dimensiones del Cartel (Estirar / Cambiar)";
            scaleTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(scaleTitle);

            panel.appendChild(createNudgeRow("Ancho (X)", "fuelIndicatorWidth", props.fuelIndicatorWidth, 0.1, 0.2, 50));
            panel.appendChild(createNudgeRow("Alto (Y)", "fuelIndicatorHeight", props.fuelIndicatorHeight, 0.1, 0.1, 50));
            panel.appendChild(createNudgeRow("Tamaño de letra (auto-ajuste)", "fuelIndicatorFontSize", props.fuelIndicatorFontSize, 2, 14, 80));

            const rotTitle = document.createElement("div");
            rotTitle.textContent = "Rotación 3D del Cartel";
            rotTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(rotTitle);

            panel.appendChild(createNudgeRow("Rotación X", "fuelIndicatorRotationX", props.fuelIndicatorRotationX || 0, 5, -360, 360));
            panel.appendChild(createNudgeRow("Rotación Y", "fuelIndicatorRotationY", props.fuelIndicatorRotationY || 0, 5, -360, 360));
            panel.appendChild(createNudgeRow("Rotación Z", "fuelIndicatorRotationZ", props.fuelIndicatorRotationZ || 0, 5, -360, 360));

            const posTitle = document.createElement("div");
            posTitle.textContent = "Posición Relativa a la Estación";
            posTitle.style.cssText = "font-size:11px;font-weight:bold;color:#42ffd2;text-transform:uppercase;margin-top:4px;";
            panel.appendChild(posTitle);

            panel.appendChild(createNudgeRow("Desplazamiento X", "fuelIndicatorOffsetX", props.fuelIndicatorOffsetX, 0.2, -50, 50));
            panel.appendChild(createNudgeRow("Altura sobre zona Y", "fuelIndicatorOffsetY", props.fuelIndicatorOffsetY, 0.05, -50, 50));
            panel.appendChild(createNudgeRow("Desplazamiento Z", "fuelIndicatorOffsetZ", props.fuelIndicatorOffsetZ, 0.2, -50, 50));

            const resetBtn = document.createElement("button");
            resetBtn.textContent = "↺ Restablecer cartel (valores predeterminados)";
            resetBtn.style.cssText = "background:#182e2b;color:#a5ebe0;border:1px solid #3d635c;padding:6px;border-radius:4px;cursor:pointer;font-size:11px;margin-top:4px;";
            resetBtn.onclick = () => {
                const defaults = {
                    fuelIndicatorMode: 'billboard',
                    fuelIndicatorWidth: 2.8,
                    fuelIndicatorHeight: 1.4,
                    fuelIndicatorFontSize: 38,
                    fuelIndicatorRotationX: 0,
                    fuelIndicatorRotationY: 0,
                    fuelIndicatorRotationZ: 0,
                    fuelIndicatorScale: 1.0,
                    fuelIndicatorOffsetX: 0,
                    fuelIndicatorOffsetY: 0.85,
                    fuelIndicatorOffsetZ: 0
                };
                Object.assign(props, defaults);
                this.selectedObject.userData.logicProperties = props;
                this.selectedObject.fuelZoneVisual?.update(0, []);
                this.syncTransformInputs();
                this.syncFuelZoneUI();
                this.transformGizmo.update();
                this.game?.broadcastObjectUpdate?.(this.selectedObject);
            };
            panel.appendChild(resetBtn);

        } else {
            // Zone base view
            const banner = document.createElement("div");
            banner.style.cssText = "padding:6px 8px;background:#102e28;border-left:3px solid #42ffd2;color:#78ffd6;font-size:11px;border-radius:3px;line-height:1.4;";
            banner.textContent = "🟩 Editando Plataforma Base: Ajusta la posición, rotación y dimensiones del volumen de recarga con los paneles superiores o el Gizmo 3D.";
            panel.appendChild(banner);

            const borderBox = document.createElement("div");
            borderBox.style.cssText = "border-top:1px solid #23473f;padding-top:8px;margin-top:4px;";
            renderFuelZoneBorder(borderBox, props, updateProp);
            panel.appendChild(borderBox);

            const logicBtn = document.createElement("button");
            logicBtn.textContent = "⚙ Abrir Panel de Lógica Avanzada (Caudal, Capacidad, F)";
            logicBtn.style.cssText = "background:#1e4039;color:#b2fff0;border:1px solid #42ffd2;padding:8px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold;margin-top:6px;";
            logicBtn.onclick = () => this.openLogicPanel();
            panel.appendChild(logicBtn);
        }
    }
}

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
