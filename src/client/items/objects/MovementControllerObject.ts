import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { MapObjectItem } from "./MapObjectItem";
import type { ItemContext } from "../../types";

export class MovementControllerObject extends MapObjectItem {
  generateIcon(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#" + new THREE.Color(this.color).getHexString();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

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

    return canvas.toDataURL();
  }

  build3D(world: RAPIER.World | null) {
    const geometry = new THREE.SphereGeometry(this.scale.x, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.7,
      wireframe: true
    });
    const mesh = new THREE.Mesh(geometry, material);

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(this.scale.x, this.scale.x, this.scale.x),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    mesh.add(core);

    const colliders: RAPIER.ColliderDesc[] = [];
    if (RAPIER) {
      const col = RAPIER.ColliderDesc.ball(this.scale.x);
      colliders.push(col);
    }

    return { mesh, colliders };
  }

  use(context: ItemContext): boolean {
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
}
