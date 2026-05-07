const anime = window.anime;
import { ScopeSettings } from './ScopeSettings.js';

export class ScopeEffects {
    constructor(ui) {
        this.ui = ui;
        this.animations = [];
        this.swayTime = 0;
    }

    startAmbientEffects() {
        this.stopAmbientEffects();

        // Respiración suave en la retícula
        if (ScopeSettings.enableBreathing && this.ui.reticle) {
            const breath = anime({
                targets: this.ui.reticle,
                scale: [0.98, 1.02],
                duration: 4000,
                direction: 'alternate',
                loop: true,
                easing: 'easeInOutSine'
            });
            this.animations.push(breath);
        }

        // Pulso en el texto del HUD
        if (this.ui.textElement) {
            const pulse = anime({
                targets: this.ui.textElement,
                opacity: [0.7, 1],
                duration: 2000,
                direction: 'alternate',
                loop: true,
                easing: 'easeInOutSine'
            });
            this.animations.push(pulse);
        }

        // Glitch sutil ocasional si está habilitado
        if (ScopeSettings.enableGlitch && this.ui.overlay) {
            const glitch = anime({
                targets: this.ui.overlay,
                translateX: () => anime.random(-2, 2),
                translateY: () => anime.random(-2, 2),
                duration: 50,
                loop: true,
                easing: 'steps(5)',
                delay: () => anime.random(2000, 5000), // Random delay entre glitches
            });
            this.animations.push(glitch);
        }
    }

    stopAmbientEffects() {
        this.animations.forEach(anim => anim.pause());
        this.animations = [];
        // Reset transforms
        if (this.ui.reticle) anime.set(this.ui.reticle, { scale: 1 });
        if (this.ui.textElement) anime.set(this.ui.textElement, { opacity: 1 });
        if (this.ui.overlay) anime.set(this.ui.overlay, { translateX: 0, translateY: 0 });
    }

    // Retorna offset dinámico de "sway" procedural para la cámara
    getProceduralSway(dt, isAiming) {
        if (!isAiming || !ScopeSettings.enableBreathing) return { x: 0, y: 0 };
        
        this.swayTime += dt;
        const intensity = ScopeSettings.swayIntensity * 0.0005;
        
        // Lissajous curve for breathing figure-8
        const swayX = Math.sin(this.swayTime * 1.5) * intensity;
        const swayY = Math.sin(this.swayTime * 3.0) * (intensity * 0.5);
        
        return { x: swayX, y: swayY };
    }

    destroy() {
        this.stopAmbientEffects();
    }
}
