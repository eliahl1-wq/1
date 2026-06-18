import { useCallback, useEffect, useRef, useState } from 'react';
import { CASHOUT_HOLD_MS } from '../game/cashoutRing.js';

export { CASHOUT_HOLD_MS };

const UI_TICK_MS = 50;

/**
 * Hold Q (or press-and-hold the cashout button) before starting the cashout timer.
 * Canvas progress should read wall-clock from the renderer; this hook only drives UI + completion.
 */
export function useHoldKeyCashout({ canStart, onComplete, onProgress, onHoldStart, onHoldEnd }) {
    const [holdProgress, setHoldProgress] = useState(0);
    const startTimeRef = useRef(null);
    const uiIntervalRef = useRef(null);
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

    const pushProgress = useCallback((progress) => {
        onProgressRef.current?.(progress);
        setHoldProgress(progress);
    }, []);

    const clearTimers = useCallback(() => {
        if (uiIntervalRef.current) {
            clearInterval(uiIntervalRef.current);
            uiIntervalRef.current = null;
        }
        if (completeTimeoutRef.current) {
            clearTimeout(completeTimeoutRef.current);
            completeTimeoutRef.current = null;
        }
    }, []);

    const cancelHold = useCallback(() => {
        if (startTimeRef.current == null) return;
        startTimeRef.current = null;
        clearTimers();
        onHoldEndRef.current?.();
        pushProgress(0);
    }, [clearTimers, pushProgress]);

    const tickUi = useCallback(() => {
        const start = startTimeRef.current;
        if (start == null) return;
        const progress = Math.min(1, (performance.now() - start) / CASHOUT_HOLD_MS);
        pushProgress(progress);
    }, [pushProgress]);

    const startHold = useCallback(() => {
        if (startTimeRef.current != null) return;
        if (typeof canStartRef.current === 'function' && !canStartRef.current()) return;
        const now = performance.now();
        startTimeRef.current = now;
        onHoldStartRef.current?.(now);
        pushProgress(0.001);
        uiIntervalRef.current = setInterval(tickUi, UI_TICK_MS);
        completeTimeoutRef.current = setTimeout(() => {
            startTimeRef.current = null;
            clearTimers();
            onHoldEndRef.current?.();
            pushProgress(0);
            onCompleteRef.current?.();
        }, CASHOUT_HOLD_MS);
    }, [clearTimers, pushProgress, tickUi]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code !== 'KeyQ' || e.repeat) return;
            startHold();
        };
        const onKeyUp = (e) => {
            if (e.code !== 'KeyQ') return;
            cancelHold();
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            cancelHold();
        };
    }, [startHold, cancelHold]);

    return { holdProgress, startHold, cancelHold, isHolding: holdProgress > 0 };
}
