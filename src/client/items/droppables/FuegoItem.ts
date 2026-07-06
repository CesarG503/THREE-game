import * as THREE from "three";
import { Item } from "../Item";

export class FuegoItem extends Item {
  type: string;
  groupId: string;
  itemTexture: string;

  constructor(groupId: string = "Grupo 1", itemTexture: string = "/assets/textures/fuego.png") {
    super("fuego", "Fuego", itemTexture);
    this.type = "collectible";
    this.value = 0;
    this.groupId = groupId;
    this.itemTexture = itemTexture;
  }

  getDisplayMesh() {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(this.iconPath);

    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }
}
