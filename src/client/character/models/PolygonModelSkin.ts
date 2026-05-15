import * as THREE from "three";
import type { ICharacterModel } from "../../types";

export class PolygonModelSkin implements ICharacterModel {
  scene: THREE.Scene;
  isLocal: boolean;
  model: THREE.Group | null;
  isVisible: boolean;
  head: THREE.Mesh | null;
  body: THREE.Mesh | null;
  rightArm: THREE.Mesh | null;
  leftArm: THREE.Mesh | null;
  rightLeg: THREE.Mesh | null;
  leftLeg: THREE.Mesh | null;
  pivotGroup: THREE.Group | null;
  contentGroup: THREE.Group | null;
  upperBodyGroup: THREE.Group | null;
  headGroup: THREE.Group | null;
  rightArmGroup: THREE.Group | null;
  leftArmGroup: THREE.Group | null;
  rightLegGroup: THREE.Group | null;
  leftLegGroup: THREE.Group | null;
  skinUrl: string;
  attackWeight: number;
  textureLoader!: THREE.TextureLoader;
  targetHeadPitch: number;
  targetHeadYaw: number;
  jumpAnimationType: string;
  fallAnimationType: string;
  currentHeldItem: any;
  isFirstPerson: boolean;

  constructor(scene: THREE.Scene, isLocal = true) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.model = null;
    this.isVisible = false;

    // Body Parts
    this.head = null;
    this.body = null;
    this.rightArm = null;
    this.leftArm = null;
    this.rightLeg = null;
    this.leftLeg = null;

    // Groups for pivoting
    this.pivotGroup = null;
    this.contentGroup = null;
    this.upperBodyGroup = null;

    this.headGroup = null;
    this.rightArmGroup = null;
    this.leftArmGroup = null;
    this.rightLegGroup = null;
    this.leftLegGroup = null;

    // Default Skin URL (Steve)
    this.skinUrl =
      "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/entity/player/wide/steve.png";

    this.attackWeight = 0;
    this.targetHeadPitch = 0;
    this.targetHeadYaw = 0;
    this.jumpAnimationType = "";
    this.fallAnimationType = "";
    this.isFirstPerson = false;

