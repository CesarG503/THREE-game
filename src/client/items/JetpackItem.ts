import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Item } from "./Item";
import { PI } from "three/src/nodes/TSL.js";

export class JetpackItem extends Item {
  static cachedModel: THREE.Object3D | null = null;
  static isLoading = false;
  static callbacks: Array<() => void> = [];

  type: string;
  airLimit: number;
  consumableUse: number;
  maxConsumableUse: number;
  thrust: number;
  particleVFX: string;
  equipSlot: string;
  modelPath: string;
  modelScale: number;
  limitHeightEnabled: boolean;
  maxFlightHeight: number;
  cooldownEnabled: boolean;
  cooldownTime: number;

  model: THREE.Object3D | null;
  equipGroup: THREE.Group;

  onLoadCallback: (() => void) | null;

  constructor(config: any = {}) {
    const id = config.id || "jetpack";
    const name = config.name || "Jetpack";
    const iconPath = config.iconPath || "/assets/textures/jetpack.png";

    super(id, name, iconPath);

    this.type = "consumable";
    this.airLimit = config.airLimit !== undefined ? config.airLimit : 5;
    this.consumableUse = config.consumableUse !== undefined ? config.consumableUse : 30;
    this.maxConsumableUse = config.maxConsumableUse !== undefined ? config.maxConsumableUse : 30;
    this.thrust = config.thrust !== undefined ? config.thrust : 25.0;
    this.particleVFX = config.particleVFX || "Humo y Fuego";
    this.limitHeightEnabled = config.limitHeightEnabled !== undefined ? config.limitHeightEnabled : true;
    this.maxFlightHeight = config.maxFlightHeight !== undefined ? config.maxFlightHeight : 20.0;
    this.cooldownEnabled = config.cooldownEnabled !== undefined ? config.cooldownEnabled : false;
    this.cooldownTime = config.cooldownTime !== undefined ? config.cooldownTime : 3.0;
    this.equipSlot = "back";
    this.modelPath = "/assets/Jetpack.glb";
    this.modelScale = 1;

    this.model = null;
    this.equipGroup = new THREE.Group();
    this.onLoadCallback = null;

    this.loadModel();
  }

  loadModel() {
    if (this.model || JetpackItem.isLoading) return;

    if (JetpackItem.cachedModel) {
      this.setupFromCache();
      return;
    }

    if (JetpackItem.isLoading) {
      JetpackItem.callbacks.push(() => this.setupFromCache());
      return;
    }

    JetpackItem.isLoading = true;
    const loader = new GLTFLoader();

    loader.load(
      this.modelPath,
      (gltf: any) => {
        const obj = gltf.scene;

        obj.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.metalness = 0.8;
              child.material.roughness = 0.2;
            }
          }
        });

        JetpackItem.cachedModel = obj;
        JetpackItem.isLoading = false;

        this.setupFromCache();

        JetpackItem.callbacks.forEach(cb => cb());
        JetpackItem.callbacks = [];
      },
      undefined,
      (err: any) => {
        console.error("Error loading Jetpack GLB:", err);
        JetpackItem.isLoading = false;
      }
    );
  }

  setupFromCache() {
    if (!JetpackItem.cachedModel) return;

    this.model = SkeletonUtils.clone(JetpackItem.cachedModel);
    this.model.scale.set(this.modelScale, this.modelScale, this.modelScale);

    this.model.rotation.set(0, 1.5, 0);
    this.model.position.set(-0.50, -0.3, 0.90);

    this.equipGroup.add(this.model);

    console.log("Jetpack GLB Model Loaded successfully");
    if (this.onLoadCallback) this.onLoadCallback();
  }

  setOnLoad(callback: () => void) {
    this.onLoadCallback = callback;
    if (this.model) callback();
  }

  getEquipMesh() {
    return this.equipGroup;
  }

  consumeFuel(dt: number) {
    this.consumableUse -= dt;
    if (this.consumableUse <= 0) {
      this.consumableUse = 0;
    }
  }

  clone() {
    return new JetpackItem({
      id: this.id,
      name: this.name,
      iconPath: this.iconPath,
      airLimit: this.airLimit,
      consumableUse: this.consumableUse,
      maxConsumableUse: this.maxConsumableUse,
      thrust: this.thrust,
      particleVFX: this.particleVFX,
      limitHeightEnabled: this.limitHeightEnabled,
      maxFlightHeight: this.maxFlightHeight,
      cooldownEnabled: this.cooldownEnabled,
      cooldownTime: this.cooldownTime
    });
  }
}
