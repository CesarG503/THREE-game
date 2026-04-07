import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { GLBModel } from "./GLBModel.js"
import { PolygonModel } from "./PolygonModel.js"
import { PolygonModelSkin } from "./PolygonModelSkin.js"
import { ParticleSystem } from "../effects/ParticleSystem.js"

export class CharacterController {
    constructor(scene, world, camera, cameraController) {
        this.scene = scene
        this.world = world
        this.camera = camera
        this.cameraController = cameraController

        // Models
        this.glbModel = new GLBModel(scene)
        this.polygonModel = new PolygonModel(scene)
        this.polygonModelSkin = new PolygonModelSkin(scene)
        this.currentType = 'skin' // 'glb' | 'polygon' | 'skin'

        this.rigidBody = null
        this.characterController = null

        // Settings
        this.speed = 10
        this.jumpForce = 20
        this.grounded = false
        this.verticalVelocity = 0
        this.collider = null

        this.ladders = [] // Reference to ladders in level
        this.isClimbing = false

        this.rotationSmoothness = 0.15
        this.currentRotation = 0
        this.headPitch = 0;
        this.headYaw = 0;

        // Flight / Editor Mode
        this.canFly = false
        this.isFlying = false
        this.lastJumpTime = 0
        this.maxMultiJumps = 0;
        this.jumpCount = 0;
        this.wasJumpDown = false;

        // Momentum System
        this.momentum = new THREE.Vector3(0, 0, 0)
        this.momentumDamping = 2.0

        // No-Clip / Build Mode Ghost
        this.noClip = false

        // Stats & Health
        this.maxHealth = 100
        this.currentHealth = 100
        this.respawns = -1 // -1 = Infinite
        this.startPosition = new THREE.Vector3(0, 5, 0)
        this.isDead = false

        this.initPhysics()
        this.particleSystem = new ParticleSystem(scene)
        this.setModelType(this.currentType) // Initialize visibility

        // Event System
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    setModelType(type) {
        console.log("Setting Model Type:", type)
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

    initPhysics() {
        // 1. Create Rigid Body
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
        this.rigidBody = this.world.createRigidBody(bodyDesc)

        // 2. Create Collider (Capsule)
        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0)
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody)

        // 3. Create Key Character Controller
        this.characterController = this.world.createCharacterController(0.1)
        this.characterController.enableAutostep(0.6, 0.25, true)
        this.characterController.enableSnapToGround(0.5)
        this.characterController.setApplyImpulsesToDynamicBodies(true)

        this.characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
        this.characterController.setMinSlopeSlideAngle(45 * Math.PI / 180);
    }

    setNoClip(enabled) {
        this.noClip = enabled
        console.log("No-Clip", enabled ? "Enabled" : "Disabled")
    }

    applyImpulse(force) {
        this.momentum.add(force)
        if (force.y !== 0) {
            this.verticalVelocity = force.y
            this.momentum.y = 0
            this.grounded = false
        }
    }

