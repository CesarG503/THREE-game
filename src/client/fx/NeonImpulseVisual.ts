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
  uniform float uArrowColumns;
  uniform float uArrowSpanMode;
  uniform float uOvalDensity;
  varying vec2 vUv;

  void main() {
    // Physical coordinates in meters
    float worldX = vUv.x * uDimensions.x;
    float worldY = vUv.y * uDimensions.y;

    // 1. VIVID NEON GRADIENT (Yellow -> Orange -> Red) across width X
    // Left: Neon Yellow (#FFE600), Center: Vibrant Orange (#FF5500), Right: Hot Red (#FF0020)
    vec3 colYellow = vec3(1.0, 0.90, 0.0);
    vec3 colOrange = vec3(1.0, 0.35, 0.0);
    vec3 colRed    = vec3(1.0, 0.02, 0.12);

    vec3 bgGrad = vUv.x < 0.5 
      ? mix(colYellow, colOrange, vUv.x * 2.0)
      : mix(colOrange, colRed, (vUv.x - 0.5) * 2.0);

    // 2. BACKGROUND WITH THIN OVALS (Never round circles)
    // Ridge frequency scales with physical width so ovals stay thin (~0.07m wide)
    float dens = max(6.0, uOvalDensity);
    float totalOvals = max(8.0, floor(uDimensions.x * dens + 0.5));
    
    // Thin longitudinal ridges across width X
    float ridgePhase = vUv.x * totalOvals * 6.2831853;
    float ridges = sin(ridgePhase) * 0.5 + 0.5;
    ridges = pow(ridges, 1.35);

    // Dynamic wave moving forward along length Y with subtle chevron slant
    float colCount = uArrowColumns < 0.5 ? max(1.0, floor(uDimensions.x / 1.5 + 0.35)) : max(1.0, floor(uArrowColumns + 0.5));
    float laneUvX = fract(vUv.x * colCount);
    float laneSlant = abs(laneUvX - 0.5) * 0.35;
    
    // Wave moves along length Y at ~2.2 waves per 2 meters, scrolling forward
    float wavePhase = (worldY - laneSlant) * (3.14159265 * 2.2) - uTime * 6.2;
    float wave = sin(wavePhase) * 0.5 + 0.5;

    // Moving background blending two radiant tones: saturated base vs electric pulse
    vec3 bgCol = mix(bgGrad * (0.68 + 0.32 * ridges), bgGrad * 1.40 + vec3(0.08, 0.04, 0.0), wave * 0.45);

    // 3. SHARP CHEVRON ARROWS (Aspect-corrected, configurable columns)
    float cols = colCount;
    float colWidth = uDimensions.x / cols;
    float colIdx = clamp(floor(vUv.x * cols), 0.0, cols - 1.0);
    float localColX = (vUv.x * cols - colIdx) * colWidth;
    float distFromColCenter = abs(localColX - colWidth * 0.5);

    // Arrow half-width in meters: proportional clamp (max 0.75m = 1.5m arrow) or expand
    float maxHalfWidth = (uArrowSpanMode > 0.5) 
      ? (colWidth * 0.43) 
      : min(colWidth * 0.43, 0.75);

    float arrowSpanMask = smoothstep(maxHalfWidth, maxHalfWidth - 0.06, distFromColCenter);

    // Chevron slope: constant sleek forward V-angle (~65% of half-width in meters)
    float vPeakMeters = maxHalfWidth * 0.65;
    float normX = clamp(distFromColCenter / max(0.001, maxHalfWidth), 0.0, 1.0);
    float yOffset = (1.0 - normX) * vPeakMeters;

    // Periodic chevrons along length Y (spacing 1.35m)
    float spacingY = 1.35;
    float scrollY = worldY - uTime * 3.0;
    float cellY = mod(scrollY - yOffset, spacingY);
    float deltaY = cellY;
    if (deltaY > spacingY * 0.5) {
      deltaY = spacingY - deltaY;
    }

    // Perpendicular Euclidean distance to the chevron wing
    float wingLen = sqrt(maxHalfWidth * maxHalfWidth + vPeakMeters * vPeakMeters);
    float cosAngle = maxHalfWidth / max(0.001, wingLen);
    float perpDist = deltaY * cosAngle;

    // Razor-sharp core and luminous aura in physical meters
    float coreThickness = 0.048;
    float auraThickness = 0.16;

    // Screen-space anti-aliasing via derivatives (sharp, never blurry)
    float aa = max(0.003, fwidth(perpDist) * 1.2);
    float chevronCore = smoothstep(coreThickness + aa, coreThickness - aa, perpDist) * arrowSpanMask;
    float chevronAura = smoothstep(auraThickness, 0.0, perpDist) * arrowSpanMask;

    vec3 arrowColor = vec3(1.0, 1.0, 1.0);
    vec3 auraColor = vec3(1.0, 0.95, 0.82);

    // Composite background, luminous white chevron, and glowing aura
    vec3 finalColor = mix(bgCol, arrowColor, chevronCore * 0.96);
    finalColor += auraColor * chevronAura * 0.42;

    // Soft border edges
    float edgeX = smoothstep(0.0, 0.015, vUv.x) * smoothstep(1.0, 0.985, vUv.x);
    float edgeY = smoothstep(0.0, 0.015, vUv.y) * smoothstep(1.0, 0.985, vUv.y);
    finalColor *= edgeX * edgeY;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class NeonImpulseVisual {
  readonly surfaceMesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(private pad: THREE.Object3D, private dims: { x: number; y: number; z: number }) {
    this.dims = { ...dims };
    const props = this.pad.userData?.logicProperties || {};
    const cols = this.parseArrowColumns(props);
    const spanMode = props.arrowSpanMode === "full" ? 1.0 : 0.0;
    const density = typeof props.ovalDensity === "number" ? props.ovalDensity : 14.0;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDimensions: { value: new THREE.Vector2(dims.x, dims.z) },
        uArrowColumns: { value: cols },
        uArrowSpanMode: { value: spanMode },
        uOvalDensity: { value: density }
      },
      vertexShader: NEON_VERTEX_SHADER,
      fragmentShader: NEON_FRAGMENT_SHADER,
      side: THREE.DoubleSide,
      extensions: {
        derivatives: true
      }
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

  parseArrowColumns(props: any): number {
    const mode = props.arrowColumnsMode || "auto";
    if (mode === "auto") return 0.0;
    if (mode === "custom") {
      const val = parseInt(props.arrowColumns, 10);
      return isNaN(val) ? 1.0 : Math.max(1.0, Math.min(12.0, val));
    }
    const parsed = parseFloat(mode);
    return isNaN(parsed) ? 1.0 : Math.max(1.0, parsed);
  }

  update(dims: { x: number; y: number; z: number }) {
    this.dims = { ...dims };
    const props = this.pad.userData?.logicProperties || {};

    this.material.uniforms.uDimensions.value.set(dims.x, dims.z);
    this.material.uniforms.uArrowColumns.value = this.parseArrowColumns(props);
    this.material.uniforms.uArrowSpanMode.value = props.arrowSpanMode === "full" ? 1.0 : 0.0;
    this.material.uniforms.uOvalDensity.value = typeof props.ovalDensity === "number" ? props.ovalDensity : 14.0;

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
