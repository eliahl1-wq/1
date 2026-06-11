import { useCallback, useEffect, useRef, useState } from 'react';

export const CASHOUT_HOLD_MS = 1500;

/**
 * Hold Q (or press-and-hold the cashout button) before starting the cashout timer.
 */
export function useHoldKeyCashout({ canStart, onComplete }) {
    const [holdProgress, setHoldProgress] = useState(0);
    const startTimeRef = useRef(null);
    const rafRef = useRef(null);
    const canStartRef = useRef(canStart);
    const onCompleteRef = useRef(onComplete);
    canStartRef.current = canStart;
    onCompleteRef.current = onComplete;

    const cancelHold = useCallback(() => {
        if (startTimeRef.current == null) return;
        startTimeRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setHoldProgress(0);
    }, []);

    const tick = useCallback(() => {
        const start = startTimeRef.current;
        if (start == null) return;

        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / CASHOUT_HOLD_MS);
        setHoldProgress(progress);

        if (progress >= 1) {
            startTimeRef.current = null;
            rafRef.current = null;
            setHoldProgress(0);
            onCompleteRef.current?.();
            return;
        }

        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const startHold = useCallback(() => {
        if (startTimeRef.current != null) return;
        if (typeof canStartRef.current === 'function' && !canStartRef.current()) return;
        startTimeRef.current = Date.now();
        setHoldProgress(0.001);
        rafRef.current = requestAnimationFrame(tick);
    }, [tick]);

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
