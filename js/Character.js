import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { CapsuleCollider, CollisionLayer } from "./collision/index.js"

export class Character {
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera
        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null

        this.cameraController = null

        // Physics
        this.velocity = new THREE.Vector3()
        this.direction = new THREE.Vector3()
        this.speed = 10
        this.gravity = 30
        this.jumpForce = 15
        this.onGround = true
        this.isGroundedCollision = false

        this.targetRotation = 0
        this.rotationSmoothness = 0.12
        this.rotationOffset = Math.PI

        this.collider = null

        this.loadModel()
    }

    setCameraController(cameraController) {
        this.cameraController = cameraController
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load(
            "https://threejs.org/examples/models/gltf/Soldier.glb",
            (gltf) => {
                this.model = gltf.scene
                this.model.rotation.y = this.rotationOffset
                this.scene.add(this.model)

                this.model.traverse((object) => {
                    if (object.isMesh) object.castShadow = true
                })

                this.mixer = new THREE.AnimationMixer(this.model)
                const clips = gltf.animations

                this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Idle"))
                this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Run"))
                this.animations["Walk"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Walk"))

                this.switchAnimation("Idle")

                this.collider = new CapsuleCollider({
                    id: "local-player",
                    parent: this.model,
                    radius: 0.4,
                    height: 1.8,
                    offset: new THREE.Vector3(0, 0.9, 0),
                    layer: CollisionLayer.PLAYER,
                    collidesWithMask: CollisionLayer.REMOTE_PLAYER | CollisionLayer.NPC | CollisionLayer.ENVIRONMENT,
                    onCollisionEnter: (other, response) => {
                        console.log(`[Character] Collision started with: ${other.id}`)
                        if (response && response.normal.y > 0.5) {
                            this.isGroundedCollision = true
                            this.velocity.y = 0
                            this.onGround = true
                        }
                    },
                    onCollisionStay: (other, response) => {
                        if (response && response.normal.y > 0.5) {
                            this.isGroundedCollision = true
                            this.velocity.y = 0
                            this.onGround = true
                        }
                    },
                    onCollisionExit: (other) => {
                        console.log(`[Character] Collision ended with: ${other.id}`)
                    },
                })

                const loading = document.getElementById("loading")
                if (loading) loading.style.display = "none"
            },
            undefined,
            (error) => {
                console.error("An error happened loading the model:", error)
            },
        )
    }

    switchAnimation(name) {
        if (!this.animations[name]) return
        const action = this.animations[name]
        if (this.currentAction === action) return

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2)
        }
        action.reset().fadeIn(0.2).play()
        this.currentAction = action
    }

    update(dt, input) {
        if (!this.model) return

        // Reset grounded state from collision for this frame (will be set by collision system later if still colliding)
        // Actually, since collision runs AFTER update in main loop, we rely on flags set in PREVIOUS frame.
        // But if we reset here, we lose the info from previous frame's collision?
        // Wait.
        // Frame 1 Update: isGroundedCollision is false (init) -> Gravity applies.
        // Frame 1 Collision: Sets isGroundedCollision = true.
        // Frame 2 Update: isGroundedCollision is true.
        // We should start by setting it to false? No, if we set it to false here, we effectively treat it as "air" for this physics step until we read it? 
        // No, we read it immediately to cancel gravity.
        // If we reset it here, `this.isGroundedCollision` becomes false. Then we apply gravity.
        // Then at end of frame, collision runs and sets it true.
        // So effectively we apply 1 frame of gravity every frame?
        //
        // Better: Reset it to false at the very END of update? No.
        //
        // Standard pattern:
        // 1. Clear flags.
        // 2. Apply forces (Player input).
        // 3. Move.
        // 4. Resolve Collisions (sets flags).

        // Use the flag set by the LAST frame's collision update.
        // But we need to clear it so it doesn't stick true forever if we walk off a ledge.
        // Who clears it?
        // Method A: Clear at start of `collisionSystem.update`.
        // Method B: Clear at start of `character.update`.

        // If we clear at start of `character.update`, then we lose the "true" set by last frame's collision.
        // So Frame N Collision set it true.
        // Frame N+1 Update:
        //   Read `isGroundedCollision` (true).
        //   Apply logic.
        //   Clear `isGroundedCollision` (false).

        const wasGroundedByCollision = this.isGroundedCollision
        this.isGroundedCollision = false // Reset for next collision pass

        this.direction.set(0, 0, 0)

        let moveX = 0
        let moveZ = 0

        if (input.keys.forward) moveZ += 1
        if (input.keys.backward) moveZ -= 1
        if (input.keys.left) moveX -= 1
        if (input.keys.right) moveX += 1

        const hasMovement = moveX !== 0 || moveZ !== 0

        if (hasMovement && this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()

            // Calculate world-space movement direction
            this.direction.x = forward.x * moveZ + right.x * moveX
            this.direction.z = forward.z * moveZ + right.z * moveX
            this.direction.normalize()

            if (this.cameraController.isFirstPerson) {
                // In First Person, character always faces camera direction
                this.targetRotation = this.cameraController.fpYaw + this.rotationOffset

                // Calculate dot product to determine if moving forward or backward relative to camera
                const forward = this.cameraController.getForwardDirection()
                const moveDir = this.direction.clone()
                const dot = forward.dot(moveDir)

                // If moving backwards (dot < 0), reverse animation
                if (this.animations["Run"]) {
                    this.animations["Run"].timeScale = dot >= -0.1 ? 1 : -1
                }
            } else {
                // In Third Person, character faces movement direction
                this.targetRotation = Math.atan2(this.direction.x, this.direction.z) + this.rotationOffset
                if (this.animations["Run"]) this.animations["Run"].timeScale = 1
            }

            const currentRotation = this.model.rotation.y
            let diff = this.targetRotation - currentRotation

            // Handle angle wrapping
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2

            this.model.rotation.y += diff * this.rotationSmoothness

            this.switchAnimation("Run")
        } else {
            if (this.cameraController && this.cameraController.isFirstPerson) {
                this.targetRotation = this.cameraController.fpYaw + this.rotationOffset

                const currentRotation = this.model.rotation.y
                let diff = this.targetRotation - currentRotation

                while (diff > Math.PI) diff -= Math.PI * 2
                while (diff < -Math.PI) diff += Math.PI * 2

                this.model.rotation.y += diff * this.rotationSmoothness
            }
            this.switchAnimation("Idle")
        }

        // Calculate Velocity
        if (hasMovement) {
            this.velocity.x = this.direction.x * this.speed
            this.velocity.z = this.direction.z * this.speed
        } else {
            this.velocity.x = 0
            this.velocity.z = 0
        }

        // Jump
        if (this.onGround && input.keys.jump) {
            this.velocity.y = this.jumpForce
            this.onGround = false
        }

        // Gravity
        if (!this.onGround && !wasGroundedByCollision) {
            this.velocity.y -= this.gravity * dt
        }

        // Apply Position
        const deltaPosition = this.velocity.clone().multiplyScalar(dt)
        this.model.position.add(deltaPosition)

        // Floor Collision (World Y=0)
        if (this.model.position.y < 0) {
            this.model.position.y = 0
            this.velocity.y = 0
            this.onGround = true
        } else if (wasGroundedByCollision) {
            this.onGround = true
            // Ensure we don't build up negative velocity while grounded
            if (this.velocity.y < 0) this.velocity.y = 0
        } else {
            // If we are not at y=0 and not grounded by collision, we are in air
            this.onGround = false
        }

        // Update Animation Mixer
        if (this.mixer) {
            this.mixer.update(dt)
        }
    }

    getPosition() {
        return this.model ? this.model.position.clone() : new THREE.Vector3()
    }

    getRotation() {
        return this.model ? this.model.rotation.y : 0
    }

    getCollider() {
        return this.collider
    }
}
