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
  heldItem: any;
  heldItemMesh: THREE.Object3D | null;
  isHoldingWeapon: boolean;
  currentWeaponHand: "left" | "right";
  isFirstPerson: boolean;
  airTime: number;
  backItemMesh: THREE.Object3D | null;
  isSuperman: boolean;

  constructor(scene: THREE.Scene, isLocal = true) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.model = null;
    this.isVisible = false;
    this.isSuperman = false;

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
    this.currentHeldItem = null;
    this.heldItemMesh = null;
    this.backItemMesh = null;
    this.isHoldingWeapon = false;
    this.currentWeaponHand = "right";
    this.isFirstPerson = false;
    this.airTime = 0;

    this.initLoader();
    this.createModel();
  }

  initLoader() {
    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin("anonymous");
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

  setSkinUrl(url: string) {
    if (!url || url === this.skinUrl) return;
    this.skinUrl = url;
    this.applySkinTexture(url);
  }

  applySkinTexture(url: string) {
    if (!this.model) return;

    this.textureLoader.load(url, (texture) => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;

      this.model?.traverse((child: any) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material: any) => {
          material.map = texture;
          material.needsUpdate = true;
        });
      });
    });
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
    if (!this.rightArmGroup || !this.leftArmGroup) return;

    if (this.heldItemMesh) {
      if (this.currentWeaponHand === "left") {
        this.leftArmGroup.remove(this.heldItemMesh);
      } else {
        this.rightArmGroup.remove(this.heldItemMesh);
      }
      this.heldItemMesh = null;
    }

    if (this.backItemMesh) {
      this.upperBodyGroup.remove(this.backItemMesh);
      this.backItemMesh = null;
    }

    this.currentHeldItem = item;
    this.isHoldingWeapon = item !== null && item.type === "weapon";
    this.heldItem = item;

    if (!item || !item.getEquipMesh) return;

    const mesh = item.getEquipMesh();
    if (!mesh) return;

    if (item.equipSlot === "back") {
      this.backItemMesh = mesh;
      const pixelScale = (1 / 16) * 0.9;
      // Position it exactly on the Steve model's back!
      mesh.position.set(0, 1.3 - 6 * pixelScale, 2.3 * pixelScale);
      // Face 180 degrees backwards
      mesh.rotation.set(0, Math.PI, 0);
      this.upperBodyGroup.add(mesh);
    } else {
      this.heldItemMesh = mesh;
      const pixelScale = (1 / 16) * 0.9;
      mesh.position.set(0, -10 * pixelScale, 2 * pixelScale);
      mesh.rotation.set(Math.PI / 2, 1.5, Math.PI);

      const intendedHand = item.equippedHand || "right";
      this.currentWeaponHand = intendedHand === "left" ? "right" : "left";

      if (this.currentWeaponHand === "left") {
        this.leftArmGroup.add(mesh);
      } else {
        this.rightArmGroup.add(mesh);
      }
    }
  }

  update(dt: number, isMoving: boolean, isCrouching = false, isAttacking = false, isGrounded = true, verticalVelocity = 0, isSuperman = false, noPitchTilt = false) {
    this.isSuperman = isSuperman;
    if (!this.model || !this.isVisible) return;
    if (
      !this.headGroup ||
      !this.body ||
      !this.upperBodyGroup ||
      !this.rightArmGroup ||
      !this.leftArmGroup ||
      !this.rightLegGroup ||
      !this.leftLegGroup ||
      !this.pivotGroup
    ) {
      return;
    }

    const attackLerpSpeed = 15 * dt;
    const targetWeight = isAttacking && !this.isHoldingWeapon ? 1.0 : 0.0;
    this.attackWeight = THREE.MathUtils.lerp(this.attackWeight, targetWeight, attackLerpSpeed);

    const attackSpeed = 25;
    const attackVal = Math.sin((Date.now() / 1000) * attackSpeed);
    const swing = (attackVal + 1) / 2;

    const pixelScale = (1 / 16) * 0.9;
    const crouchOffset = isCrouching ? 0.2 : 0;
    const legCrouchOffset = isCrouching ? 0.05 : 0;

    const targetHeadY = 1.3 - crouchOffset;
    const targetBodyY = 1.3 - 6 * pixelScale - crouchOffset;

    let targetRArmX = 4 * pixelScale + 2 * pixelScale;
    let targetLArmX = -4 * pixelScale - 2 * pixelScale;
    let targetRArmY = 1.3 - 2 * pixelScale - crouchOffset;
    let targetLArmY = 1.3 - 2 * pixelScale - crouchOffset;
    let targetRArmZ = 0;
    let targetLArmZ = 0;

    if (this.isFirstPerson && this.isHoldingWeapon) {
      const curPitch = this.targetHeadPitch || 0;
      const isLeft = this.currentWeaponHand === "left";

      let xOffset = isLeft ? -0.15 : 0.15;
      let yOffset = -0.15;
      const zOffset = -0.05;

      if (curPitch > 0) {
        xOffset += isLeft ? -curPitch * 0.15 : curPitch * 0.15;
        yOffset -= curPitch * 0.2;
      } else {
        yOffset -= curPitch * 0.1;
      }

      if (isLeft) {
        targetLArmX += xOffset;
        targetLArmY += yOffset;
        targetLArmZ += zOffset;
      } else {
        targetRArmX += xOffset;
        targetRArmY += yOffset;
        targetRArmZ += zOffset;
      }
    }

    const baseLegY = 1.3 - 12 * pixelScale;
    const targetLegY = baseLegY - legCrouchOffset;
    const lerpSpeed = 10 * dt;

    this.headGroup.position.y = THREE.MathUtils.lerp(this.headGroup.position.y, targetHeadY, lerpSpeed);
    this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, targetBodyY, lerpSpeed);

    this.rightArmGroup.position.x = THREE.MathUtils.lerp(this.rightArmGroup.position.x, targetRArmX, lerpSpeed);
    this.leftArmGroup.position.x = THREE.MathUtils.lerp(this.leftArmGroup.position.x, targetLArmX, lerpSpeed);
    this.rightArmGroup.position.y = THREE.MathUtils.lerp(this.rightArmGroup.position.y, targetRArmY, lerpSpeed);
    this.leftArmGroup.position.y = THREE.MathUtils.lerp(this.leftArmGroup.position.y, targetLArmY, lerpSpeed);
    this.rightArmGroup.position.z = THREE.MathUtils.lerp(this.rightArmGroup.position.z, targetRArmZ, lerpSpeed);
    this.leftArmGroup.position.z = THREE.MathUtils.lerp(this.leftArmGroup.position.z, targetLArmZ, lerpSpeed);

    this.rightLegGroup.position.y = THREE.MathUtils.lerp(this.rightLegGroup.position.y, targetLegY, lerpSpeed);
    this.leftLegGroup.position.y = THREE.MathUtils.lerp(this.leftLegGroup.position.y, targetLegY, lerpSpeed);

    const targetBodyRotX = isCrouching ? 0.2 : 0;
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, targetBodyRotX, lerpSpeed);

    const targetHeadRotX = targetBodyRotX - (this.targetHeadPitch || 0);
    this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, targetHeadRotX, lerpSpeed * 2.0);

    if (this.backItemMesh) {
      const targetBackY = (1.3 - 6 * pixelScale) - crouchOffset;
      this.backItemMesh.position.y = THREE.MathUtils.lerp(this.backItemMesh.position.y, targetBackY, lerpSpeed);
      const targetBackRotX = -this.body.rotation.x;
      this.backItemMesh.rotation.x = THREE.MathUtils.lerp(this.backItemMesh.rotation.x, targetBackRotX, lerpSpeed);
    }

    if (isSuperman) {
      const currentPitch = this.targetHeadPitch || 0;
      const targetPivotRotX = noPitchTilt ? Math.PI / 2.2 : (Math.PI / 2.2 - currentPitch);
      this.pivotGroup.rotation.x = THREE.MathUtils.lerp(this.pivotGroup.rotation.x, targetPivotRotX, 10 * dt);

      const targetHeadRotX = -Math.PI / 2;
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, targetHeadRotX, 10 * dt);

      const armFlyRotX = -Math.PI + 0.2;
      this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, armFlyRotX, 10 * dt);
      this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, armFlyRotX, 10 * dt);

      this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, -0.15, 10 * dt);
      this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, 0.15, 10 * dt);

      this.leftArmGroup.rotation.y = THREE.MathUtils.lerp(this.leftArmGroup.rotation.y, 0, 10 * dt);
      this.rightArmGroup.rotation.y = THREE.MathUtils.lerp(this.rightArmGroup.rotation.y, 0, 10 * dt);

      this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0.05, 10 * dt);
      this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, -0.05, 10 * dt);

      this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, 0, 10 * dt);
      this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, 10 * dt);
      this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, this.targetHeadYaw || 0, 10 * dt);
    } else {
      let baseRArmX = 0;
      let baseLArmX = 0;
      let baseRLegX = 0;
      let baseLLegX = 0;
      let baseRArmZ = 0;
      let baseLArmZ = 0;

      if (isMoving) {
        const speed = isCrouching ? 5 : 10;
        const time = (Date.now() / 1000) * speed;
        const sinVal = Math.sin(time);

        baseRArmX = sinVal * 0.8;
        baseLArmX = -sinVal * 0.8;
        baseRLegX = -sinVal * 0.8;
        baseLLegX = sinVal * 0.8;

        if (isCrouching) {
          baseRArmX += 0.2;
          baseLArmX += 0.2;
        }
      } else {
        const time = Date.now() / 1000;
        baseRArmZ = Math.sin(time) * 0.05 + 0.05;
        baseLArmZ = -Math.sin(time) * 0.05 - 0.05;

        if (isCrouching) {
          baseRArmX = 0.2;
          baseLArmX = 0.2;
        }
      }

      const animLerp = 0.2;
      this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, baseRLegX, animLerp);
      this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, baseLLegX, animLerp);

      if (this.attackWeight > 0.01) {
        const blend = this.attackWeight;
        const punchRotX = -swing * 2.5 - 0.2;
        const recoilRotX = swing * 0.5 + 0.5;
        const targetTwist = swing * 0.4;

        const finalLArmX = THREE.MathUtils.lerp(baseLArmX, punchRotX, blend);
        const finalRArmX = THREE.MathUtils.lerp(baseRArmX, recoilRotX, blend);
        const finalTwist = THREE.MathUtils.lerp(0, targetTwist, blend);

        this.leftArmGroup.rotation.x = finalLArmX;
        this.rightArmGroup.rotation.x = finalRArmX;
        this.body.rotation.y = 0;
        this.upperBodyGroup.rotation.y = finalTwist;
        this.headGroup.rotation.y = this.targetHeadYaw || 0;
        this.leftArmGroup.rotation.y = 0;
        this.rightArmGroup.rotation.y = 0;
      } else if (this.isHoldingWeapon) {
        const currentPitch = this.targetHeadPitch || 0;
        const pointAimAngle = -Math.PI / 2 - currentPitch;
        const aimBob = isMoving ? Math.sin((Date.now() / 100) * 0.5) * 0.05 : Math.sin(Date.now() / 500) * 0.02;

        let freeArmTargetRotX = this.currentWeaponHand === "left" ? baseRArmX : baseLArmX;
        let freeArmTargetRotZ = this.currentWeaponHand === "left" ? baseRArmZ : baseLArmZ;
        let weaponArmRotZ = 0;
        let weaponArmRotY = 0;

        if (this.isFirstPerson) {
          const pitchOffset = currentPitch * 0.3;
          if (this.currentWeaponHand === "left") {
            weaponArmRotZ = -0.1 - pitchOffset * 0.5;
            weaponArmRotY = 0.15 + pitchOffset * 0.5;
          } else {
            weaponArmRotZ = 0.1 + pitchOffset * 0.5;
            weaponArmRotY = -0.15 - pitchOffset * 0.5;
          }
        }

        if (this.heldItem && this.heldItem.isReloading) {
          if (!this.heldItem._reloadStartTime) {
            this.heldItem._reloadStartTime = Date.now();
          }

          const t = (Date.now() - this.heldItem._reloadStartTime) / 700;
          const targetRotX = -Math.PI / 2;
          const targetRotZ = this.currentWeaponHand === "left" ? -0.8 : 0.8;

          if (t < 1.0) {
            const localLerp = t / 1.0;
            const ease = localLerp * localLerp * (3 - 2 * localLerp);
            freeArmTargetRotX = THREE.MathUtils.lerp(freeArmTargetRotX, targetRotX, ease);
            freeArmTargetRotZ = THREE.MathUtils.lerp(freeArmTargetRotZ, targetRotZ, ease);
          } else if (t < 1.5) {
            const dipLerp = (t - 1.0) / 0.5;
            const dip = Math.sin(dipLerp * Math.PI) * 0.4;
            freeArmTargetRotX = targetRotX + dip;
            freeArmTargetRotZ = targetRotZ;
          } else if (t < 2.2) {
            const localLerp = (t - 1.5) / 0.7;
            const ease = localLerp * localLerp * (3 - 2 * localLerp);
            freeArmTargetRotX = THREE.MathUtils.lerp(targetRotX, freeArmTargetRotX, ease);
            freeArmTargetRotZ = THREE.MathUtils.lerp(
              targetRotZ,
              this.currentWeaponHand === "left" ? baseRArmZ : baseLArmZ,
              ease
            );
          }
        } else if (this.heldItem) {
          this.heldItem._reloadStartTime = null;
        }

        const headYaw = this.targetHeadYaw || 0;
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, headYaw, animLerp * 2.0);

        let weaponSwayZ = 0;
        let weaponSwayY = 0;
        if (this.isFirstPerson) {
          weaponSwayZ = headYaw * -0.4;
          weaponSwayY = headYaw * 0.3;
        }

        if (this.currentWeaponHand === "left") {
          this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, pointAimAngle + aimBob, 0.2);
          this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, weaponArmRotZ + weaponSwayZ, 0.2);
          this.leftArmGroup.rotation.y = THREE.MathUtils.lerp(this.leftArmGroup.rotation.y, weaponArmRotY + weaponSwayY, 0.4);

          this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, freeArmTargetRotX, animLerp);
          this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, freeArmTargetRotZ, animLerp);
          this.rightArmGroup.rotation.y = THREE.MathUtils.lerp(this.rightArmGroup.rotation.y, 0, animLerp);
        } else {
          this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, pointAimAngle + aimBob, 0.2);
          this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, weaponArmRotZ + weaponSwayZ, 0.2);
          this.rightArmGroup.rotation.y = THREE.MathUtils.lerp(this.rightArmGroup.rotation.y, weaponArmRotY + weaponSwayY, 0.4);

          this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, freeArmTargetRotX, animLerp);
          this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, freeArmTargetRotZ, animLerp);
          this.leftArmGroup.rotation.y = THREE.MathUtils.lerp(this.leftArmGroup.rotation.y, 0, animLerp);
        }

        if (this.heldItemMesh && this.heldItem && this.heldItem.type === "weapon") {
          const recoil = this.heldItem.gunImpulse ? this.heldItem.gunImpulse * 2 : 0;
          const reloadZ = this.heldItem.springReloadZ || 0;
          const initialZ = 2 * pixelScale;

          this.heldItemMesh.position.z = initialZ - reloadZ - recoil;
          this.heldItemMesh.rotation.x = this.heldItem.isReloading ? -Math.PI / 2 - reloadZ * 3 : -Math.PI / 2;
        }

        const aimTwist = this.currentWeaponHand === "left" ? 0.2 : -0.2;
        this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, aimTwist, animLerp);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, aimTwist * 0.5, animLerp * 2.0);
      } else {
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, animLerp);
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, baseLArmX, animLerp);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, baseRArmX, animLerp);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, baseLArmZ, animLerp);
        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, baseRArmZ, animLerp);

        const resetTwist = 0;
        this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, resetTwist, animLerp);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, resetTwist + (this.targetHeadYaw || 0), animLerp * 2.0);
        this.leftArmGroup.rotation.y = THREE.MathUtils.lerp(this.leftArmGroup.rotation.y, resetTwist, animLerp);
        this.rightArmGroup.rotation.y = THREE.MathUtils.lerp(this.rightArmGroup.rotation.y, resetTwist, animLerp);
      }
    }

    if (!isGrounded) {
      this.airTime += dt;
    } else {
      this.airTime = 0;
    }

    if (!isSuperman) {
      const jumpAnim = this.jumpAnimationType || "flip";
      const fallAnim = this.fallAnimationType || "none";
      let shouldFlip = false;

      if (jumpAnim === "flip" && !isGrounded) {
        shouldFlip = true;
      }

      if (fallAnim === "flip" && !isGrounded && this.airTime > 0.5) {
        shouldFlip = true;
      }

      if (shouldFlip) {
        const jumpLerp = 0.15;

        this.rightArmGroup.rotation.z = THREE.MathUtils.lerp(this.rightArmGroup.rotation.z, 0, jumpLerp);
        this.leftArmGroup.rotation.z = THREE.MathUtils.lerp(this.leftArmGroup.rotation.z, 0, jumpLerp);
        this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, -0.5, jumpLerp);
        this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, -0.5, jumpLerp);
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0.5, jumpLerp);
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0.5, jumpLerp);

        this.pivotGroup.rotation.x -= 10 * dt;
      } else {
        const currentRot = this.pivotGroup.rotation.x;
        if (Math.abs(currentRot) > 0.001) {
          const twoPI = Math.PI * 2;
          const targetRot = Math.round(currentRot / twoPI) * twoPI;
          this.pivotGroup.rotation.x = THREE.MathUtils.lerp(currentRot, targetRot, 15 * dt);

          if (Math.abs(this.pivotGroup.rotation.x - targetRot) < 0.01) {
            this.pivotGroup.rotation.x = 0;
          }
        }
      }
    }
  }
}
