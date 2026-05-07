import { ScopeSettings } from "./ScopeSettings.js";

export class ScopeUI {
    constructor() {
        this.overlay = null;
        this.textElement = null;
        this.vignette = null;
        this.reticle = null;
        this.createUI();
    }

    createUI() {
        // Contenedor principal
        this.overlay = document.createElement("div");
        this.overlay.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            z-index: 100;
            will-change: opacity, transform, backdrop-filter;
        `;

        // Vignette cinemático (bordes oscuros suaves para no tapar la visión)
        this.vignette = document.createElement("div");
        this.vignette.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle, transparent 60%, rgba(0,0,0,0.5) 100%);
            z-index: 1;
        `;

        // Crosshair SVG optimizado y moderno
        const svgContainer = document.createElement("div");
        svgContainer.style.cssText = `
            position: relative;
            width: 100vh;
            height: 100vh;
            max-width: 100vw;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: center;
            will-change: transform;
        `;

        const strokeColor = ScopeSettings.hudColor;
        svgContainer.innerHTML = `
            <svg id="scope-svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="0.4" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <linearGradient id="lens-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="rgba(255,255,255,0.08)" />
                        <stop offset="50%" stop-color="rgba(0,0,0,0)" />
                        <stop offset="100%" stop-color="rgba(0,0,0,0.15)" />
                    </linearGradient>
                </defs>

                <!-- Lente interior sutil con efecto cristal -->
                <circle cx="50" cy="50" r="38" fill="url(#lens-grad)" />
                <circle cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.1)" stroke-width="0.2" fill="none" />
                
                <!-- Anillos tecnológicos -->
                <circle cx="50" cy="50" r="36" stroke="${strokeColor}" stroke-width="0.1" stroke-dasharray="1, 2" fill="none" opacity="0.4" />
                <circle cx="50" cy="50" r="35" stroke="${strokeColor}" stroke-width="0.05" fill="none" opacity="0.2" />
                <circle cx="50" cy="50" r="15" stroke="${strokeColor}" stroke-width="0.05" stroke-dasharray="2, 6" fill="none" opacity="0.5" />

                <!-- Retícula moderna -->
                <g filter="url(#glow)">
                    <!-- Lineas principales (cruz abierta) -->
                    <line x1="15" y1="50" x2="47" y2="50" stroke="${strokeColor}" stroke-width="0.15" />
                    <line x1="53" y1="50" x2="85" y2="50" stroke="${strokeColor}" stroke-width="0.15" />
                    <line x1="50" y1="15" x2="50" y2="47" stroke="${strokeColor}" stroke-width="0.15" />
                    <line x1="50" y1="53" x2="50" y2="85" stroke="${strokeColor}" stroke-width="0.15" />
                    
                    <!-- Marcas de distancia -->
                    <line x1="30" y1="49" x2="30" y2="51" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="40" y1="49.5" x2="40" y2="50.5" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="70" y1="49" x2="70" y2="51" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="60" y1="49.5" x2="60" y2="50.5" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="49" y1="30" x2="51" y2="30" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="49.5" y1="40" x2="50.5" y2="40" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="49" y1="70" x2="51" y2="70" stroke="${strokeColor}" stroke-width="0.2" />
                    <line x1="49.5" y1="60" x2="50.5" y2="60" stroke="${strokeColor}" stroke-width="0.2" />

                    <!-- Punto central -->
                    <circle cx="50" cy="50" r="0.2" fill="rgba(255, 50, 50, 1)" />
                    
                    <!-- Elementos periféricos HUD (Arcos y corchetes) -->
                    <path d="M 22 35 Q 15 50 22 65" fill="none" stroke="${strokeColor}" stroke-width="0.15" opacity="0.6" />
                    <path d="M 78 35 Q 85 50 78 65" fill="none" stroke="${strokeColor}" stroke-width="0.15" opacity="0.6" />
                    
                    <!-- Marcas angulares de esquinas -->
                    <polyline points="27,25 25,25 25,27" fill="none" stroke="${strokeColor}" stroke-width="0.3" opacity="0.8" />
                    <polyline points="73,25 75,25 75,27" fill="none" stroke="${strokeColor}" stroke-width="0.3" opacity="0.8" />
                    <polyline points="27,75 25,75 25,73" fill="none" stroke="${strokeColor}" stroke-width="0.3" opacity="0.8" />
                    <polyline points="73,75 75,75 75,73" fill="none" stroke="${strokeColor}" stroke-width="0.3" opacity="0.8" />
                </g>
            </svg>
        `;

        this.reticle = svgContainer;

        // Texto de HUD
        const hudContainer = document.createElement("div");
        hudContainer.style.cssText = `
            position: absolute;
            bottom: 10%;
            right: 10%;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            z-index: 3;
            font-family: 'Courier New', Courier, monospace;
            will-change: opacity, transform;
        `;

        this.textElement = document.createElement("div");
        this.textElement.style.cssText = `
            color: ${ScopeSettings.hudColor};
            font-size: 32px;
            font-weight: bold;
            text-shadow: 0 0 8px ${ScopeSettings.hudGlow};
            margin-bottom: 5px;
            letter-spacing: 2px;
        `;
        this.textElement.innerText = "x1";

        const helperText = document.createElement("div");
        helperText.style.cssText = `
            color: ${ScopeSettings.hudColor};
            font-size: 12px;
            text-shadow: 0 0 5px ${ScopeSettings.hudGlow};
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        helperText.innerText = "SHIFT + SCROLL : ZOOM";

        hudContainer.appendChild(this.textElement);
        hudContainer.appendChild(helperText);

        // Ensamblar
        this.overlay.appendChild(this.vignette);
        this.overlay.appendChild(this.reticle);
        this.overlay.appendChild(hudContainer);
        document.body.appendChild(this.overlay);
    }

    setZoomText(zoomValue) {
        if (this.textElement) {
            this.textElement.innerText = `x${zoomValue}`;
        }
    }

    destroy() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
