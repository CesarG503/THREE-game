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
        // e.g. game.html#/play/ROOM-XYZ or game.html#/edit
        const hash = window.location.hash.replace('#', '');
        const parts = hash.split('/').filter(p => p.length > 0);
        
        if (parts.length > 0) {
            this.currentMode = parts[0] === 'edit' ? 'editor' : 'play';
        }

        if (parts.length > 1) {
            this.roomId = parts[1];
        } else {
            // If they just entered #/play or #/edit without a code, generate a random one
            // so they immediately become the host of a shareable room!
            this.roomId = this.generateId();
            
            // Replace the URL instantly so they can copy-paste to friends
            const modePath = this.currentMode === 'editor' ? 'edit' : 'play';
            window.history.replaceState(null, null, `#/${modePath}/${this.roomId}`);
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
