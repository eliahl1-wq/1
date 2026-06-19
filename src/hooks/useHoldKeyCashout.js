import { useCallback, useEffect, useRef, useState } from 'react';
import { CASHOUT_HOLD_MS } from '../game/cashoutRing.js';

export { CASHOUT_HOLD_MS };

/**
 * Hold Q (or press-and-hold the cashout button) before starting the cashout timer.
 * Canvas ring uses renderer.setHoldStart — no per-tick React state here (keeps game smooth).
 */
export function useHoldKeyCashout({ canStart, onComplete, onProgress, onHoldStart, onHoldEnd }) {
    const [isHolding, setIsHolding] = useState(false);
    const startTimeRef = useRef(null);
    const completeTimeoutRef = useRef(null);
    const canStartRef = useRef(canStart);
    const onCompleteRef = useRef(onComplete);
    const onProgressRef = useRef(onProgress);
    const onHoldStartRef = useRef(onHoldStart);
    const onHoldEndRef = useRef(onHoldEnd);
    canStartRef.current = canStart;
    onCompleteRef.current = onComplete;
    onProgressRef.current = onProgress;
    onHoldStartRef.current = onHoldStart;
    onHoldEndRef.current = onHoldEnd;

    const clearCompleteTimer = useCallback(() => {
        if (completeTimeoutRef.current) {
            clearTimeout(completeTimeoutRef.current);
            completeTimeoutRef.current = null;
        }
    }, []);

    const cancelHold = useCallback(() => {
        if (startTimeRef.current == null) return;
        startTimeRef.current = null;
        clearCompleteTimer();
        setIsHolding(false);
        onHoldEndRef.current?.();
        onProgressRef.current?.(0);
    }, [clearCompleteTimer]);

    const startHold = useCallback(() => {
        if (startTimeRef.current != null) return;
        if (typeof canStartRef.current === 'function' && !canStartRef.current()) return;
        const now = performance.now();
        startTimeRef.current = now;
        setIsHolding(true);
        onHoldStartRef.current?.(now);
        onProgressRef.current?.(0.001);

        completeTimeoutRef.current = setTimeout(() => {
            startTimeRef.current = null;
            clearCompleteTimer();
            setIsHolding(false);
            onHoldEndRef.current?.();
            onProgressRef.current?.(0);
            onCompleteRef.current?.();
        }, CASHOUT_HOLD_MS);
    }, [clearCompleteTimer]);

    const startHoldRef = useRef(startHold);
    const cancelHoldRef = useRef(cancelHold);
    startHoldRef.current = startHold;
    cancelHoldRef.current = cancelHold;

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code !== 'KeyQ' || e.repeat) return;
            startHoldRef.current();
        };
        const onKeyUp = (e) => {
            if (e.code !== 'KeyQ') return;
            e.preventDefault();
            cancelHoldRef.current();
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    return { isHolding, startHold, cancelHold };
}
