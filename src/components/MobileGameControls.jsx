import React, { useRef, useCallback, useState } from 'react';
import { isTouchDevice } from '../utils/mobile';

const IS_MOBILE = isTouchDevice();

function stopPointer(e) {
    e.stopPropagation();
    e.preventDefault();
}

/** Gray boost bolt — icon only (no text; avoids mobile text-selection bugs). */
function BoostIcon({ active }) {
    return (
        <svg
            className="game-mobile-btn-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
        >
            <path
                d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
                fill={active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.48)'}
                stroke={active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)'}
                strokeWidth="0.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function MobileBtn({ children, ariaLabel, onPress, onRelease, onTap }) {
    const [active, setActive] = useState(false);

    return (
        <button
            type="button"
            className={`game-mobile-btn${active ? ' game-mobile-btn--active' : ''}`}
            aria-label={ariaLabel}
            onPointerDown={(e) => {
                stopPointer(e);
                e.currentTarget.setPointerCapture(e.pointerId);
                setActive(true);
                if (onTap) onTap();
                else onPress?.();
            }}
            onPointerUp={(e) => {
                stopPointer(e);
                setActive(false);
                onRelease?.();
            }}
            onPointerCancel={(e) => {
                stopPointer(e);
                setActive(false);
                onRelease?.();
            }}
        >
            {children}
        </button>
    );
}

/** Slither: hold to boost (same as mouse down on desktop). */
export function SlitherMobileControls({ onBoostChange }) {
    if (!IS_MOBILE) return null;

    const setBoost = useCallback((active) => onBoostChange?.(active), [onBoostChange]);
    const [boosting, setBoosting] = useState(false);

    const press = () => {
        setBoosting(true);
        setBoost(true);
    };
    const release = () => {
        setBoosting(false);
        setBoost(false);
    };

    return (
        <div className="game-mobile-controls game-mobile-controls--slither">
            <MobileBtn ariaLabel="Boost" onPress={press} onRelease={release}>
                <BoostIcon active={boosting} />
            </MobileBtn>
        </div>
    );
}

/** Agar: split (tap). Eject is double-tap on the canvas (see Game.jsx). */
export function AgarMobileControls({ onSplit }) {
    if (!IS_MOBILE) return null;

    return (
        <div className="game-mobile-controls game-mobile-controls--agar">
            <MobileBtn ariaLabel="Split" onTap={() => onSplit?.()}>
                <span className="game-mobile-btn-text">Split</span>
            </MobileBtn>
        </div>
    );
}

export { IS_MOBILE as isMobileGameClient };

/** Double-tap on canvas → eject mass (mobile Agar only). */
export function useMobileDoubleTapEject(enabled, onEject) {
    const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

    return useCallback((clientX, clientY) => {
        if (!enabled || !IS_MOBILE) return false;
        const now = Date.now();
        const last = lastTapRef.current;
        const dt = now - last.time;
        const dist = Math.hypot(clientX - last.x, clientY - last.y);
        if (dt > 0 && dt < 320 && dist < 48) {
            lastTapRef.current = { time: 0, x: 0, y: 0 };
            onEject?.();
            return true;
        }
        lastTapRef.current = { time: now, x: clientX, y: clientY };
        return false;
    }, [enabled, onEject]);
}
