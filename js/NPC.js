import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { CapsuleCollider, CollisionLayer } from "./collision/index.js"

export class NPC {
    constructor(scene, position = new THREE.Vector3(0, 0, 0), id = "npc-default") {
        this.scene = scene
        this.position = position
        this.id = id
        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null
        this.rotationOffset = Math.PI
        this.scale = 1.0
        this.emissiveIntensity = 0.0
        this.heightOffset = 0

        this.collider = null

        this.loadModel()
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load(
            "./assets/Xbot.glb",
            (gltf) => {
                this.model = gltf.scene
                this.model.position.copy(this.position)
                this.model.position.y += this.heightOffset
                this.model.rotation.y = this.rotationOffset
                this.model.scale.set(this.scale, this.scale, this.scale)
                this.scene.add(this.model)

                this.model.traverse((object) => {
                    if (object.isMesh) {
                        object.castShadow = true
                        object.receiveShadow = true

                        if (object.material) {
                            object.material.emissive = new THREE.Color(0xffffff)
                            object.material.emissiveIntensity = this.emissiveIntensity
                        }
                    }
                })

                this.mixer = new THREE.AnimationMixer(this.model)
                const clips = gltf.animations

                if (clips && clips.length > 0) {
                    const runClip = THREE.AnimationClip.findByName(clips, "Survey") || clips[0]
                    this.animations["Survey"] = this.mixer.clipAction(runClip)
                    this.switchAnimation("Survey")
                }

                this.collider = new CapsuleCollider({
                    id: this.id,
                    parent: this.model,
                    radius: 0.5,
                    height: 2.0,
                    offset: new THREE.Vector3(0, 1.0, 0),
                    layer: CollisionLayer.NPC,
                    collidesWithMask: CollisionLayer.PLAYER | CollisionLayer.REMOTE_PLAYER,
                    isStatic: true,
                    userData: { type: "npc", id: this.id },
                    onCollisionEnter: (other) => {
                        console.log(`[NPC ${this.id}] Player entered interaction range`)
                    },
                })
            },
            undefined,
            (error) => {
                console.error("An error happened loading the NPC model:", error)
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

    update(dt) {
        if (this.mixer) {
            this.mixer.update(dt)
        }
    }

    getCollider() {
        return this.collider
    }
}
