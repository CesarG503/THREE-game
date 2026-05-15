import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class NPCRapier {
    scene: THREE.Scene;
    world: RAPIER.World;
    position: THREE.Vector3;
    pathPoints: THREE.Vector3[];

    model: THREE.Group | null;
    mixer: THREE.AnimationMixer | null;
    animations: Record<string, THREE.AnimationAction>;
    currentAction: THREE.AnimationAction | null;
    rigidBody: RAPIER.RigidBody | null;
    characterController: RAPIER.KinematicCharacterController | null;
    collider: RAPIER.Collider | null;

    speed: number;
    currentPathIndex: number;
    waitTime: number;
    state: string;

    currentRotation: number;
    rotationSmoothness: number;

    placeholder: THREE.Mesh | null;

    constructor(scene: THREE.Scene, world: RAPIER.World, position: THREE.Vector3, pathPoints: THREE.Vector3[] = []) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.pathPoints = pathPoints;

        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.rigidBody = null;
        this.characterController = null;
        this.collider = null;

        this.speed = 3;
        this.currentPathIndex = 0;
        this.waitTime = 0;
        this.state = "IDLE";

        this.currentRotation = 0;
        this.rotationSmoothness = 0.1;

        this.placeholder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 1.8),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        this.placeholder.position.copy(this.position);
        this.scene.add(this.placeholder);

        this.loadModel();
        this.initPhysics();
    }

    initPhysics() {
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(this.position.x, this.position.y, this.position.z);
        this.rigidBody = this.world.createRigidBody(bodyDesc);

        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0);
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

        this.characterController = this.world.createCharacterController(0.1);
        this.characterController.enableAutostep(0.6, 0.25, true);
        this.characterController.enableSnapToGround(0.5);
        this.characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
        this.characterController.setMinSlopeSlideAngle(45 * Math.PI / 180);
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load("/assets/Xbot.glb", (gltf) => {
            if (this.placeholder) {
                this.scene.remove(this.placeholder);
                this.placeholder = null;
            }

            this.model = gltf.scene;
            this.scene.add(this.model);

            this.model.traverse((o: THREE.Object3D | any) => { if (o.isMesh) o.castShadow = true; });

            this.model.scale.set(1, 1, 1);

            this.mixer = new THREE.AnimationMixer(this.model);
            const clips = gltf.animations;
            this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "idle"));
            this.animations["Walk"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "walk"));
            this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "run"));

            this.switchAnimation("Idle");
            this.updateModelVisuals();
        });
    }

    switchAnimation(name: string) {
        if (!this.animations[name]) return;
        const action = this.animations[name];
        if (this.currentAction === action) return;
        if (this.currentAction) this.currentAction.fadeOut(0.2);
        action.reset().fadeIn(0.2).play();
        this.currentAction = action;
    }

    update(dt: number) {
        if (!this.rigidBody || !this.model) return;

        let moveDir = new THREE.Vector3(0, 0, 0);

        if (this.pathPoints.length > 0) {
            const target = this.pathPoints[this.currentPathIndex];
            const currentPos = this.rigidBody.translation();
            const dist = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).distanceTo(target);

            if (dist < 1.0) {
                this.currentPathIndex = (this.currentPathIndex + 1) % this.pathPoints.length;
                this.switchAnimation("Idle");
            } else {
                moveDir.subVectors(target, currentPos).normalize();
                moveDir.y = 0;
                this.switchAnimation("Run");
            }
        }

        let desiredTranslation = moveDir.multiplyScalar(this.speed * dt);
        desiredTranslation.y = -20 * dt;

        this.characterController.computeColliderMovement(this.collider, desiredTranslation);

        let correctedMovement = this.characterController.computedMovement();
        let newPos = this.rigidBody.translation();
        newPos.x += correctedMovement.x;
        newPos.y += correctedMovement.y;
        newPos.z += correctedMovement.z;

        this.rigidBody.setNextKinematicTranslation(newPos);

        if (moveDir.lengthSq() > 0.001) {
            let targetRotation = Math.atan2(moveDir.x, moveDir.z);
            let rotDiff = targetRotation - this.currentRotation;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            this.currentRotation += rotDiff * this.rotationSmoothness;
        }

        this.updateModelVisuals();
        if (this.mixer) this.mixer.update(dt);
    }

    updateModelVisuals() {
        if (!this.rigidBody) return;
        const pos = this.rigidBody.translation();

        if (this.model) {
            this.model.position.set(pos.x, pos.y, pos.z);
            this.model.rotation.y = this.currentRotation;
        } else if (this.placeholder) {
            this.placeholder.position.set(pos.x, pos.y, pos.z);
        }
    }
}
