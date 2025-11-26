import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

export class RemotePlayer {
    constructor(scene, playerId, position = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene
        this.playerId = playerId
        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null
        this.currentAnimation = "Idle"

        this.currentPosition = position.clone()
        this.targetPosition = position.clone()
        this.interpolationSpeed = 10

        this.currentRotation = 0
        this.targetRotation = 0
        this.rotationOffset = Math.PI

        this.label = null
        this.labelVisible = true

        this.loadModel()
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load(
            "https://threejs.org/examples/models/gltf/Soldier.glb",
            (gltf) => {
                this.model = gltf.scene
                this.model.position.copy(this.currentPosition)
                this.model.rotation.y = this.rotationOffset
                this.scene.add(this.model)

                this.model.traverse((object) => {
                    if (object.isMesh) {
                        object.castShadow = true
                        if (object.material) {
                            object.material = object.material.clone()
                            object.material.color.setHex(this.getPlayerColor())
                        }
                    }
                })

                this.mixer = new THREE.AnimationMixer(this.model)
                const clips = gltf.animations

                this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Idle"))
                this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Run"))
                this.animations["Walk"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Walk"))

                this.switchAnimation("Idle")

                this.createLabel()
            },
            undefined,
            (error) => {
                console.error(`[RemotePlayer ${this.playerId}] Error loading model:`, error)
            },
        )
    }

    getPlayerColor() {
        const colors = [0x4488ff, 0xff4444, 0x44ff44, 0xffff44, 0xff44ff, 0x44ffff, 0xff8844, 0x8844ff]
        const hash = this.playerId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
        return colors[hash % colors.length]
    }

    createLabel() {
        const canvas = document.createElement("canvas")
        canvas.width = 128
        canvas.height = 32
        const ctx = canvas.getContext("2d")

        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
        ctx.roundRect(0, 0, 128, 32, 6)
        ctx.fill()

        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 16px Arial"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`${this.playerId.slice(-4)}`, 64, 16)

        const texture = new THREE.CanvasTexture(canvas)
        const material = new THREE.SpriteMaterial({ map: texture })
        this.label = new THREE.Sprite(material)
        this.label.scale.set(1, 0.25, 1)
        this.label.position.y = 2.2
        this.label.visible = this.labelVisible

        if (this.model) {
            this.model.add(this.label)
        }
    }

    setLabelVisibility(visible) {
        this.labelVisible = visible
        if (this.label) {
            this.label.visible = visible
        }
    }

    setTargetPosition(x, y, z) {
        this.targetPosition.set(x, y, z)
    }

    setRotation(rotation) {
        this.targetRotation = rotation
    }

    switchAnimation(name) {
        if (!this.animations[name]) return
        if (this.currentAnimation === name) return

        const action = this.animations[name]

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2)
        }
        action.reset().fadeIn(0.2).play()
        this.currentAction = action
        this.currentAnimation = name
    }

    update(dt) {
        if (!this.model) return

        this.currentPosition.lerp(this.targetPosition, this.interpolationSpeed * dt)
        this.model.position.copy(this.currentPosition)

        let diff = this.targetRotation - this.currentRotation
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        this.currentRotation += diff * 0.15
        this.model.rotation.y = this.currentRotation + this.rotationOffset

        if (this.mixer) {
            this.mixer.update(dt)
        }

        const distance = this.currentPosition.distanceTo(this.targetPosition)
        if (distance > 0.1) {
            this.switchAnimation("Run")
        } else {
            this.switchAnimation("Idle")
        }
    }

    dispose() {
        if (this.model) {
            this.scene.remove(this.model)
            this.model.traverse((object) => {
                if (object.geometry) object.geometry.dispose()
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((m) => m.dispose())
                    } else {
                        object.material.dispose()
                    }
                }
            })
        }
        if (this.label) {
            if (this.label.material.map) this.label.material.map.dispose()
            this.label.material.dispose()
        }
    }
}
