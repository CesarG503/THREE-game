import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLBModel } from "../character/models/glb/GLBModel";
import { PolygonModel } from "../character/models/polygon/PolygonModel";
import { PolygonModelSkin } from "../character/models/polygon/PolygonModelSkin";
import { GunItem } from "../items/GunItem";
import { WEAPONS_CONFIG } from "../items/WeaponSettings";
import { PelotaItem } from "../items/PelotaItem";
import { JetpackItem } from "../items/JetpackItem";
import type { GunConfig } from "../types";
import { getGravityQuaternion, normalizeGravityOrientation, type GravityOrientation } from "../utils/GravityOrientation";

export class RemotePlayer {
    scene: any;
    world: any;
    playerId: any;
    playerName: any;

    glbModel: any;
    polygonModel: any;
    polygonModelSkin: any;
    currentType: any;

    state: any;
    equippedWeaponName: any;
    equippedHandName: any;
    currentWeaponInstance: any;

    currentPosition: any;
    targetPosition: any;
    interpolationSpeed: number;

    currentRotation: number;
    targetRotation: number;
    rotationOffset: number;

    label: any;
    labelVisible: boolean;

    collider: any;
    rigidBody: any;
    attackEndTime: number;
    weaponsCache: any;
    particleSystem: any;
    localRoleId: any;
    gravityOrientation: GravityOrientation;
    targetGravityOrientation: GravityOrientation;
    gravityTransitionActive: boolean;
    gravityTransitionElapsed: number;
    gravityTransitionDuration: number;
    gravityTransitionStart: THREE.Quaternion;
    currentGravityQuaternion: THREE.Quaternion;
    targetGravityQuaternion: THREE.Quaternion;

    constructor(scene: any, world: any, playerId: any, playerName: any, position: any = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene;
        this.world = world;
        this.playerId = playerId;
        this.playerName = playerName || playerId.slice(-4);

        this.glbModel = new GLBModel(scene, false);
        this.polygonModel = new PolygonModel(scene, false);
        this.polygonModelSkin = new PolygonModelSkin(scene, false);
        this.currentType = "skin";

        this.state = {
            modelType: "skin",
            isMoving: false,
            isCrouching: false,
            isAttacking: false,
            isGrounded: true,
            verticalVelocity: 0,
            action: "Idle",
            equippedWeapon: null
        };

        this.equippedWeaponName = null;
        this.equippedHandName = null;
        this.currentWeaponInstance = null;

        this.currentPosition = position.clone();
        this.targetPosition = position.clone();
        this.interpolationSpeed = 10;

        this.currentRotation = 0;
        this.targetRotation = 0;
        this.rotationOffset = Math.PI;

        this.label = null;
        this.labelVisible = true;

        this.collider = null;
        this.rigidBody = null;
        this.attackEndTime = 0;
        this.weaponsCache = null;
        this.localRoleId = null;
        this.gravityOrientation = "down";
        this.targetGravityOrientation = "down";
        this.gravityTransitionActive = false;
        this.gravityTransitionElapsed = 0;
        this.gravityTransitionDuration = 0.65;
        this.gravityTransitionStart = new THREE.Quaternion();
        this.currentGravityQuaternion = new THREE.Quaternion();
        this.targetGravityQuaternion = new THREE.Quaternion();

        this.initPhysics();
        this.createLabel();
        this.setModelType(this.currentType);
    }

    initPhysics() {
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(this.currentPosition.x, this.currentPosition.y, this.currentPosition.z);
        this.rigidBody = this.world.createRigidBody(bodyDesc);

        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0);
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

