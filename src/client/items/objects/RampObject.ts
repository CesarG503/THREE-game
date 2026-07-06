import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";
import { RampUtils } from "../../utils/RampUtils";

export class RampObject extends MapObjectItem {
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

    ctx.beginPath();
    ctx.moveTo(8, 56);
    ctx.lineTo(56, 56);
    ctx.lineTo(56, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const geometry = RampUtils.createGeometry(this.scale);
    const material = new THREE.MeshStandardMaterial({ color: this.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      colliders.push(RampUtils.createColliderDesc(this.scale, RAPIER));
    }

    return { mesh, colliders };
  }
}
