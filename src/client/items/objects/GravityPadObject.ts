import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";
import { normalizeGravityOrientation } from "../../utils/GravityOrientation";

export class GravityPadObject extends MapObjectItem {
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

    ctx.fillStyle = "#233b68";
    ctx.fillRect(10, 36, 44, 12);
    ctx.strokeRect(10, 36, 44, 12);

    ctx.strokeStyle = "#8bd8ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 48);
    ctx.lineTo(32, 15);
    ctx.moveTo(32, 15);
    ctx.lineTo(20, 27);
    ctx.moveTo(32, 15);
    ctx.lineTo(44, 27);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("G", 32, 31);

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
    const padColor = this.color !== undefined ? this.color : 0x2f75ff;
    const material = new THREE.MeshStandardMaterial({
      color: padColor,
      roughness: 0.72,
      emissive: 0x123a88,
      emissiveIntensity: 0.45
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(this.scale.x, this.scale.z) * 0.26, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = this.scale.y / 2 + 0.025;
    mesh.add(ring);

    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, this.scale.y / 2 + 0.05, this.scale.z * 0.28),
      Math.min(this.scale.x, this.scale.z) * 0.45,
      0xffffff,
      0.24,
      0.16
    );
    arrow.userData.isGravityPadArrow = true;
    mesh.add(arrow);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2).setSensor(true);
      colliders.push(col);
    }

    if (!this.logicProperties) this.logicProperties = {};
    if (this.logicProperties.name === undefined) this.logicProperties.name = "Pad de Gravedad";
    if (this.logicProperties.gravityOrientation === undefined) this.logicProperties.gravityOrientation = "up";
    if (this.logicProperties.transitionDuration === undefined) this.logicProperties.transitionDuration = 0.8;
    if (this.logicProperties.cooldown === undefined) this.logicProperties.cooldown = 0.35;
    this.logicProperties.gravityOrientation = normalizeGravityOrientation(this.logicProperties.gravityOrientation);

    return { mesh, colliders };
  }
}
