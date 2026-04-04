import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { GLBModel } from "./Character/GLBModel.js"
import { PolygonModel } from "./Character/PolygonModel.js"
import { PolygonModelSkin } from "./Character/PolygonModelSkin.js"
import { GunItem } from "./item/GunItem.js"
import { PelotaItem } from "./item/PelotaItem.js"

export class RemotePlayer {
    constructor(scene, world, playerId, position = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene
        this.world = world
        this.playerId = playerId

        // Models
        this.glbModel = new GLBModel(scene)
        this.polygonModel = new PolygonModel(scene)
        this.polygonModelSkin = new PolygonModelSkin(scene)
        this.currentType = 'skin'

        // State Tracking
        this.state = {
            modelType: 'skin',
            isMoving: false,
            isCrouching: false,
            isAttacking: false,
            isGrounded: true,
            verticalVelocity: 0,
            action: "Idle",
            equippedWeapon: null
        }

        this.equippedWeaponName = null
        this.equippedHandName = null
        this.currentWeaponInstance = null

        this.currentPosition = position.clone()
        this.targetPosition = position.clone()
        this.interpolationSpeed = 10

        this.currentRotation = 0
        this.targetRotation = 0
        this.rotationOffset = Math.PI // Matches GLBModel rotation offset expectation

        this.label = null
        this.labelVisible = true

        this.collider = null
        this.rigidBody = null

        this.initPhysics()
        this.createLabel()
        this.setModelType(this.currentType)
    }

    initPhysics() {
        // Rapier Collider (Kinematic)
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(this.currentPosition.x, this.currentPosition.y, this.currentPosition.z)
        this.rigidBody = this.world.createRigidBody(bodyDesc)

        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0)
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody)
    }

    setModelType(type) {
        if (!type) return;
        this.currentType = type

        // Reset all
        this.glbModel.setVisible(false)
        this.polygonModel.setVisible(false)
        this.polygonModelSkin.setVisible(false)

        if (type === 'glb') {
            this.glbModel.setVisible(true)
        } else if (type === 'polygon') {
            this.polygonModel.setVisible(true)
        } else if (type === 'skin') {
            this.polygonModelSkin.setVisible(true)
        }
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

        this.scene.add(this.label)
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

    setState(state) {
        if (!state) return;

        // Sustain attack trigger for visual completion (Minecraft style swing takes ~200-300ms)
        if (state.isAttacking) {
            this.attackEndTime = Date.now() + 300;
        }

        this.state = state;

        if (state.modelType && state.modelType !== this.currentType) {
            this.setModelType(state.modelType);
        }

        if (state.jumpAnimationType !== undefined) {
            this.polygonModelSkin.setJumpAnimationType(state.jumpAnimationType);
        }

        if (state.equippedWeapon !== this.equippedWeaponName || state.equippedHand !== this.equippedHandName) {
            this.equippedWeaponName = state.equippedWeapon;
            this.equippedHandName = state.equippedHand;
            
            if (state.equippedWeapon === "gun") {
                this.currentWeaponInstance = new GunItem();
                this.currentWeaponInstance.equippedHand = state.equippedHand || "right";
                this.glbModel.setHeldItem(this.currentWeaponInstance);
                this.polygonModel.setHeldItem(this.currentWeaponInstance);
                this.polygonModelSkin.setHeldItem(this.currentWeaponInstance);
            } else if (state.equippedWeapon === "pelota") {
                this.currentWeaponInstance = new PelotaItem();
                this.currentWeaponInstance.equippedHand = state.equippedHand || "right";
                this.glbModel.setHeldItem(this.currentWeaponInstance);
                this.polygonModel.setHeldItem(this.currentWeaponInstance);
                this.polygonModelSkin.setHeldItem(this.currentWeaponInstance);
            } else {
                this.currentWeaponInstance = null;
                this.glbModel.setHeldItem(null);
                this.polygonModel.setHeldItem(null);
                this.polygonModelSkin.setHeldItem(null);
            }
        }

        // Forward reload/shoot signals to currentWeaponInstance if needed
        // (Visual bullets are handled by handleRemoteShoot in main_rapier, but we keep this instance around for future state)
    }

    update(dt) {
        // Interpolate Position
        this.currentPosition.lerp(this.targetPosition, this.interpolationSpeed * dt)

        // Update Label Position
        if (this.label) {
            this.label.position.x = this.currentPosition.x
            this.label.position.y = this.currentPosition.y + 2.2
            this.label.position.z = this.currentPosition.z
        }

        // Update Physics Body
        if (this.rigidBody) {
            this.rigidBody.setNextKinematicTranslation({
                x: this.currentPosition.x,
                y: this.currentPosition.y,
                z: this.currentPosition.z
            })
        }

        // Interpolate Rotation smoothly
        let diff = this.targetRotation - this.currentRotation
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        this.currentRotation += diff * 0.15

        // Dispatch state to models
        this.glbModel.setPosition(this.currentPosition)
        this.glbModel.setRotation(this.currentRotation)

        this.polygonModel.setPosition(this.currentPosition)
        this.polygonModel.setRotation(this.currentRotation)

        this.polygonModelSkin.setPosition(this.currentPosition)
        this.polygonModelSkin.setRotation(this.currentRotation)

        // Animate based on state
        // If local distance movement is significant, player is moving as fallback precaution
        const isLocallyMoving = (this.currentPosition.distanceTo(this.targetPosition) > 0.05)
        const hasInput = this.state.isMoving || isLocallyMoving

        // Force sustained attack to bypass missing 50ms ticks
        const effectivelyAttacking = this.state.isAttacking || (Date.now() < this.attackEndTime);

        this.glbModel.update(dt, hasInput)
        this.polygonModel.update(dt, hasInput)
        this.polygonModelSkin.update(
            dt,
            hasInput,
            this.state.isCrouching === true,
            effectivelyAttacking,
            this.state.isGrounded !== false,
            Number(this.state.verticalVelocity) || 0
        )
    }

    dispose() {
        // GLBModel handles its own dispose nicely if needed, but lets clean up what we can
        const removeMesh = (modelObj) => {
            if (modelObj && modelObj.model) {
                this.scene.remove(modelObj.model)
                modelObj.model.traverse((object) => {
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
        }

        removeMesh(this.glbModel)
        removeMesh(this.polygonModel)
        removeMesh(this.polygonModelSkin)

        if (this.label) {
            this.scene.remove(this.label)
            if (this.label.material.map) this.label.material.map.dispose()
            this.label.material.dispose()
        }
        if (this.rigidBody) {
            this.world.removeRigidBody(this.rigidBody)
        }
    }

    getCollider() {
        return this.collider
    }
}
