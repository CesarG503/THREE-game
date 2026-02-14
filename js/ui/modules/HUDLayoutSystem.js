export class HUDLayoutSystem {
    constructor(container) {
        this.container = container;
        this.elements = new Map(); // id -> { el, config, onMove }
        this.activeDrag = null;
        this.isEditMode = false;

        this.grid = null;

        // Bind handlers to retain 'this'
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    enableEditMode(showGrid = true) {
        this.isEditMode = true;
        this.container.style.pointerEvents = 'auto'; // Enable interaction

        if (showGrid) {
            if (!this.grid) {
                this.grid = document.createElement('div');
                this.grid.style.cssText = `
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none; opacity: 0.1; z-index: 0;
                    background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px);
                    background-size: 50px 50px;
                `;
                this.container.appendChild(this.grid);
            }
            this.grid.style.display = 'block';
        }
    }

    disableEditMode() {
        this.isEditMode = false;
        // this.container.style.pointerEvents = 'none'; // Avoid disabling if we want consistent state, or...
        // Actually for HUD Editor, container is fullscreen. We want pass through?
        this.container.style.pointerEvents = 'none';

        if (this.grid) {
            this.grid.style.display = 'none';
        }
    }

    registerElement(element, id, initialPos, onMoveCallback) {
        // Ensure element is absolute and interactive
        element.style.position = 'absolute';
        element.style.pointerEvents = 'auto'; // Crucial for receiving events

        // Apply initial pos
        this.applyPosition(element, initialPos);

        // Store metadata
        this.elements.set(id, {
            el: element,
            onMove: onMoveCallback
        });

        // Setup drag handlers on the element itself
        this.makeDraggable(element, id);
    }

    applyPosition(el, pos) {
        if (!pos) return;
        if (pos.top) el.style.top = pos.top;
        if (pos.left) el.style.left = pos.left;
        if (pos.bottom) el.style.bottom = pos.bottom;
        if (pos.right) el.style.right = pos.right;

        // Handle transforms carefully
        if (pos.transform) {
            el.style.transform = pos.transform;
        } else {
            el.style.transform = 'none';
        }
    }

    makeDraggable(element, id) {
        // Visual cues
        element.style.cursor = 'grab';
        element.style.userSelect = 'none';

        element.onmousedown = (e) => {
            if (!this.isEditMode) return;

            e.preventDefault();
            e.stopPropagation();

            this.activeDrag = { el: element, id: id };
            element.style.cursor = 'grabbing';
            element.style.zIndex = '1000'; // Bring to front while dragging

            // Add global listeners
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('mouseup', this.onMouseUp);
        };
    }

    onMouseMove(e) {
        if (this.activeDrag && this.isEditMode) {
            e.preventDefault();
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const el = this.activeDrag.el;
            const w = el.offsetWidth;
            const h = el.offsetHeight;

            // Centered drag logic
            let newLeft = x - (w / 2);
            let newTop = y - (h / 2);

            // Bounds clamping
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + w > rect.width) newLeft = rect.width - w;
            if (newTop + h > rect.height) newTop = rect.height - h;

            // Apply pixel position for smooth dragging
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.transform = 'none';

            // Calculate percentages for storage
            const leftPct = (newLeft / rect.width) * 100;
            const topPct = (newTop / rect.height) * 100;

            // Helper to format as string
            const posData = {
                left: leftPct.toFixed(2) + '%',
                top: topPct.toFixed(2) + '%'
            };

            // Notify callback
            const meta = this.elements.get(this.activeDrag.id);
            if (meta && meta.onMove) {
                meta.onMove(posData);
            }
        }
    }

    onMouseUp(e) {
        if (this.activeDrag) {
            this.activeDrag.el.style.cursor = 'grab';
            this.activeDrag.el.style.zIndex = '';
            this.activeDrag = null;

            // Remove global listeners
            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);
        }
    }
}
