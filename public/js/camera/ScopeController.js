import { ScopeSettings } from "./scope/ScopeSettings.js";
import { ScopeUI } from "./scope/ScopeUI.js";
import { ScopeAnimation } from "./scope/ScopeAnimation.js";
import { ScopeEffects } from "./scope/ScopeEffects.js";
import { ScopeInput } from "./scope/ScopeInput.js";

export class ScopeController {
    constructor(camera, game) {
        this.camera = camera;
        this.game = game;
        
        this.isAiming = false;
        this.currentWeapon = null;
        
        // Estado interno de zoom
        this.currentScopeIndex = -1;
        this.allowedScopes = [];
        
        // Instanciar submódulos
        this.ui = new ScopeUI();
        this.animation = new ScopeAnimation(this.camera, this.ui);
        this.effects = new ScopeEffects(this.ui);
        this.input = new ScopeInput(this);
    }

    canHandleInput() {
        return this.isAiming && this.currentWeapon && this.currentWeapon.maxScope > 1;
    }

    zoomIn() {
        if (this.allowedScopes.length === 0) return;
        this.currentScopeIndex++;
        if (this.currentScopeIndex >= this.allowedScopes.length) {
            this.currentScopeIndex = this.allowedScopes.length - 1;
        }
        this._applyZoomChange();
    }

    zoomOut() {
        if (this.allowedScopes.length === 0) return;
        this.currentScopeIndex--;
        if (this.currentScopeIndex < 0) {
            this.currentScopeIndex = 0; // No bajar del mínimo mientras se apunta
        }
        this._applyZoomChange();
    }

    _applyZoomChange() {
        const selectedZoom = this.allowedScopes[this.currentScopeIndex];
        const targetFov = selectedZoom === 1 
            ? ScopeSettings.defaultFov / 1.2 // Iron Sights zoom
            : ScopeSettings.defaultFov / selectedZoom;
        
        this.ui.setZoomText(selectedZoom);
        this.animation.animateZoomChange(targetFov);

        // Hide UI overlay if zoom is 1 (no-scope mode)
        if (this.ui.overlay) {
            const isNoScope = selectedZoom === 1;
            window.gsap.to(this.ui.overlay, {
                opacity: isNoScope ? 0 : 1,
                duration: 0.2,
                ease: "power2.out"
            });
        }
    }

    // Llamado externo cuando se dispara el arma
    onShoot() {
        if (this.isAiming) {
            const selectedZoom = this.allowedScopes[this.currentScopeIndex];
            // Solo aplicar recoil de la mira si el overlay es visible
            if (selectedZoom > 1) {
                this.animation.animateRecoil();
            }
        }
    }

    update(dt, isAimingCommand, currentWeapon) {
        this.currentWeapon = currentWeapon;
        
        const canAim = currentWeapon && currentWeapon.type === "weapon" && currentWeapon.maxScope > 1;
        
        // Manejo de entrada y salida del modo mira
        if (isAimingCommand && canAim) {
            if (!this.isAiming) {
                this.isAiming = true;
                
                // Inicializar scopes permitidos
                const maxScope = currentWeapon.maxScope;
                this.allowedScopes = ScopeSettings.availableScopes.filter(s => s <= maxScope);
                
                if (this.currentScopeIndex === -1 || this.currentScopeIndex >= this.allowedScopes.length) {
                    this.currentScopeIndex = this.allowedScopes.length - 1; // Default al maximo
                }
                
                const zoomValue = this.allowedScopes[this.currentScopeIndex];
                const targetFov = zoomValue === 1 
                    ? ScopeSettings.defaultFov / 1.2 
                    : ScopeSettings.defaultFov / zoomValue;
                
                this.ui.setZoomText(zoomValue);
                this.animation.animateEnter(targetFov, zoomValue);
                this.effects.startAmbientEffects();
            }
        } else {
            if (this.isAiming) {
                this.isAiming = false;
                this.animation.animateExit();
                this.effects.stopAmbientEffects();
            }
            
            // Ligero zoom táctico si el arma no tiene mira (Iron Sights)
            if (isAimingCommand && currentWeapon && currentWeapon.type === "weapon" && currentWeapon.maxScope <= 1) {
                const targetFov = ScopeSettings.defaultFov / 1.2;
                this.camera.fov += (targetFov - this.camera.fov) * 15.0 * dt;
                this.camera.updateProjectionMatrix();
            } else if (!isAimingCommand) {
                // Return to normal FOV if not aiming and not handled by GSAP (GSAP handles it if isAiming was true)
                // We use a small threshold to avoid constant updates
                if (!this.animation.fovTween?.isActive() && Math.abs(this.camera.fov - ScopeSettings.defaultFov) > 0.1) {
                    this.camera.fov += (ScopeSettings.defaultFov - this.camera.fov) * 15.0 * dt;
                    this.camera.updateProjectionMatrix();
                }
            }
        }

        // Aplicar sway procedural (Breathing effect)
        if (this.isAiming) {
            const sway = this.effects.getProceduralSway(dt, this.isAiming);
            // Aplicar el sway directamente a la rotación de la cámara o offset
            // (Se asume que la cámara está dentro de un rig, o rotamos ligeramente)
            // Como no queremos interferir con el CameraController agresivamente,
            // podemos modificar el UI ligeramente o el FOV/rotation temporal
            if (this.ui.reticle) {
                this.ui.reticle.style.transform = `translate(${sway.x * 50}px, ${sway.y * 50}px)`;
            }
        }
    }

    destroy() {
        this.ui.destroy();
        this.animation.destroy();
        this.effects.destroy();
        this.input.destroy();
    }
}
