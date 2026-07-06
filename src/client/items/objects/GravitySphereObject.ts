import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class GravitySphereObject extends MapObjectItem {
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
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#9C27B0";
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("G-S", 32, 32);

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const radius = this.scale.radius !== undefined ? this.scale.radius : (this.scale.x / 2 || 0.75);
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const matColor = this.color !== undefined ? this.color : 0x9C27B0;
    const material = new THREE.MeshStandardMaterial({
      color: matColor,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x4a148c,
      emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.2, 0.05, 16, 100),
      new THREE.MeshBasicMaterial({ color: 0xe040fb, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    mesh.add(ring);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.ball(radius);
      colliders.push(col);
    }

    if (!this.logicProperties) this.logicProperties = {};
    if (this.logicProperties.holdTime === undefined) this.logicProperties.holdTime = 0.5;
    if (this.logicProperties.oneShot === undefined) this.logicProperties.oneShot = false;
    if (this.logicProperties.pulsationMode === undefined) this.logicProperties.pulsationMode = false;
    if (this.logicProperties.triggered === undefined) this.logicProperties.triggered = false;

    return { mesh, colliders };
  }
}
