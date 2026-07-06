import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class LadderObject extends MapObjectItem {
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

    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(20, 8);
    ctx.lineTo(20, 56);
    ctx.moveTo(44, 8);
    ctx.lineTo(44, 56);
    for (let i = 12; i <= 52; i += 8) {
      ctx.moveTo(20, i);
      ctx.lineTo(44, i);
    }
    ctx.stroke();

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const height = this.scale.y;
    const width = this.scale.x;

    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.7 });

    const railGeo = new THREE.BoxGeometry(0.1, height, 0.1);
    const leftRail = new THREE.Mesh(railGeo, mat);
    leftRail.position.set(-width / 2, 0, 0);

    const rightRail = new THREE.Mesh(railGeo, mat);
    rightRail.position.set(width / 2, 0, 0);

    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;

    group.add(leftRail);
    group.add(rightRail);

    const rungCount = Math.floor(height / 0.4);
    const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, width, 8);
    rungGeo.rotateZ(Math.PI / 2);

    for (let i = 0; i < rungCount; i++) {
      const rung = new THREE.Mesh(rungGeo, mat);
      rung.position.set(0, -height / 2 + (i + 1) * 0.4, 0);
      rung.castShadow = true;
      group.add(rung);
    }

    (group as any).bounds = new THREE.Box3();
    group.userData.isLadder = true;
    group.userData.needsBoundsUpdate = true;

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 0.2).setSensor(true);
      colliders.push(col);

      const railHalfW = 0.05;
      const railHalfH = height / 2;
      const railHalfD = 0.05;

      const leftRailCol = RAPIER.ColliderDesc.cuboid(railHalfW, railHalfH, railHalfD).setTranslation(-width / 2, 0, 0);
      colliders.push(leftRailCol);

      const rightRailCol = RAPIER.ColliderDesc.cuboid(railHalfW, railHalfH, railHalfD).setTranslation(width / 2, 0, 0);
      colliders.push(rightRailCol);
    }

    return { mesh: group, colliders };
  }
}
