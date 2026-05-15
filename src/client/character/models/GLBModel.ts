import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ICharacterModel } from "../../types";

export class GLBModel implements ICharacterModel {
  scene: THREE.Scene;
  isLocal: boolean;
  model: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  animations: Record<string, THREE.AnimationAction>;
  currentAction: THREE.AnimationAction | null;
  isVisible: boolean;

  constructor(scene: THREE.Scene, isLocal = true) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.model = null;
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;
    this.isVisible = false;

    this.loadModel();
  }

  loadModel() {
    const loader = new GLTFLoader();
    loader.load("https://threejs.org/examples/models/gltf/Soldier.glb", (gltf: any) => {
      this.model = gltf.scene;
      this.model.userData.isPlayer = true;
      this.model.userData.isLocalPlayer = this.isLocal;
      this.scene.add(this.model);

      this.model.traverse((o: any) => {
        if (o.isMesh) o.castShadow = true;
      });

      this.mixer = new THREE.AnimationMixer(this.model);
      this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Idle"));
      this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Run"));

      this.model.visible = this.isVisible;
      if (this.isVisible) {
        this.switchAnimation("Idle");
      }

      const loading = document.getElementById("loading");
      if (loading) loading.style.display = "none";
    });
  }

  setVisible(visible: boolean) {
    this.isVisible = visible;
    if (this.model) {
      this.model.visible = visible;
      if (visible && !this.currentAction) {
        this.switchAnimation("Idle");
      }
    }
  }

  setPosition(pos: THREE.Vector3) {
    if (this.model) {
      this.model.position.copy(pos);
    }
  }

  setRotation(rot: number) {
    if (this.model) {
      this.model.rotation.y = rot;
    }
  }

  getPosition(): THREE.Vector3 {
    return this.model ? this.model.position.clone() : new THREE.Vector3();
  }

  setHeldItem(item: any) {
    void item;
  }

  switchAnimation(name: string) {
    if (!this.mixer || !this.animations[name]) return;
    const action = this.animations[name];
    if (this.currentAction === action) return;
    if (this.currentAction) this.currentAction.fadeOut(0.2);
    action.reset().fadeIn(0.2).play();
    this.currentAction = action;
  }

  update(dt: number, isMoving: boolean) {
    if (!this.model || !this.isVisible) return;

    if (isMoving) {
      this.switchAnimation("Run");
    } else {
      this.switchAnimation("Idle");
    }

    if (this.mixer) this.mixer.update(dt);
  }
}
