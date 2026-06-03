// @ts-nocheck

import {
    applyResponsivePosition
} from './HUDResponsiveUtils'

export class HUDLayoutSystem {
    constructor(container) {
        this.container = container;
        this.elements = new Map(); // id -> { el, config, onMove }
        this.selection = new Set(); // Set of selected IDs
        this.activeDrag = null;
        this.isEditMode = false;
        this.onSelectionChange = null; // Callback
        this.onDragEnd = null;

        this.grid = null;

        // Marquee State
        this.isMarqueeSelecting = false;
        this.marqueeStart = { x: 0, y: 0 };
        this.marqueeBox = null;

        // Bind handlers
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onContainerMouseDown = this.onContainerMouseDown.bind(this);
        this.refreshLayout = this.refreshLayout.bind(this);
    }

    setSelectionCallback(cb) {
        this.onSelectionChange = cb;
    }

    setDragEndCallback(cb) {
        this.onDragEnd = cb;
    }

    enableEditMode(showGrid = true) {
        this.isEditMode = true;
        this.container.style.pointerEvents = 'auto';

        // Add marquee listener to container
        this.container.addEventListener('mousedown', this.onContainerMouseDown);
        window.addEventListener('resize', this.refreshLayout);
        window.visualViewport?.addEventListener('resize', this.refreshLayout);

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
        this.container.style.pointerEvents = 'none';
        this.container.removeEventListener('mousedown', this.onContainerMouseDown);
        window.removeEventListener('resize', this.refreshLayout);
        window.visualViewport?.removeEventListener('resize', this.refreshLayout);

        if (this.grid) {
            this.grid.style.display = 'none';
        }
        this.clearSelection();
    }

    // --- Selection API ---

