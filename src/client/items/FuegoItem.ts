import * as THREE from "three";
import { Item } from "./Item";

export class FuegoItem extends Item {
  type: string;
  value: number;

  constructor() {
    super("fuego", "Fuego", "/assets/textures/fuego.png");
    this.type = "collectible";
    this.value = 0;
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