    update(dt, input) {
        if (!this.rigidBody) return

        // 0. No-Clip Override (God Mode)
        if (this.noClip) {
            let speed = this.speed * 2
            let moveDir = new THREE.Vector3()

            if (this.cameraController) {
                const camDir = new THREE.Vector3()
                this.camera.getWorldDirection(camDir)
                const right = this.cameraController.getRightDirection()

                if (input.keys.forward) moveDir.add(camDir)
                if (input.keys.backward) moveDir.sub(camDir)
                if (input.keys.right) moveDir.add(right)
                if (input.keys.left) moveDir.sub(right)

                if (input.keys.jump) moveDir.y += 1
            }

            if (moveDir.lengthSq() > 0) {
                moveDir.normalize().multiplyScalar(speed * dt)
            }

            let newPos = this.rigidBody.translation()
            newPos.x += moveDir.x
            newPos.y += moveDir.y
            newPos.z += moveDir.z

            this.rigidBody.setNextKinematicTranslation(newPos)
            this.updateModelVisuals()
            return
        }

        // Flight Mode Check
        if (this.isFlying) {
            this.checkFlightToggle(input)
            // CRITICAL: Update jump state before potentially returning
            this.wasJumpDown = input.keys.jump

            if (this.isFlying) {
                let moveDir = new THREE.Vector3()
                if (input.keys.forward) moveDir.z += 1
                if (input.keys.backward) moveDir.z -= 1
                if (input.keys.left) moveDir.x -= 1
                if (input.keys.right) moveDir.x += 1

                this.handleFlightMovement(dt, input, moveDir)
                return
            }
        }

        // Double Jump / Flight Toggle Check
        if (this.canFly) {
            this.checkFlightToggle(input)
        }

        // 1. Calculate Desired Movement
        let moveDir = new THREE.Vector3()
        if (input.keys.forward) moveDir.z += 1
        if (input.keys.backward) moveDir.z -= 1
        if (input.keys.left) moveDir.x -= 1
        if (input.keys.right) moveDir.x += 1

        this.checkClimbing()

        let desiredTranslation = new THREE.Vector3()
        let hasInput = moveDir.lengthSq() > 0

        if (hasInput && this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()

            desiredTranslation.x = forward.x * moveDir.z + right.x * moveDir.x
            desiredTranslation.z = forward.z * moveDir.z + right.z * moveDir.x
            desiredTranslation.normalize().multiplyScalar(this.speed * dt)

            // Rotation Logic
            if (this.cameraController.isFirstPerson) {
                this.headPitch = this.cameraController.fpPitch;
                
                let targetBodyRot = this.cameraController.fpYaw + Math.PI;
                let angleDiff = targetBodyRot - this.currentRotation;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                const deadzone = Math.PI / 3; // 60 degrees max head turn
                if (Math.abs(angleDiff) > deadzone) {
                    let correction = Math.sign(angleDiff) * (Math.abs(angleDiff) - deadzone);
                    this.currentRotation += correction;
                    angleDiff = targetBodyRot - this.currentRotation;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                }
                this.headYaw = angleDiff;

            } else {
                this.headPitch = 0;
                this.headYaw = 0;
                let targetRotation = Math.atan2(desiredTranslation.x, desiredTranslation.z) + Math.PI
                let rotDiff = targetRotation - this.currentRotation
                while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
                while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
                this.currentRotation += rotDiff * this.rotationSmoothness
            }

        } else {
            // Idle Logic
            if (this.cameraController && this.cameraController.isFirstPerson) {
                this.headPitch = this.cameraController.fpPitch;
                
                let targetBodyRot = this.cameraController.fpYaw + Math.PI;
                let angleDiff = targetBodyRot - this.currentRotation;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                const deadzone = Math.PI / 3;
                if (Math.abs(angleDiff) > deadzone) {
                    let correction = targetBodyRot - (Math.sign(angleDiff) * deadzone);
                    let diff = correction - this.currentRotation;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    // Smoothly rotate the body to follow
                    this.currentRotation += diff * 15.0 * dt;
                    
                    angleDiff = targetBodyRot - this.currentRotation;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                }
                this.headYaw = angleDiff;
            } else {
                this.headPitch = 0;
                this.headYaw = 0;
            }
        }

        // Update Model Animations
        const isGrounded = this.characterController.computedGrounded();
        this.glbModel.update(dt, hasInput)
        this.polygonModel.update(dt, hasInput)
        this.polygonModelSkin.update(dt, hasInput, input.keys.crouch, input.keys.attack, isGrounded, this.verticalVelocity)

        if (this.particleSystem) this.particleSystem.update(dt);

        // 2. Physics Movement Calculation
        if (this.isClimbing) {
            this.verticalVelocity = 0
            if (input.keys.forward) this.verticalVelocity = 3
            if (input.keys.backward) this.verticalVelocity = -3

            if (input.keys.forward || input.keys.backward) {
                desiredTranslation.x = 0
                desiredTranslation.z = 0
                if (input.keys.left || input.keys.right) {
                    const right = this.cameraController.getRightDirection()
                    desiredTranslation.x = right.x * moveDir.x
                    desiredTranslation.z = right.z * moveDir.x
                    desiredTranslation.normalize().multiplyScalar(this.speed / 2 * dt)
                }
            }
        } else {
            // let gravityStep = -20 * dt
            // Handled in jump logic now
        }

        // Jump Logic
        // Reset Jump Count if grounded
        if (isGrounded) {
            if (this.jumpCount > 0) {
                this.jumpCount = 0;
                this.emit('jumpChanged', { current: this.maxMultiJumps, max: this.maxMultiJumps, type: 'reset' });
            }
        }

        // Detect Jump Trigger (Rising Edge)
        const jumpJustPressed = input.keys.jump && !this.wasJumpDown;

        if (this.isClimbing) {
            if (input.keys.jump) {
                this.isClimbing = false
                this.verticalVelocity = 5
            }
        } else if (isGrounded && input.keys.jump) {
            // Standard Ground Jump
            this.verticalVelocity = this.jumpForce
        } else if (!isGrounded && !this.isFlying) {
            // Air / Multi Jump
            if (jumpJustPressed && this.jumpCount < this.maxMultiJumps) {
                this.verticalVelocity = this.jumpForce;
                this.jumpCount++;
                console.log(`Multi-Jump: ${this.jumpCount}/${this.maxMultiJumps}`);

                this.emit('jumpChanged', {
                    current: this.maxMultiJumps - this.jumpCount,
                    max: this.maxMultiJumps,
                    type: 'air-jump'
                });

                if (this.particleSystem) {
                    this.particleSystem.spawnJumpEffect(this.getPosition());
                }
            }

            // Gravity
            if (this.verticalVelocity > -20) { // Limit terminal velocity
                this.verticalVelocity -= 50 * dt
            }
        }

        this.wasJumpDown = input.keys.jump;

        if (isGrounded && this.verticalVelocity <= 0) {
            this.verticalVelocity = -5
        }

        desiredTranslation.y = this.verticalVelocity * dt

        // Momentum
        const dampingFactor = Math.exp(-this.momentumDamping * dt)
        this.momentum.multiplyScalar(dampingFactor)
        if (this.momentum.lengthSq() < 0.01) {
            this.momentum.set(0, 0, 0)
        }
        desiredTranslation.add(this.momentum.clone().multiplyScalar(dt))

        // 3. EXECUTE MOVEMENT
        this.characterController.computeColliderMovement(
            this.collider,
            desiredTranslation,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
        )

        let correctedMovement = this.characterController.computedMovement()
        let newPos = this.rigidBody.translation()
        newPos.x += correctedMovement.x
        newPos.y += correctedMovement.y
        newPos.z += correctedMovement.z

        this.rigidBody.setNextKinematicTranslation(newPos)

        // 5. Update Visuals (Mesh)
        this.updateModelVisuals()
    }

