import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class DefaultMapObject extends MapObjectItem {
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

    if (this.type === "pillar") {
      ctx.fillRect(20, 8, 24, 48);
      ctx.strokeRect(20, 8, 24, 48);
    } else {
      ctx.fillRect(8, 20, 48, 24);
      ctx.strokeRect(8, 20, 48, 24);
    }

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      transparent: this.opacity !== undefined && this.opacity < 1.0,
      opacity: this.opacity !== undefined ? this.opacity : 1.0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
      colliders.push(col);
    }

    return { mesh, colliders };
  }
}
