import * as THREE from "three"

/**
 * Gestor de Colocación de Objetos
 * Maneja la lógica de previsualización (ghost) y raycasting para colocar items.
 */
export class PlacementManager {
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera

        // Grupo para la visualización fantasma
        this.placementGhost = null
        this.ghostBaseMat = null
        this.ghostArrowMat = null
        this.ghostArrow = null

        // Texturas precargadas
        this.texImpulso = null
        this.texSalto = null

        // Estado del input
        this.currentSlot = -1
        this.rotationIndex = 0

        // Configuración Snapping
        this.snapToGrid = false
        this.gridSize = 1

        // Configuración Aerial Grid
        this.aerialGridActive = false
        this.aerialCollider = null
        this.aerialVisual = null

        this.init()
    }

    /**
     * Inicializa recursos y objetos visuales
     */
    init() {
        // Cargar texturas
        const loader = new THREE.TextureLoader()
        this.texImpulso = loader.load('./assets/textures/impulso.png')
        this.texSalto = loader.load('./assets/textures/salto.png')

        // Crear grupo fantasma
        this.placementGhost = new THREE.Group()
        this.scene.add(this.placementGhost)

        // 1. Ghost BOX (Paredes, Pilares, Pads)
        const boxGeo = new THREE.BoxGeometry(1, 1, 1) // Base 1x1x1, scale later
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        })
        this.ghostBaseMat = material

        this.ghostBoxMesh = new THREE.Mesh(boxGeo, material)
        // Position handled in update
        this.placementGhost.add(this.ghostBoxMesh)

        // 2. Ghost RAMP (Prisma Triangular)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(1, 0);
        shape.lineTo(0, 1);
        shape.lineTo(0, 0);

        const extrudeSettings = {
            steps: 1,
            depth: 1,
            bevelEnabled: false,
        };
        const rampGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        rampGeo.center()

        this.ghostRampMesh = new THREE.Mesh(rampGeo, material)
        this.ghostRampMesh.visible = false
        this.placementGhost.add(this.ghostRampMesh)


        // Flecha / Icono indicador (Solo para Pads viejos)
        const arrowGeo = new THREE.PlaneGeometry(2.4, 2.4)
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        })
        this.ghostArrowMat = arrowMat

        this.ghostArrow = new THREE.Mesh(arrowGeo, arrowMat)
        this.ghostArrow.rotation.x = -Math.PI / 2
        this.ghostArrow.position.y = 0.05 // Ligeramente elevado
        this.placementGhost.add(this.ghostArrow)

        // Grid Aéreo
        this.initAerialGrid()

        // Ocultar por defecto
        this.placementGhost.visible = false
    }

    initAerialGrid() {
        // 1. Dynamic Collider Plane (Infinite-like Plane)
        // We use a large flat box or plane. 
        // 100x1x100 is good.
        const geometry = new THREE.PlaneGeometry(1000, 1000)
        geometry.rotateX(-Math.PI / 2) // Horizontal
        const material = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        this.aerialCollider = new THREE.Mesh(geometry, material)
        this.scene.add(this.aerialCollider)

        // 2. Visual Grid (Single Layer)
        this.aerialVisual = new THREE.Group()

        // Single Grid Helper
        // 100 size, 100 divisions = 1x1 cells
        const grid = new THREE.GridHelper(100, 100, 0x444444, 0x222222)
        this.aerialVisual.add(grid)

        // No bounding box needed for infinite-like plane
        this.aerialVisual.visible = false
        this.scene.add(this.aerialVisual)
    }

    setAerialGrid(active) {
        this.aerialGridActive = active
        if (this.aerialVisual) {
            this.aerialVisual.visible = active
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
        this.currentItem = item
        this.rotationIndex = rotationIndex

        // Si no hay item o no es de construcción, ocultar
        if (!item || (!item.isImpulsePad && !item.type)) {
            this.placementGhost.visible = false
            this.currentHit = null
            // Hide aerial if not building? Maybe keep it if active? 
            // Better to hide if no tool selected to avoid confusion
            if (this.aerialVisual) this.aerialVisual.visible = false
            return
        }

        // --- Aerial Grid Dynamic Update ---
        if (this.aerialGridActive && playerPosition) {
            // Round height to nearest integer or step
            // e.g. if player at y=1.2, grid at 1.0. If at 1.8, grid at 2.0?
            // Or floor? Construction usually built up.
            // Let's use Math.floor(y) to build at foot level, or Math.round breaks at 0.5.
            const gridY = Math.round(playerPosition.y)

            this.aerialVisual.visible = true
            this.aerialVisual.position.y = gridY
            this.aerialCollider.position.y = gridY

            // Should infinite plane move x/z to follow player so grid is always centered?
            // Grid helper is finite (100x100). Yes, center on player x/z snapped to grid size?
            // Or just keep it at 0,0,0 if map is small?
            // Better to center it on player, snapped to 100 units?
            // For now, center on player x/z so grid is always around them.
            // But snap position to whole numbers to keep grid lines stable.
            this.aerialVisual.position.x = Math.round(playerPosition.x)
            this.aerialVisual.position.z = Math.round(playerPosition.z)
            // Collider can just be at valid height, it's huge.

        } else if (!this.aerialGridActive) {
            // Only hide if disabled
            if (this.aerialVisual) this.aerialVisual.visible = false
        }

        // Raycast
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)

        // Define objects to intersect
        let objectsToIntersect = this.scene.children

        // Explicitly handle aerial collider priority
        if (this.aerialGridActive && this.aerialCollider) {
            this.aerialCollider.visible = true // Must be visible for raycast? No, raycast works on invisible if recursive? 
            // Raycast checks visibility by default? No, unless recursive check?
            // THREE.Raycaster default doesn't check 'visible' unless traversing?
            // Actually it's simpler to set it visible=false but it still intersects.
            // But let's check.
        }

        const intersects = raycaster.intersectObjects(this.scene.children, true)

        // Filter out ghost and characters
        const hit = intersects.find(h =>
            h.distance < 60 && // Increased range for building
            h.object.type === "Mesh" &&
            h.object !== this.placementGhost &&
            !this.placementGhost.children.includes(h.object) &&
            !h.object.userData.isPlayer &&
            (this.aerialGridActive || h.object !== this.aerialCollider) // Only accept aerialCollider if active
        )

        this.currentHit = hit ? hit.point : null

        if (hit) {
            this.placementGhost.visible = true

            // Grid Snapping Logic
            if (this.snapToGrid || this.aerialGridActive) { // Always snap if aerial active? Or respect toggle?
                // User said "manipular y crear construcciones sin soporte en una maya 3d" 
                // Implicitly implies using the grid.
                const gridSize = this.gridSize || 1

                // If it's the Aerial Collider, force strict Y snap to that plane
                const isAerialHit = (hit.object === this.aerialCollider)

                const sx = Math.round(item.scale.x)
                const sz = Math.round(item.scale.z)
                // Height snapping too?
                const sy = Math.round(item.scale.y)

                const offsetX = (sx % 2 !== 0) ? (gridSize / 2) : 0
                const offsetZ = (sz % 2 !== 0) ? (gridSize / 2) : 0
                // Vertical snap offset? 
                // Since our pivot is the BASE of the object, we usually do NOT want to offset Y based on height for snapping to floor.
                // We want Base to be at Grid Y.
                // So offsetY should be 0 for Base-pivoted objects.
                const offsetY = 0

                hit.point.x = Math.round((hit.point.x - offsetX) / gridSize) * gridSize + offsetX
                hit.point.z = Math.round((hit.point.z - offsetZ) / gridSize) * gridSize + offsetZ

                // Aerial Grid specific logic
                if (isAerialHit) {
                    // Snap Y to the aerial plane level exactly
                    const gridY = this.aerialCollider.position.y
                    hit.point.y = gridY
                }
                // For normal Snapping, we DO NOT modify Y. We trust the raycast hit (floor/wall).
                // Existing logic before my changes did not snap Y, allowing it to sit on whatever surface.
            }

            this.placementGhost.position.copy(hit.point)

            // Adjust visual based on item type
            if (item.constructor.name === "MapObjectItem") {
                this.ghostArrow.visible = false
                this.ghostBaseMat.visible = true

                if (item.type === 'ramp') {
                    this.ghostBoxMesh.visible = false
                    this.ghostRampMesh.visible = true
                    this.ghostRampMesh.scale.set(item.scale.z, item.scale.y, item.scale.x)
                    this.ghostRampMesh.position.y = item.scale.y / 2
                } else {
                    this.ghostRampMesh.visible = false
                    this.ghostBoxMesh.visible = true
                    this.ghostBoxMesh.scale.set(item.scale.x, item.scale.y, item.scale.z)
                    this.ghostBoxMesh.position.y = item.scale.y / 2
                }
                this.ghostBaseMat.color.setHex(0x00FF00)

            } else {
                // IMPULSE PADS (Legacy)
                this.ghostRampMesh.visible = false
                this.ghostBoxMesh.visible = true
                this.ghostBoxMesh.scale.set(3, 0.2, 3)
                this.ghostBoxMesh.position.y = 0.1

                this.ghostArrow.visible = true

                const isJump = (item.id === "pad_jump")
                if (isJump && this.texSalto) {
                    this.ghostArrowMat.map = this.texSalto
                } else if (!isJump && this.texImpulso) {
                    this.ghostArrowMat.map = this.texImpulso
                }

                let rotY = 0
                if (rotationIndex === 1) rotY = -Math.PI / 2
                if (rotationIndex === 2) rotY = -Math.PI
                if (rotationIndex === 3) rotY = Math.PI / 2
                this.ghostArrow.rotation.z = rotY
            }

            // Apply rotation to ghost group
            if (item.constructor.name === "MapObjectItem") {
                this.placementGhost.rotation.y = 0
                if (rotationIndex === 1) this.placementGhost.rotation.y = -Math.PI / 2
                if (rotationIndex === 2) this.placementGhost.rotation.y = -Math.PI
                if (rotationIndex === 3) this.placementGhost.rotation.y = Math.PI / 2
            } else {
                this.placementGhost.rotation.y = 0
            }


            // Validation Logic (Restored)
            let isValid = true
            if (item.id.includes("pad")) {
                const PAD_SIZE = 3
                const isTargetPad = hit.object.userData && hit.object.userData.isImpulsePad
                let isOverlapping = false

                if (!isTargetPad) {
                    for (const obj of this.scene.children) {
                        if (obj.userData && obj.userData.isImpulsePad) {
                            const dx = Math.abs(obj.position.x - hit.point.x)
                            const dz = Math.abs(obj.position.z - hit.point.z)
                            if (dx < PAD_SIZE && dz < PAD_SIZE) {
                                isOverlapping = true
                                break
                            }
                        }
                    }
                }
                isValid = !isTargetPad && !isOverlapping
            }

            // Visual Feedback for Validity
            if (isValid) {
                if (item.constructor.name === "MapObjectItem") {
                    this.ghostBaseMat.color.setHex(0x00FF00)
                } else {
                    const isJump = (item.id === "pad_jump")
                    const color = isJump ? 0x00FFFF : 0x00FF00
                    this.ghostBaseMat.color.setHex(color)
                    this.ghostArrowMat.color.setHex(0xFFFFFF)
                }
                return hit.point
            } else {
                this.ghostBaseMat.color.setHex(0xFF0000)
                this.ghostArrowMat.color.setHex(0xFF0000) // Tint Red
                return null
            }

        } else {
            this.placementGhost.visible = false
            return null
        }
    }

    getCurrentTarget() {
        return this.currentHit
    }
}
