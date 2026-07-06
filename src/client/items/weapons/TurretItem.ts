import * as THREE from "three";
import { Item } from "../Item";
import { TurretPad } from "../../entities/TurretPad";

export class TurretItem extends Item {
  constructor(id: any = "turret", name: any = "Turret", iconPath: any = "") {
    super(id, name, iconPath);
  }

  use(context: any) {
    const { placementManager, scene, world, platforms, rotationIndex } = context;

    const hitPoint = placementManager.update(0, rotationIndex);

    if (hitPoint) {
      const placePos = hitPoint.clone();
      placePos.y += 0.1;

      const pad = new TurretPad(scene, world, placePos);

      platforms.push(pad);
      console.log(`Placed ${this.name}`);
      return true;
    }

    return false;
  }

  getDisplayMesh() {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    return new THREE.Mesh(geo, mat);
  }
}
