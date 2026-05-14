import * as THREE from "three";
import { Item } from "./Item";
import { ImpulsePlatform } from "../entities/ImpulsePlatform";

export class ImpulseItem extends Item {
  type: any;
  strength: any;

  constructor(id: any, name: any, iconPath: any, type: any, strength: any) {
    super(id, name, iconPath);
    this.type = type; // "lateral" | "jump"
    this.strength = strength;
  }

  use(context: any) {
    const { placementManager, scene, world, platforms, rotationIndex } = context;

    const hitPoint = placementManager.update(this, rotationIndex);

    if (hitPoint) {
      const placePos = hitPoint.clone();
      placePos.y += 0.1;

      let dir = new THREE.Vector3(0, 1, 0);

      if (this.type === "lateral") {
        dir = new THREE.Vector3(0, 0, -1);
        if (rotationIndex === 1) dir.set(1, 0, 0);
        if (rotationIndex === 2) dir.set(0, 0, 1);
        if (rotationIndex === 3) dir.set(-1, 0, 0);
      }

      const pad = new ImpulsePlatform(scene, world, placePos, dir, this.strength, "pad");
      platforms.push(pad);
      console.log(`Placed ${this.name}`);
      return true;
    }

    return false;
  }

  getDisplayMesh() {
    const geo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
    const color = this.type === "jump" ? 0x00ffff : 0x00ff00;
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);

    return mesh;
  }
}
