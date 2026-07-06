import * as THREE from "three";
import { Item } from "../Item";
import { Projectile } from "../../weapons/Projectile";

export class PelotaItem extends Item {
  type: any;
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  bulletDrop: number;
  rebote: boolean;
  lastShotTime: number;
  equipGroup: any;

  constructor(id = "pelota", name = "Pelota", iconPath = "/assets/textures/pelota.png", damage = 5, fireRate = 2, bulletSpeed = 20, bulletDrop = 1.0) {
    super(id, name, iconPath);
    this.type = "weapon";
    this.damage = damage;
    this.fireRate = fireRate;
    this.bulletSpeed = bulletSpeed;
    this.bulletDrop = bulletDrop;
    this.rebote = true;

    this.lastShotTime = 0;
  }

  use(context: any) {
    const now = performance.now() / 1000;
    if (now - this.lastShotTime < 1.0 / this.fireRate) {
      return false;
    }

    this.lastShotTime = now;
    this.shoot(context);
    return true;
  }

  shoot(context: any) {
    const { scene, world, origin, direction } = context;

    const spawnPos = origin.clone().add(direction.clone().multiplyScalar(1.0));

    const projectile = new Projectile(scene, world, spawnPos, direction, this.bulletSpeed, this.damage, this.bulletDrop, "ball", this.rebote);

    if (context.registerProjectile) {
      context.registerProjectile(projectile);
    }

    if (context.networkManager) {
      context.networkManager.sendPlayerShoot(
        spawnPos,
        direction,
        "ball",
        this.bulletSpeed,
        this.damage,
        this.bulletDrop,
        this.rebote,
        false
      );
    }
  }

  getEquipMesh() {
    if (!this.equipGroup) {
      this.equipGroup = new THREE.Group();
      const mesh = this.getDisplayMesh();
      mesh.scale.set(0.5, 0.5, 0.5);
      this.equipGroup.add(mesh);
    }
    return this.equipGroup;
  }

  getDisplayMesh() {
    const geo = new THREE.SphereGeometry(0.3, 16, 16);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load("/assets/textures/pelota.png");
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5
    });
    return new THREE.Mesh(geo, mat);
  }
}
