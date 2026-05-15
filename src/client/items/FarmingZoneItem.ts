import * as THREE from "three";
import { Item } from "./Item";
import { FarmingZone } from "../entities/FarmingZone";

export class FarmingZoneItem extends Item {
  type: string;

  constructor() {
    super("farming_zone", "Zona de Farmeo", "/assets/textures/fuego.png");
    this.type = "logic";
  }

  use(context: any) {
    const { placementManager, scene, itemDropManager, farmingZones, rotationIndex } = context;
    const hitPoint = placementManager.update(this, rotationIndex);

    if (!hitPoint) return false;

    const placePos = hitPoint.clone();
    placePos.y += 0.1;

    const zone = new FarmingZone(scene, itemDropManager, placePos);
    if (farmingZones) {
      farmingZones.push(zone);
    } else if (context.game) {
      context.game.farmingZone = zone;
    }

    console.log("Placed Farming Zone");
    return true;
  }

  getDisplayMesh() {
    const geo = new THREE.BoxGeometry(1, 0.2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4500, transparent: true, opacity: 0.7 });
    return new THREE.Mesh(geo, mat);
  }
}
