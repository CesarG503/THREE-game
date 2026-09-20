import * as THREE from 'three';
import { MapAssetManager } from '../map/MapAssetManager';

const NEON_VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEON_FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec2 uDimensions;
  varying vec2 vUv;

  void main() {
    // Aspect-ratio aware repeating: about 1.25 meters per chevron along length Z (uDimensions.y)
    float chevronSpacing = 1.25;
    float countY = max(1.0, uDimensions.y / chevronSpacing);
    vec2 st = vec2(vUv.x, vUv.y * countY);

    // 1. VIVID NEON GRADIENT (Yellow -> Orange -> Red) across width X
    // Left: Neon Yellow (#FFF000), Center: Vibrant Orange (#FF5500), Right: Hot Red (#FF001E)
    vec3 colYellow = vec3(1.0, 0.94, 0.0);
    vec3 colOrange = vec3(1.0, 0.38, 0.0);
    vec3 colRed    = vec3(1.0, 0.04, 0.1);

    vec3 bgGrad = vUv.x < 0.5 
      ? mix(colYellow, colOrange, vUv.x * 2.0)
      : mix(colOrange, colRed, (vUv.x - 0.5) * 2.0);

    // 2. MOVING TWO-COLOR BACKGROUND ("fondo de movimiento dos colores")
    // Longitudinal ridges across width X
    float ridges = sin(vUv.x * 3.14159 * 26.0) * 0.5 + 0.5;
    ridges = pow(ridges, 1.35);

    // Fast moving energy waves flowing forward along length Y
    float wave = sin(st.y * 3.14159 * 3.2 - uTime * 6.5) * 0.5 + 0.5;

    // Moving background blending two radiant tones: saturated warm base vs electric hot neon pulse
    vec3 bgCol = mix(bgGrad * (0.72 + 0.28 * ridges), bgGrad * 1.38 + vec3(0.08, 0.04, 0.0), wave * 0.42);

    // 3. GLOWING CHEVRON ARROWS ("con una flecha como la imagen con movimiento")
    // Continuous forward motion along Y in boost direction
    float scrollSpeed = 2.4;
    float scrollY = st.y - uTime * scrollSpeed;
    float cellY = fract(scrollY);

    // Chevron geometry: symmetrical V pointing forward (+Y in local plane = -Z world forward)
    float xDist = abs(vUv.x - 0.5) * 2.0; // 0.0 at center, 1.0 at margins
    float chevronSpan = smoothstep(0.88, 0.76, xDist); // Chevrons stay centered within ~80% width

    // V-slope: center is 0.35 ahead of the outer wings
    float vSlope = 0.35;
    float peakY = (1.0 - xDist) * vSlope;
    float arrowDist = fract(cellY - peakY);

    // Sharp white core and soft glow
    float thickness = 0.14;
    float chevronCore = smoothstep(0.0, 0.02, arrowDist) * smoothstep(thickness, thickness - 0.02, arrowDist);
    chevronCore *= chevronSpan;

    float chevronAura = smoothstep(0.0, 0.07, arrowDist) * smoothstep(thickness + 0.07, thickness, arrowDist);
    chevronAura *= chevronSpan;

    vec3 arrowColor = vec3(1.0, 1.0, 1.0);
    vec3 auraColor = vec3(1.0, 0.96, 0.85);

    // Composite background, luminous white chevron, and aura
    vec3 finalColor = mix(bgCol, arrowColor, chevronCore * 0.95);
    finalColor += auraColor * chevronAura * 0.38;

    // Soft border edges
    float edgeX = smoothstep(0.0, 0.02, vUv.x) * smoothstep(1.0, 0.98, vUv.x);
    float edgeY = smoothstep(0.0, 0.02, vUv.y) * smoothstep(1.0, 0.98, vUv.y);
    finalColor *= edgeX * edgeY;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class NeonImpulseVisual {
  readonly surfaceMesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(private pad: THREE.Object3D, private dims: { x: number; y: number; z: number }) {
    this.dims = { ...dims };

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDimensions: { value: new THREE.Vector2(dims.x, dims.z) }
      },
      vertexShader: NEON_VERTEX_SHADER,
      fragmentShader: NEON_FRAGMENT_SHADER,
      side: THREE.DoubleSide
    });

    this.material.onBeforeRender = () => {
      this.material.uniforms.uTime.value = performance.now() / 1000;
    };

    const planeW = Math.max(0.1, dims.x - 0.14);
    const planeD = Math.max(0.1, dims.z - 0.14);
    const planeGeo = new THREE.PlaneGeometry(planeW, planeD);
    this.surfaceMesh = new THREE.Mesh(planeGeo, this.material);
    this.surfaceMesh.name = "neonPadSurfaceMesh";
    this.surfaceMesh.userData.isNeonPadSurface = true;
    this.surfaceMesh.position.y = dims.y / 2 + 0.005;
    this.surfaceMesh.rotation.x = -Math.PI / 2;
    this.surfaceMesh.receiveShadow = false;

    this.pad.add(this.surfaceMesh);
    this.pad.userData.neonVisual = this;
  }

  update(dims: { x: number; y: number; z: number }) {
    this.dims = { ...dims };
    this.material.uniforms.uDimensions.value.set(dims.x, dims.z);
    this.surfaceMesh.position.y = dims.y / 2 + 0.005;
    this.surfaceMesh.geometry.dispose();
    const planeW = Math.max(0.1, dims.x - 0.14);
    const planeD = Math.max(0.1, dims.z - 0.14);
    this.surfaceMesh.geometry = new THREE.PlaneGeometry(planeW, planeD);
  }

  dispose() {
    this.surfaceMesh.geometry.dispose();
    this.material.dispose();
    this.pad.remove(this.surfaceMesh);
    delete this.pad.userData.neonVisual;
  }
}

