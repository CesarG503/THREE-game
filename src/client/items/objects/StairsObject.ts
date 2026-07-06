import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";
import { StairsUtils } from "../../utils/StairsUtils";

export class StairsObject extends MapObjectItem {
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
    ctx.lineTo(24, 56);
    ctx.lineTo(24, 40);
    ctx.lineTo(40, 40);
    ctx.lineTo(40, 24);
    ctx.lineTo(56, 24);
    ctx.lineTo(56, 8);
    ctx.lineTo(56, 56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const steps = StairsUtils.calculateSteps(this.scale);
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      transparent: this.opacity !== undefined && this.opacity < 1.0,
      opacity: this.opacity !== undefined ? this.opacity : 1.0
    });
    const stepGeo = new THREE.BoxGeometry(steps[0].size.x, steps[0].size.y, steps[0].size.z);
    const colliders: RAPIER.ColliderDesc[] = [];

    steps.forEach((step: any) => {
      const mesh = new THREE.Mesh(stepGeo, material);
      mesh.position.set(step.position.x, step.position.y, step.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      if (RAPIER) {
        const col = RAPIER.ColliderDesc.cuboid(step.size.x / 2, step.size.y / 2, step.size.z / 2).setTranslation(
          step.position.x,
          step.position.y,
          step.position.z
        );
        colliders.push(col);
      }
    });

    return { mesh: group, colliders };
  }
}
