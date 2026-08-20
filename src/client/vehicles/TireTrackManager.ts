import * as THREE from 'three';

export interface SkidSegment {
  mesh: THREE.Mesh;
  createdAt: number;
  lifetime: number;
  initialOpacity: number;
  age: number;
}

interface TrackPoint {
  left: THREE.Vector3;
  right: THREE.Vector3;
  center: THREE.Vector3;
}

export class TireTrackManager {
  private scene: THREE.Scene;
  private activeSegments: SkidSegment[] = [];
  private lastPoints = new Map<string, TrackPoint>();
  private tireTexture: THREE.DataTexture;
  private maxSegments = 350;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tireTexture = this.createTireTexture();
  }

  /**
   * Crea una textura procedural de 16x16 que simula la huella de caucho de un neumático
   * con estrías longitudinales y bordes suavizados para evitar bordes rígidos.
   */
  private createTireTexture(): THREE.DataTexture {
    const width = 16;
    const height = 16;
    const size = width * height * 4;
    const data = new Uint8Array(size);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        // Estrías: x=0 borde, x=3 ranura, x=8 ranura central, x=13 ranura, x=15 borde
        let alpha = 230;
        if (x === 0 || x === 15) alpha = 30;
        else if (x === 1 || x === 14) alpha = 130;
        else if (x === 3 || x === 8 || x === 13) alpha = 70;
        else if (x === 4 || x === 7 || x === 9 || x === 12) alpha = 240;

        // Color de caucho oscuro quemado
        data[index] = 18;       // R
        data[index + 1] = 18;   // G
        data[index + 2] = 18;   // B
        data[index + 3] = alpha; // A
      }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Registra un punto de contacto de la rueda trasera contra el suelo para formar
   * una tira continua de huella de neumático.
   */
  addTirePoint(
    trackId: string,
    groundPos: THREE.Vector3,
    groundNormal: THREE.Vector3,
    forwardDir: THREE.Vector3,
    width = 0.16,
    duration = 4,
    opacity = 0.75
  ) {
    if (!this.scene) return;

    // Calcular vector lateral perpendicular al avance y a la normal del suelo
    const lateral = new THREE.Vector3().crossVectors(forwardDir, groundNormal).normalize().multiplyScalar(width * 0.5);
    if (lateral.lengthSq() < 0.0001) {
      lateral.set(width * 0.5, 0, 0);
    }

    // Elevar ligeramente sobre el suelo (1.5 cm) para evitar z-fighting con el terreno
    const surfaceOffset = groundNormal.clone().normalize().multiplyScalar(0.015);
    const center = groundPos.clone().add(surfaceOffset);
    const left = center.clone().sub(lateral);
    const right = center.clone().add(lateral);

    const prev = this.lastPoints.get(trackId);
    if (!prev) {
      this.lastPoints.set(trackId, { left, right, center });
      return;
    }

    const dist = prev.center.distanceTo(center);
    // Evitar generar geometría redundante si no ha habido suficiente desplazamiento (mínimo 8 cm)
    if (dist < 0.08) return;

    // Si hubo un salto brusco de distancia (teletransporte, respawn), reiniciar el trazo
    if (dist > 3.0) {
      this.lastPoints.set(trackId, { left, right, center });
      return;
    }

    // Calcular vector lateral perpendicular a la dirección real de desplazamiento
    const moveDir = center.clone().sub(prev.center).normalize();
    let curLateral = new THREE.Vector3().crossVectors(moveDir, groundNormal).normalize().multiplyScalar(width * 0.5);
    if (curLateral.lengthSq() < 0.0001) {
      curLateral = lateral;
    }
    const curLeft = center.clone().sub(curLateral);
    const curRight = center.clone().add(curLateral);

    // Construir quad con 2 triángulos que conectan el punto anterior con el actual
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      prev.left.x, prev.left.y, prev.left.z,
      prev.right.x, prev.right.y, prev.right.z,
      curRight.x, curRight.y, curRight.z,
      curLeft.x, curLeft.y, curLeft.z,
    ]);

    const normals = new Float32Array([
      groundNormal.x, groundNormal.y, groundNormal.z,
      groundNormal.x, groundNormal.y, groundNormal.z,
      groundNormal.x, groundNormal.y, groundNormal.z,
      groundNormal.x, groundNormal.y, groundNormal.z,
    ]);

    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]);

    const indices = [0, 1, 2, 0, 2, 3];

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
      color: 0x181818,
      map: this.tireTexture,
      transparent: true,
      opacity: Math.max(0.1, Math.min(1, opacity)),
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    this.scene.add(mesh);

    const segment: SkidSegment = {
      mesh,
      createdAt: Date.now(),
      lifetime: Math.max(0.5, duration),
      initialOpacity: material.opacity,
      age: 0
    };

    this.activeSegments.push(segment);
    this.lastPoints.set(trackId, { left: curLeft, right: curRight, center });

    // Mantener límite de segmentos para rendimiento óptimo
    if (this.activeSegments.length > this.maxSegments) {
      const oldest = this.activeSegments.shift();
      if (oldest) this.destroySegment(oldest);
    }
  }

  /**
   * Finaliza el trazo actual de un vehículo (por ejemplo al soltar Shift o quedar en el aire),
   * de modo que el próximo derrape no dibuje una línea flotante.
   */
  endTrack(trackId: string) {
    this.lastPoints.delete(trackId);
  }

  /**
   * Actualiza el tiempo de vida y el desvanecimiento de todas las marcas de derrape activas.
   */
  update(dt: number) {
    if (dt <= 0) return;

    for (let i = this.activeSegments.length - 1; i >= 0; i--) {
      const seg = this.activeSegments[i];
      seg.age += dt;

      if (seg.age >= seg.lifetime) {
        this.destroySegment(seg);
        this.activeSegments.splice(i, 1);
        continue;
      }

      // Permanece fija y visible durante el primer 40% de su duración,
      // y luego se desvanece suavemente a 0 durante el 60% restante.
      const fadeStart = seg.lifetime * 0.4;
      if (seg.age > fadeStart) {
        const progress = (seg.age - fadeStart) / Math.max(0.01, seg.lifetime - fadeStart);
        const fade = 1 - Math.min(1, Math.max(0, progress));
        const mat = seg.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = seg.initialOpacity * fade;
      }
    }
  }

  private destroySegment(segment: SkidSegment) {
    if (segment.mesh.parent) {
      segment.mesh.parent.remove(segment.mesh);
    }
    segment.mesh.geometry.dispose();
    if (Array.isArray(segment.mesh.material)) {
      segment.mesh.material.forEach(m => m.dispose());
    } else {
      segment.mesh.material.dispose();
    }
  }

  /**
   * Limpia todas las marcas de derrape asociadas a un vehículo o todas en general.
   */
  clear(trackId?: string) {
    if (trackId) {
      this.lastPoints.delete(trackId);
    } else {
      this.lastPoints.clear();
      for (const seg of this.activeSegments) {
        this.destroySegment(seg);
      }
      this.activeSegments.length = 0;
    }
  }

  dispose() {
    this.clear();
    this.tireTexture.dispose();
  }

  /** Cantidad de segmentos activos en el mundo (usado para pruebas y monitoreo). */
  get segmentCount(): number {
    return this.activeSegments.length;
  }
}
