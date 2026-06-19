import { useCallback, useEffect, useRef, useState } from 'react';
import { CASHOUT_HOLD_MS } from '../game/cashoutRing.js';

export { CASHOUT_HOLD_MS };

/**
 * Hold Q (or press-and-hold the cashout button) before starting the cashout timer.
 * Completion uses wall-clock time so it still works when the game thread is busy.
 */
export function useHoldKeyCashout({ canStart, onComplete, onProgress, onHoldStart, onHoldEnd }) {
    const [isHolding, setIsHolding] = useState(false);
    const startTimeRef = useRef(null);
    const completedRef = useRef(false);
    const pollRafRef = useRef(null);
    const pollIntervalRef = useRef(null);
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

    const stopPoll = useCallback(() => {
        if (pollRafRef.current) {
            cancelAnimationFrame(pollRafRef.current);
            pollRafRef.current = null;
        }
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const finishHold = useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        startTimeRef.current = null;
        stopPoll();
        setIsHolding(false);
        onHoldEndRef.current?.();
        onProgressRef.current?.(0);
        onCompleteRef.current?.();
    }, [stopPoll]);

    const cancelHold = useCallback(() => {
        if (startTimeRef.current == null || completedRef.current) return;
        startTimeRef.current = null;
        stopPoll();
        setIsHolding(false);
        onHoldEndRef.current?.();
        onProgressRef.current?.(0);
    }, [stopPoll]);

    const startHold = useCallback(() => {
        if (startTimeRef.current != null) return;
        if (typeof canStartRef.current === 'function' && !canStartRef.current()) return;
        const now = performance.now();
        completedRef.current = false;
        startTimeRef.current = now;
        setIsHolding(true);
        onHoldStartRef.current?.(now);
        onProgressRef.current?.(0.001);

        const poll = () => {
            const started = startTimeRef.current;
            if (started == null || completedRef.current) {
                pollRafRef.current = null;
                return;
            }
            const progress = Math.min(1, (performance.now() - started) / CASHOUT_HOLD_MS);
            onProgressRef.current?.(progress);
            if (progress >= 1) {
                finishHold();
                return;
            }
            pollRafRef.current = requestAnimationFrame(poll);
        };
        pollRafRef.current = requestAnimationFrame(poll);

        pollIntervalRef.current = setInterval(() => {
            const started = startTimeRef.current;
            if (started == null || completedRef.current) return;
            const progress = Math.min(1, (performance.now() - started) / CASHOUT_HOLD_MS);
            if (progress >= 1) finishHold();
        }, 64);
    }, [finishHold]);

    const startHoldRef = useRef(startHold);
    const cancelHoldRef = useRef(cancelHold);
    startHoldRef.current = startHold;
    cancelHoldRef.current = cancelHold;

    useEffect(() => () => stopPoll(), [stopPoll]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code !== 'KeyQ' || e.repeat) return;
            e.preventDefault();
            startHoldRef.current();
        };
        const onKeyUp = (e) => {
            if (e.code !== 'KeyQ') return;
            e.preventDefault();
            const started = startTimeRef.current;
            if (started != null && !completedRef.current) {
                const progress = (performance.now() - started) / CASHOUT_HOLD_MS;
                if (progress < 0.98) cancelHoldRef.current();
                else finishHold();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [finishHold]);

    return { isHolding, startHold, cancelHold, finishHold };
}
