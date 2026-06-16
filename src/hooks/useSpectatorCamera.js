import { useEffect, useRef, useCallback } from 'react';

const EDGE_PX = 52;
const EDGE_SPEED = 480;
const WHEEL_FACTOR = 1.09;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function edgeAxis(pos, size) {
    if (size <= EDGE_PX * 2) return 0;
    if (pos < EDGE_PX) return -1 + pos / EDGE_PX;
    if (pos > size - EDGE_PX) return (pos - (size - EDGE_PX)) / EDGE_PX;
    return 0;
}

function touchDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

function touchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    };
}

/**
 * Free-camera controls for post-match spectating.
 * Edge scroll, drag-pan, wheel zoom (desktop), pinch zoom (mobile).
 */
export function useSpectatorCamera({
    active,
    canvasRef,
    worldWidth = 6000,
    worldHeight = 6000,
    worldBounds = null,
    baseViewZoom = 1,
    minZoom = 0.45,
    maxZoom = 1.65,
    initialZoom = 1,
}) {
    const bounds = worldBounds || {
        minX: 120,
        maxX: worldWidth - 120,
        minY: 120,
        maxY: worldHeight - 120,
    };

    const camRef = useRef({
        x: worldBounds ? 0 : worldWidth / 2,
        y: worldBounds ? 0 : worldHeight / 2,
        zoom: initialZoom,
    });
    const pointerRef = useRef({
        dragging: false,
        pinchActive: false,
        lastX: 0,
        lastY: 0,
        lastPinchDist: 0,
        edgeX: 0,
        edgeY: 0,
    });

    const clampCamera = useCallback((cam) => {
        cam.x = clamp(cam.x, bounds.minX, bounds.maxX);
        cam.y = clamp(cam.y, bounds.minY, bounds.maxY);
        cam.zoom = clamp(cam.zoom, minZoom, maxZoom);
    }, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, minZoom, maxZoom]);

    const applyZoom = useCallback((factor, clientX, clientY) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cam = camRef.current;
        const rect = canvas.getBoundingClientRect();
        const sx = clientX - rect.left - rect.width / 2;
        const sy = clientY - rect.top - rect.height / 2;
        const oldZ = cam.zoom * baseViewZoom;
        const newZoom = clamp(cam.zoom * factor, minZoom, maxZoom);
        const newZ = newZoom * baseViewZoom;
        const wx = cam.x + sx / oldZ;
        const wy = cam.y + sy / oldZ;
        cam.zoom = newZoom;
        cam.x = wx - sx / newZ;
        cam.y = wy - sy / newZ;
        clampCamera(cam);
    }, [canvasRef, baseViewZoom, clampCamera, minZoom, maxZoom]);

    const seed = useCallback((x, y, zoom = initialZoom) => {
        camRef.current.x = x;
        camRef.current.y = y;
        camRef.current.zoom = clamp(zoom, minZoom, maxZoom);
        clampCamera(camRef.current);
    }, [clampCamera, initialZoom, minZoom, maxZoom]);

    useEffect(() => {
        if (!active) return undefined;
        let rafId = 0;
        let last = performance.now();

        const tick = (now) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const { edgeX, edgeY, dragging, pinchActive } = pointerRef.current;
            if (!dragging && !pinchActive && (edgeX || edgeY)) {
                const cam = camRef.current;
                const speed = EDGE_SPEED / cam.zoom;
                cam.x += edgeX * speed * dt;
                cam.y += edgeY * speed * dt;
                clampCamera(cam);
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [active, clampCamera]);

    useEffect(() => {
        if (!active) return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ptr = pointerRef.current;

        const panByScreenDelta = (dx, dy) => {
            const z = camRef.current.zoom * baseViewZoom;
            camRef.current.x -= dx / z;
            camRef.current.y -= dy / z;
            clampCamera(camRef.current);
        };

        const onMouseMove = (e) => {
            if (ptr.dragging) {
                panByScreenDelta(e.clientX - ptr.lastX, e.clientY - ptr.lastY);
                ptr.lastX = e.clientX;
                ptr.lastY = e.clientY;
                ptr.edgeX = 0;
                ptr.edgeY = 0;
                return;
            }
            const rect = canvas.getBoundingClientRect();
            ptr.edgeX = edgeAxis(e.clientX - rect.left, rect.width);
            ptr.edgeY = edgeAxis(e.clientY - rect.top, rect.height);
        };

        const onMouseLeave = () => {
            ptr.edgeX = 0;
            ptr.edgeY = 0;
            if (!ptr.dragging) return;
        };

        const onMouseDown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            ptr.dragging = true;
            ptr.lastX = e.clientX;
            ptr.lastY = e.clientY;
            ptr.edgeX = 0;
            ptr.edgeY = 0;
        };

        const onMouseUp = () => {
            ptr.dragging = false;
        };

        const onWheel = (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1 / WHEEL_FACTOR : WHEEL_FACTOR;
            applyZoom(factor, e.clientX, e.clientY);
        };

        const onTouchStart = (e) => {
            if (e.touches.length >= 2) {
                e.preventDefault();
                ptr.pinchActive = true;
                ptr.dragging = false;
                ptr.lastPinchDist = touchDistance(e.touches);
                const c = touchCenter(e.touches);
                ptr.lastX = c.x;
                ptr.lastY = c.y;
                return;
            }
            if (e.touches.length === 1) {
                ptr.dragging = true;
                ptr.pinchActive = false;
                ptr.lastX = e.touches[0].clientX;
                ptr.lastY = e.touches[0].clientY;
                ptr.edgeX = 0;
                ptr.edgeY = 0;
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length >= 2 && ptr.pinchActive) {
                e.preventDefault();
                const dist = touchDistance(e.touches);
                const center = touchCenter(e.touches);
                if (ptr.lastPinchDist > 0 && dist > 0) {
                    applyZoom(dist / ptr.lastPinchDist, center.x, center.y);
                }
                panByScreenDelta(center.x - ptr.lastX, center.y - ptr.lastY);
                ptr.lastPinchDist = dist;
                ptr.lastX = center.x;
                ptr.lastY = center.y;
                return;
            }
            if (ptr.dragging && e.touches.length === 1) {
                e.preventDefault();
                const t = e.touches[0];
                panByScreenDelta(t.clientX - ptr.lastX, t.clientY - ptr.lastY);
                ptr.lastX = t.clientX;
                ptr.lastY = t.clientY;
            }
        };

        const onTouchEnd = (e) => {
            if (e.touches.length >= 2) {
                ptr.lastPinchDist = touchDistance(e.touches);
                const c = touchCenter(e.touches);
                ptr.lastX = c.x;
                ptr.lastY = c.y;
                return;
            }
            if (e.touches.length === 1) {
                ptr.pinchActive = false;
                ptr.dragging = true;
                ptr.lastX = e.touches[0].clientX;
                ptr.lastY = e.touches[0].clientY;
                return;
            }
            ptr.dragging = false;
            ptr.pinchActive = false;
            ptr.lastPinchDist = 0;
        };

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
        canvas.addEventListener('touchcancel', onTouchEnd);

        return () => {
            ptr.dragging = false;
            ptr.pinchActive = false;
            ptr.edgeX = 0;
            ptr.edgeY = 0;
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [active, canvasRef, baseViewZoom, applyZoom, clampCamera]);

    return { camRef, seed };
}
