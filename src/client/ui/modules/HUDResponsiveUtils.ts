// @ts-nocheck

export function clamp(value, min, max) {
    if (max < min) return min;
    return Math.max(min, Math.min(value, max));
}

export function getViewportMetrics(container) {
    const rect = container?.getBoundingClientRect?.();
    const width = Math.max(1, rect?.width || window.visualViewport?.width || window.innerWidth || 1);
    const height = Math.max(1, rect?.height || window.visualViewport?.height || window.innerHeight || 1);
    const edge = clamp(Math.round(Math.min(width, height) * 0.03), 8, 24);
    const gap = clamp(Math.round(Math.min(width, height) * 0.018), 6, 16);

    return {
        width,
        height,
        edge,
        gap,
        scale: clamp(Math.min(width / 900, height / 620), 0.55, 1)
    };
}

export function scaleHUDValue(value, container, min = 1, max = Number.POSITIVE_INFINITY) {
    const scale = getViewportMetrics(container).scale;
    return clamp(Math.round((Number(value) || 0) * scale), min, max);
}

export function fitLength(value, container, axis = "x", min = 1) {
    const metrics = getViewportMetrics(container);
    const available = Math.max(min, (axis === "x" ? metrics.width : metrics.height) - metrics.edge * 2);
    return clamp(scaleHUDValue(value, container, min), min, available);
}

export function resetPositionStyles(el) {
    el.style.top = "auto";
    el.style.left = "auto";
    el.style.bottom = "auto";
    el.style.right = "auto";
    el.style.transform = "none";
}

export function applyResponsivePosition(el, pos) {
    if (!el || !pos) return;

    resetPositionStyles(el);

    if (typeof pos === "object") {
        if (pos.top !== undefined) el.style.top = pos.top;
        if (pos.left !== undefined) el.style.left = pos.left;
        if (pos.bottom !== undefined) el.style.bottom = pos.bottom;
        if (pos.right !== undefined) el.style.right = pos.right;
        if (pos.transform) el.style.transform = pos.transform;
    }
}

export function hasViewportConstraint(constraint) {
    if (!constraint) return false;
    return (constraint.horizontal && constraint.horizontal !== "free") ||
        (constraint.vertical && constraint.vertical !== "free");
}

export function resolveViewportConstraintPosition(container, el, constraint) {
    if (!container || !el || !hasViewportConstraint(constraint)) return null;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const result = {};

    if (constraint.horizontal && constraint.horizontal !== "free") {
        const guideX = constraint.horizontal === "center"
            ? containerRect.width / 2
            : constraint.horizontal === "right"
                ? containerRect.width
                : 0;
        const elementOffset = constraint.horizontal === "center"
            ? elRect.width / 2
            : constraint.horizontal === "right"
                ? elRect.width
                : 0;
        result.left = `${Math.round(guideX + (Number(constraint.offsetX) || 0) - elementOffset)}px`;
    }

    if (constraint.vertical && constraint.vertical !== "free") {
        const guideY = constraint.vertical === "center"
            ? containerRect.height / 2
            : constraint.vertical === "bottom"
                ? containerRect.height
                : 0;
        const elementOffset = constraint.vertical === "center"
            ? elRect.height / 2
            : constraint.vertical === "bottom"
                ? elRect.height
                : 0;
        result.top = `${Math.round(guideY + (Number(constraint.offsetY) || 0) - elementOffset)}px`;
    }

    return result;
}

export function applyViewportConstraint(el, container, constraint) {
    const resolved = resolveViewportConstraintPosition(container, el, constraint);
    if (!resolved) return false;

    if (resolved.left !== undefined) {
        el.style.left = resolved.left;
        el.style.right = "auto";
    }
    if (resolved.top !== undefined) {
        el.style.top = resolved.top;
        el.style.bottom = "auto";
    }
    if (resolved.left !== undefined || resolved.top !== undefined) {
        el.style.transform = "none";
    }
    return true;
}

