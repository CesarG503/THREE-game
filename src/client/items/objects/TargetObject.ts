import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";
import type { ItemContext } from "../../types";

export class TargetObject extends MapObjectItem {
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

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(32, 32, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(32, 32, 8, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const group: any = new THREE.Group();

    const radius = this.scale.x / 2 || 1.0;
    const thickness = this.scale.y || 0.2;

    group.updateTargetVisuals = () => {
      while (group.children.length > 0) {
        const child: any = group.children[0];
        group.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }

      const currentRings = group.userData.logicProperties && group.userData.logicProperties.rings ? group.userData.logicProperties.rings : 3;
      const dynamicRadius =
        group.userData.logicProperties && group.userData.logicProperties.radius ? group.userData.logicProperties.radius : radius;

      for (let i = 0; i < currentRings; i++) {
        const ringRadius = dynamicRadius * (1.0 - i / currentRings);
        const isRed = i % 2 === 0;
        const ringColor = isRed ? 0xff0000 : 0xffffff;
        const ringDepth = thickness + i * 0.01;

        const geo = new THREE.CylinderGeometry(ringRadius, ringRadius, ringDepth, 32);
        const mat = new THREE.MeshStandardMaterial({
          color: ringColor,
          roughness: 0.8,
          metalness: 0.1
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.position.y = i * 0.001;
        mesh.userData.ringIndex = i;
        group.add(mesh);
      }
    };

    group.userData.logicProperties = this.logicProperties || {};
    group.updateTargetVisuals();

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const initialRadius = this.logicProperties && this.logicProperties.radius ? this.logicProperties.radius : radius;
      const col = RAPIER.ColliderDesc.cylinder(thickness / 2, initialRadius);
      colliders.push(col);
    }

    return { mesh: group as THREE.Group, colliders };
  }

  use(context: ItemContext): boolean {
    if (context.placementManager && context.placementManager.currentTargetProperties) {
      this.logicProperties = {
        ...(this.logicProperties || {}),
        ...context.placementManager.currentTargetProperties
      };

      if (this.logicProperties.radius) {
        const diameter = this.logicProperties.radius * 2;
        this.scale.x = diameter;
        this.scale.z = diameter;
      }
    }
    return super.use(context);
  }
}
