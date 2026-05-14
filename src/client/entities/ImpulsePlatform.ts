import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class ImpulsePlatform {
    scene: any;
    world: any;
    position: any;
    direction: any;
    strength: number;
    type: string;

    width: number;
    height: number;
    depth: number;

    collider: any;
    mesh: any;
    wasInZone: boolean;

    constructor(scene: any, world: any, position: any, direction: any, strength: number, type: string = "pad") {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.direction = direction.normalize();
        this.strength = strength;
        this.type = type;

        this.width = 3;
        this.height = 0.2;
        this.depth = 3;

        this.collider = null;
        this.mesh = null;
        this.wasInZone = false;
        this.initPhysics();
        this.initVisuals();
    }

    initPhysics() {
        let bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
            this.position.x,
            this.position.y - (this.height / 2),
            this.position.z
        );
        let rigidBody = this.world.createRigidBody(bodyDesc);

        let colliderDesc = RAPIER.ColliderDesc.cuboid(
            this.width / 2,
            this.height / 2,
            this.depth / 2
        ).setSensor(true);

        this.collider = this.world.createCollider(colliderDesc, rigidBody);
    }

    initVisuals() {
        const isJump = this.direction.y > 0.5;

        const lateralColor = 0x00ff00;
        const jumpColor = 0x00ffff;

        const color = isJump ? jumpColor : lateralColor;

        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.8
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.userData.isImpulsePad = true;
        this.mesh.position.copy(this.position);
        this.mesh.position.y -= this.height / 2;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        const textureLoader = new THREE.TextureLoader();
        const texturePath = isJump ? "/assets/textures/salto.png" : "/assets/textures/impulso.png";
        const texture = textureLoader.load(texturePath);

        const arrowGeometry = new THREE.PlaneGeometry(this.width * 0.8, this.depth * 0.8);
        const arrowMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);

        arrowMesh.position.y = this.height / 2 + 0.01;
        arrowMesh.rotation.x = -Math.PI / 2;

        if (!isJump) {
            const flatDir = new THREE.Vector3(this.direction.x, 0, this.direction.z).normalize();

            if (flatDir.lengthSq() > 0.001) {
                const targetTheta = Math.atan2(this.direction.x, this.direction.z);
                arrowMesh.rotation.z = targetTheta - Math.PI;
            }
        }

        this.mesh.add(arrowMesh);
    }

    update(character: any) {
        if (!character || !character.rigidBody || !this.collider) return;

        const charPos = character.getPosition();

        const halfW = this.width / 2;
        const halfD = this.depth / 2;

        const dx = Math.abs(charPos.x - this.position.x);
        const dz = Math.abs(charPos.z - this.position.z);
        const dy = charPos.y - this.position.y;

        const inZone = (dx < halfW && dz < halfD && dy >= -0.1 && dy < 0.5);

        if (inZone) {
            if (!this.wasInZone) {
                const force = this.direction.clone().multiplyScalar(this.strength);
                character.applyImpulse(force);
                this.wasInZone = true;
            }
        } else {
            this.wasInZone = false;
        }
    }
}
