import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export class LevelLoader {
    scene: any;
    world: any;
    loader: any;
    debugPhysics: boolean;
    ladders: any[];

    constructor(scene: any, world: any) {
        this.scene = scene;
        this.world = world;

        this.loader = new GLTFLoader();

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
        dracoLoader.setDecoderConfig({ type: "js" });
        this.loader.setDRACOLoader(dracoLoader);

        this.debugPhysics = false;
        this.ladders = [];
    }

    load(url: string, position: any = new THREE.Vector3(0, 0, 0), scale: any = new THREE.Vector3(1, 1, 1)) {
        return new Promise((resolve, reject) => {
            this.loader.load(url, (gltf: any) => {
                gltf.scene.position.copy(position);
                gltf.scene.scale.copy(scale);

                gltf.scene.updateMatrixWorld(true);

                this.processScene(gltf.scene);
                this.scene.add(gltf.scene);
                console.log("Level loaded:", url);
                resolve(gltf.scene);
            }, undefined, (err: any) => {
                console.error("Error loading level:", err);
                reject(err);
            });
        });
    }

    processScene(scene: any) {
        scene.updateMatrixWorld(true);

        scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                const name = child.name.toLowerCase();

                if (name.includes("_collider") || name.includes("_fixed")) {
                    this.createStaticBody(child, !name.includes("_fixed"));
                } else if (name.includes("_ladder")) {
                    child.updateMatrixWorld(true);
                    const box = new THREE.Box3().setFromObject(child);
                    box.expandByScalar(0.2);

                    this.ladders.push({
                        bounds: box,
                        mesh: child
                    });
                }
            }
        });
    }

    createStaticBody(mesh: any, invisible: boolean = false) {
        if (invisible || (mesh.userData && mesh.userData.invisible)) {
            mesh.visible = false;
        }

        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        mesh.getWorldPosition(pos);
        mesh.getWorldQuaternion(quat);
        mesh.getWorldScale(scale);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(quat);
        const body = this.world.createRigidBody(bodyDesc);

        let colliderDesc = null;

        const geometry = mesh.geometry;
        const vertices = geometry.attributes.position.array;
        const indices = geometry.index ? geometry.index.array : null;

        const scaledVertices = new Float32Array(vertices.length);
        for (let i = 0; i < vertices.length; i += 3) {
            scaledVertices[i] = vertices[i] * scale.x;
            scaledVertices[i + 1] = vertices[i + 1] * scale.y;
            scaledVertices[i + 2] = vertices[i + 2] * scale.z;
        }

        if (indices) {
            colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, indices);
        } else {
            const generatedIndices = new Uint32Array(vertices.length / 3);
            for (let i = 0; i < generatedIndices.length; i++) generatedIndices[i] = i;
            colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, generatedIndices);
        }

        this.world.createCollider(colliderDesc, body);
    }
}
