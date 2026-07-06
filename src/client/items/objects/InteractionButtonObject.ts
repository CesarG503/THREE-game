import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class InteractionButtonObject extends MapObjectItem {
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

    ctx.fillStyle = "#555";
    ctx.fillRect(16, 40, 32, 16);
    ctx.strokeRect(16, 40, 32, 16);

    ctx.fillStyle = this.color ? "#" + new THREE.Color(this.color).getHexString() : "red";
    ctx.beginPath();
    ctx.arc(32, 32, 12, 0, Math.PI, true);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("F", 32, 38);

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const group = new THREE.Group();

    const btnGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32);
    const btnMat = new THREE.MeshStandardMaterial({
      color: this.color || 0xff0000,
      emissive: this.color || 0xff0000,
      emissiveIntensity: 0.2
    });
    const btn = new THREE.Mesh(btnGeo, btnMat);
    btn.position.y = 0.05;
    btn.userData.isButtonMesh = true;

    const plateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 32);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.01;
    group.add(plate);
    group.add(btn);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.cylinder(0.05, 0.3).setTranslation(0, 0.05, 0);
      colliders.push(col);
    }

    if (!this.logicProperties) this.logicProperties = {};
    if (this.logicProperties.holdTime === undefined) this.logicProperties.holdTime = 0;
    if (this.logicProperties.oneShot === undefined) this.logicProperties.oneShot = false;
    if (this.logicProperties.triggered === undefined) this.logicProperties.triggered = false;

    return { mesh: group, colliders };
  }
}
