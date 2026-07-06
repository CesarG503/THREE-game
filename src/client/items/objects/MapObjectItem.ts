import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Item } from "../Item";
import { normalizeTextureSettings, applyMapObjectTexture, type MapTextureSettings } from "../../utils/TextureMapping";
import type { ItemContext } from "../../types";

export type MapObjectScale = {
  x: number;
  y: number;
  z: number;
  shapeType?: string;
  radius?: number;
};

export abstract class MapObjectItem extends Item {
  type: string;
  color: number;
  scale: MapObjectScale;
  texturePath: string | null;
  textureAssetId: string | null;
  textureSettings: Required<MapTextureSettings>;
  logicProperties: any;
  opacity: number | undefined;
  uuid: string;

  constructor(
    id: string,
    name: string,
    type: string,
    iconPath: string,
    color: number,
    scale: MapObjectScale = { x: 1, y: 1, z: 1 },
    texturePath: string | null = null,
    textureAssetId: string | null = null,
    textureSettings: MapTextureSettings | null = null
  ) {
    super(id, name, iconPath);
    this.type = type;
    this.color = color;
    this.scale = scale;
    this.texturePath = texturePath;
    this.textureAssetId = textureAssetId;
    this.textureSettings = normalizeTextureSettings(textureSettings);
    this.logicProperties = null;
    this.uuid = THREE.MathUtils.generateUUID();

    const generatedIcon = this.generateIcon();
    if (generatedIcon) {
      this.iconPath = generatedIcon;
    }
  }

  abstract generateIcon(): string;

  abstract build3D(
    world: RAPIER.World | null
  ): { mesh: THREE.Object3D; colliders: RAPIER.ColliderDesc[] };

  createObjectInWorld(
    scene: THREE.Scene,
    world: RAPIER.World | null,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    isCenterPosition = false
  ): void {
    const { mesh, colliders } = this.build3D(world);
    if (!mesh) return;

    mesh.position.copy(position);
    if (this.type !== "interaction_button" && this.type !== "spawn_point" && !isCenterPosition) {
      mesh.position.y += this.scale.y / 2;
    }

    mesh.rotation.copy(rotation);
    mesh.scale.set(1, 1, 1);

    if (this.texturePath) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(this.texturePath, (texture: any) => {
        applyMapObjectTexture(mesh, texture, this.scale, this.textureSettings);
      });
    }

    mesh.userData.isEditableMapObject = true;
    mesh.userData.isMapObject = true;
    mesh.userData.mapObjectType = this.type;
    mesh.userData.customName = this.name || "";
    mesh.userData.uuid = THREE.MathUtils.generateUUID();
    mesh.userData.originalUUID = mesh.userData.uuid;
    mesh.userData.color = this.color;
    mesh.userData.opacity = this.opacity !== undefined ? this.opacity : 1.0;
    mesh.userData.originalScale = { x: this.scale.x, y: this.scale.y, z: this.scale.z };
    mesh.userData.originalRotY = mesh.rotation.y;
    mesh.userData.texturePath = this.texturePath;
    mesh.userData.textureAssetId = this.textureAssetId;
    mesh.userData.textureSettings = { ...this.textureSettings };

    if (this.logicProperties) {
      mesh.userData.logicProperties = { ...this.logicProperties };
    }

    scene.add(mesh);

    if (world && RAPIER) {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation(mesh.quaternion);

      const rigidBody = world.createRigidBody(bodyDesc);

      mesh.userData.rigidBody = rigidBody;

      colliders.forEach((col: any) => {
        world.createCollider(col, rigidBody);
      });
    }

    if ((mesh as any).userData?.needsBoundsUpdate) {
      mesh.updateMatrix();

      mesh.matrixWorld.copy(mesh.matrix);
      const children = mesh.children;
      for (let i = 0, l = children.length; i < l; i++) {
        children[i].updateMatrixWorld(true);
      }

      (mesh as any).bounds.setFromObject(mesh);

      (mesh as any).bounds.max.y += 0.5;
      (mesh as any).bounds.expandByScalar(0.5);
    }

    console.log(`Spawned ${this.type} at`, position);
  }

  spawnObject(scene: any, world: any, position: any, rotationOrIndex: any = 0) {
    let rotationIndex = 0;
    let quaternion = null;
    const rotation = new THREE.Euler(0, 0, 0);

    if (rotationOrIndex && typeof rotationOrIndex === "object" && rotationOrIndex.isQuaternion) {
      quaternion = rotationOrIndex;
      rotation.setFromQuaternion(quaternion);
    } else {
      rotationIndex = rotationOrIndex;
      if (rotationIndex === 1) rotation.y = -Math.PI / 2;
      if (rotationIndex === 2) rotation.y = -Math.PI;
      if (rotationIndex === 3) rotation.y = Math.PI / 2;
      quaternion = new THREE.Quaternion().setFromEuler(rotation);
    }

    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    if (quaternion) {
      rigidBodyDesc.setRotation(quaternion);
    }

    this.createObjectInWorld(scene, world, position, rotation);
  }

  spawnObjectFromData(scene: any, world: any, pos: any, rot: any) {
    const rx = rot.x !== undefined ? rot.x : rot._x;
    const ry = rot.y !== undefined ? rot.y : rot._y;
    const rz = rot.z !== undefined ? rot.z : rot._z;

    const position = new THREE.Vector3(pos.x, pos.y, pos.z);
    const rotation = new THREE.Euler(rx, ry, rz);

    this.createObjectInWorld(scene, world, position, rotation, true);
  }

  use(context: ItemContext): boolean {
    if (context.isRightClick) {
      return false;
    }

    if (context && context.placementManager) {
      const position = context.placementManager.getCurrentTarget();
      const rotationIndex = context.placementManager.getPlacementRotation();
      if (position) {
        this.spawnObject(context.scene, context.world, position, rotationIndex);
        return true;
      }
    }
    return false;
  }
}
