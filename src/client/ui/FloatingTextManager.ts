import * as THREE from "three";
import type { FloatingTextItem } from "../types";

export class FloatingTextManager {
  sceneManager: any;
  container: HTMLElement;
  texts: FloatingTextItem[];

  constructor(sceneManager: any) {
    this.sceneManager = sceneManager;
    this.container = document.createElement("div");
    this.container.id = "floating-text-container";
    this.container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 50;
        `;
    document.body.appendChild(this.container);
    this.texts = [];

    const style = document.createElement("style");
    style.innerHTML = `
            @keyframes damageFloat {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                20% { transform: translate(-50%, -100%) scale(1.5); opacity: 1; }
                100% { transform: translate(-50%, -200%) scale(1); opacity: 0; }
            }
            .damage-text {
                position: absolute;
                font-family: 'Arial', sans-serif;
                font-weight: 900;
                font-size: 32px;
                text-align: center;
                user-select: none;
                text-shadow:
                    -2px -2px 0 #000,
                     2px -2px 0 #000,
                    -2px  2px 0 #000,
                     2px  2px 0 #000,
                     0px  4px 8px rgba(0,0,0,0.5);
                animation: damageFloat 1s forwards cubic-bezier(0.2, 0.8, 0.2, 1);
            }
        `;
    document.head.appendChild(style);
  }

  spawnText(text: string | number, position3D: THREE.Vector3, color = "#ff4444", duration = 1.0) {
    const el = document.createElement("div");
    el.className = "damage-text";
    el.textContent = text.toString();
    el.style.color = color;
    el.style.animationDuration = `${duration}s`;

    this.container.appendChild(el);

    const textObj: FloatingTextItem = {
      el,
      pos3D: position3D.clone(),
      life: duration,
      maxLife: duration
    };

    this.texts.push(textObj);
  }

  update(dt: number) {
    const camera = this.sceneManager.camera;

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;

      if (t.life <= 0) {
        t.el.remove();
        this.texts.splice(i, 1);
        continue;
      }

      t.pos3D.y += dt * 1.5;

      const vec = t.pos3D.clone();
      vec.project(camera);

      if (vec.z < 1) {
        const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
        const y = -vec.y * 0.5 * window.innerHeight + 0.5 * window.innerHeight;
        t.el.style.left = `${x}px`;
        t.el.style.top = `${y}px`;
        t.el.style.display = "block";
      } else {
        t.el.style.display = "none";
      }
    }
  }
}
