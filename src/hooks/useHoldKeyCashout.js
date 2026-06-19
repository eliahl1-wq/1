import { useCallback, useEffect, useRef } from 'react';
import { CASHOUT_HOLD_MS } from '../game/cashoutRing.js';

export { CASHOUT_HOLD_MS };

/**
 * Hold Q (or press-and-hold the cashout button) before starting the cashout timer.
 * Completion is detected on the canvas rAF loop (see renderer.setHoldCompleteCallback)
 * so a lag spike cannot stall setTimeout and cancel the hold via keyup.
 */
export function useHoldKeyCashout({ canStart, onComplete, onHoldStart, onHoldEnd }) {
    const holdingRef = useRef(false);
    const canStartRef = useRef(canStart);
    const onCompleteRef = useRef(onComplete);
    const onHoldStartRef = useRef(onHoldStart);
    const onHoldEndRef = useRef(onHoldEnd);
    canStartRef.current = canStart;
    onCompleteRef.current = onComplete;
    onHoldStartRef.current = onHoldStart;
    onHoldEndRef.current = onHoldEnd;

    const cancelHold = useCallback(() => {
        if (!holdingRef.current) return;
        holdingRef.current = false;
        onHoldEndRef.current?.();
    }, []);

    const startHold = useCallback(() => {
        if (holdingRef.current) return;
        if (typeof canStartRef.current === 'function' && !canStartRef.current()) return;
        holdingRef.current = true;
        onHoldStartRef.current?.(performance.now());
    }, []);

    const completeHold = useCallback(() => {
        if (!holdingRef.current) return;
        holdingRef.current = false;
        onHoldEndRef.current?.();
        onCompleteRef.current?.();
    }, []);

    const startHoldRef = useRef(startHold);
    const cancelHoldRef = useRef(cancelHold);
    const completeHoldRef = useRef(completeHold);
    startHoldRef.current = startHold;
    cancelHoldRef.current = cancelHold;
    completeHoldRef.current = completeHold;

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code !== 'KeyQ' || e.repeat) return;
            e.preventDefault();
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

    return { startHold, cancelHold, completeHold, isHoldingRef: holdingRef };
}
