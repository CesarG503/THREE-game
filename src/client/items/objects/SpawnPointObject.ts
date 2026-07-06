import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class SpawnPointObject extends MapObjectItem {
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
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", 32, 32);

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const shapeType = this.scale.shapeType || "circle";
    let geometry: THREE.BufferGeometry;
    let col: RAPIER.ColliderDesc | null = null;
    let height: number;

    if (shapeType === "square") {
      geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
      height = this.scale.y;
      if (RAPIER) {
        col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
      }
    } else {
      const radius = this.scale.x / 2 || 1.0;
      height = this.scale.y || 0.05;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      if (RAPIER) {
        col = RAPIER.ColliderDesc.cylinder(height / 2, radius);
      }
    }

    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.9,
      emissive: this.color,
      emissiveIntensity: 0.2,
      roughness: 0.8,
      metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.6);
    arrowShape.lineTo(0.4, -0.2);
    arrowShape.lineTo(0, 0);
    arrowShape.lineTo(-0.4, -0.2);
    arrowShape.lineTo(0, 0.6);

    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);

    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = Math.PI;
    arrow.position.y = height / 2 + 0.01;

    mesh.add(arrow);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (col) {
      colliders.push(col);
    }

    return { mesh, colliders };
  }
}
