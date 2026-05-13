export class RouteManager {
    constructor() {
        this.currentMode = 'play'; // 'play' or 'editor'
        this.roomId = null;

        this.parseHash();

        window.addEventListener('hashchange', () => {
            // In a robust SPA we wouldn't reload entirely, but physically reloading
            // ensures the gigantic Three.js scene builds fresh and drops physical instances
            // perfectly without memory leaks on map switches for now.
            window.location.reload();
        });
    }

    parseHash() {
        // e.g. /play/#ROOM-XYZ or /editor/#ROOM-XYZ
        const pathname = window.location.pathname;
        const hash = window.location.hash.replace('#', '');
        
        // Determinar modo basado en la carpeta actual
        if (pathname.includes('editor')) {
            this.currentMode = 'editor';
        } else {
            // Default to 'play' mode
            this.currentMode = 'play';
        }

        if (hash.length > 0) {
            this.roomId = hash;
        } else {
            // Generar código de sala si el hash está vacío
            this.roomId = this.generateId();
            
            // Actualizar URL sin recargar
            window.history.replaceState(null, null, `#${this.roomId}`);
        }

        console.log(`[Route] Mode: ${this.currentMode} | Room: ${this.roomId}`);
    }

    generateId() {
        return Math.random().toString(36).substring(2, 7).toUpperCase(); // e.g., "XA9B4"
    }

    getMode() {
        return this.currentMode;
    }

    getRoomId() {
        return this.roomId;
    }
}
