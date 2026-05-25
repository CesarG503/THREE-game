import * as THREE from "three";
import { FuegoItem } from "../items/FuegoItem";

export class FarmingZone {
    scene: any;
    itemDropManager: any;
    position: any;

    width: number;
    depth: number;
    height: number;

    accumulatedTime: number;
    spawnInterval: number;
    itemsPerSpawn: number;
    itemValue: number;
    groupId: string;
    itemTexture: string;

    mesh: any;

    constructor(scene: any, itemDropManager: any, position: any) {
        this.scene = scene;
        this.itemDropManager = itemDropManager;
        this.position = position;

        this.width = 3;
        this.depth = 3;
        this.height = 0.2;

        this.accumulatedTime = 0;
        this.spawnInterval = 1.0;
        this.itemsPerSpawn = 1;
        this.itemValue = 1;
        this.groupId = "Grupo 1";
        this.itemTexture = "/assets/textures/fuego.png";

        this.initVisuals();
    }

    setSpawnInterval(seconds: number) {
        if (seconds <= 0) return;
        this.spawnInterval = seconds;
    }

    setItemsPerSpawn(count: number) {
        this.itemsPerSpawn = Math.max(0, Math.floor(count));
    }

    setItemValue(val: number) {
        this.itemValue = Math.floor(val);
    }

    setGroupId(grp: string) {
        this.groupId = grp;
    }

    setItemTexture(tex: string) {
        this.itemTexture = tex;
    }

    initVisuals() {
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff4500,
            roughness: 0.8
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y -= this.height / 2;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    update(dt: number) {
        this.accumulatedTime += dt;

        if (this.accumulatedTime >= this.spawnInterval) {
            this.accumulatedTime -= this.spawnInterval;
            for (let i = 0; i < this.itemsPerSpawn; i++) {
                this.spawnItem();
            }
        }
    }

    spawnItem() {
        const item = new FuegoItem(this.groupId, this.itemTexture);
        item.value = this.itemValue;

        const halfW = this.width / 2 * 0.8;
        const halfD = this.depth / 2 * 0.8;

        const offsetX = (Math.random() - 0.5) * 2 * halfW;
        const offsetZ = (Math.random() - 0.5) * 2 * halfD;

        const spawnPos = new THREE.Vector3(
            this.position.x + offsetX,
            this.position.y + 1.0,
            this.position.z + offsetZ
        );

        const direction = new THREE.Vector3(0, 1, 0);
        this.itemDropManager.dropItem(item, spawnPos, direction, 0.0);
    }

    setPosition(newPos: any) {
        this.position.copy(newPos);
        if (this.mesh) {
            this.mesh.position.copy(newPos);
            this.mesh.position.y -= this.height / 2;
        }
    }
}
