import React, { useCallback, useEffect, useRef } from 'react';
import { isTouchDevice } from '../utils/mobile';

const IS_MOBILE = isTouchDevice();

function stopPointer(event) {
    event.preventDefault();
    event.stopPropagation();
}

function pulseHaptic(duration = 8) {
    try {
        navigator.vibrate?.(duration);
    } catch {
        // Haptics are optional and unsupported on some mobile browsers.
    }
}

function measureJoystick(element) {
    const rect = element.getBoundingClientRect();
    return {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        max: Math.max(30, element.clientWidth * 0.34),
        forcedPortrait: window.matchMedia?.('(orientation: portrait)')?.matches || false,
    };
}

function toLocalJoystickDelta(event, element, cachedGeometry = null) {
    const geometry = cachedGeometry || measureJoystick(element);
    const screenDx = event.clientX - geometry.centerX;
    const screenDy = event.clientY - geometry.centerY;
    const dx = geometry.forcedPortrait ? screenDy : screenDx;
    const dy = geometry.forcedPortrait ? -screenDx : screenDy;
    const max = geometry.max;
    const length = Math.hypot(dx, dy);
    const scale = length > max ? max / length : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;
    const rawMagnitude = Math.min(1, length / max);
    const deadzone = 0.1;
    const magnitude = rawMagnitude <= deadzone ? 0 : (rawMagnitude - deadzone) / (1 - deadzone);
    const directionX = length > 0 ? dx / length : 0;
    const directionY = length > 0 ? dy / length : 0;
    return {
        knobX,
        knobY,
        x: directionX * magnitude,
        y: directionY * magnitude,
        magnitude,
    };
}

function VirtualJoystick({ label, variant, onChange }) {
    const pointerIdRef = useRef(null);
    const geometryRef = useRef(null);
    const rootRef = useRef(null);
    const knobRef = useRef(null);

    const updateVisual = useCallback((x, y, active) => {
        rootRef.current?.classList.toggle('is-active', active);
        knobRef.current?.style.setProperty('--surviv-knob-x', `${x}px`);
        knobRef.current?.style.setProperty('--surviv-knob-y', `${y}px`);
    }, []);

    const update = useCallback((event) => {
        const next = toLocalJoystickDelta(event, event.currentTarget, geometryRef.current);
        updateVisual(next.knobX, next.knobY, true);
        onChange?.(next.x, next.y, next.magnitude);
    }, [onChange, updateVisual]);

    const release = useCallback((event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        stopPointer(event);
        pointerIdRef.current = null;
        geometryRef.current = null;
        updateVisual(0, 0, false);
        onChange?.(0, 0, 0);
    }, [onChange, updateVisual]);

    useEffect(() => () => onChange?.(0, 0, 0), [onChange]);

    return (
        <div
            ref={rootRef}
            className={`surviv-mobile-stick surviv-mobile-stick--${variant}`}
            role="application"
            aria-label={label}
            aria-roledescription="virtual joystick"
            onPointerDown={(event) => {
                if (pointerIdRef.current != null && pointerIdRef.current !== event.pointerId) return;
                stopPointer(event);
                pointerIdRef.current = event.pointerId;
                geometryRef.current = measureJoystick(event.currentTarget);
                event.currentTarget.setPointerCapture(event.pointerId);
                pulseHaptic(6);
                update(event);
            }}
            onPointerMove={(event) => {
                if (pointerIdRef.current !== event.pointerId) return;
                stopPointer(event);
                update(event);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="surviv-mobile-stick-ring" />
            <div ref={knobRef} className="surviv-mobile-stick-knob" />
            <span className="surviv-mobile-stick-caption">{variant === 'aim' ? 'AIM / FIRE' : 'MOVE'}</span>
        </div>
    );
}

function ActionIcon({ type }) {
    if (type === 'inventory') {
        return <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M8 8V5a4 4 0 0 1 8 0v3" /></>;
    }
    if (type === 'reload') {
        return <><path d="M20 6v5h-5" /><path d="M18.5 15a7 7 0 1 1-.5-8.5L20 8" /></>;
    }
    if (type === 'heal') {
        return <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></>;
    }
    return <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="5" /></>;
}

function ActionButton({ label, shortLabel, badge, type, onPress, onRelease, accent, active, disabled = false }) {
    const pointerIdRef = useRef(null);

    const releasePointer = useCallback((event) => {
        if (pointerIdRef.current == null) return;
        if (event?.pointerId != null && event.pointerId !== pointerIdRef.current) return;
        if (event) stopPointer(event);
        pointerIdRef.current = null;
        onRelease?.();
    }, [onRelease]);

    return (
        <button
            type="button"
            className={`surviv-mobile-action${accent ? ' is-accent' : ''}${active ? ' is-active' : ''}`}
            aria-label={label}
            title={label}
            disabled={disabled}
            onPointerDown={(event) => {
                if (pointerIdRef.current != null || disabled) return;
                stopPointer(event);
                pointerIdRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                pulseHaptic(accent ? 12 : 8);
                onPress?.();
            }}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onLostPointerCapture={() => releasePointer()}
            onKeyDown={(event) => {
                if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                event.stopPropagation();
                onPress?.();
            }}
            onKeyUp={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onRelease?.();
            }}
        >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <ActionIcon type={type} />
            </svg>
            <span className="surviv-mobile-action-label">{shortLabel}</span>
            {badge != null && <span className="surviv-mobile-action-badge">{badge}</span>}
        </button>
    );
}
function SurvivMobileControls({
    onMove,
    onAim,
    onInventory,
    onReload,
    onHeal,
    onInteract,
    onInteractEnd,
    canInteract,
    canReload,
    canHeal,
    isReloading,
    medkitCount = 0,
}) {
    if (!IS_MOBILE) return null;

    return (
        <div className="surviv-mobile-controls" aria-label="Surviv mobile controls">
            <VirtualJoystick label="Move" variant="move" onChange={onMove} />
            <div className="surviv-mobile-actions">
                <ActionButton label="Inventory" shortLabel="BAG" type="inventory" onPress={onInventory} />
                <ActionButton label={isReloading ? 'Reloading' : 'Reload weapon'} shortLabel={isReloading ? '...' : 'RLD'} type="reload" onPress={onReload} active={isReloading} disabled={!canReload} />
                <ActionButton label="Use medkit" shortLabel="MED" badge={medkitCount} type="heal" onPress={onHeal} disabled={!canHeal} />
                <ActionButton label={canInteract ? 'Pick up nearby item' : 'Nothing nearby'} shortLabel="TAKE" type="interact" onPress={onInteract} onRelease={onInteractEnd} accent={canInteract} disabled={!canInteract} />
            </div>
            <VirtualJoystick label="Aim and fire" variant="aim" onChange={onAim} />
        </div>
    );
}

export default React.memo(SurvivMobileControls);
