import * as THREE from "three";
import { BoxCollider, CollisionLayer } from "../collision";

export class EnvironmentBuilder {
    scene: any;
    collisionSystem: any;

    constructor(scene: any, collisionSystem: any) {
        this.scene = scene;
        this.collisionSystem = collisionSystem;
    }

    addBox(position: any, size: any, rotation: any = new THREE.Euler(), color: number = 0x888888) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.copy(position);
        mesh.rotation.copy(rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);

        const collider = new BoxCollider({
            id: `env-box-${Math.random().toString(36).substr(2, 9)}`,
            parent: mesh,
            size: size.clone(),
            rotation: rotation.clone(),
            layer: CollisionLayer.ENVIRONMENT,
            collidesWithMask: CollisionLayer.PLAYER | CollisionLayer.NPC,
            isStatic: true
        });

        this.collisionSystem.addCollider(collider);

        return mesh;
    }

    addRamp(position: any, width: number, length: number, height: number, rotationY: number = 0) {
        const angle = Math.asin(height / length);

        const size = new THREE.Vector3(width, 0.2, length);
        const rotation = new THREE.Euler(-angle, rotationY, 0);

        const offset = new THREE.Vector3(0, height / 2, length / 2 * Math.cos(angle));
        const centerPos = position.clone().add(offset);

        return this.addBox(centerPos, size, rotation, 0xffaa44);
    }

    buildLevel() {
        this.addBox(
            new THREE.Vector3(5, 1, 0),
            new THREE.Vector3(4, 2, 4),
            new THREE.Euler(0, 0, 0),
            0x4488ff
        );

        this.addBox(
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(2, 0.2, 5),
            new THREE.Euler(-0.4, 0, 0),
            0xffaa00
        );

        this.addBox(
            new THREE.Vector3(-5, 1.5, -5),
            new THREE.Vector3(3, 3, 3),
            new THREE.Euler(0, Math.PI / 4, Math.PI / 4),
            0xaa44aa
        );

        for (let i = 0; i < 5; i++) {
            this.addBox(
                new THREE.Vector3(-5, i * 0.5 + 0.25, 5 + i * 0.5),
                new THREE.Vector3(2, 0.5, 0.5),
                new THREE.Euler(0, 0, 0),
                0x88cc44
            );
        }

        this.addBox(
            new THREE.Vector3(0, -0.5, 0),
            new THREE.Vector3(100, 1, 100),
            new THREE.Euler(0, 0, 0),
            0x333333
        );

        this.addRampPhysicsTest(new THREE.Vector3(-8, 0, -5), 8, 2, 0x00ff00);
        this.addRampPhysicsTest(new THREE.Vector3(-12, 0, -5), 5, 3, 0xffff00);
        this.addRampPhysicsTest(new THREE.Vector3(-16, 0, -5), 3, 4, 0xff0000);
    }

    addRampPhysicsTest(pos: any, length: number, height: number, color: number) {
        const angle = Math.atan2(height, length);
        const hypotenuse = Math.sqrt(length * length + height * height);

        const ramp = this.addBox(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(2, 0.5, hypotenuse),
            new THREE.Euler(-angle, 0, 0),
            color
        );

        ramp.position.set(
            pos.x,
            pos.y + height / 2,
            pos.z + length / 2
        );

        this.addBox(
            new THREE.Vector3(pos.x, height - 0.5, pos.z + length + 2),
            new THREE.Vector3(4, 1, 4),
            new THREE.Euler(0, 0, 0),
            color
        );
    }
}
