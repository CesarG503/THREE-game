import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";

// Reuse Three's Rayleigh/Mie model for both the full sky and the skybox overlay.
export class SolarAtmosphere extends Sky {
  constructor() {
    super();
    this.name = "solarAtmosphere";
    this.scale.setScalar(450000);
    this.frustumCulled = false;
    this.renderOrder = -950;
    this.userData.ignorePlacementRaycast = true;
    this.raycast = () => {};
    const material = this.material;
    material.transparent = true;
    material.fog = false;
    Object.assign(material.uniforms, {
      fullSky: { value: false },
      solarEnabled: { value: true },
      solarRadius: { value: 0.008 },
      solarColor: { value: new THREE.Color() },
      solarStrength: { value: 1 }
    });
    // Zero scattering and G=1 are valid slider endpoints; keep the model finite.
    material.vertexShader = material.vertexShader.replace(
      "vBetaR = totalRayleigh * rayleighCoefficient;",
      "vBetaR = totalRayleigh * max(0.0, rayleighCoefficient);"
    );
    material.fragmentShader = `
      uniform bool fullSky;
      uniform bool solarEnabled;
      uniform float solarRadius;
      uniform vec3 solarColor;
      uniform float solarStrength;
    ` + material.fragmentShader
      .replaceAll("( vBetaR + vBetaM )", "max( vBetaR + vBetaM, vec3(1e-9) )")
      .replace("hgPhase( cosTheta, mieDirectionalG )", "hgPhase( cosTheta, clamp(mieDirectionalG, 0.0, 0.999) )")
      .replace("L0 += ( vSunE * 19000.0 * Fex ) * sundisk;", "")
      .replace("gl_FragColor = vec4( retColor, 1.0 );", /* glsl */`
        // The main renderer may have no tone mapping; retain detail in the HDR halo.
        #ifndef TONE_MAPPING
          retColor = retColor / (vec3(1.0) + retColor);
        #endif
        float daylight = smoothstep(-0.10, 0.03, vSunDirection.y);
        float horizon = smoothstep(-0.006, 0.003, direction.y);
        float angle = acos(clamp(cosTheta, -1.0, 1.0));
        float edge = max(fwidth(angle), solarRadius * 0.025);
        float disk = (1.0 - smoothstep(solarRadius - edge, solarRadius + edge, angle))
          * horizon * smoothstep(-0.04, 0.01, vSunDirection.y);
        if (!solarEnabled) disk = 0.0;

        // Extinction reddens the disk as the optical path grows at the horizon.
        vec3 transmission = Fex / max(max(Fex.r, Fex.g), max(Fex.b, 1e-6));
        vec3 diskColor = solarColor * transmission * solarStrength;
        if (fullSky) {
          gl_FragColor = vec4(mix(retColor, diskColor, disk), 1.0);
        } else {
          // Broad dawn light plus forward Mie scattering, composited over any skybox.
          float forwardGlow = pow(max(cosTheta, 0.0), 4.0);
          float horizonGlow = exp(-abs(direction.y) * 8.0)
            * pow(max(cosTheta, 0.0), 2.0) * (1.0 - smoothstep(0.0, 0.5, vSunDirection.y));
          float radiance = max(max(Lin.r, Lin.g), Lin.b) * 0.04;
          float haze = (1.0 - exp(-radiance)) * (0.45 * forwardGlow + 0.3 * horizonGlow)
            * daylight * smoothstep(-0.04, 0.02, direction.y);
          float alpha = disk + haze * (1.0 - disk);
          vec3 color = (diskColor * disk + retColor * solarColor * haze * (1.0 - disk))
            / max(alpha, 1e-6);
          gl_FragColor = vec4(color, solarEnabled ? alpha : 0.0);
        }
      `);
  }
}
