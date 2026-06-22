import React, { useEffect, useState } from 'react';
import { isTouchDevice } from '../utils/mobile';
import { CASHOUT_HOLD_MS } from '../hooks/useHoldKeyCashout';

const IS_MOBILE = isTouchDevice();
const HOLD_SECONDS = CASHOUT_HOLD_MS / 1000;

function DollarIcon() {
    return <span className="game-cashout-icon game-cashout-dollar" aria-hidden>$</span>;
}

function KeyCap({ children }) {
    return <kbd className="game-keycap">{children}</kbd>;
}

function useHoldLogic(disabled, onHoldStart, onHoldEnd, onComplete) {
    const [isHolding, setIsHolding] = useState(false);
    const completeTimeoutRef = useRef(null);
    const startRef = useRef(onHoldStart);
    const endRef = useRef(onHoldEnd);
    const compRef = useRef(onComplete);

    startRef.current = onHoldStart;
    endRef.current = onHoldEnd;
    compRef.current = onComplete;

    const clearCompleteTimer = useCallback(() => {
        if (completeTimeoutRef.current) {
            clearTimeout(completeTimeoutRef.current);
            completeTimeoutRef.current = null;
        }
    }, []);

    const cancelHold = useCallback(() => {
        setIsHolding(prev => {
            if (prev) {
                clearCompleteTimer();
                endRef.current?.();
            }
            return false;
        });
    }, [clearCompleteTimer]);

    const startHold = useCallback(() => {
        if (disabled) return;
        setIsHolding(prev => {
            if (!prev) {
                const now = performance.now();
                startRef.current?.(now);
                completeTimeoutRef.current = setTimeout(() => {
                    clearCompleteTimer();
                    setIsHolding(false);
                    endRef.current?.();
                    compRef.current?.();
                }, CASHOUT_HOLD_MS);
            }
            return true;
        });
    }, [disabled, clearCompleteTimer]);

    const startHoldRef = useRef(startHold);
    const cancelHoldRef = useRef(cancelHold);
    startHoldRef.current = startHold;
    cancelHoldRef.current = cancelHold;

    useEffect(() => {
        if (disabled) {
            cancelHold();
            return;
        }
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
            cancelHoldRef.current();
        };
    }, [disabled, cancelHold]);

    return { isHolding, startHold, cancelHold };
}

function useSecuringProgress(localTimer, cashOutTotal, cashOutEndAt) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (localTimer <= 0) {
            setProgress(0);
            return undefined;
        }

        const total = cashOutTotal || 10;
        let raf = 0;

        const tick = () => {
            const remainingSec = cashOutEndAt > 0
                ? Math.max(0, cashOutEndAt - Date.now()) / 1000
                : localTimer;
            const next = total > 0
                ? Math.min(1, Math.max(0, 1 - remainingSec / total))
                : 0;
            setProgress(next);
            if (remainingSec > 0) raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [localTimer, cashOutTotal, cashOutEndAt]);

    return progress;
}

export default function GameCashoutBar({
    disabled,
    onHoldStart,
    onHoldEnd,
    onComplete,
    localTimer = 0,
    cashOutTotal = 10,
    cashOutEndAt = 0,
}) {
    const securingProgress = useSecuringProgress(localTimer, cashOutTotal, cashOutEndAt);

    const { isHolding, startHold, cancelHold } = useHoldLogic(
        disabled || localTimer > 0,
        onHoldStart,
        onHoldEnd,
        onComplete
    );

    const handleHoldStart = (e) => {
        e.preventDefault();
        startHold();
    };

    const handleHoldEnd = (e) => {
        e.preventDefault();
        cancelHold();
    };

    if (localTimer > 0) {
        return (
            <div className="game-cashout-wrap">
                <div className="game-cashout-securing">
                    <div className="game-cashout-securing-head">
                        <span className="game-cashout-securing-label">Securing</span>
                        <span className="game-cashout-securing-time">{localTimer}s</span>
                    </div>
                    <div className="game-cashout-securing-track">
                        <div
                            className="game-cashout-securing-fill"
                            style={{ transform: `scaleX(${securingProgress})` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="game-cashout-wrap">
            <div className="game-cashout-stack">
                <button
                    type="button"
                    className={`game-cashout-btn btn btn-primary${isHolding ? ' game-cashout-btn--holding' : ''}`}
                    style={{ '--cashout-hold-ms': `${CASHOUT_HOLD_MS}ms` }}
                    onMouseDown={handleHoldStart}
                    onMouseUp={handleHoldEnd}
                    onMouseLeave={handleHoldEnd}
                    onTouchStart={handleHoldStart}
                    onTouchEnd={handleHoldEnd}
                    onTouchCancel={handleHoldEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={disabled}
                >
                    <span className="game-cashout-btn-progress" aria-hidden />
                    <span className="game-cashout-btn-content">
                        <DollarIcon />
                        Cash Out
                    </span>
                </button>
                {!IS_MOBILE && (
                    <p className="game-cashout-hint">
                        Hold <KeyCap>Q</KeyCap> for {HOLD_SECONDS} second{HOLD_SECONDS === 1 ? '' : 's'}
                    </p>
                )}
            </div>
        </div>
    );
}