    toggleFlight() {
        this.isFlying = !this.isFlying
        this.verticalVelocity = 0
        this.momentum.set(0, 0, 0)
        console.log("Flight Mode:", this.isFlying)
    }

    handleFlightMovement(dt, input, moveDir) {
        this.verticalVelocity = 0
        let desiredTranslation = new THREE.Vector3()
        let speed = this.speed * 2

        if (this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()
            let camDir = new THREE.Vector3()
            this.camera.getWorldDirection(camDir)

            // Re-calculate move based on camera Look vector for "Free Cam" feel
            // We use the input moveDir to determine which direction relative to cam
            // Actually, we should just use input keys mapping to cam direction
            if (input.keys.forward) desiredTranslation.add(camDir)
            if (input.keys.backward) desiredTranslation.sub(camDir)
            if (input.keys.right) desiredTranslation.add(right)
            if (input.keys.left) desiredTranslation.sub(right)

            if (input.keys.jump) desiredTranslation.y += 1
        }

        if (desiredTranslation.lengthSq() > 0) {
            desiredTranslation.normalize().multiplyScalar(speed * dt)
        }

        this.characterController.computeColliderMovement(
            this.collider,
            desiredTranslation,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
        )
        let corrected = this.characterController.computedMovement()
        let newPos = this.rigidBody.translation()
        newPos.x += corrected.x
        newPos.y += corrected.y
        newPos.z += corrected.z
        this.rigidBody.setNextKinematicTranslation(newPos)

        this.updateModelVisuals()
    }

