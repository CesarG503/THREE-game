import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";

export class ImpulsePadObject extends MapObjectItem {
  generateIcon(): string {
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
    if (!ctx) return "";

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#" + new THREE.Color(this.color).getHexString();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

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

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
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

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;

    const textureLoader = new THREE.TextureLoader();
    const texturePath = isJump ? "/assets/textures/salto.png" : "/assets/textures/impulso.png";
    const texture = textureLoader.load(texturePath);
    const arrowGeometry = new THREE.PlaneGeometry(this.scale.x * 0.8, this.scale.z * 0.8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrowMesh.position.y = this.scale.y / 2 + 0.01;
    arrowMesh.rotation.x = -Math.PI / 2;
    if (!isJump) arrowMesh.rotation.z = 0;
    mesh.add(arrowMesh);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2).setSensor(true);
      colliders.push(col);
    }

    if (!this.logicProperties) this.logicProperties = {};
    if (this.logicProperties.strength === undefined) this.logicProperties.strength = isJump ? 25 : 40;
    if (this.logicProperties.cooldown === undefined) this.logicProperties.cooldown = 0.25;
    this.logicProperties.padKind = isJump ? "jump" : "lateral";

    return { mesh, colliders };
  }
}
