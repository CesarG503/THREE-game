import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Item } from "./Item";
import { StairsUtils } from "../utils/StairsUtils";
import { RampUtils } from "../utils/RampUtils";
import { applyMapObjectTexture, normalizeTextureSettings, type MapTextureSettings } from "../utils/TextureMapping";
import type { ItemContext } from "../types";
import { normalizeGravityOrientation } from "../utils/GravityOrientation";
import { MapAssetManager } from "../map/MapAssetManager";

type MapObjectScale = {
  x: number;
  y: number;
  z: number;
  shapeType?: string;
  radius?: number;
  length2?: number;
  bendAngleX?: number;
  bendAngleY?: number;
};

export const getTubeSegments = (scale: any) => {
  if (scale && scale.segments && Array.isArray(scale.segments) && scale.segments.length > 0) {
    return scale.segments;
  }
  const length1 = (scale && scale.y) || 2.0;
  const length2 = (scale && scale.length2) !== undefined ? scale.length2 : 2.0;
  const bendAngleX = (scale && scale.bendAngleX) !== undefined ? scale.bendAngleX : 0;
  const bendAngleY = (scale && scale.bendAngleY) !== undefined ? scale.bendAngleY : 90;
  return [
    { length: length1, bendAngleX: 0, bendAngleY: 0 },
    { length: length2, bendAngleX: bendAngleX, bendAngleY: bendAngleY }
  ];
};

export class MapObjectItem extends Item {
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

    this.iconPath = this.generateIcon();

