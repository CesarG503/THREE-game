import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";
import type { ItemContext } from "../../types";

export class InteractiveCollisionObject extends MapObjectItem {
  generateIcon(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.clearRect(0, 0, 64, 64);
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

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const shapeType = this.scale.shapeType || "box";
    const radius = this.scale.radius || 1.0;

    let geometry: THREE.BufferGeometry;
    let col: RAPIER.ColliderDesc | null = null;

    if (shapeType === "sphere") {
      geometry = new THREE.SphereGeometry(radius, 16, 16);
      if (RAPIER) col = RAPIER.ColliderDesc.ball(radius);
    } else {
      geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z);
      if (RAPIER) col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2);
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.3,
      wireframe: false
    });
    const mesh = new THREE.Mesh(geometry, material);

    const wiregeo = new THREE.EdgesGeometry(geometry);
    const wiremat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const wire = new THREE.LineSegments(wiregeo, wiremat);
    mesh.add(wire);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (col) {
      colliders.push(col);
    }

    if (!this.logicProperties) this.logicProperties = {};
    if (this.logicProperties.isTraversable === undefined) this.logicProperties.isTraversable = false;
    if (this.logicProperties.triggerOnTouch === undefined) this.logicProperties.triggerOnTouch = false;
    if (this.logicProperties.triggerOnEnter === undefined) this.logicProperties.triggerOnEnter = false;

    this.logicProperties.shapeType = shapeType;
    this.logicProperties.radius = radius;

    mesh.userData.shapeType = shapeType;
    mesh.userData.radius = radius;

    return { mesh, colliders };
  }

  use(context: ItemContext): boolean {
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
        const diameter = (this.scale.radius ?? 1.0) * 2;
        this.scale.x = diameter;
        this.scale.y = diameter;
        this.scale.z = diameter;
      }
    }

    return super.use(context);
  }
}