    checkFlightToggle(input) {
        if (input.keys.jump && !this.wasJumpDown) {
            const now = Date.now()
            if (now - this.lastJumpTime < 300) {
                this.toggleFlight()
            }
            this.lastJumpTime = now
        }
        // this.wasJumpDown = input.keys.jump // handled in update now
    }

    checkClimbing() {
        if (!this.ladders || this.ladders.length === 0) return

        const myPos = this.getPosition()
        const center = myPos.clone().add(new THREE.Vector3(0, 1, 0))

        let touchingLadder = false

        for (const ladder of this.ladders) {
            // FORCE Update Bounds if needed or just periodically
            // Ideally we only do this if it moved, but for safety in this fix:
            // We check if bounds exist. If not, create them.
            if (!ladder.bounds) ladder.bounds = new THREE.Box3()

            // If the ladder has been resized/moved, we need to ensure bounds are fresh in World Space.
            // setFromObject calculates World AABB.
            // Optimization: Only do this if we suspect change, but for now we do it
            // because the user reported issues with "ghost" sizes.
            // using userData.needsBoundsUpdate flag if set by Editor.
            if (!ladder.userData) ladder.userData = {}; // Safety init

            if (ladder.userData.needsBoundsUpdate || !ladder.userData.boundsInitialized) {
                // Fix: Check if ladder is a standard Object3D before calling updateMatrixWorld
                if (typeof ladder.updateMatrixWorld === 'function') {
                    ladder.updateMatrixWorld(true)

                    // NEW: Custom traversal to ignore Gizmo (AxesHelper)
                    ladder.bounds.makeEmpty()

                    if (typeof ladder.traverse === 'function') {
                        ladder.traverse((child) => {
                            // Skip AxesHelper or explicit Gizmos
                            if (child.type === 'AxesHelper' || (child.userData && child.userData.isGizmo)) return

                            if (child.geometry) {
                                ladder.bounds.expandByObject(child)
                            }
                        })
                    } else {
                        // Fallback if no traverse (unlikely for Object3D)
                        ladder.bounds.setFromObject(ladder)
                    }
                }
                // Else: It's a custom Ladder object or wrapper (LevelLoader/LevelBuilder) 
                // that likely has bounds pre-calculated or managed internally. 
                // We just mark it as initialized.

                ladder.userData.needsBoundsUpdate = false
                ladder.userData.boundsInitialized = true
            }

            // Check distance instead of strict containment.
            // Player radius is approx 0.5. Solid rails keep player center ~0.55m away from ladder center.
            // Distance 0 means inside. Distance < 0.7 allows touching + small buffer.
            if (ladder.bounds.distanceToPoint(center) < 0.7) {
                touchingLadder = true
                break
            }
        }

        if (touchingLadder && !this.isClimbing) {
            this.isClimbing = true
            this.verticalVelocity = 0
        } else if (!touchingLadder && this.isClimbing) {
            this.isClimbing = false
        }
    }

