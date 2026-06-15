import React, { useRef, useCallback, useEffect } from 'react';
import { isTouchDevice } from '../utils/mobile';

const IS_MOBILE = isTouchDevice();

function stopPointer(e) {
    e.stopPropagation();
    e.preventDefault();
}

function MobileBtn({ label, sub, accent, onPress, onRelease, onTap }) {
    return (
        <button
            type="button"
            className={`game-mobile-btn${accent ? ' game-mobile-btn--accent' : ''}`}
            onPointerDown={(e) => {
                stopPointer(e);
                e.currentTarget.setPointerCapture(e.pointerId);
                if (onTap) onTap();
                else onPress?.();
            }}
            onPointerUp={(e) => {
                stopPointer(e);
                onRelease?.();
            }}
            onPointerCancel={(e) => {
                stopPointer(e);
                onRelease?.();
            }}
        >
            <span className="game-mobile-btn-label">{label}</span>
            {sub && <span className="game-mobile-btn-sub">{sub}</span>}
        </button>
    );
}

/** Slither: hold to boost (same as mouse down on desktop). */
export function SlitherMobileControls({ onBoostChange }) {
    if (!IS_MOBILE) return null;

    const setBoost = useCallback((active) => onBoostChange?.(active), [onBoostChange]);

    return (
        <div className="game-mobile-controls game-mobile-controls--slither">
            <MobileBtn
                label="⚡"
                sub="BOOST"
                accent
                onPress={() => setBoost(true)}
                onRelease={() => setBoost(false)}
            />
        </div>
    );
}

/** Agar: split (tap) + eject mass (hold). */
export function AgarMobileControls({ onSplit, onEject }) {
    const ejectIntervalRef = useRef(null);

    useEffect(() => () => {
        if (ejectIntervalRef.current) clearInterval(ejectIntervalRef.current);
    }, []);

    if (!IS_MOBILE) return null;

    const startEject = () => {
        onEject?.();
        if (ejectIntervalRef.current) clearInterval(ejectIntervalRef.current);
        ejectIntervalRef.current = setInterval(() => onEject?.(), 120);
    };

    const stopEject = () => {
        if (ejectIntervalRef.current) {
            clearInterval(ejectIntervalRef.current);
            ejectIntervalRef.current = null;
        }
    };

    return (
        <div className="game-mobile-controls game-mobile-controls--agar">
            <MobileBtn label="W" sub="EJECT" onPress={startEject} onRelease={stopEject} />
            <MobileBtn label="⎵" sub="SPLIT" accent onTap={() => onSplit?.()} />
        </div>
    );
}

export { IS_MOBILE as isMobileGameClient };