    this.initLoader();
    this.createModel();
  }

  initLoader() {
    this.textureLoader = new THREE.TextureLoader();
  }

  createModel() {
    this.model = new THREE.Group();
    this.model.userData.isPlayer = true;
    this.model.userData.isLocalPlayer = this.isLocal;
    this.model.visible = false;

    this.pivotGroup = new THREE.Group();
    this.pivotGroup.position.y = 0.9;
    this.model.add(this.pivotGroup);

    this.contentGroup = new THREE.Group();
    this.contentGroup.position.y = -0.9;
    this.pivotGroup.add(this.contentGroup);

    this.upperBodyGroup = new THREE.Group();
    this.contentGroup.add(this.upperBodyGroup);

    const texture = this.textureLoader.load(this.skinUrl);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });

    const pixelScale = (1 / 16) * 0.9;

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.3;
    this.upperBodyGroup.add(this.headGroup);

    const headGeo = this.createBoxGeometryWithUVs(8, 8, 8, 0, 0);
    this.head = new THREE.Mesh(headGeo, material);
    this.head.position.y = 4 * pixelScale;
    this.head.scale.set(pixelScale, pixelScale, pixelScale);
    this.head.castShadow = true;
    this.headGroup.add(this.head);

    const headOuterGeo = this.createBoxGeometryWithUVs(8, 8, 8, 32, 0);
    const headOuter = new THREE.Mesh(headOuterGeo, material);
    headOuter.position.y = 4 * pixelScale;
    headOuter.scale.set(pixelScale * 1.1, pixelScale * 1.1, pixelScale * 1.1);
    headOuter.renderOrder = 1;
    this.headGroup.add(headOuter);

    const bodyGeo = this.createBoxGeometryWithUVs(8, 12, 4, 16, 16);
    this.body = new THREE.Mesh(bodyGeo, material);
    this.body.position.y = 1.3 - 6 * pixelScale;
    this.body.scale.set(pixelScale, pixelScale, pixelScale);
    this.body.castShadow = true;
    this.upperBodyGroup.add(this.body);

    const bodyOuterGeo = this.createBoxGeometryWithUVs(8, 12, 4, 16, 32);
    const bodyOuter = new THREE.Mesh(bodyOuterGeo, material);
    bodyOuter.position.copy(this.body.position);
    bodyOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.upperBodyGroup.add(bodyOuter);

    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(4 * pixelScale + 2 * pixelScale, 1.3 - 2 * pixelScale, 0);
    this.upperBodyGroup.add(this.rightArmGroup);

    const rArmGeo = this.createBoxGeometryWithUVs(4, 12, 4, 40, 16);
    this.rightArm = new THREE.Mesh(rArmGeo, material);
    this.rightArm.position.y = -6 * pixelScale + 2 * pixelScale;
    this.rightArm.scale.set(pixelScale, pixelScale, pixelScale);
    this.rightArm.castShadow = true;
    this.rightArmGroup.add(this.rightArm);

    const rArmOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 40, 32);
    const rArmOuter = new THREE.Mesh(rArmOuterGeo, material);
    rArmOuter.position.y = -6 * pixelScale + 2 * pixelScale;
    rArmOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.rightArmGroup.add(rArmOuter);

    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-4 * pixelScale - 2 * pixelScale, 1.3 - 2 * pixelScale, 0);
    this.upperBodyGroup.add(this.leftArmGroup);

    const lArmGeo = this.createBoxGeometryWithUVs(4, 12, 4, 32, 48);
    this.leftArm = new THREE.Mesh(lArmGeo, material);
    this.leftArm.position.y = -6 * pixelScale + 2 * pixelScale;
    this.leftArm.scale.set(pixelScale, pixelScale, pixelScale);
    this.leftArm.castShadow = true;
    this.leftArmGroup.add(this.leftArm);

    const lArmOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 48, 48);
    const lArmOuter = new THREE.Mesh(lArmOuterGeo, material);
    lArmOuter.position.y = -6 * pixelScale + 2 * pixelScale;
    lArmOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.leftArmGroup.add(lArmOuter);

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(2 * pixelScale, 1.3 - 12 * pixelScale, 0);
    this.contentGroup.add(this.rightLegGroup);

    const rLegGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 16);
    this.rightLeg = new THREE.Mesh(rLegGeo, material);
    this.rightLeg.position.y = -6 * pixelScale;
    this.rightLeg.scale.set(pixelScale, pixelScale, pixelScale);
    this.rightLeg.castShadow = true;
    this.rightLegGroup.add(this.rightLeg);

    const rLegOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 32);
    const rLegOuter = new THREE.Mesh(rLegOuterGeo, material);
    rLegOuter.position.y = -6 * pixelScale;
    rLegOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.rightLegGroup.add(rLegOuter);

    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-2 * pixelScale, 1.3 - 12 * pixelScale, 0);
    this.contentGroup.add(this.leftLegGroup);

    const lLegGeo = this.createBoxGeometryWithUVs(4, 12, 4, 16, 48);
    this.leftLeg = new THREE.Mesh(lLegGeo, material);
    this.leftLeg.position.y = -6 * pixelScale;
    this.leftLeg.scale.set(pixelScale, pixelScale, pixelScale);
    this.leftLeg.castShadow = true;
    this.leftLegGroup.add(this.leftLeg);

    const lLegOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 48);
    const lLegOuter = new THREE.Mesh(lLegOuterGeo, material);
    lLegOuter.position.y = -6 * pixelScale;
    lLegOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.leftLegGroup.add(lLegOuter);

    this.scene.add(this.model);
  }

  createBoxGeometryWithUVs(w: number, h: number, d: number, u: number, v: number) {
    const geometry = new THREE.BoxGeometry(w, h, d);

    const width = 64;
    const height = 64;

    const mapUV = (x: number, y: number, w1: number, h1: number) => {
      const u1 = x / width;
      const v1 = 1 - (y + h1) / height;
      const u2 = (x + w1) / width;
      const v2 = 1 - y / height;
      return [
        new THREE.Vector2(u2, v1),
        new THREE.Vector2(u2, v2),
        new THREE.Vector2(u1, v2),
        new THREE.Vector2(u1, v1)
      ];
    };

    const uvRight = mapUV(u, v + d, d, h);
    const uvLeft = mapUV(u + d + w, v + d, d, h);
    const uvTop = mapUV(u + d, v, w, d);
    const uvBottom = mapUV(u + d + w, v, w, d);
    const uvFront = mapUV(u + d, v + d, w, h);
    const uvBack = mapUV(u + d + w + d, v + d, w, h);

    const order = [uvRight, uvLeft, uvTop, uvBottom, uvFront, uvBack];

    const uvAttribute = geometry.attributes.uv;

    for (let i = 0; i < 6; i++) {
      const faceUVs = order[i];

      const u1 = faceUVs[2].x;
      const v1 = faceUVs[2].y;

      const u2 = faceUVs[1].x;
      const v2 = faceUVs[1].y;

      const u3 = faceUVs[3].x;
      const v3 = faceUVs[3].y;

      const u4 = faceUVs[0].x;
      const v4 = faceUVs[0].y;

      uvAttribute.setXY(i * 4 + 0, u1, v1);
      uvAttribute.setXY(i * 4 + 1, u2, v2);
      uvAttribute.setXY(i * 4 + 2, u3, v3);
      uvAttribute.setXY(i * 4 + 3, u4, v4);
    }

    geometry.attributes.uv.needsUpdate = true;
    return geometry;
  }

  setVisible(visible: boolean) {
    this.isVisible = visible;
    if (this.model) {
      this.model.visible = visible;
    }
  }

  setPosition(pos: THREE.Vector3) {
    if (this.model) {
      this.model.position.copy(pos);
    }
  }

  setRotation(rot: number) {
    if (this.model) {
      this.model.rotation.y = rot + Math.PI;
    }
  }

  getPosition(): THREE.Vector3 {
    return this.model ? this.model.position.clone() : new THREE.Vector3();
  }

  setHeadRotation(pitch: number, yaw: number) {
    if (!this.headGroup) return;
    this.targetHeadPitch = pitch;
    this.targetHeadYaw = yaw;
  }

  setFirstPerson(isFirstPerson: boolean) {
    if (this.isFirstPerson === isFirstPerson) return;
    this.isFirstPerson = isFirstPerson;

    if (this.headGroup) {
      this.headGroup.traverse((child: any) => {
        if (child.isMesh) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
            child.userData.invisibleMaterial = child.material.clone();
            child.userData.invisibleMaterial.colorWrite = false;
            child.userData.invisibleMaterial.depthWrite = false;
          }
          child.material = isFirstPerson ? child.userData.invisibleMaterial : child.userData.originalMaterial;
        }
      });
    }
  }

  setJumpAnimationType(type: string) {
    this.jumpAnimationType = type;
  }

  setFallAnimationType(type: string) {
    this.fallAnimationType = type;
  }

  setHeldItem(item: any) {
    if (!this.rightArmGroup) return;
    this.currentHeldItem = item;
  }

  update(dt: number, isMoving: boolean, isCrouching?: boolean, isAttacking?: boolean, isGrounded?: boolean, verticalVelocity?: number) {
    if (!this.model || !this.isVisible) return;

    const walkSpeed = 7;
    const walk = Math.sin((Date.now() / 1000) * walkSpeed);

    if (isMoving) {
      if (this.rightLegGroup) this.rightLegGroup.rotation.x = walk;
      if (this.leftLegGroup) this.leftLegGroup.rotation.x = -walk;

      if (this.rightArmGroup) this.rightArmGroup.rotation.x = -walk;
      if (this.leftArmGroup) this.leftArmGroup.rotation.x = walk;
    } else {
      if (this.rightLegGroup) this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0, 0.1);
      if (this.leftLegGroup) this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0, 0.1);
      if (this.rightArmGroup) this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, 0, 0.1);
      if (this.leftArmGroup) this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0, 0.1);
    }

    if (isCrouching) {
      if (this.upperBodyGroup) this.upperBodyGroup.position.y = -0.1;
      if (this.rightLegGroup) this.rightLegGroup.position.y = 0.85;
      if (this.leftLegGroup) this.leftLegGroup.position.y = 0.85;
    } else {
      if (this.upperBodyGroup) this.upperBodyGroup.position.y = 0;
      if (this.rightLegGroup) this.rightLegGroup.position.y = 1.3 - 12 * (1 / 16) * 0.9;
      if (this.leftLegGroup) this.leftLegGroup.position.y = 1.3 - 12 * (1 / 16) * 0.9;
    }

    if (!isGrounded) {
      if (verticalVelocity > 0) {
        if (this.jumpAnimationType === "tuck") {
          if (this.rightLegGroup) this.rightLegGroup.rotation.x = 1.2;
          if (this.leftLegGroup) this.leftLegGroup.rotation.x = 1.2;
        } else {
          if (this.rightLegGroup) this.rightLegGroup.rotation.x = 0.6;
          if (this.leftLegGroup) this.leftLegGroup.rotation.x = 0.6;
        }

        if (this.rightArmGroup) this.rightArmGroup.rotation.x = -0.2;
        if (this.leftArmGroup) this.leftArmGroup.rotation.x = -0.2;
      } else {
        if (this.fallAnimationType === "tuck") {
          if (this.rightLegGroup) this.rightLegGroup.rotation.x = 1.1;
          if (this.leftLegGroup) this.leftLegGroup.rotation.x = 1.1;
        } else {
          if (this.rightLegGroup) this.rightLegGroup.rotation.x = 0.4;
          if (this.leftLegGroup) this.leftLegGroup.rotation.x = 0.4;
        }
        if (this.rightArmGroup) this.rightArmGroup.rotation.x = 0.2;
        if (this.leftArmGroup) this.leftArmGroup.rotation.x = 0.2;
      }
    }

    const targetHeadPitch = this.targetHeadPitch || 0;
    const targetHeadYaw = this.targetHeadYaw || 0;
    if (this.headGroup) {
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, targetHeadPitch, 0.2);
      this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, targetHeadYaw, 0.2);
    }

    if (isAttacking) {
      this.attackWeight = Math.min(1.0, this.attackWeight + dt * 6.0);
    } else {
      this.attackWeight = Math.max(0.0, this.attackWeight - dt * 6.0);
    }

    if (this.rightArmGroup) {
      const recoil = -0.6 * this.attackWeight;
      this.rightArmGroup.rotation.x += recoil;
    }

    if (this.currentHeldItem && this.currentHeldItem.mesh && this.rightArmGroup) {
      this.currentHeldItem.mesh.position.copy(this.rightArmGroup.position);
    }
  }
}
