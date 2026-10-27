import * as THREE from "three";
import { animate, Timeline } from "animejs";

export interface CameraAnimationParams {
  position?: { x?: number; y?: number; z?: number };
  target?: { x?: number; y?: number; z?: number };
  fov?: number;
  duration?: number;
  ease?: string;
}

export interface TransformAnimationParams {
  position?: { x?: number; y?: number; z?: number };
  rotation?: { x?: number; y?: number; z?: number };
  scale?: { x?: number; y?: number; z?: number } | number;
  duration?: number;
  ease?: string;
}

export interface MaterialAnimationParams {
  opacity?: number;
  color?: string | number;
  roughness?: number;
  metalness?: number;
  wireframe?: boolean;
  duration?: number;
  ease?: string;
}

/**
 * AnimeThreeAdapter: High-performance bridge between Anime.js v4 and Three.js.
 * Controls 3D camera, object transforms, materials, lights, and uniforms
 * with full timeline orchestration, scrubbing, and reversible state tracking.
 */
export class AnimeThreeAdapter {
  private activeTimelines: Set<Timeline> = new Set();
  private baseStates: Map<any, any> = new Map();

  /**
   * Records initial state of a 3D object to allow pristine reverts.
   */
  public snapshot(object: any): void {
    if (!object || this.baseStates.has(object)) return;

    if (object.isCamera) {
      this.baseStates.set(object, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        fov: object.fov,
      });
    } else if (object.isObject3D) {
      this.baseStates.set(object, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone(),
      });
    } else if (object.isMaterial) {
      this.baseStates.set(object, {
        opacity: object.opacity,
        transparent: object.transparent,
      });
    }
  }

  /**
   * Restores all snapshot 3D objects to their initial base states.
   */
  public restoreAll(): void {
    this.baseStates.forEach((state, object) => {
      if (object.isCamera) {
        object.position.copy(state.position);
        object.rotation.copy(state.rotation);
        if (typeof state.fov === "number") {
          object.fov = state.fov;
          if (typeof object.updateProjectionMatrix === "function") {
            object.updateProjectionMatrix();
          }
        }
      } else if (object.isObject3D) {
        object.position.copy(state.position);
        object.rotation.copy(state.rotation);
        object.scale.copy(state.scale);
      } else if (object.isMaterial) {
        object.opacity = state.opacity;
        object.transparent = state.transparent;
      }
    });
    this.baseStates.clear();
  }

  /**
   * Animates a Three.js Camera (position, lookAt target, FOV) via an Anime.js Timeline.
   */
  public animateCamera(
    camera: THREE.PerspectiveCamera,
    targetLookAt: THREE.Vector3,
    params: CameraAnimationParams,
    timeline?: Timeline,
    positionOffset: number | string = 0
  ): void {
    this.snapshot(camera);
    const duration = params.duration ?? 1000;
    const ease = params.ease ?? "outCubic";

    // Camera position interpolation
    if (params.position) {
      const posProxy = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };

      const animProps: any = {
        duration,
        ease,
        onUpdate: () => {
          camera.position.set(posProxy.x, posProxy.y, posProxy.z);
          camera.lookAt(targetLookAt);
        },
      };

      if (params.position.x !== undefined) animProps.x = params.position.x;
      if (params.position.y !== undefined) animProps.y = params.position.y;
      if (params.position.z !== undefined) animProps.z = params.position.z;

      if (timeline) {
        timeline.add(posProxy, animProps, positionOffset);
      } else {
        animate(posProxy, animProps);
      }
    }

    // Camera target (lookAt) interpolation
    if (params.target) {
      const targetProxy = {
        x: targetLookAt.x,
        y: targetLookAt.y,
        z: targetLookAt.z,
      };

      const animProps: any = {
        duration,
        ease,
        onUpdate: () => {
          targetLookAt.set(targetProxy.x, targetProxy.y, targetProxy.z);
          camera.lookAt(targetLookAt);
        },
      };

      if (params.target.x !== undefined) animProps.x = params.target.x;
      if (params.target.y !== undefined) animProps.y = params.target.y;
      if (params.target.z !== undefined) animProps.z = params.target.z;

      if (timeline) {
        timeline.add(targetProxy, animProps, positionOffset);
      } else {
        animate(targetProxy, animProps);
      }
    }

    // Camera FOV zoom interpolation
    if (params.fov !== undefined) {
      const fovProxy = { fov: camera.fov };
      const animProps: any = {
        fov: params.fov,
        duration,
        ease,
        onUpdate: () => {
          camera.fov = fovProxy.fov;
          camera.updateProjectionMatrix();
        },
      };

      if (timeline) {
        timeline.add(fovProxy, animProps, positionOffset);
      } else {
        animate(fovProxy, animProps);
      }
    }
  }

  /**
   * Animates a 3D Object transform (position, rotation, scale) via an Anime.js Timeline.
   */
  public animateTransform(
    object: THREE.Object3D,
    params: TransformAnimationParams,
    timeline?: Timeline,
    positionOffset: number | string = 0
  ): void {
    this.snapshot(object);
    const duration = params.duration ?? 1000;
    const ease = params.ease ?? "outCubic";

    // Position
    if (params.position) {
      const posProxy = {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      };

      const animProps: any = {
        duration,
        ease,
        onUpdate: () => {
          object.position.set(posProxy.x, posProxy.y, posProxy.z);
        },
      };

      if (params.position.x !== undefined) animProps.x = params.position.x;
      if (params.position.y !== undefined) animProps.y = params.position.y;
      if (params.position.z !== undefined) animProps.z = params.position.z;

      if (timeline) {
        timeline.add(posProxy, animProps, positionOffset);
      } else {
        animate(posProxy, animProps);
      }
    }

    // Rotation
    if (params.rotation) {
      const rotProxy = {
        x: object.rotation.x,
        y: object.rotation.y,
        z: object.rotation.z,
      };

      const animProps: any = {
        duration,
        ease,
        onUpdate: () => {
          object.rotation.set(rotProxy.x, rotProxy.y, rotProxy.z);
        },
      };

      if (params.rotation.x !== undefined) animProps.x = params.rotation.x;
      if (params.rotation.y !== undefined) animProps.y = params.rotation.y;
      if (params.rotation.z !== undefined) animProps.z = params.rotation.z;

      if (timeline) {
        timeline.add(rotProxy, animProps, positionOffset);
      } else {
        animate(rotProxy, animProps);
      }
    }

    // Scale
    if (params.scale !== undefined) {
      const targetScale = typeof params.scale === "number"
        ? { x: params.scale, y: params.scale, z: params.scale }
        : params.scale;

      const scaleProxy = {
        x: object.scale.x,
        y: object.scale.y,
        z: object.scale.z,
      };

      const animProps: any = {
        duration,
        ease,
        onUpdate: () => {
          object.scale.set(scaleProxy.x, scaleProxy.y, scaleProxy.z);
        },
      };

      if (targetScale.x !== undefined) animProps.x = targetScale.x;
      if (targetScale.y !== undefined) animProps.y = targetScale.y;
      if (targetScale.z !== undefined) animProps.z = targetScale.z;

      if (timeline) {
        timeline.add(scaleProxy, animProps, positionOffset);
      } else {
        animate(scaleProxy, animProps);
      }
    }
  }

  /**
   * Animates Material properties (opacity, color, etc.)
   */
  public animateMaterial(
    material: THREE.Material & { color?: THREE.Color },
    params: MaterialAnimationParams,
    timeline?: Timeline,
    positionOffset: number | string = 0
  ): void {
    this.snapshot(material);
    const duration = params.duration ?? 1000;
    const ease = params.ease ?? "outCubic";

    if (params.opacity !== undefined) {
      material.transparent = true;
      const opacityProxy = { opacity: material.opacity };

      const animProps: any = {
        opacity: params.opacity,
        duration,
        ease,
        onUpdate: () => {
          material.opacity = opacityProxy.opacity;
        },
      };

      if (timeline) {
        timeline.add(opacityProxy, animProps, positionOffset);
      } else {
        animate(opacityProxy, animProps);
      }
    }

    if (params.color !== undefined && material.color) {
      const targetColor = new THREE.Color(params.color);
      const colorProxy = {
        r: material.color.r,
        g: material.color.g,
        b: material.color.b,
      };

      const animProps: any = {
        r: targetColor.r,
        g: targetColor.g,
        b: targetColor.b,
        duration,
        ease,
        onUpdate: () => {
          material.color?.setRGB(colorProxy.r, colorProxy.g, colorProxy.b);
        },
      };

      if (timeline) {
        timeline.add(colorProxy, animProps, positionOffset);
      } else {
        animate(colorProxy, animProps);
      }
    }
  }

  /**
   * Animates a point light or directional light intensity & color.
   */
  public animateLight(
    light: THREE.Light,
    intensity: number,
    colorHex?: number,
    timeline?: Timeline,
    positionOffset: number | string = 0,
    duration = 800
  ): void {
    const proxy = { intensity: light.intensity };
    const animProps: any = {
      intensity,
      duration,
      ease: "outQuad",
      onUpdate: () => {
        light.intensity = proxy.intensity;
      },
    };

    if (timeline) {
      timeline.add(proxy, animProps, positionOffset);
    } else {
      animate(proxy, animProps);
    }

    if (colorHex !== undefined) {
      const targetColor = new THREE.Color(colorHex);
      const colProxy = { r: light.color.r, g: light.color.g, b: light.color.b };
      const colProps: any = {
        r: targetColor.r,
        g: targetColor.g,
        b: targetColor.b,
        duration,
        ease: "outQuad",
        onUpdate: () => {
          light.color.setRGB(colProxy.r, colProxy.g, colProxy.b);
        },
      };
      if (timeline) {
        timeline.add(colProxy, colProps, positionOffset);
      } else {
        animate(colProxy, colProps);
      }
    }
  }
}