    updateModelVisuals() {
        if (!this.rigidBody) return

        const pos = this.rigidBody.translation()
        const position = new THREE.Vector3(pos.x, pos.y, pos.z)

        this.glbModel.setPosition(position)
        this.glbModel.setRotation(this.currentRotation)

        this.polygonModel.setPosition(position)
        this.polygonModel.setRotation(this.currentRotation)

        this.polygonModelSkin.setPosition(position)
        this.polygonModelSkin.setRotation(this.currentRotation)
        if (this.polygonModelSkin.setHeadRotation) {
            this.polygonModelSkin.setHeadRotation(this.headPitch, this.headYaw)
        }
        
        const isFP = this.cameraController ? this.cameraController.isFirstPerson : false;
        if (this.polygonModelSkin.setFirstPerson) {
            this.polygonModelSkin.setFirstPerson(isFP)
        }
    }

    getPosition() {
        if (this.rigidBody) {
            const t = this.rigidBody.translation()
            return new THREE.Vector3(t.x, t.y, t.z)
        }
        return new THREE.Vector3()
    }

    getRotation() {
        return this.currentRotation
    }

    setStats(stats) {
        if (stats.speed !== undefined) this.speed = stats.speed
        if (stats.jumpForce !== undefined) this.jumpForce = stats.jumpForce
        if (stats.maxHealth !== undefined) {
            this.maxHealth = stats.maxHealth
            this.currentHealth = this.maxHealth // Reset health on profile change? Maybe.
        }
        if (stats.respawns !== undefined) this.respawns = stats.respawns
        if (stats.canFly !== undefined) this.canFly = stats.canFly
        if (stats.maxMultiJumps !== undefined) this.maxMultiJumps = stats.maxMultiJumps

        if (stats.jumpAnimationType !== undefined) {
            this.polygonModelSkin.setJumpAnimationType(stats.jumpAnimationType)
        }
        if (stats.fallAnimationType !== undefined) {
            this.polygonModelSkin.setFallAnimationType(stats.fallAnimationType)
        }

        console.log("Stats Updated:", stats)
    }

    setHeldItem(item) {
        // Validate type? For now just pass to skin
        this.emit('itemEquipped', item); // Event for HUD or others?

        // Delegate to active model
        if (this.polygonModelSkin) {
            this.polygonModelSkin.setHeldItem(item);
        }
    }

    takeDamage(amount) {
        if (this.isDead || this.noClip) return

        this.currentHealth -= amount
        console.log(`Player Health: ${this.currentHealth}/${this.maxHealth}`)

        this.emit('healthChanged', { current: this.currentHealth, max: this.maxHealth });

        if (this.currentHealth <= 0) {
            this.die()
        }
    }

    die() {
        if (this.isDead) return
        this.isDead = true
        console.log("Player Died!")

        // Visual feedback? (Animation, Particle)

        // Respawn Logic
        if (this.respawns === -1 || this.respawns > 0) {
            if (this.respawns > 0) this.respawns--
            setTimeout(() => this.respawn(), 2000) // 2s delay
        } else {
            console.log("Game Over - No Respawns Left")
            // Trigger Game Over UI or Spectator Mode
            alert("¡Has muerto definitivamente!")
        }
    }

    respawn() {
        if (!this.rigidBody) return

        this.isDead = false
        this.currentHealth = this.maxHealth

        this.emit('healthChanged', { current: this.currentHealth, max: this.maxHealth });
        this.emit('jumpChanged', { current: this.maxMultiJumps, max: this.maxMultiJumps });

        // Reset Position (Teleport)
        // Ideally use a Spawn Point from LogicSystem if available, else startPosition
        let respawnPos = this.startPosition

        // Check for Spawn Points in Scene? 
        // We can't easily access LogicSystem here directly unless passed or via global.
        // For now, use startPosition which we should update if we find a spawn point interactively.

        this.rigidBody.setTranslation({ x: respawnPos.x, y: respawnPos.y, z: respawnPos.z }, true)
        this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)

        console.log("Respawned at", respawnPos)
    }
}
