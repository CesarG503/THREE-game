// @ts-nocheck

import * as THREE from "three"
import { StairsUtils } from "../utils/StairsUtils"
import { RampUtils } from "../utils/RampUtils"
import { LogicItemsManager } from "./logic_items/LogicItemsManager"
import { listAssets, uploadAsset } from "../platform/api"
import { applyMapObjectTexture, normalizeTextureSettings } from "../utils/TextureMapping"
import { TransformGizmo } from "../editor/TransformGizmo"

export class ObjectInspector {
    constructor(gameInstance) {
        this.game = gameInstance
        this.isVisible = false
        this.selectedObject = null
        this.customTextureAssets = []
        this.allowDynamicSwitch = false
        this.isCollapsed = false

        this.setupUI()
        this.transformGizmo = new TransformGizmo(this.game, this)
        void this.refreshCustomTextures()
    }

    setupUI() {
        // Main Container
        this.container = document.createElement('div')
        this.container.id = 'object-inspector'
        this.container.style.cssText = `
            position: absolute;
            top: 20px; 
            right: 20px;
            width: 300px;
            max-height: 90vh;
            background: rgba(0,0,0,0.9);
            border: 2px solid #444; 
            border-radius: 12px;
            display: none;
            flex-direction: column;
            color: white;
            font-family: sans-serif;
            z-index: 2000;
            padding: 15px;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #444 #222;
        `

        // Header
        const header = document.createElement('div')
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #555;
            padding-bottom: 10px;
            margin-bottom: 15px;
        `
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
                    } else if (type === "cylinder" || type === "tube") {
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
                    this.updateDimensions('y', val, true);
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
                    this.selectedObject.userData.originalScale.bendAngleX = val;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
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
                    this.selectedObject.userData.originalScale.bendAngleY = val;
                    this.updateDimensions('y', this.selectedObject.userData.originalScale.y, true);
                }
            };
            section.appendChild(rBendY.row);
            this.rowBendAngleY = rBendY.row;
            this.inputBendAngleY = rBendY.input;
        })

        // ...


        // ...


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
                    e.stopPropagation()
                })
            })

        document.body.appendChild(this.container)
    }

    createSection(title, contentBuilder) {
        const section = document.createElement('div')
        section.style.cssText = `border: 1px solid #333; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05);`

        const lbl = document.createElement('div')
        lbl.textContent = title
        lbl.style.cssText = `font-size: 12px; color: #aaa; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;`
        section.appendChild(lbl)

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

    show(object) {
        if (!object) return
        this.selectedObject = object
        this.isVisible = true
        this.container.style.display = 'flex'

        const isEnv = object.userData.mapObjectType?.startsWith("environment_");
        
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
        this.title.textContent = `Propiedades: ${objName}`
        if (this.inputCustomName) {
            this.inputCustomName.value = object.userData.customName || ""
        }

        if (this.chkDynamicSwitch) {
            this.chkDynamicSwitch.checked = this.allowDynamicSwitch
        }

        if (this.isCollapsed) {
            this.content.style.display = "none"
            this.container.style.maxHeight = "50px"
        } else {
            this.content.style.display = "flex"
            this.container.style.maxHeight = "90vh"
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

        this.syncTextureSettingsInputs(texSettings)

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
            object.userData.mapObjectType === 'gravity_pad' ||
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

        // Disable Game Input - REMOVED to allow movement
        // if (this.game.inputManager) this.game.inputManager.enabled = false
        document.exitPointerLock()
        if (this.game.cameraController) this.game.cameraController.setUIOpen(true)

        this.transformGizmo.attach(object)

        if (object.userData.mapObjectType === "logic_camera") {
            this.game?.logicCameraSystem?.showCameraPreview?.(object)
        } else {
            this.game?.logicCameraSystem?.closeCameraPreview?.()
        }
    }

    hide() {
        this.isVisible = false
        this.container.style.display = 'none'

        this.transformGizmo.detach()
        this.game?.logicCameraSystem?.closeCameraPreview?.()

        this.selectedObject = null
        if (this.game.cameraController) this.game.cameraController.setUIOpen(false)

        // Enable Game Input - REMOVED (never disabled)
        // if (this.game.inputManager) this.game.inputManager.enabled = true
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

        // Toggle custom inputs based on mapObjectType
        const type = this.selectedObject.userData.mapObjectType;
        const dimRow = this.dimensionsSection.querySelector('div'); // Standard grid row

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
            if (this.rowLength2) this.rowLength2.style.display = "flex";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "flex";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "flex";
            if (this.inputRadius) this.inputRadius.value = dims.radius || 0.5;
            if (this.inputLength1) this.inputLength1.value = dims.y || 2.0;
            if (this.inputLength2) this.inputLength2.value = dims.length2 || 2.0;
            if (this.inputBendAngleX) this.inputBendAngleX.value = dims.bendAngleX !== undefined ? dims.bendAngleX : 0;
            if (this.inputBendAngleY) this.inputBendAngleY.value = dims.bendAngleY !== undefined ? dims.bendAngleY : 90;
        } else {
            if (dimRow) dimRow.style.display = "grid";
            if (this.rowRadius) this.rowRadius.style.display = "none";
            if (this.rowLength1) this.rowLength1.style.display = "none";
            if (this.rowLength2) this.rowLength2.style.display = "none";
            if (this.rowBendAngleX) this.rowBendAngleX.style.display = "none";
            if (this.rowBendAngleY) this.rowBendAngleY.style.display = "none";
        }
    }

    cycleTransformMode() {
        return this.transformGizmo.cycleMode()
    }

    updateGizmo() {
        this.transformGizmo.update()
    }

    applyGizmoDimensions(dimensions, previousDimensions = null) {
        if (!this.selectedObject || !dimensions) return

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
        this.selectedObject.position[axis] = value
        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    nudge(axisAxis, amount) {
        if (!this.selectedObject) return
        const axis = axisAxis.toLowerCase()
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
        // Convert to radians
        const radians = valueDegrees * (Math.PI / 180)
        this.selectedObject.rotation[axis] = radians
        this.transformGizmo.update()
        this.refreshPhysicsAndVisuals()
    }

    nudgeRotation(axisAxis, amountDegrees) {
        if (!this.selectedObject) return
        const axis = axisAxis.toLowerCase()

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
        if (this.selectedObject.userData.mapObjectType === 'ramp') {
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
        } else if (this.selectedObject.userData.mapObjectType === 'circle') {
            const radius = dims.radius !== undefined ? dims.radius : (dims.x / 2 || 1.0);
            const height = dims.y || 0.05;
            newGeo = new THREE.CylinderGeometry(radius, radius, height, 32);
        } else if (this.selectedObject.userData.mapObjectType === 'tube') {
            // Rebuild Tube children
            const radius = dims.radius !== undefined ? dims.radius : 0.5;
            const length1 = dims.y || 2.0;
            const length2 = dims.length2 !== undefined ? dims.length2 : 2.0;
            const bendAngleX = dims.bendAngleX !== undefined ? dims.bendAngleX : 0;
            const bendAngleY = dims.bendAngleY !== undefined ? dims.bendAngleY : 90;

            const toRemove = [...this.selectedObject.children];
            toRemove.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                this.selectedObject.remove(c);
            });

            let mat = new THREE.MeshStandardMaterial({ color: this.selectedObject.userData.color || 0xffffff });
            if (toRemove.length > 0 && toRemove[0].material) {
                mat = toRemove[0].material;
            }

            // Section 1
            const sec1Geo = new THREE.CylinderGeometry(radius, radius, length1, 32);
            sec1Geo.translate(0, length1 / 2, 0);
            const sec1Mesh = new THREE.Mesh(sec1Geo, mat);
            sec1Mesh.castShadow = true;
            sec1Mesh.receiveShadow = true;
            this.selectedObject.add(sec1Mesh);

            // Elbow
            const elbowGeo = new THREE.SphereGeometry(radius, 32, 32);
            elbowGeo.translate(0, length1, 0);
            const elbowMesh = new THREE.Mesh(elbowGeo, mat);
            elbowMesh.castShadow = true;
            elbowMesh.receiveShadow = true;
            this.selectedObject.add(elbowMesh);

            // Section 2
            const sec2Geo = new THREE.CylinderGeometry(radius, radius, length2, 32);
            sec2Geo.translate(0, length2 / 2, 0);
            const sec2Mesh = new THREE.Mesh(sec2Geo, mat);
            sec2Mesh.castShadow = true;
            sec2Mesh.receiveShadow = true;
            sec2Mesh.position.set(0, length1, 0);
            sec2Mesh.rotation.set(
                bendAngleX * Math.PI / 180,
                bendAngleY * Math.PI / 180,
                0
            );
            this.selectedObject.add(sec2Mesh);
        } else {
            // Default Box
            newGeo = new THREE.BoxGeometry(dims.x, dims.y, dims.z)
        }

        if (newGeo) {
            this.selectedObject.geometry.dispose()
            this.selectedObject.geometry = newGeo
        }

        if (this.selectedObject.userData.texturePath) {
            this.reapplySelectedTexture()
        }
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

        this.selectedObject.userData.color = parseInt(hex.replace('#', '0x'))

        if (this.selectedObject.material) {
            this.selectedObject.material.color.set(hex)
        }
        // If Group (Stairs)
        if (this.selectedObject.isGroup) {
            this.selectedObject.children.forEach(c => {
                if (c.material) c.material.color.set(hex)
            })
        }
        
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
        }
    }

    updateTexture(pathOrDataUrl, assetId = null) {
        if (!this.selectedObject) return

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
            this.selectedObject.userData.textureSettings = { ...normalized }
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

        this.selectedObject.userData.textureSettings = normalizeTextureSettings({
            ...(this.selectedObject.userData.textureSettings || {}),
            [key]: value
        })
        this.syncTextureSettingsInputs(this.selectedObject.userData.textureSettings)
        if (this.selectedObject.userData.texturePath) {
            this.reapplySelectedTexture()
        }
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject)
        }
    }

    reapplySelectedTexture() {
        if (!this.selectedObject || !this.selectedObject.userData.texturePath) return
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

        // Calls a method in Game to regenerate body
        if (this.game.regenerateObjectPhysics) {
            this.game.regenerateObjectPhysics(this.selectedObject)
        }
        
        if (this.game && this.game.broadcastObjectUpdate) {
            this.game.broadcastObjectUpdate(this.selectedObject);
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

        const uuid = this.selectedObject.userData.uuid
        
        // Red
        if (this.game.networkManager && this.game.gameMode === 'editor') {
            this.game.networkManager.sendEditorRemove(uuid)
        }
        
        // Destrucción local
        this.game.deleteObjectByUuid(uuid)
    }
}