export function deriveViewportConstraintOffsets(container, el, constraint) {
    if (!container || !el || !constraint) return { offsetX: 0, offsetY: 0 };

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const next = {
        offsetX: Number(constraint.offsetX) || 0,
        offsetY: Number(constraint.offsetY) || 0
    };

    if (constraint.horizontal && constraint.horizontal !== "free") {
        const guideX = constraint.horizontal === "center"
            ? containerRect.width / 2
            : constraint.horizontal === "right"
                ? containerRect.width
                : 0;
        const elementX = constraint.horizontal === "center"
            ? elRect.left - containerRect.left + elRect.width / 2
            : constraint.horizontal === "right"
                ? elRect.right - containerRect.left
                : elRect.left - containerRect.left;
        next.offsetX = Math.round(elementX - guideX);
    }

    if (constraint.vertical && constraint.vertical !== "free") {
        const guideY = constraint.vertical === "center"
            ? containerRect.height / 2
            : constraint.vertical === "bottom"
                ? containerRect.height
                : 0;
        const elementY = constraint.vertical === "center"
            ? elRect.top - containerRect.top + elRect.height / 2
            : constraint.vertical === "bottom"
                ? elRect.bottom - containerRect.top
                : elRect.top - containerRect.top;
        next.offsetY = Math.round(elementY - guideY);
    }

    return next;
}

export function scalePixelPosition(pos, scale) {
    if (!pos) return pos;

    const scaleValue = (value) => {
        if (typeof value !== "string" || !value.endsWith("px")) return value;
        return `${Math.round((parseFloat(value) || 0) * scale)}px`;
    };

    return {
        left: scaleValue(pos.left),
        top: scaleValue(pos.top)
    };
}

export function lengthToPixels(value, total, fallback = 0) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return fallback;

    const trimmed = value.trim();
    if (!trimmed) return fallback;

    const amount = parseFloat(trimmed);
    if (!Number.isFinite(amount)) return fallback;
    if (trimmed.endsWith("%")) return (amount / 100) * total;
    return amount;
}

export function positionFromRect(childRect, parentRect) {
    const parentWidth = Math.max(1, parentRect.width);
    const parentHeight = Math.max(1, parentRect.height);

    return {
        left: `${(((childRect.left - parentRect.left) / parentWidth) * 100).toFixed(3)}%`,
        top: `${(((childRect.top - parentRect.top) / parentHeight) * 100).toFixed(3)}%`
    };
}

export function positionFromContainerRect(childRect, containerRect) {
    const width = Math.max(1, containerRect.width);
    const height = Math.max(1, containerRect.height);

    return {
        left: `${(((childRect.left - containerRect.left) / width) * 100).toFixed(2)}%`,
        top: `${(((childRect.top - containerRect.top) / height) * 100).toFixed(2)}%`
    };
}

export function resolveAnchoredPosition(container, parent, pos) {
    if (!container || !parent || !pos) return null;

    const containerRect = container.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const left = parentRect.left - containerRect.left + lengthToPixels(pos.left, parentRect.width, 0);
    const top = parentRect.top - containerRect.top + lengthToPixels(pos.top, parentRect.height, 0);

    return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`
    };
}

export function rectsTouchOrOverlap(a, b) {
    if (!a || !b) return false;
    return a.right >= b.left &&
        a.left <= b.right &&
        a.bottom >= b.top &&
        a.top <= b.bottom;
}

export function keepElementInsideContainer(el, container, padding = 0) {
    if (!el || !container) return false;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const availableWidth = Math.max(1, containerRect.width - padding * 2);
    const availableHeight = Math.max(1, containerRect.height - padding * 2);
    const currentLeft = elRect.left - containerRect.left;
    const currentTop = elRect.top - containerRect.top;
    const maxLeft = Math.max(padding, containerRect.width - elRect.width - padding);
    const maxTop = Math.max(padding, containerRect.height - elRect.height - padding);
    const nextLeft = elRect.width > availableWidth
        ? padding
        : clamp(currentLeft, padding, maxLeft);
    const nextTop = elRect.height > availableHeight
        ? padding
        : clamp(currentTop, padding, maxTop);

    const moved = Math.round(nextLeft) !== Math.round(currentLeft) ||
        Math.round(nextTop) !== Math.round(currentTop);

    if (moved) {
        el.style.left = `${Math.round(nextLeft)}px`;
        el.style.top = `${Math.round(nextTop)}px`;
        el.style.bottom = "auto";
        el.style.right = "auto";
        el.style.transform = "none";
    }

    return moved;
}