        this.applyCollisionProfile();
    }

    applyCollisionProfile() {
        if (!this.collider) return;

        let membership = 0x0002;
        let filter = 0xfffd;

        let isSensor = false;

        let groups = (membership << 16) | filter;
        this.collider.setCollisionGroups(groups);
        this.collider.setSensor(isSensor);
    }

    setModelType(type: any) {
        if (!type) return;
        this.currentType = type;

        this.glbModel.setVisible(false);
        this.polygonModel.setVisible(false);
        this.polygonModelSkin.setVisible(false);

        if (type === "glb") {
            this.glbModel.setVisible(true);
        } else if (type === "polygon") {
            this.polygonModel.setVisible(true);
        } else if (type === "skin") {
            this.polygonModelSkin.setVisible(true);
        }
    }

    getPlayerColor() {
        const colors = [0x4488ff, 0xff4444, 0x44ff44, 0xffff44, 0xff44ff, 0x44ffff, 0xff8844, 0x8844ff];
        const hash = this.playerId.split("").reduce((acc: any, char: any) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    createLabel() {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.roundRect(0, 0, 128, 32, 6);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${this.playerName}`, 64, 16);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        this.label = new THREE.Sprite(material);
        this.label.scale.set(1, 0.25, 1);
        this.label.position.y = 2.2;
        this.label.visible = this.labelVisible;

        this.scene.add(this.label);
    }

    setLabelVisibility(visible: boolean) {
        this.labelVisible = visible;
        if (this.label) {
            this.label.visible = visible;
        }
    }

    setTargetPosition(x: number, y: number, z: number) {
        this.targetPosition.set(x, y, z);
    }

    setRotation(rotation: number) {
        this.targetRotation = rotation;
    }

    setState(state: any) {
        if (!state) return;

        if (state.isAttacking) {
            this.attackEndTime = Date.now() + 300;
        }

        let oldPlayerCollision = this.state.playerCollision;

        this.state = state;

        if (state.gravityOrientation !== undefined) {
            const gravityDuration = Number(state.gravityTransitionDuration ?? 0.65);
            this.setGravityOrientation(state.gravityOrientation, Number.isFinite(gravityDuration) ? gravityDuration : 0.65);
        }

        if (state.modelType && state.modelType !== this.currentType) {
            this.setModelType(state.modelType);
        }

        if (state.skinUrl && this.polygonModelSkin && this.polygonModelSkin.setSkinUrl) {
            this.polygonModelSkin.setSkinUrl(state.skinUrl);
        }

        if (this.polygonModelSkin && this.polygonModelSkin.setRoleVisual) {
            const sameRole = Boolean(this.localRoleId && state.roleId && this.localRoleId === state.roleId);
            this.polygonModelSkin.setRoleVisual(selectRoleVisualForViewer(state.roleVisual, sameRole));
        }

        if (state.playerCollision !== oldPlayerCollision) {
            this.applyCollisionProfile();
        }

        if (state.jumpAnimationType !== undefined) {
            this.polygonModelSkin.setJumpAnimationType(state.jumpAnimationType);
        }

        if (state.animationStyle !== undefined) {
            this.polygonModelSkin.setAnimationStyle(state.animationStyle);
        }

        if (state.limbBending !== undefined) {
            this.polygonModelSkin.setLimbBending(state.limbBending);
        }

        if (state.equippedWeapon !== this.equippedWeaponName || state.equippedHand !== this.equippedHandName) {
            const weaponChanged = state.equippedWeapon !== this.equippedWeaponName;
            this.equippedWeaponName = state.equippedWeapon;
            this.equippedHandName = state.equippedHand;

            if (!this.weaponsCache) {
                this.weaponsCache = {};
            }

            if (weaponChanged) {
                if (state.equippedWeapon && state.equippedWeapon.startsWith("gun_")) {
                    if (!this.weaponsCache[state.equippedWeapon]) {
                        const weaponConfig =
                            WEAPONS_CONFIG.find(c => c.id === state.equippedWeapon) ||
                            ({ id: state.equippedWeapon, name: state.equippedWeapon } as GunConfig);
                        this.weaponsCache[state.equippedWeapon] = new GunItem(weaponConfig);
                    }
                    this.currentWeaponInstance = this.weaponsCache[state.equippedWeapon];
                    this.currentWeaponInstance.equippedHand = state.equippedHand || "right";
                    this.glbModel.setHeldItem(this.currentWeaponInstance);
                    this.polygonModel.setHeldItem(this.currentWeaponInstance);
                    this.polygonModelSkin.setHeldItem(this.currentWeaponInstance);
                } else if (state.equippedWeapon === "pelota") {
                    if (!this.weaponsCache["pelota"]) {
                        this.weaponsCache["pelota"] = new PelotaItem();
                    }
                    this.currentWeaponInstance = this.weaponsCache["pelota"];
                    this.currentWeaponInstance.equippedHand = state.equippedHand || "right";
                    this.glbModel.setHeldItem(this.currentWeaponInstance);
                    this.polygonModel.setHeldItem(this.currentWeaponInstance);
                    this.polygonModelSkin.setHeldItem(this.currentWeaponInstance);
                } else if (state.equippedWeapon === "jetpack" || (state.equippedWeapon && state.equippedWeapon.startsWith("jetpack"))) {
                    if (!this.weaponsCache[state.equippedWeapon]) {
                        this.weaponsCache[state.equippedWeapon] = new JetpackItem({ id: state.equippedWeapon });
                    }
                    this.currentWeaponInstance = this.weaponsCache[state.equippedWeapon];
                    this.glbModel.setHeldItem(this.currentWeaponInstance);
                    this.polygonModel.setHeldItem(this.currentWeaponInstance);
                    this.polygonModelSkin.setHeldItem(this.currentWeaponInstance);
                } else {
                    this.currentWeaponInstance = null;
                    this.glbModel.setHeldItem(null);
                    this.polygonModel.setHeldItem(null);
                    this.polygonModelSkin.setHeldItem(null);
                }
            } else if (this.currentWeaponInstance) {
                this.currentWeaponInstance.equippedHand = state.equippedHand || "right";
                this.glbModel.setHeldItem(this.currentWeaponInstance);
                this.polygonModel.setHeldItem(this.currentWeaponInstance);
                this.polygonModelSkin.setHeldItem(this.currentWeaponInstance);
            }
        }
    }

    setGravityOrientation(orientation: any, duration = 0.65) {
        const nextOrientation = normalizeGravityOrientation(orientation);
        if (nextOrientation === this.targetGravityOrientation) return;

        this.targetGravityOrientation = nextOrientation;
        this.targetGravityQuaternion.copy(getGravityQuaternion(nextOrientation));
        this.gravityTransitionStart.copy(this.currentGravityQuaternion);
        this.gravityTransitionElapsed = 0;
        this.gravityTransitionDuration = Math.max(0.01, duration);
        this.gravityTransitionActive = true;
    }

    updateGravityTransition(dt: number) {
        if (!this.gravityTransitionActive) return;

        this.gravityTransitionElapsed += dt;
        const t = THREE.MathUtils.clamp(this.gravityTransitionElapsed / this.gravityTransitionDuration, 0, 1);
        const eased = t * t * (3 - 2 * t);
        this.currentGravityQuaternion.copy(this.gravityTransitionStart).slerp(this.targetGravityQuaternion, eased);

        if (t >= 1) {
            this.currentGravityQuaternion.copy(this.targetGravityQuaternion);
            this.gravityOrientation = this.targetGravityOrientation;
            this.gravityTransitionActive = false;
        }
    }

    getGravityUpVector() {
        return new THREE.Vector3(0, 1, 0).applyQuaternion(this.currentGravityQuaternion).normalize();
    }

    applyModelTransform(modelController: any, yawOffset: number) {
        if (!modelController?.model) return;
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentRotation + yawOffset);
        modelController.model.position.copy(this.currentPosition);
        modelController.model.quaternion.copy(this.currentGravityQuaternion).multiply(yaw);
    }

    update(dt: number) {
        this.updateGravityTransition(dt);
        this.currentPosition.lerp(this.targetPosition, this.interpolationSpeed * dt);
        const up = this.getGravityUpVector();

        if (this.label) {
            this.label.position.x = this.currentPosition.x;
            this.label.position.y = this.currentPosition.y;
            this.label.position.z = this.currentPosition.z;
            this.label.position.addScaledVector(up, 2.2);
        }

        if (this.rigidBody) {
            this.rigidBody.setNextKinematicTranslation({
                x: this.currentPosition.x,
                y: this.currentPosition.y,
                z: this.currentPosition.z
            });
            this.rigidBody.setNextKinematicRotation(this.currentGravityQuaternion);
        }

        let diff = this.targetRotation - this.currentRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.currentRotation += diff * 0.15;

        this.applyModelTransform(this.glbModel, 0);
        this.applyModelTransform(this.polygonModel, Math.PI);
        this.applyModelTransform(this.polygonModelSkin, Math.PI);

        if (this.polygonModelSkin.setHeadRotation) {
            this.polygonModelSkin.setHeadRotation(this.state.headPitch || 0, this.state.headYaw || 0);
        }

        const isLocallyMoving = (this.currentPosition.distanceTo(this.targetPosition) > 0.05);
        const hasInput = this.state.isMoving || isLocallyMoving;

        const effectivelyAttacking = this.state.isAttacking || (Date.now() < this.attackEndTime);

        this.glbModel.update(dt, hasInput);
        this.polygonModel.update(dt, hasInput);
        const isUsingJetpack = this.state.equippedWeapon && (this.state.equippedWeapon === "jetpack" || this.state.equippedWeapon.startsWith("jetpack"));
        const isSuperman = this.state.isSuperman !== undefined ? !!this.state.isSuperman : !!(isUsingJetpack && this.state.isCrouching && !this.state.isGrounded);
        const noPitchTilt = this.state.noPitchTilt !== undefined ? !!this.state.noPitchTilt : !!(isUsingJetpack && 
                               this.currentWeaponInstance && 
                               this.currentWeaponInstance.pointerFollowEnabled && 
                               !this.currentWeaponInstance.shiftFlightEnabled);
        const visualCrouch = !!(this.state.isCrouching && !isSuperman);
        const isRunning = !!this.state.isRunning;

        this.polygonModelSkin.update(
            dt,
            hasInput,
            visualCrouch,
            (effectivelyAttacking || false),
            (this.state.isGrounded !== undefined ? this.state.isGrounded : true),
            this.state.verticalVelocity || 0,
            isSuperman,
            noPitchTilt,
            isRunning
        );
        if (this.currentWeaponInstance && typeof this.currentWeaponInstance.updateAnim === "function") {
            this.currentWeaponInstance.updateAnim(dt, 0);
        }

        const effectivelyUsingJetpack = this.state.isUsingJetpack !== undefined ? !!this.state.isUsingJetpack : isUsingJetpack;

        if (effectivelyUsingJetpack && this.particleSystem && this.polygonModelSkin && this.polygonModelSkin.backItemMesh) {
            const jetpackMesh = this.polygonModelSkin.backItemMesh;
            const leftNozzleWorld = new THREE.Vector3();
            const rightNozzleWorld = new THREE.Vector3();
            const leftOffset = new THREE.Vector3(-0.15, 0.1, 0.5);
            const rightOffset = new THREE.Vector3(0.15, 0.1, 0.5);

            jetpackMesh.updateMatrixWorld(true);
            jetpackMesh.localToWorld(leftNozzleWorld.copy(leftOffset));
            jetpackMesh.localToWorld(rightNozzleWorld.copy(rightOffset));

            const normal = new THREE.Vector3(0, -1, 0);
            const particleVFX = (this.currentWeaponInstance && this.currentWeaponInstance.particleVFX) || "Humo y Fuego";
            this.particleSystem.spawnJetpackEffect(leftNozzleWorld, normal, particleVFX);
            this.particleSystem.spawnJetpackEffect(rightNozzleWorld, normal, particleVFX);
        }
    }

    dispose() {
        const removeMesh = (modelObj: any) => {
            if (modelObj && modelObj.model) {
                this.scene.remove(modelObj.model);
                modelObj.model.traverse((object: any) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach((m: any) => m.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
            }
        };

        removeMesh(this.glbModel);
        removeMesh(this.polygonModel);
        removeMesh(this.polygonModelSkin);

        if (this.label) {
            this.scene.remove(this.label);
            if (this.label.material.map) this.label.material.map.dispose();
            this.label.material.dispose();
        }
        if (this.rigidBody) {
            this.world.removeRigidBody(this.rigidBody);
        }
    }

    getCollider() {
        return this.collider;
    }
}

function selectRoleVisualForViewer(roleVisual: any, sameRole: boolean) {
    if (!roleVisual || typeof roleVisual !== "object") {
        return { type: "none" };
    }
    if (roleVisual.sameRole || roleVisual.otherRole) {
        return sameRole ? (roleVisual.sameRole || { type: "none" }) : (roleVisual.otherRole || { type: "none" });
    }
    return roleVisual;
}
