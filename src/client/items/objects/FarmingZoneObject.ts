import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class FarmingZoneObject extends MapObjectItem {
  generateIcon(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#" + new THREE.Color(this.color).getHexString();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    ctx.fillStyle = "#ff4500";
    ctx.globalAlpha = 0.75;
    ctx.fillRect(12, 24, 40, 24);
    ctx.globalAlpha = 1;
    ctx.strokeRect(12, 24, 40, 24);

    ctx.fillStyle = "white";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 32, 36);

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
    const material = new THREE.MeshStandardMaterial({
      color: this.color || 0xff4500,
      roughness: 0.8,
      transparent: true,
      opacity: this.opacity !== undefined ? this.opacity : 0.7,
      emissive: 0x552000,
      emissiveIntensity: 0.25
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;

    const wiregeo = new THREE.EdgesGeometry(geometry);
    const wiremat = new THREE.LineBasicMaterial({ color: 0xffaa00 });
    const wire = new THREE.LineSegments(wiregeo, wiremat);
    mesh.add(wire);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2).setSensor(true);
      colliders.push(col);
    }

    if (!this.logicProperties) this.logicProperties = {};
    if (this.logicProperties.spawnInterval === undefined) this.logicProperties.spawnInterval = 1.0;
    if (this.logicProperties.itemsPerSpawn === undefined) this.logicProperties.itemsPerSpawn = 1;
    if (this.logicProperties.itemValue === undefined) this.logicProperties.itemValue = 1;

    return { mesh, colliders };
  }
}
