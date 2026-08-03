import * as THREE from "three";

// Additive glare brightens the existing sky without painting an opaque disk over it.
export class CelestialGlow extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor(name: string, preservePhase = false) {
    super(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color() },
        intensity: { value: 0 },
        spread: { value: 1 },
        extent: { value: 8 },
        preservePhase: { value: preservePhase }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vDirection;
        void main() {
          vUv = uv;
          vDirection = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float spread;
        uniform float extent;
        uniform bool preservePhase;
        varying vec2 vUv;
        varying vec3 vDirection;
        void main() {
          float r = length(vUv * 2.0 - 1.0) * extent;
          float core = exp(-0.5 * pow(r / (0.65 + spread * 0.45), 2.0));
          float corona = 0.2 * exp(-0.5 * pow(r / (1.0 + spread * 1.2), 2.0));
          float glow = (core + corona) * intensity;
          if (preservePhase) {
            // Concentrate lunar glare along the lit crescent, keeping its dark side readable.
            vec2 radialDirection = normalize(vUv * 2.0 - 1.0 + vec2(1e-6));
            float litSide = smoothstep(-0.6, 0.6, dot(radialDirection, normalize(vec2(-17.0, -10.0))));
            float phaseGlow = mix(0.2, 1.0, litSide);
            glow *= smoothstep(0.6, 0.95, r) * mix(phaseGlow, 1.0, smoothstep(1.0, 4.0, r));
          }
          glow *= 1.0 - smoothstep(0.85, 1.0, r / extent);
          glow *= smoothstep(-0.006, 0.003, normalize(vDirection).y);
          gl_FragColor = vec4(glowColor, clamp(glow, 0.0, 1.0));
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false
    }));
    this.name = name;
    this.renderOrder = -925;
    this.frustumCulled = false;
    this.userData.ignorePlacementRaycast = true;
    this.raycast = () => {};
  }

  setGlow(radius: number, intensity: number, spread: number, color: THREE.Color) {
    const extent = 5 * (1 + spread * 1.2);
    this.scale.setScalar(radius * extent);
    this.material.uniforms.extent.value = extent;
    this.material.uniforms.intensity.value = intensity;
    this.material.uniforms.spread.value = spread;
    this.material.uniforms.glowColor.value.copy(color);
    this.visible = intensity > 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
