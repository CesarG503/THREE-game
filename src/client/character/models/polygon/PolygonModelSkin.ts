import * as THREE from "three";
import type { ICharacterModel } from "../../../types";
import { AnimationRegistry } from "../animations/AnimationSystem";
import type { AnimationState, LimbParts } from "../animations/AnimationSystem";
import { LimbBender } from "../bending/LimbBender";
import "../animations/ClassicAnimationSystem";
import "../animations/StylizedAnimationSystem";

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
  roleVisualGroup: THREE.Group | null;
  roleOutlineMeshes: THREE.Mesh[];
  roleVisual: any;
  activeDebris: any[];

  // New configuration options
  animationStyle: string;
  limbBending: "none" | "jelly" | "joint";
  airJumpTriggered: boolean;

  constructor(scene: THREE.Scene, isLocal = true) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.model = null;
    this.isVisible = false;
    this.isSuperman = false;
    this.roleVisualGroup = null;
    this.roleOutlineMeshes = [];
    this.roleVisual = { type: "none", color: "#ffffff", aura: "soft" };

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

    // Default animation and bending configurations
    this.animationStyle = "classic";
    this.limbBending = "none";
    this.airJumpTriggered = false;
    this.activeDebris = [];

    this.initLoader();
    this.createModel();
  }

  initLoader() {
    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin("anonymous");
  }

  setAnimationStyle(style: string) {
    this.animationStyle = style || "classic";
  }

  setLimbBending(bending: "none" | "jelly" | "joint") {
    this.limbBending = bending || "none";
  }

  triggerAirJump() {
    this.airJumpTriggered = true;
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
    const heightSegments = 10; // Number of height subdivisions for bending limbs

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

    // Body uses standard box geometry (doesn't bend)
    const bodyGeo = this.createBoxGeometryWithUVs(8, 12, 4, 16, 16);
    this.body = new THREE.Mesh(bodyGeo, material);
    this.body.position.y = 1.3 - 6 * pixelScale;
    this.body.scale.set(pixelScale, pixelScale, pixelScale);
    this.body.castShadow = true;
    this.upperBodyGroup.add(this.body);

    const bodyOuterGeo = this.createBoxGeometryWithUVs(8, 12, 4, 16, 32);
    const bodyOuter = new THREE.Mesh(bodyOuterGeo, material);
    bodyOuter.position.set(0, 0, 0);
    bodyOuter.scale.set(1.05, 1.05, 1.05);
    this.body.add(bodyOuter);

    // Right Arm (Subdivided)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(4 * pixelScale + 2 * pixelScale, 1.3 - 2 * pixelScale, 0);
    this.upperBodyGroup.add(this.rightArmGroup);

    const rArmGeo = this.createBoxGeometryWithUVs(4, 12, 4, 40, 16, 1, heightSegments, 1);
    this.rightArm = new THREE.Mesh(rArmGeo, material);
    this.rightArm.position.y = -6 * pixelScale + 2 * pixelScale;
    this.rightArm.scale.set(pixelScale, pixelScale, pixelScale);
    this.rightArm.castShadow = true;
    this.rightArmGroup.add(this.rightArm);

    const rArmOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 40, 32, 1, heightSegments, 1);
    const rArmOuter = new THREE.Mesh(rArmOuterGeo, material);
    rArmOuter.position.y = -6 * pixelScale + 2 * pixelScale;
    rArmOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.rightArmGroup.add(rArmOuter);

    // Left Arm (Subdivided)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-4 * pixelScale - 2 * pixelScale, 1.3 - 2 * pixelScale, 0);
    this.upperBodyGroup.add(this.leftArmGroup);

    const lArmGeo = this.createBoxGeometryWithUVs(4, 12, 4, 32, 48, 1, heightSegments, 1);
    this.leftArm = new THREE.Mesh(lArmGeo, material);
    this.leftArm.position.y = -6 * pixelScale + 2 * pixelScale;
    this.leftArm.scale.set(pixelScale, pixelScale, pixelScale);
    this.leftArm.castShadow = true;
    this.leftArmGroup.add(this.leftArm);

    const lArmOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 48, 48, 1, heightSegments, 1);
    const lArmOuter = new THREE.Mesh(lArmOuterGeo, material);
    lArmOuter.position.y = -6 * pixelScale + 2 * pixelScale;
    lArmOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.leftArmGroup.add(lArmOuter);

    // Right Leg (Subdivided)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(2 * pixelScale, 1.3 - 12 * pixelScale, 0);
    this.contentGroup.add(this.rightLegGroup);

    const rLegGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 16, 1, heightSegments, 1);
    this.rightLeg = new THREE.Mesh(rLegGeo, material);
    this.rightLeg.position.y = -6 * pixelScale;
    this.rightLeg.scale.set(pixelScale, pixelScale, pixelScale);
    this.rightLeg.castShadow = true;
    this.rightLegGroup.add(this.rightLeg);

    const rLegOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 32, 1, heightSegments, 1);
    const rLegOuter = new THREE.Mesh(rLegOuterGeo, material);
    rLegOuter.position.y = -6 * pixelScale;
    rLegOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05);
    this.rightLegGroup.add(rLegOuter);

    // Left Leg (Subdivided)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-2 * pixelScale, 1.3 - 12 * pixelScale, 0);
    this.contentGroup.add(this.leftLegGroup);

    const lLegGeo = this.createBoxGeometryWithUVs(4, 12, 4, 16, 48, 1, heightSegments, 1);
    this.leftLeg = new THREE.Mesh(lLegGeo, material);
    this.leftLeg.position.y = -6 * pixelScale;
    this.leftLeg.scale.set(pixelScale, pixelScale, pixelScale);
    this.leftLeg.castShadow = true;
    this.leftLegGroup.add(this.leftLeg);

    const lLegOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 48, 1, heightSegments, 1);
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
        if (!child.isMesh || !child.material || child.userData?.isRoleOutline || child.userData?.isRoleVisual) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material: any) => {
          material.map = texture;
          material.needsUpdate = true;
        });
      });
    });
  }

  setRoleVisual(visual: any) {
    this.roleVisual = normalizeRoleVisual(visual);
    if (!this.model) return;

    this.clearRoleVisual();

    if (this.roleVisual.type === "none") return;

    const color = new THREE.Color(this.roleVisual.color);
    const group = new THREE.Group();
    group.name = "roleVisual";
    group.userData.isRoleVisual = true;

    if (this.roleVisual.type === "outline") {
      this.addRoleOutline(color);
      return;
    }

    if (this.roleVisual.type === "color" || this.roleVisual.type === "color_aura") {
      const bandMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      });
      const chestBand = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 8, 48), bandMaterial);
      chestBand.position.y = 1.02;
      chestBand.rotation.x = Math.PI / 2;
      group.add(chestBand);

      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), bandMaterial.clone());
      marker.position.set(0, 1.95, 0.03);
      group.add(marker);
    }

    if (this.roleVisual.type === "aura" || this.roleVisual.type === "color_aura") {
      const auraMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: this.roleVisual.aura === "ring" ? 0.78 : 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const aura = new THREE.Mesh(new THREE.TorusGeometry(0.58, this.roleVisual.aura === "ring" ? 0.028 : 0.045, 16, 72), auraMaterial);
      aura.name = "roleAura";
      aura.position.y = 0.08;
      aura.rotation.x = Math.PI / 2;
      group.add(aura);

      if (this.roleVisual.aura !== "ring") {
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.015, 12, 60), auraMaterial.clone());
        halo.name = "roleHalo";
        halo.position.y = 2.12;
        halo.rotation.x = Math.PI / 2;
        group.add(halo);
      }
    }

    this.roleVisualGroup = group;
    group.traverse((child: any) => {
      child.userData.isRoleVisual = true;
    });
    this.model.add(group);
  }

  clearRoleVisual() {
    this.roleOutlineMeshes.forEach((outline) => {
      if (outline.parent) outline.parent.remove(outline);
      const materials = Array.isArray(outline.material) ? outline.material : [outline.material];
      materials.forEach((material: any) => material?.dispose?.());
    });
    this.roleOutlineMeshes = [];

    if (this.roleVisualGroup && this.model) {
      this.model.remove(this.roleVisualGroup);
      this.roleVisualGroup.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material: any) => material?.dispose?.());
        }
      });
      this.roleVisualGroup = null;
    }
  }

  addRoleOutline(color: THREE.Color) {
    if (!this.model) return;

    const targetMeshes: THREE.Mesh[] = [];
    this.model.traverse((child: any) => {
      if (!child.isMesh || !child.geometry || child.userData?.isRoleOutline || child.userData?.isRoleVisual) return;
      targetMeshes.push(child);
    });

    targetMeshes.forEach((mesh: any) => {
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
      outline.name = "roleOutline";
      outline.userData.isRoleOutline = true;
      outline.renderOrder = 2;
      outline.position.set(0, 0, 0);
      outline.rotation.set(0, 0, 0);
      outline.scale.set(1.055, 1.055, 1.055);
      mesh.add(outline);
      this.roleOutlineMeshes.push(outline);
    });
  }

  /**
   * Creates a box geometry with correct UV coordinates mapped from a 64x64 skin texture.
   * Supports vertical and horizontal subdivisions.
   */
  createBoxGeometryWithUVs(
    w: number,
    h: number,
    d: number,
    u: number,
    v: number,
    widthSegments = 1,
    heightSegments = 1,
    depthSegments = 1
  ) {
    const geometry = new THREE.BoxGeometry(w, h, d, widthSegments, heightSegments, depthSegments);

    const width = 64;
    const height = 64;

    const getFaceBounds = (x: number, y: number, w1: number, h1: number) => {
      const u1 = x / width;
      const v1 = 1 - (y + h1) / height;
      const u2 = (x + w1) / width;
      const v2 = 1 - y / height;
      return { u1, v1, u2, v2 };
    };

    const bounds = [
      getFaceBounds(u, v + d, d, h),           // Right (Index 0)
      getFaceBounds(u + d + w, v + d, d, h),   // Left (Index 1)
      getFaceBounds(u + d, v, w, d),           // Top (Index 2)
      getFaceBounds(u + d + w, v, w, d),       // Bottom (Index 3)
      getFaceBounds(u + d, v + d, w, h),       // Front (Index 4)
      getFaceBounds(u + d + w + d, v + d, w, h) // Back (Index 5)
    ];

    const uvAttribute = geometry.attributes.uv;
    const indexAttribute = geometry.index;

    if (!indexAttribute) return geometry;

    // Loop through the 6 planes of the subdivided BoxGeometry
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const group = geometry.groups[faceIdx];
      const start = group.start;
      const count = group.count;
      const b = bounds[faceIdx];

      const seenVertices = new Set<number>();

      for (let i = 0; i < count; i++) {
        const vertexIdx = indexAttribute.getX(start + i);
        if (seenVertices.has(vertexIdx)) continue;
        seenVertices.add(vertexIdx);

        // Three.js sets default plane UV coordinates from [0, 1] on each plane
        const uDef = uvAttribute.getX(vertexIdx);
        const vDef = uvAttribute.getY(vertexIdx);

        // Interpolate default UV within our target skin texture patch bounds
        const finalU = b.u1 + uDef * (b.u2 - b.u1);
        const finalV = b.v1 + vDef * (b.v2 - b.v1);

        uvAttribute.setXY(vertexIdx, finalU, finalV);
      }
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
      mesh.position.set(0, 1.3 - 6 * pixelScale, 2.3 * pixelScale);
      mesh.rotation.set(0, Math.PI, 0);
      this.upperBodyGroup.add(mesh);
    } else {
      this.heldItemMesh = mesh;
      const pixelScale = (1 / 16) * 0.9;
      mesh.position.set(0, -10 * pixelScale, 2 * pixelScale);
      mesh.rotation.set(Math.PI / 2, 1.5, 0);

      const intendedHand = item.equippedHand || "right";
      this.currentWeaponHand = intendedHand === "left" ? "right" : "left";

      if (this.currentWeaponHand === "left") {
        this.leftArmGroup.add(mesh);
      } else {
        this.rightArmGroup.add(mesh);
      }
    }
  }

  update(
    dt: number,
    isMoving: boolean,
    isCrouching = false,
    isAttacking = false,
    isGrounded = true,
    verticalVelocity = 0,
    isSuperman = false,
    noPitchTilt = false,
    isRunning = false
  ) {
    // Update debris even if model is hidden (since player is dead)
    if (this.activeDebris && this.activeDebris.length > 0) {
      this.activeDebris.forEach((deb) => {
        deb.lifeTime += dt;

        // Apply physics
        if (deb.group.position.y > deb.groundY) {
          deb.velocity.y -= 9.8 * dt; // gravity
          deb.group.position.addScaledVector(deb.velocity, dt);

          // Rotation
          deb.group.rotation.x += deb.angularVelocity.x * dt;
          deb.group.rotation.y += deb.angularVelocity.y * dt;
          deb.group.rotation.z += deb.angularVelocity.z * dt;
        } else {
          deb.group.position.y = deb.groundY;
          deb.velocity.set(0, 0, 0);
          deb.angularVelocity.set(0, 0, 0);
        }

        // Fade out in the last 1 second
        const timeRemaining = deb.maxLifeTime - deb.lifeTime;
        if (timeRemaining <= 1.0) {
          const opacity = Math.max(0, timeRemaining);
          deb.group.traverse((child: any) => {
            if (child.isMesh && child.material) {
              child.material.opacity = opacity;
              child.material.transparent = true;
            }
          });
        }
      });

      // Filter out dead debris
      const deadDebris = this.activeDebris.filter((deb) => deb.lifeTime >= deb.maxLifeTime);
      deadDebris.forEach((deb) => {
        this.scene.remove(deb.group);
        deb.group.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((m: any) => m?.dispose?.());
          }
        });
      });
      this.activeDebris = this.activeDebris.filter((deb) => deb.lifeTime < deb.maxLifeTime);
    }

    this.isSuperman = isSuperman;
    if (!this.model || !this.isVisible) return;

    // 1. Role Aura & Visual updates
    if (this.roleVisualGroup) {
      const aura = this.roleVisualGroup.getObjectByName("roleAura");
      const halo = this.roleVisualGroup.getObjectByName("roleHalo");
      if (aura) {
        aura.rotation.z += dt * 1.6;
        const pulse = this.roleVisual.aura === "pulse" ? 1 + Math.sin(Date.now() / 180) * 0.08 : 1;
        aura.scale.setScalar(pulse);
      }
      if (halo) halo.rotation.z -= dt * 1.2;
    }

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

    // 2. Air time increment (needed for fall animations)
    if (!isGrounded) {
      this.airTime += dt;
    } else {
      this.airTime = 0;
    }

    // 3. Delegate limb movements to Animation System
    const animState: AnimationState = {
      dt,
      isMoving,
      isCrouching,
      isAttacking,
      isGrounded,
      verticalVelocity,
      isSuperman,
      noPitchTilt,
      attackWeight: this.attackWeight,
      airTime: this.airTime,
      targetHeadPitch: this.targetHeadPitch,
      targetHeadYaw: this.targetHeadYaw,
      isHoldingWeapon: this.isHoldingWeapon,
      currentWeaponHand: this.currentWeaponHand,
      heldItem: this.heldItem,
      isFirstPerson: this.isFirstPerson,
      jumpAnimationType: this.jumpAnimationType,
      fallAnimationType: this.fallAnimationType,
      isRunning
    };

    const parts: LimbParts = {
      headGroup: this.headGroup,
      body: this.body,
      upperBodyGroup: this.upperBodyGroup,
      rightArmGroup: this.rightArmGroup,
      leftArmGroup: this.leftArmGroup,
      rightLegGroup: this.rightLegGroup,
      leftLegGroup: this.leftLegGroup,
      pivotGroup: this.pivotGroup,
      backItemMesh: this.backItemMesh,
      heldItemMesh: this.heldItemMesh
    };

    const animationManager = AnimationRegistry.get(this.animationStyle) || AnimationRegistry.get("classic")!;
    animationManager.update(parts, animState, this);

    // 4. Apply limb bending (flexibility of limbs)
    if (this.limbBending !== "none") {
      let rArmBend = 0;
      let lArmBend = 0;
      let rLegBend = 0;
      let lLegBend = 0;

      // Helper function to calculate elbow bending based on physical arm rotation
      const getArmBendVal = (armRotX: number) => {
        // Base flex for running / standing
        const base = isRunning ? 0.4 : 0.15;
        // Elbow bends more when the arm swings forward (negative rotation X) or backward (positive rotation X)
        if (armRotX < 0) {
          return base + (-armRotX) * 0.65;
        } else {
          return base + armRotX * 0.35;
        }
      };

      // Compute bending angles from actual rotation states
      if (this.isHoldingWeapon) {
        if (this.currentWeaponHand === "right") {
          rArmBend = 0.3; // slightly bent for weapon holding
          lArmBend = getArmBendVal(this.leftArmGroup.rotation.x);
        } else {
          lArmBend = 0.3;
          rArmBend = getArmBendVal(this.rightArmGroup.rotation.x);
        }
      } else {
        rArmBend = getArmBendVal(this.rightArmGroup.rotation.x);
        lArmBend = getArmBendVal(this.leftArmGroup.rotation.x);
      }

      // Add a slight extra mid-air elbow flex
      if (!isGrounded && !isSuperman) {
        rArmBend += 0.2;
        lArmBend += 0.2;
      }

      // Knee bending calculation (knees bend backward, positive angle)
      if (!isGrounded && !isSuperman) {
        // Knees bend dynamically in mid-air following scissor swing
        rLegBend = 0.2 + Math.abs(this.rightLegGroup.rotation.x) * 0.55;
        lLegBend = 0.2 + Math.abs(this.leftLegGroup.rotation.x) * 0.55;
      } else {
        // Knees bend when swinging on the ground
        rLegBend = isRunning ? (0.25 + Math.abs(this.rightLegGroup.rotation.x) * 1.1) : (Math.abs(this.rightLegGroup.rotation.x) * 0.95);
        lLegBend = isRunning ? (0.25 + Math.abs(this.leftLegGroup.rotation.x) * 1.1) : (Math.abs(this.leftLegGroup.rotation.x) * 0.95);
      }

      // Apply bending: codos doblan para adelante (negative angle), rodillas doblan para atras (positive angle)
      LimbBender.bend(this.rightArm, this.limbBending, -rArmBend);
      if (this.rightArmGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.rightArmGroup.children[1], this.limbBending, -rArmBend);
      }

      LimbBender.bend(this.leftArm, this.limbBending, -lArmBend);
      if (this.leftArmGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.leftArmGroup.children[1], this.limbBending, -lArmBend);
      }

      LimbBender.bend(this.rightLeg, this.limbBending, rLegBend);
      if (this.rightLegGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.rightLegGroup.children[1], this.limbBending, rLegBend);
      }

      LimbBender.bend(this.leftLeg, this.limbBending, lLegBend);
      if (this.leftLegGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.leftLegGroup.children[1], this.limbBending, lLegBend);
      }

      // Keep default held item position/rotation so it behaves exactly like rigid mode
      if (this.heldItemMesh) {
        const pixelScale = (1 / 16) * 0.9;
        this.heldItemMesh.position.set(0, -10 * pixelScale, 2 * pixelScale);
        this.heldItemMesh.rotation.set(Math.PI / 2, 1.5, 0);
      }
    } else {
      // Restore standard rigid shape if bending style was switched off
      LimbBender.bend(this.rightArm, "none", 0);
      if (this.rightArmGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.rightArmGroup.children[1], "none", 0);
      }

      LimbBender.bend(this.leftArm, "none", 0);
      if (this.leftArmGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.leftArmGroup.children[1], "none", 0);
      }

      LimbBender.bend(this.rightLeg, "none", 0);
      if (this.rightLegGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.rightLegGroup.children[1], "none", 0);
      }

      LimbBender.bend(this.leftLeg, "none", 0);
      if (this.leftLegGroup.children[1] instanceof THREE.Mesh) {
        LimbBender.bend(this.leftLegGroup.children[1], "none", 0);
      }

      // Restore default held item position/rotation if no bending
      if (this.heldItemMesh) {
        const pixelScale = (1 / 16) * 0.9;
        this.heldItemMesh.position.set(0, -10 * pixelScale, 2 * pixelScale);
        this.heldItemMesh.rotation.set(Math.PI / 2, 1.5, 0);
      }
    }
  }

  explodeBodyParts(duration: number) {
    if (!this.model) return;

    // Force matrix update to get correct world coordinates
    this.model.updateMatrixWorld(true);

    const parts = [
      { name: "head", obj: this.headGroup },
      { name: "torso", obj: this.body },
      { name: "rightArm", obj: this.rightArmGroup },
      { name: "leftArm", obj: this.leftArmGroup },
      { name: "rightLeg", obj: this.rightLegGroup },
      { name: "leftLeg", obj: this.leftLegGroup }
    ];

    const groundY = this.model.position.y;
    this.clearDebris();

    parts.forEach((part) => {
      const group = part.obj;
      if (!group) return;

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();

      group.getWorldPosition(worldPos);
      group.getWorldQuaternion(worldQuat);
      group.getWorldScale(worldScale);

      const debrisGroup = new THREE.Group();
      debrisGroup.position.copy(worldPos);
      debrisGroup.quaternion.copy(worldQuat);
      debrisGroup.scale.copy(worldScale);

      // Clone child meshes and ensure they have individual materials for fading
      const cloneObj = group.clone();
      cloneObj.position.set(0, 0, 0);
      cloneObj.rotation.set(0, 0, 0);
      cloneObj.scale.set(1, 1, 1);
      
      cloneObj.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
        }
      });
      debrisGroup.add(cloneObj);

      this.scene.add(debrisGroup);

      // Random velocities
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5.0,
        2.5 + Math.random() * 3.5,
        (Math.random() - 0.5) * 5.0
      );

      const angVel = new THREE.Vector3(
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0
      );

      this.activeDebris.push({
        group: debrisGroup,
        velocity: vel,
        angularVelocity: angVel,
        groundY,
        lifeTime: 0,
        maxLifeTime: duration
      });
    });

    // Hide character model
    this.setVisible(false);
  }

  clearDebris() {
    this.activeDebris.forEach((deb) => {
      this.scene.remove(deb.group);
      deb.group.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m: any) => m?.dispose?.());
        }
      });
    });
    this.activeDebris = [];
  }
}

function normalizeRoleVisual(visual: any) {
  const value = visual && typeof visual === "object" ? visual : {};
  return {
    type: ["none", "color", "aura", "color_aura", "outline"].includes(value.type) ? value.type : "none",
    color: typeof value.color === "string" ? value.color : "#ffffff",
    aura: ["soft", "pulse", "ring"].includes(value.aura) ? value.aura : "soft",
  };
}
