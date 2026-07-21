import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isTouchDevice } from '../utils/mobile';

const IS_MOBILE = isTouchDevice();

function stopPointer(event) {
    event.preventDefault();
    event.stopPropagation();
}

function toLocalJoystickDelta(event, element) {
    const rect = element.getBoundingClientRect();
    const screenDx = event.clientX - (rect.left + rect.width / 2);
    const screenDy = event.clientY - (rect.top + rect.height / 2);
    const forcedPortrait = window.matchMedia?.('(orientation: portrait)')?.matches;
    const dx = forcedPortrait ? screenDy : screenDx;
    const dy = forcedPortrait ? -screenDx : screenDy;
    const max = Math.max(30, element.clientWidth * 0.34);
    const length = Math.hypot(dx, dy);
    const scale = length > max ? max / length : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;
    return {
        knobX,
        knobY,
        x: knobX / max,
        y: knobY / max,
        magnitude: Math.min(1, length / max),
    };
}

function VirtualJoystick({ label, variant, onChange }) {
    const pointerIdRef = useRef(null);
    const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

    const update = useCallback((event) => {
        const next = toLocalJoystickDelta(event, event.currentTarget);
        setKnob({ x: next.knobX, y: next.knobY, active: true });
        onChange?.(next.x, next.y, next.magnitude);
    }, [onChange]);

    const release = useCallback((event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        stopPointer(event);
        pointerIdRef.current = null;
        setKnob({ x: 0, y: 0, active: false });
        onChange?.(0, 0, 0);
    }, [onChange]);

    useEffect(() => () => onChange?.(0, 0, 0), [onChange]);

    return (
        <div
            className={`surviv-mobile-stick surviv-mobile-stick--${variant}${knob.active ? ' is-active' : ''}`}
            role="application"
            aria-label={label}
            aria-roledescription="virtual joystick"
            onPointerDown={(event) => {
                if (pointerIdRef.current != null && pointerIdRef.current !== event.pointerId) return;
                stopPointer(event);
                pointerIdRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
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
            <div
                className="surviv-mobile-stick-knob"
                style={{ left: `calc(50% + ${knob.x}px)`, top: `calc(50% + ${knob.y}px)` }}
            />
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

function ActionButton({ label, type, onPress, onRelease, accent, disabled = false }) {
    return (
        <button
            type="button"
            className={`surviv-mobile-action${accent ? ' is-accent' : ''}`}
            aria-label={label}
            title={label}
            disabled={disabled}
            onPointerDown={(event) => {
                stopPointer(event);
                event.currentTarget.setPointerCapture(event.pointerId);
                onPress?.();
            }}
            onPointerUp={(event) => { stopPointer(event); onRelease?.(); }}
            onPointerCancel={(event) => { stopPointer(event); onRelease?.(); }}
            onLostPointerCapture={() => onRelease?.()}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
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
}) {
    if (!IS_MOBILE) return null;

    return (
        <div className="surviv-mobile-controls" aria-label="Surviv mobile controls">
            <VirtualJoystick label="Move" variant="move" onChange={onMove} />
            <div className="surviv-mobile-actions">
                <ActionButton label="Inventory" type="inventory" onPress={onInventory} />
                <ActionButton label={isReloading ? 'Reloading' : 'Reload weapon'} type="reload" onPress={onReload} disabled={!canReload} />
                <ActionButton label="Use medkit" type="heal" onPress={onHeal} disabled={!canHeal} />
                <ActionButton label={canInteract ? 'Interact with nearby item' : 'Nothing nearby'} type="interact" onPress={onInteract} onRelease={onInteractEnd} accent={canInteract} disabled={!canInteract} />
            </div>
            <VirtualJoystick label="Aim and fire" variant="aim" onChange={onAim} />
        </div>
    );
}

export default React.memo(SurvivMobileControls);