    this.uuid = THREE.MathUtils.generateUUID();
  }

  generateIcon() {
    if (this.type === "impulse_jump") {
      return "/assets/textures/salto.png";
    }
    if (this.type === "impulse_lateral") {
      return "/assets/textures/impulso.png";
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 64, 64);

    ctx.fillStyle = "#" + new THREE.Color(this.color).getHexString();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    if (this.type === "ramp") {
      ctx.beginPath();
      ctx.moveTo(8, 56);
      ctx.lineTo(56, 56);
      ctx.lineTo(56, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.type === "stairs") {
      ctx.beginPath();
      ctx.moveTo(8, 56);
      ctx.lineTo(24, 56);
      ctx.lineTo(24, 40);
      ctx.lineTo(40, 40);
      ctx.lineTo(40, 24);
      ctx.lineTo(56, 24);
      ctx.lineTo(56, 8);
      ctx.lineTo(56, 56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.type === "pillar") {
      ctx.fillRect(20, 8, 24, 48);
      ctx.strokeRect(20, 8, 24, 48);
    } else if (this.type === "spawn_point") {
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", 32, 32);
    } else if (this.type === "movement_controller") {
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.moveTo(16, 32);
      ctx.lineTo(48, 32);
      ctx.lineTo(40, 24);
      ctx.moveTo(48, 32);
      ctx.lineTo(40, 40);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillText("MOV", 32, 48);
    } else if (this.type === "interaction_button") {
      ctx.fillStyle = "#555";
      ctx.fillRect(16, 40, 32, 16);
      ctx.strokeRect(16, 40, 32, 16);

      ctx.fillStyle = this.color ? "#" + new THREE.Color(this.color).getHexString() : "red";
      ctx.beginPath();
      ctx.arc(32, 32, 12, 0, Math.PI, true);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("F", 32, 38);
    } else if (this.type === "logic_camera" || this.type === "camera_prop") {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(14, 24, 30, 18);
      ctx.strokeRect(14, 24, 30, 18);

      ctx.beginPath();
      ctx.moveTo(44, 28);
      ctx.lineTo(56, 22);
      ctx.lineTo(56, 44);
      ctx.lineTo(44, 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CAM", 30, 33);
    } else if (this.type === "camera_panel") {
      ctx.fillStyle = "#111827";
      ctx.fillRect(12, 14, 40, 36);
      ctx.strokeRect(12, 14, 40, 36);

      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(17, 20, 30, 18);

      ctx.fillStyle = "white";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("F", 32, 46);
    } else if (this.type === "interactive_collision") {
      ctx.fillStyle = "rgba(0, 136, 255, 0.5)";
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 2;

      ctx.fillRect(16, 16, 32, 32);
      ctx.strokeRect(16, 16, 32, 32);

      ctx.fillStyle = "white";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚡", 32, 32);
    } else if (this.type === "gravity_pad") {
      ctx.fillStyle = "#233b68";
      ctx.fillRect(10, 36, 44, 12);
      ctx.strokeRect(10, 36, 44, 12);

      ctx.strokeStyle = "#8bd8ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(32, 48);
      ctx.lineTo(32, 15);
      ctx.moveTo(32, 15);
      ctx.lineTo(20, 27);
      ctx.moveTo(32, 15);
      ctx.lineTo(44, 27);
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("G", 32, 31);
    } else if (this.type === "target") {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(32, 32, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(32, 32, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === "gravity_pad") {
      const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
      const padColor = this.color !== undefined ? this.color : 0x2f75ff;
      const material = new THREE.MeshStandardMaterial({
        color: padColor,
        roughness: 0.72,
        emissive: 0x123a88,
        emissiveIntensity: 0.45
      });

      object3D = new THREE.Mesh(geometry, material);
      object3D.receiveShadow = true;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(Math.min(this.scale.x, this.scale.z) * 0.26, 0.025, 8, 36),
        new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = this.scale.y / 2 + 0.025;
      object3D.add(ring);

      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, this.scale.y / 2 + 0.05, this.scale.z * 0.28),
        Math.min(this.scale.x, this.scale.z) * 0.45,
        0xffffff,
        0.24,
        0.16
      );
      arrow.userData.isGravityPadArrow = true;
      object3D.add(arrow);

      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2).setSensor(true);
      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.name === undefined) this.logicProperties.name = "Pad de Gravedad";
      if (this.logicProperties.gravityOrientation === undefined) this.logicProperties.gravityOrientation = "up";
      if (this.logicProperties.transitionDuration === undefined) this.logicProperties.transitionDuration = 0.8;
      if (this.logicProperties.cooldown === undefined) this.logicProperties.cooldown = 0.35;
      this.logicProperties.gravityOrientation = normalizeGravityOrientation(this.logicProperties.gravityOrientation);
    } else if (this.type === "impulse_jump" || this.type === "impulse_lateral") {
      const isJump = this.type === "impulse_jump";
      ctx.fillStyle = isJump ? "#00ffff" : "#00ff00";
      ctx.fillRect(10, 36, 44, 12);
      ctx.strokeRect(10, 36, 44, 12);

      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (isJump) {
        ctx.moveTo(32, 46);
        ctx.lineTo(32, 14);
        ctx.moveTo(32, 14);
        ctx.lineTo(20, 26);
        ctx.moveTo(32, 14);
        ctx.lineTo(44, 26);
      } else {
        ctx.moveTo(14, 32);
        ctx.lineTo(50, 32);
        ctx.moveTo(50, 32);
        ctx.lineTo(38, 20);
        ctx.moveTo(50, 32);
        ctx.lineTo(38, 44);
      }
      ctx.stroke();
    } else if (this.type === "farming_zone") {
      ctx.fillStyle = "#ff4500";
      ctx.globalAlpha = 0.75;
      ctx.fillRect(12, 24, 40, 24);
      ctx.globalAlpha = 1;
      ctx.strokeRect(12, 24, 40, 24);

      ctx.fillStyle = "white";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 32, 36);
    } else if (this.type === "gravity_sphere") {
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#9C27B0";
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("G-S", 32, 32);
    } else if (this.type === "ladder") {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.moveTo(20, 8);
      ctx.lineTo(20, 56);
      ctx.moveTo(44, 8);
      ctx.lineTo(44, 56);
      for (let i = 12; i <= 52; i += 8) {
        ctx.moveTo(20, i);
        ctx.lineTo(44, i);
      }
      ctx.stroke();
    } else if (this.type === "sphere") {
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(32, 32, 24, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === "cylinder") {
      ctx.beginPath();
      ctx.ellipse(32, 16, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(16, 16, 32, 32);
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.lineTo(16, 48);
      ctx.moveTo(48, 16);
      ctx.lineTo(48, 48);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(32, 48, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(32, 32, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === "tube") {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(24, 52);
      ctx.lineTo(24, 28);
      ctx.quadraticCurveTo(24, 24, 28, 24);
      ctx.lineTo(52, 24);
      ctx.stroke();
      ctx.lineWidth = 2;
    } else {
      ctx.fillRect(8, 20, 48, 24);
      ctx.strokeRect(8, 20, 48, 24);
    }

    return canvas.toDataURL();
  }

  use(context: ItemContext) {
    if (this.type === "interactive_collision") {
      if (context.isRightClick) {
        const raycaster = new THREE.Raycaster();
        raycaster.set(context.origin, context.direction);
        const intersects = raycaster.intersectObjects(context.scene.children, true);
        const hit = intersects.find((h: any) => h.object.userData && h.object.userData.isEditableMapObject);

        if (hit) {
          const target = hit.object;

          if (!target.userData.logicProperties) target.userData.logicProperties = {};

          target.userData.originalMapObjectType = target.userData.mapObjectType;
          target.userData.mapObjectType = "interactive_collision";

          if (target.userData.logicProperties.isTraversable === undefined) target.userData.logicProperties.isTraversable = false;
          if (target.userData.logicProperties.triggerOnTouch === undefined) target.userData.logicProperties.triggerOnTouch = false;
          if (target.userData.logicProperties.triggerOnEnter === undefined) target.userData.logicProperties.triggerOnEnter = false;

          alert(`Lógica de Colisión Interactiva aplicada a: ${target.userData.name || "Objeto"}`);
          return true;
        }
        return false;
      }

      if (context.placementManager && context.placementManager.currentCollisionSize) {
        this.scale = { ...context.placementManager.currentCollisionSize };

        if (this.scale.shapeType === "sphere") {
          const diameter = this.scale.radius * 2;
          this.scale.x = diameter;
          this.scale.y = diameter;
          this.scale.z = diameter;
        }
      }
    }

    if (context.isRightClick && this.type !== "movement_controller") {
      return false;
    }

    if (this.type === "spawn_point") {
      if (context.placementManager && context.placementManager.currentSpawnProperties) {
        const props = context.placementManager.currentSpawnProperties;

        this.scale = { ...props };

        if (props.shapeType === "circle") {
          this.scale.x = props.radius * 2;
          this.scale.z = props.radius * 2;
          this.scale.y = 0.05;
        }
      }
    }

    if (this.type === "target") {
      if (context.placementManager && context.placementManager.currentTargetProperties) {
        this.logicProperties = {
          ...(this.logicProperties || {}),
          ...context.placementManager.currentTargetProperties
        };

        if (this.logicProperties.radius) {
          const diameter = this.logicProperties.radius * 2;
          this.scale.x = diameter;
          this.scale.z = diameter;
        }
      }
    }

    if (this.type === "movement_controller") {
      const raycaster = new THREE.Raycaster();
      raycaster.set(context.origin, context.direction);

      const intersects = raycaster.intersectObjects(context.scene.children, true);
      const hit = intersects.find((h: any) => h.object.userData && h.object.userData.isEditableMapObject);

      if (hit) {
        const target = hit.object;

        if (!target.userData.logicProperties) {
          target.userData.logicProperties = {};
        }

        const hasMovement = target.userData.logicProperties.waypoints ||
          (Array.isArray(target.userData.logicProperties.sequences) && target.userData.logicProperties.sequences.length > 0);

        if (!hasMovement) {
          const moverDefaults = this.logicProperties || {};
          const defaultSeq = (Array.isArray(moverDefaults.sequences) && moverDefaults.sequences[0]) || moverDefaults;
          target.userData.logicProperties.sequences = [{
            name: "Secuencia Principal",
            waypoints: [],
            speed: defaultSeq.speed || 2.0,
            loop: defaultSeq.loop !== false,
            active: defaultSeq.active !== false,
            triggerType: "none"
          }];

          alert(`Transformado en Objeto Móvil: ${target.userData.mapObjectType}`);
        } else {
          alert(`Este objeto ya tiene lógica de movimiento.`);
        }

        return true;
      }
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

  createObjectInWorld(scene: any, world: any, position: any, rotation: any, isCenterPosition = false) {
    let object3D: any;
    const collidersDesc: any[] = [];

    if (this.type === "stairs") {
      const steps = StairsUtils.calculateSteps(this.scale);

      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: this.opacity !== undefined && this.opacity < 1.0,
        opacity: this.opacity !== undefined ? this.opacity : 1.0
      });
      const stepGeo = new THREE.BoxGeometry(steps[0].size.x, steps[0].size.y, steps[0].size.z);

      steps.forEach((step: any) => {
        const mesh = new THREE.Mesh(stepGeo, material);
        mesh.position.set(step.position.x, step.position.y, step.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        const col = RAPIER.ColliderDesc.cuboid(step.size.x / 2, step.size.y / 2, step.size.z / 2).setTranslation(
          step.position.x,
          step.position.y,
          step.position.z
        );
        collidersDesc.push(col);
      });

      object3D = group;
    } else if (this.type === "ramp") {
      const geometry = RampUtils.createGeometry(this.scale);
      const material = new THREE.MeshStandardMaterial({ color: this.color });
      object3D = new THREE.Mesh(geometry, material);
      object3D.castShadow = true;
      object3D.receiveShadow = true;

      collidersDesc.push(RampUtils.createColliderDesc(this.scale, RAPIER));
    } else if (this.type === "spawn_point") {
      const shapeType = this.scale.shapeType || "circle";

      let geometry: any;
      let col: any;
      let height: any;

      if (shapeType === "square") {
        geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
        height = this.scale.y;
        col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
      } else {
        const radius = this.scale.x / 2 || 1.0;
        height = this.scale.y || 0.05;
        geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
        col = RAPIER.ColliderDesc.cylinder(height / 2, radius);
      }

      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.9,
        emissive: this.color,
        emissiveIntensity: 0.2,
        roughness: 0.8,
        metalness: 0.2
      });
      object3D = new THREE.Mesh(geometry, material);
      object3D.receiveShadow = true;

      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 0.6);
      arrowShape.lineTo(0.4, -0.2);
      arrowShape.lineTo(0, 0);
      arrowShape.lineTo(-0.4, -0.2);
      arrowShape.lineTo(0, 0.6);

      const arrowGeo = new THREE.ShapeGeometry(arrowShape);
      const arrowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);

      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = Math.PI;
      arrow.position.y = height / 2 + 0.01;

      object3D.add(arrow);

      collidersDesc.push(col);
    } else if (this.type === "movement_controller") {
      const geometry = new THREE.SphereGeometry(this.scale.x, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.7,
        wireframe: true
      });
      object3D = new THREE.Mesh(geometry, material);

      const core = new THREE.Mesh(new THREE.BoxGeometry(this.scale.x, this.scale.x, this.scale.x), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      object3D.add(core);

      const col = RAPIER.ColliderDesc.ball(this.scale.x);
      collidersDesc.push(col);
    } else if (this.type === "interaction_button") {
      const group = new THREE.Group();

      const btnGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32);
      const btnMat = new THREE.MeshStandardMaterial({
        color: this.color || 0xff0000,
        emissive: this.color || 0xff0000,
        emissiveIntensity: 0.2
      });
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.position.y = 0.05;
      btn.userData.isButtonMesh = true;

      const plateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 32);
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.y = 0.01;
      group.add(plate);

      group.add(btn);

      object3D = group;

      const col = RAPIER.ColliderDesc.cylinder(0.05, 0.3).setTranslation(0, 0.05, 0);
      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.holdTime === undefined) this.logicProperties.holdTime = 0;
      if (this.logicProperties.oneShot === undefined) this.logicProperties.oneShot = false;
      if (this.logicProperties.triggered === undefined) this.logicProperties.triggered = false;
    } else if (this.type === "camera_prop") {
      const group: any = new THREE.Group();
      const bodyColor = this.color !== undefined ? this.color : 0x1f2937;
      const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.45,
        metalness: 0.15
      });
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        emissive: 0x0f172a,
        emissiveIntensity: 0.4,
        roughness: 0.3
      });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.35), bodyMat);
      body.castShadow = true;
      group.add(body);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 24), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = -0.3;
      lens.castShadow = true;
      group.add(lens);

      const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 12), bodyMat);
      mount.position.y = -0.4;
      group.add(mount);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24), bodyMat);
      base.position.y = -0.66;
      group.add(base);

      object3D = group;

      const col = RAPIER.ColliderDesc.cuboid(0.28, 0.45, 0.28);
      collidersDesc.push(col);
    } else if (this.type === "logic_camera") {
      const group: any = new THREE.Group();
      const isEditor = window.location.pathname.includes("/editor");

      const helperMat = new THREE.MeshBasicMaterial({
        color: 0x8bd3ff,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      });
      const helperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), helperMat);
      helperMesh.visible = isEditor;
      group.add(helperMesh);

      const frustumLineMat = new THREE.LineBasicMaterial({
        color: 0x8bd3ff,
        transparent: true,
        opacity: 0.55
      });

      const makeFrustum = (fov = 60, far = 6, aspect = 16 / 9) => {
        const near = 0.35;
        const fovRad = THREE.MathUtils.degToRad(fov);
        const nearH = Math.tan(fovRad / 2) * near;
        const nearW = nearH * aspect;
        const farH = Math.tan(fovRad / 2) * far;
        const farW = farH * aspect;
        const points = [
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(-farW, farH, -far),
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(farW, farH, -far),
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(farW, -farH, -far),
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(-farW, -farH, -far),
          new THREE.Vector3(-nearW, nearH, -near), new THREE.Vector3(nearW, nearH, -near),
          new THREE.Vector3(nearW, nearH, -near), new THREE.Vector3(nearW, -nearH, -near),
          new THREE.Vector3(nearW, -nearH, -near), new THREE.Vector3(-nearW, -nearH, -near),
          new THREE.Vector3(-nearW, -nearH, -near), new THREE.Vector3(-nearW, nearH, -near),
          new THREE.Vector3(-farW, farH, -far), new THREE.Vector3(farW, farH, -far),
          new THREE.Vector3(farW, farH, -far), new THREE.Vector3(farW, -farH, -far),
          new THREE.Vector3(farW, -farH, -far), new THREE.Vector3(-farW, -farH, -far),
          new THREE.Vector3(-farW, -farH, -far), new THREE.Vector3(-farW, farH, -far)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.LineSegments(geometry, frustumLineMat);
      };

      group.updateLogicCameraVisuals = () => {
        if (group.userData.cameraFrustumLines) {
          group.remove(group.userData.cameraFrustumLines);
          group.userData.cameraFrustumLines.geometry?.dispose?.();
        }
        const props = group.userData.logicProperties || this.logicProperties || {};
        const frustum = makeFrustum(Number(props.fov ?? 60), Number(props.far ?? 6), Number(props.aspect ?? 16 / 9));
        frustum.userData.ignoreRaycast = true;
        frustum.visible = window.location.pathname.includes("/editor");
        group.userData.cameraFrustumLines = frustum;
        group.add(frustum);

        helperMesh.visible = window.location.pathname.includes("/editor");
      };

      object3D = group;

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.logicKind === undefined) this.logicProperties.logicKind = "logic_camera";
      if (this.logicProperties.name === undefined) this.logicProperties.name = "Camara";
      if (this.logicProperties.mode === undefined) this.logicProperties.mode = "fixed";
      if (this.logicProperties.fov === undefined) this.logicProperties.fov = 60;
      if (this.logicProperties.far === undefined) this.logicProperties.far = 6;
      if (this.logicProperties.aspect === undefined) this.logicProperties.aspect = 16 / 9;
      if (this.logicProperties.eyeHeightOffset === undefined) this.logicProperties.eyeHeightOffset = 0;

      // Note: No collider for logic_camera to avoid physical interactions.
    } else if (this.type === "camera_panel") {
      const group = new THREE.Group();
      const panelColor = this.color !== undefined ? this.color : 0x0f172a;
      const frameMat = new THREE.MeshStandardMaterial({
        color: panelColor,
        roughness: 0.5,
        metalness: 0.1
      });
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x082f49,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        roughness: 0.25
      });

      const frame = new THREE.Mesh(new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z), frameMat);
      frame.castShadow = true;
      frame.receiveShadow = true;
      group.add(frame);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(this.scale.x * 0.72, this.scale.z * 0.58),
        screenMat
      );
      screen.position.y = this.scale.y / 2 + 0.004;
      screen.position.z = this.scale.z * 0.08;
      screen.rotation.x = -Math.PI / 2;
      group.add(screen);

      const keyPlate = new THREE.Mesh(
        new THREE.BoxGeometry(this.scale.x * 0.3, 0.02, this.scale.z * 0.13),
        new THREE.MeshBasicMaterial({ color: 0xe5e7eb })
      );
      keyPlate.position.set(0, this.scale.y / 2 + 0.012, -this.scale.z * 0.33);
      group.add(keyPlate);

      object3D = group;

      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.logicKind === undefined) this.logicProperties.logicKind = "camera_panel";
      if (this.logicProperties.name === undefined) this.logicProperties.name = "Panel de Camaras";
      if (!Array.isArray(this.logicProperties.cameraIds)) this.logicProperties.cameraIds = [];
      if (this.logicProperties.holdTime === undefined) this.logicProperties.holdTime = 0;
    } else if (this.type === "interactive_collision") {
      const shapeType = this.scale.shapeType || "box";
      const radius = this.scale.radius || 1.0;

      let geometry: any;
      let col: any;

      if (shapeType === "sphere") {
        geometry = new THREE.SphereGeometry(radius, 16, 16);
        col = RAPIER.ColliderDesc.ball(radius);
      } else {
        geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
        col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
      }

      const material = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.3,
        wireframe: false
      });
      object3D = new THREE.Mesh(geometry, material);

      const wiregeo = new THREE.EdgesGeometry(geometry);
      const wiremat = new THREE.LineBasicMaterial({ color: 0x00ffff });
      const wire = new THREE.LineSegments(wiregeo, wiremat);
      object3D.add(wire);

      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.isTraversable === undefined) this.logicProperties.isTraversable = false;
      if (this.logicProperties.triggerOnTouch === undefined) this.logicProperties.triggerOnTouch = false;
      if (this.logicProperties.triggerOnEnter === undefined) this.logicProperties.triggerOnEnter = false;

      this.logicProperties.shapeType = shapeType;
      this.logicProperties.radius = radius;

      object3D.userData.shapeType = shapeType;
      object3D.userData.radius = radius;
    } else if (this.type === "target") {
      const group: any = new THREE.Group();

      const radius = this.scale.x / 2 || 1.0;
      const ringsCount = this.logicProperties && this.logicProperties.rings !== undefined ? this.logicProperties.rings : 3;
      const thickness = this.scale.y || 0.2;

      group.updateTargetVisuals = () => {
        while (group.children.length > 0) {
          const child: any = group.children[0];
          group.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }

        const currentRings = group.userData.logicProperties && group.userData.logicProperties.rings ? group.userData.logicProperties.rings : 3;
        const dynamicRadius =
          group.userData.logicProperties && group.userData.logicProperties.radius ? group.userData.logicProperties.radius : radius;

        for (let i = 0; i < currentRings; i++) {
          const ringRadius = dynamicRadius * (1.0 - i / currentRings);

          const isRed = i % 2 === 0;
          const ringColor = isRed ? 0xff0000 : 0xffffff;

          const ringDepth = thickness + i * 0.01;

          const geo = new THREE.CylinderGeometry(ringRadius, ringRadius, ringDepth, 32);

          const mat = new THREE.MeshStandardMaterial({
            color: ringColor,
            roughness: 0.8,
            metalness: 0.1
          });

          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.position.y = i * 0.001;

          mesh.userData.ringIndex = i;

          group.add(mesh);
        }
      };

      group.userData.logicProperties = this.logicProperties || {};
      group.updateTargetVisuals();

      object3D = group;

      const initialRadius = this.logicProperties && this.logicProperties.radius ? this.logicProperties.radius : radius;
      const col = RAPIER.ColliderDesc.cylinder(thickness / 2, initialRadius);
      collidersDesc.push(col);
    } else if (this.type === "impulse_jump" || this.type === "impulse_lateral") {
      const isJump = this.type === "impulse_jump";
      const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
      const defaultColor = isJump ? 0x00ffff : 0x00ff00;
      const padColor = this.color !== undefined ? this.color : defaultColor;
      
      const parsedColor = new THREE.Color(padColor);
      const emissiveColor = parsedColor.clone().multiplyScalar(0.25);

      const material = new THREE.MeshStandardMaterial({
        color: padColor,
        roughness: 0.8,
        emissive: emissiveColor,
        emissiveIntensity: 0.35
      });

      object3D = new THREE.Mesh(geometry, material);
      object3D.receiveShadow = true;

      const texturePath = isJump ? "/assets/textures/salto.png" : "/assets/textures/impulso.png";
      const arrowGeometry = new THREE.PlaneGeometry(this.scale.x * 0.8, this.scale.z * 0.8);
      const arrowMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      MapAssetManager.loadTexture(texturePath).then((texture) => {
        arrowMaterial.map = texture;
        arrowMaterial.needsUpdate = true;
      }).catch((err) => {
        console.error("Failed to load pad texture:", texturePath, err);
      });
      const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrowMesh.position.y = this.scale.y / 2 + 0.01;
      arrowMesh.rotation.x = -Math.PI / 2;
      if (!isJump) arrowMesh.rotation.z = 0;
      object3D.add(arrowMesh);

      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2).setSensor(true);
      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.strength === undefined) this.logicProperties.strength = isJump ? 25 : 40;
      if (this.logicProperties.cooldown === undefined) this.logicProperties.cooldown = 0.25;
      this.logicProperties.padKind = isJump ? "jump" : "lateral";
    } else if (this.type === "farming_zone") {
      const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
      const material = new THREE.MeshStandardMaterial({
        color: this.color || 0xff4500,
        roughness: 0.8,
        transparent: true,
        opacity: this.opacity !== undefined ? this.opacity : 0.7,
        emissive: 0x552000,
        emissiveIntensity: 0.25
      });

      object3D = new THREE.Mesh(geometry, material);
      object3D.receiveShadow = true;

      const wiregeo = new THREE.EdgesGeometry(geometry);
      const wiremat = new THREE.LineBasicMaterial({ color: 0xffaa00 });
      const wire = new THREE.LineSegments(wiregeo, wiremat);
      object3D.add(wire);

      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2).setSensor(true);
      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.spawnInterval === undefined) this.logicProperties.spawnInterval = 1.0;
      if (this.logicProperties.itemsPerSpawn === undefined) this.logicProperties.itemsPerSpawn = 1;
      if (this.logicProperties.itemValue === undefined) this.logicProperties.itemValue = 1;
    } else if (this.type === "ladder") {
      const height = this.scale.y;
      const width = this.scale.x;

      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.7 });

      const railGeo = new THREE.BoxGeometry(0.1, height, 0.1);
      const leftRail = new THREE.Mesh(railGeo, mat);
      leftRail.position.set(-width / 2, 0, 0);

      const rightRail = new THREE.Mesh(railGeo, mat);
      rightRail.position.set(width / 2, 0, 0);

      leftRail.castShadow = true;
      leftRail.receiveShadow = true;
      rightRail.castShadow = true;
      rightRail.receiveShadow = true;

      group.add(leftRail);
      group.add(rightRail);

      const rungCount = Math.floor(height / 0.4);
      const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, width, 8);
      rungGeo.rotateZ(Math.PI / 2);

      for (let i = 0; i < rungCount; i++) {
        const rung = new THREE.Mesh(rungGeo, mat);
        rung.position.set(0, -height / 2 + (i + 1) * 0.4, 0);
        rung.castShadow = true;
        group.add(rung);
      }

      object3D = group;

      object3D.bounds = new THREE.Box3();

      object3D.userData.isLadder = true;

      object3D.userData.needsBoundsUpdate = true;

      const col = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 0.2).setSensor(true);
      collidersDesc.push(col);

      const railHalfW = 0.05;
      const railHalfH = height / 2;
      const railHalfD = 0.05;

      const leftRailCol = RAPIER.ColliderDesc.cuboid(railHalfW, railHalfH, railHalfD).setTranslation(-width / 2, 0, 0);
      collidersDesc.push(leftRailCol);

      const rightRailCol = RAPIER.ColliderDesc.cuboid(railHalfW, railHalfH, railHalfD).setTranslation(width / 2, 0, 0);
      collidersDesc.push(rightRailCol);
    } else if (this.type === "gravity_sphere") {
      const radius = this.scale.radius !== undefined ? this.scale.radius : (this.scale.x / 2 || 0.75);
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const matColor = this.color !== undefined ? this.color : 0x9C27B0;
      const material = new THREE.MeshStandardMaterial({
        color: matColor,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x4a148c,
        emissiveIntensity: 0.4
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.2, 0.05, 16, 100),
        new THREE.MeshBasicMaterial({ color: 0xe040fb, transparent: true, opacity: 0.8 })
      );
      ring.rotation.x = Math.PI / 2;
      mesh.add(ring);

      object3D = mesh;

      const col = RAPIER.ColliderDesc.ball(radius);
      collidersDesc.push(col);

      if (!this.logicProperties) this.logicProperties = {};
      if (this.logicProperties.holdTime === undefined) this.logicProperties.holdTime = 0.5;
      if (this.logicProperties.oneShot === undefined) this.logicProperties.oneShot = false;
      if (this.logicProperties.pulsationMode === undefined) this.logicProperties.pulsationMode = false;
      if (this.logicProperties.triggered === undefined) this.logicProperties.triggered = false;
    } else if (this.type === "sphere") {
      const radius = this.scale.radius !== undefined ? this.scale.radius : (this.scale.x / 2 || 1.0);
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: this.opacity !== undefined && this.opacity < 1.0,
        opacity: this.opacity !== undefined ? this.opacity : 1.0
      });
      object3D = new THREE.Mesh(geometry, material);
      object3D.castShadow = true;
      object3D.receiveShadow = true;

      const col = RAPIER.ColliderDesc.ball(radius);
      collidersDesc.push(col);

      object3D.userData.shapeType = "sphere";
      object3D.userData.radius = radius;
    } else if (this.type === "cylinder") {
      const radius = this.scale.radius !== undefined ? this.scale.radius : (this.scale.x / 2 || 1.0);
      const height = this.scale.y || 1.0;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: this.opacity !== undefined && this.opacity < 1.0,
        opacity: this.opacity !== undefined ? this.opacity : 1.0
      });
      object3D = new THREE.Mesh(geometry, material);
      object3D.castShadow = true;
      object3D.receiveShadow = true;

      const col = RAPIER.ColliderDesc.cylinder(height / 2, radius);
      collidersDesc.push(col);

      object3D.userData.shapeType = "cylinder";
      object3D.userData.radius = radius;
    } else if (this.type === "circle") {
      const radius = this.scale.radius !== undefined ? this.scale.radius : (this.scale.x / 2 || 1.0);
      const height = this.scale.y !== undefined ? this.scale.y : 0.05;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: this.opacity !== undefined && this.opacity < 1.0,
        opacity: this.opacity !== undefined ? this.opacity : 1.0
      });
      object3D = new THREE.Mesh(geometry, material);
      object3D.castShadow = true;
      object3D.receiveShadow = true;

      const col = RAPIER.ColliderDesc.cylinder(height / 2, radius);
      collidersDesc.push(col);

      object3D.userData.shapeType = "circle";
      object3D.userData.radius = radius;
    } else if (this.type === "tube") {
      const radius = this.scale.radius !== undefined ? this.scale.radius : 0.5;
      const segments = getTubeSegments(this.scale);

      const group = new THREE.Group();
      let parentGroup = group;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segLength = seg.length || 2.0;

        const material = new THREE.MeshStandardMaterial({
          color: this.color,
          transparent: this.opacity !== undefined && this.opacity < 1.0,
          opacity: this.opacity !== undefined ? this.opacity : 1.0
        });

        // Cylinder mesh
        const cylGeo = new THREE.CylinderGeometry(radius, radius, segLength, 32);
        const mesh = new THREE.Mesh(cylGeo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isTubeSegment = true;
        mesh.userData.segmentIndex = i;
        mesh.position.set(0, segLength / 2, 0);
        parentGroup.add(mesh);

        // Load segment texture asynchronously
        const segTexPath = seg.texturePath || this.texturePath;
        if (segTexPath) {
          MapAssetManager.loadTexture(segTexPath)
            .then((texture) => {
              applyMapObjectTexture(mesh, texture, this.scale, this.textureSettings);
            })
            .catch(err => console.error("Failed to load segment texture:", err));
        }

        let elbowMesh: THREE.Mesh | null = null;
        if (i < segments.length - 1) {
          const elbowGeo = new THREE.SphereGeometry(radius, 32, 32);
          elbowMesh = new THREE.Mesh(elbowGeo, material);
          elbowMesh.castShadow = true;
          elbowMesh.receiveShadow = true;
          elbowMesh.userData.isTubeElbow = true;
          elbowMesh.userData.segmentIndex = i;
          elbowMesh.position.set(0, segLength, 0);
          parentGroup.add(elbowMesh);

          if (segTexPath) {
            MapAssetManager.loadTexture(segTexPath)
              .then((texture) => {
                if (elbowMesh) applyMapObjectTexture(elbowMesh, texture, this.scale, this.textureSettings);
              })
              .catch(err => {});
          }

          // Next group
          const nextSeg = segments[i + 1];
          const childGroup = new THREE.Group();
          childGroup.position.set(0, segLength, 0);
          childGroup.rotation.set(
            (nextSeg.bendAngleX || 0) * Math.PI / 180,
            (nextSeg.bendAngleY || 0) * Math.PI / 180,
            0,
            "YXZ"
          );
          childGroup.userData.isTubeGroup = true;
          childGroup.userData.segmentIndex = i + 1;
          parentGroup.add(childGroup);
          parentGroup = childGroup;
        }
      }

      object3D = group;

      // Extract absolute local matrices to register colliders in Rapier
      group.updateMatrixWorld(true);
      group.traverse((child: any) => {
        if (child.isMesh && (child.userData.isTubeSegment || child.userData.isTubeElbow)) {
          const localMat = group.matrixWorld.clone().invert().multiply(child.matrixWorld);
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scaleVec = new THREE.Vector3();
          localMat.decompose(pos, quat, scaleVec);

          if (child.userData.isTubeSegment) {
            const idx = child.userData.segmentIndex;
            const segLength = segments[idx].length || 2.0;
            const col = RAPIER.ColliderDesc.cylinder(segLength / 2, radius)
              .setTranslation(pos.x, pos.y, pos.z)
              .setRotation(quat);
            collidersDesc.push(col);
          } else if (child.userData.isTubeElbow) {
            const col = RAPIER.ColliderDesc.ball(radius)
              .setTranslation(pos.x, pos.y, pos.z);
            collidersDesc.push(col);
          }
        }
      });

      object3D.userData.shapeType = "tube";
    } else {
      const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
      const material = new THREE.MeshStandardMaterial({
        color: this.color,
        transparent: this.opacity !== undefined && this.opacity < 1.0,
        opacity: this.opacity !== undefined ? this.opacity : 1.0
      });
      object3D = new THREE.Mesh(geometry, material);
      object3D.castShadow = true;
      object3D.receiveShadow = true;

      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
      collidersDesc.push(col);
    }

    object3D.position.copy(position);
    if (this.type !== "interaction_button" && this.type !== "spawn_point" && this.type !== "tube" && !isCenterPosition) {
      object3D.position.y += this.scale.y / 2;
    }

    object3D.rotation.copy(rotation);
    object3D.scale.set(1, 1, 1);

    if (this.texturePath) {
      MapAssetManager.loadTexture(this.texturePath)
        .then((texture) => {
          applyMapObjectTexture(object3D, texture, this.scale, this.textureSettings);
        })
        .catch((err) => {
          console.error("Failed to load map object texture:", this.texturePath, err);
        });
    }

    object3D.userData.isEditableMapObject = true;
    object3D.userData.isMapObject = true;
    object3D.userData.mapObjectType = this.type;
    object3D.userData.customName = this.name || "";
    object3D.userData.uuid = THREE.MathUtils.generateUUID();
    object3D.userData.originalUUID = object3D.userData.uuid;
    object3D.userData.color = this.color;
    object3D.userData.opacity = this.opacity !== undefined ? this.opacity : 1.0;
    object3D.userData.originalScale = { ...this.scale };
    object3D.userData.originalRotY = object3D.rotation.y;
    object3D.userData.texturePath = this.texturePath;
    object3D.userData.textureAssetId = this.textureAssetId;
    object3D.userData.textureSettings = { ...this.textureSettings };

    if (this.logicProperties) {
      object3D.userData.logicProperties = { ...this.logicProperties };
    }

    if (typeof object3D.updateLogicCameraVisuals === "function") {
      object3D.updateLogicCameraVisuals();
    }

    scene.add(object3D);

    if (world && RAPIER) {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(object3D.position.x, object3D.position.y, object3D.position.z)
        .setRotation(object3D.quaternion);

      const rigidBody = world.createRigidBody(bodyDesc);

      object3D.userData.rigidBody = rigidBody;

      collidersDesc.forEach((col: any) => {
        world.createCollider(col, rigidBody);
      });
    }

    if (object3D.userData.needsBoundsUpdate) {
      object3D.updateMatrix();

      object3D.matrixWorld.copy(object3D.matrix);
      const children = object3D.children;
      for (let i = 0, l = children.length; i < l; i++) {
        children[i].updateMatrixWorld(true);
      }

      object3D.bounds.setFromObject(object3D);

      object3D.bounds.max.y += 0.5;
      object3D.bounds.expandByScalar(0.5);
    }

    console.log(`Spawned ${this.type} at`, position);
  }
}
