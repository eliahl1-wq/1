import { useCallback, useEffect, useRef, useState } from 'react';

export const CASHOUT_HOLD_MS = 1500;

/**
 * Hold Q (or press-and-hold the cashout button) before starting the cashout timer.
 * Progress is pushed to `onProgress` every frame; React state is throttled for UI only.
 */
export function useHoldKeyCashout({ canStart, onComplete, onProgress }) {
    const [holdProgress, setHoldProgress] = useState(0);
    const startTimeRef = useRef(null);
    const rafRef = useRef(null);
    const lastUiUpdateRef = useRef(0);
    const canStartRef = useRef(canStart);
    const onCompleteRef = useRef(onComplete);
    const onProgressRef = useRef(onProgress);
    canStartRef.current = canStart;
    onCompleteRef.current = onComplete;
    onProgressRef.current = onProgress;

    const pushProgress = useCallback((progress) => {
        onProgressRef.current?.(progress);
        const now = Date.now();
        if (progress === 0 || now - lastUiUpdateRef.current >= 100) {
            lastUiUpdateRef.current = now;
            setHoldProgress(progress);
        }
    }, []);

    const cancelHold = useCallback(() => {
        if (startTimeRef.current == null) return;
        startTimeRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        pushProgress(0);
    }, [pushProgress]);

    const tick = useCallback(() => {
        const start = startTimeRef.current;
        if (start == null) return;

        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / CASHOUT_HOLD_MS);
        pushProgress(progress);

        if (progress >= 1) {
            startTimeRef.current = null;
            rafRef.current = null;
            pushProgress(0);
            onCompleteRef.current?.();
            return;
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [pushProgress]);

    const startHold = useCallback(() => {
        if (startTimeRef.current != null) return;
        if (typeof canStartRef.current === 'function' && !canStartRef.current()) return;
        startTimeRef.current = Date.now();
        lastUiUpdateRef.current = 0;
        pushProgress(0.001);
        rafRef.current = requestAnimationFrame(tick);
    }, [tick, pushProgress]);

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
