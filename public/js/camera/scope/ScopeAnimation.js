const gsap = window.gsap;
import { ScopeSettings } from './ScopeSettings.js';

export class ScopeAnimation {
    constructor(camera, ui) {
        this.camera = camera;
        this.ui = ui;
        this.fovTween = null;
        this.overlayTween = null;
    }

    animateEnter(targetFov) {
        // Kill previous tweens
        if (this.fovTween) this.fovTween.kill();
        if (this.overlayTween) this.overlayTween.kill();

        // Animar FOV de la cámara
        this.fovTween = gsap.to(this.camera, {
            fov: targetFov,
            duration: ScopeSettings.animationDuration,
            ease: "power2.out",
            onUpdate: () => this.camera.updateProjectionMatrix()
        });

        // Mostrar overlay de manera cinemática
        if (this.ui.overlay) {
            // Setup inicial antes de la animación
            gsap.set(this.ui.overlay, { 
                scale: 1.1
            });

            this.overlayTween = gsap.to(this.ui.overlay, {
                opacity: 1,
                scale: 1,
                duration: ScopeSettings.animationDuration,
                ease: "power2.out"
            });
        }
    }

    animateExit() {
        if (this.fovTween) this.fovTween.kill();
        if (this.overlayTween) this.overlayTween.kill();

        // Restaurar FOV original
        this.fovTween = gsap.to(this.camera, {
            fov: ScopeSettings.defaultFov,
            duration: ScopeSettings.animationDuration,
            ease: "power2.inOut",
            onUpdate: () => this.camera.updateProjectionMatrix()
        });

        // Ocultar overlay
        if (this.ui.overlay) {
            this.overlayTween = gsap.to(this.ui.overlay, {
                opacity: 0,
                scale: 1.1,
                duration: ScopeSettings.animationDuration * 0.8,
                ease: "power2.in"
            });
        }
    }

    animateZoomChange(newFov) {
        if (this.fovTween) this.fovTween.kill();
        
        this.fovTween = gsap.to(this.camera, {
            fov: newFov,
            duration: 0.15,
            ease: "back.out(1.2)", // Pequeño rebote al hacer zoom
            onUpdate: () => this.camera.updateProjectionMatrix()
        });

        // Efecto rápido en la UI al cambiar el zoom
        if (this.ui.reticle) {
            gsap.fromTo(this.ui.reticle, 
                { scale: 1.05 },
                { scale: 1, duration: 0.2, ease: "power2.out" }
            );
        }
    }

    // Efecto visual de recoil en la mira
    animateRecoil() {
        if (!this.ui.overlay) return;

        const intensity = ScopeSettings.recoilIntensity;

        gsap.timeline()
            .to(this.ui.overlay, {
                y: `-=${intensity}`,
                scale: 1.02,
                duration: 0.05,
                ease: "power1.out"
            })
            .to(this.ui.overlay, {
                y: 0,
                scale: 1,
                duration: 0.2,
                ease: "power2.out"
            });
    }

    destroy() {
        if (this.fovTween) this.fovTween.kill();
        if (this.overlayTween) this.overlayTween.kill();
    }
}