    select(id, add = false) {
        if (!add) {
            this.clearSelection(true);
        }
        this.selection.add(id);
        this.updateVisualSelection();
        if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selection));
    }

    deselect(id) {
        this.selection.delete(id);
        this.updateVisualSelection();
        if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selection));
    }

    clearSelection(silent = false) {
        this.selection.clear();
        this.updateVisualSelection();
        if (!silent && this.onSelectionChange) this.onSelectionChange([]);
    }

    toggleSelection(id) {
        if (this.selection.has(id)) {
            this.deselect(id);
        } else {
            this.select(id, true);
        }
    }

    updateVisualSelection() {
        this.elements.forEach((meta, id) => {
            if (this.selection.has(id)) {
                meta.el.style.outline = "2px solid #4CAF50";
                meta.el.style.boxShadow = "0 0 10px rgba(76, 175, 80, 0.5)";
            } else {
                meta.el.style.outline = "none";
                meta.el.style.boxShadow = "none";
            }
        });
    }

    // --- Element Reg ---

    clearElements() {
        this.elements.clear();
        this.selection.clear();
        if (this.onSelectionChange) this.onSelectionChange([]);
    }

    registerElement(element, id, initialPos, onMoveCallback) {
        element.style.position = 'absolute';
        element.style.pointerEvents = 'auto';
        this.applyPosition(element, initialPos);

        this.elements.set(id, {
            el: element,
            config: initialPos,
            onMove: onMoveCallback
        });

        this.makeDraggable(element, id);
        this.scheduleRefresh();
    }

    applyPosition(el, pos) {
        if (!pos) return;
        applyResponsivePosition(el, pos);
        this.scheduleRefresh();
    }

    scheduleRefresh() {
        cancelAnimationFrame(this.refreshFrame);
        this.refreshFrame = requestAnimationFrame(this.refreshLayout);
    }

    refreshLayout() {
        // No automatic repositioning here: editor preview must preserve exactly
        // what the user placed. Stacking is handled by layer order / z-index.
    }

    // --- Interaction ---

    makeDraggable(element, id) {
        element.style.cursor = 'grab';
        element.style.userSelect = 'none';

        element.onmousedown = (e) => {
            if (!this.isEditMode) return;
            e.preventDefault();
            e.stopPropagation(); // Prevent Marquee

            // Selection Logic
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                this.toggleSelection(id);
            } else {
                // If clicking an unselected item, select only it
                if (!this.selection.has(id)) {
                    this.select(id, false);
                }
                // If clicking a selected item, keep selection (allow group drag)
            }

            // Start Drag
            this.activeDrag = {
                startX: e.clientX,
                startY: e.clientY
            };

            // Store initial offsets for ALL selected items
            this.dragOffsets = new Map();
            const containerRect = this.container.getBoundingClientRect();

            this.selection.forEach(selId => {
                const meta = this.elements.get(selId);
                if (meta) {
                    const elRect = meta.el.getBoundingClientRect();
                    this.dragOffsets.set(selId, {
                        offsetX: elRect.left - containerRect.left,
                        offsetY: elRect.top - containerRect.top
                    });
                }
            });

            element.style.cursor = 'grabbing';
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('mouseup', this.onMouseUp);
        };
    }

    onContainerMouseDown(e) {
        if (!this.isEditMode) return;
        // If we hit background, start marquee
        this.isMarqueeSelecting = true;
        this.marqueeStart = { x: e.clientX, y: e.clientY };

        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            this.clearSelection();
        }

        // Create Box
        this.marqueeBox = document.createElement('div');
        this.marqueeBox.style.cssText = `
            position: fixed; border: 1px solid #4CAF50; background: rgba(76, 175, 80, 0.2);
            pointer-events: none; z-index: 9999;
        `;
        document.body.appendChild(this.marqueeBox);

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove(e) {
        if (this.activeDrag) {
            // DRAGGING ELEMENTS
            e.preventDefault();
            const dx = e.clientX - this.activeDrag.startX;
            const dy = e.clientY - this.activeDrag.startY;
            const containerRect = this.container.getBoundingClientRect();

            // Move ALL selected elements
            this.selection.forEach(selId => {
                const meta = this.elements.get(selId);
                const startOff = this.dragOffsets.get(selId);

                if (meta && startOff) {
                    let newLeft = startOff.offsetX + dx;
                    let newTop = startOff.offsetY + dy;

                    const w = meta.el.offsetWidth;
                    const h = meta.el.offsetHeight;
                    const maxLeft = Math.max(0, containerRect.width - w);
                    const maxTop = Math.max(0, containerRect.height - h);

                    if (newLeft < 0) newLeft = 0;
                    if (newTop < 0) newTop = 0;
                    if (newLeft > maxLeft) newLeft = maxLeft;
                    if (newTop > maxTop) newTop = maxTop;

                    meta.el.style.left = newLeft + 'px';
                    meta.el.style.top = newTop + 'px';
                    meta.el.style.bottom = 'auto';
                    meta.el.style.right = 'auto';
                    meta.el.style.transform = 'none';

                    // Callback
                    const leftPct = (newLeft / containerRect.width) * 100;
                    const topPct = (newTop / containerRect.height) * 100;
                    const nextPos = { left: leftPct.toFixed(2) + '%', top: topPct.toFixed(2) + '%' };
                    meta.config = nextPos;
                    if (meta.onMove) meta.onMove(nextPos);
                }
            });

        } else if (this.isMarqueeSelecting) {
            // MARQUEE SELECTION
            e.preventDefault();
            const currentX = e.clientX;
            const currentY = e.clientY;

            const left = Math.min(this.marqueeStart.x, currentX);
            const top = Math.min(this.marqueeStart.y, currentY);
            const width = Math.abs(currentX - this.marqueeStart.x);
            const height = Math.abs(currentY - this.marqueeStart.y);

            this.marqueeBox.style.left = left + 'px';
            this.marqueeBox.style.top = top + 'px';
            this.marqueeBox.style.width = width + 'px';
            this.marqueeBox.style.height = height + 'px';
        }
    }

    onMouseUp(e) {
        const endedDragIds = this.activeDrag ? Array.from(this.selection) : null;

        if (this.activeDrag) {
            this.activeDrag = null;
        }

        if (this.isMarqueeSelecting) {
            // Finalize Marquee
            const mbRect = this.marqueeBox.getBoundingClientRect();

            // Check Intersections
            this.elements.forEach((meta, id) => {
                const elRect = meta.el.getBoundingClientRect();
                const intersects = !(mbRect.right < elRect.left ||
                    mbRect.left > elRect.right ||
                    mbRect.bottom < elRect.top ||
                    mbRect.top > elRect.bottom);

                if (intersects) {
                    this.selection.add(id);
                }
            });

            this.updateVisualSelection();
            if (this.onSelectionChange) this.onSelectionChange(Array.from(this.selection));

            document.body.removeChild(this.marqueeBox);
            this.marqueeBox = null;
            this.isMarqueeSelecting = false;
        }

        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        // Reset cursors
        this.elements.forEach((meta) => {
            meta.el.style.cursor = 'grab';
        });

        if (endedDragIds && this.onDragEnd) {
            this.onDragEnd(endedDragIds);
        }
    }
}