/**
 * Updates the visuals of jump pads, lateral pads, and neon pads
 * (scaling arrow geometry, adjusting height, and swapping or hiding textures).
 */
export function updateImpulsePadVisuals(object: THREE.Object3D, dims?: { x: number; y: number; z: number }) {
  if (!object) return;
  const type = object.userData.mapObjectType;
  const currentDims = dims || object.userData.originalScale || { x: 3, y: 0.10, z: 3 };
  const props = object.userData.logicProperties || {};

  if (type === "impulse_neon") {
    if (object.userData.neonVisual) {
      object.userData.neonVisual.update(currentDims);
    } else {
      new NeonImpulseVisual(object, currentDims);
    }
    return;
  }

  if (type !== "impulse_jump" && type !== "impulse_lateral") return;

  const arrowMesh = object.children.find((c: any) => c.name === "padArrowMesh" || c.userData?.isPadArrow) as THREE.Mesh | undefined;
  if (!arrowMesh) return;

  // 1. Visibility toggle
  const showImage = props.showImage !== false;
  arrowMesh.visible = showImage;

  // 2. Texture update (default vs custom/gallery)
  if (showImage) {
    const isJump = type === "impulse_jump";
    const defaultTex = isJump ? "/assets/textures/salto.png" : "/assets/textures/impulso.png";
    const targetTex = props.customImage ? props.customImage : defaultTex;

    if (arrowMesh.userData.currentLoadedTex !== targetTex) {
      arrowMesh.userData.currentLoadedTex = targetTex;
      MapAssetManager.loadTexture(targetTex)
        .then((tex) => {
          (arrowMesh.material as THREE.MeshBasicMaterial).map = tex;
          (arrowMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        })
        .catch((err) => {
          console.error("Failed to load pad texture:", targetTex, err);
        });
    }
  }

  // 3. Keep arrow on top surface and scale to pad proportions
  arrowMesh.position.y = currentDims.y / 2 + 0.005;
  arrowMesh.geometry.dispose();
  arrowMesh.geometry = new THREE.PlaneGeometry(currentDims.x * 0.8, currentDims.z * 0.8);
}
