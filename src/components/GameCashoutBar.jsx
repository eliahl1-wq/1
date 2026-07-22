import React, { useEffect, useState, useRef, useCallback } from 'react';
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
            e.preventDefault();
            startHoldRef.current();
        };
        const onKeyUp = (e) => {
            if (e.code !== 'KeyQ') return;
            e.preventDefault();
            cancelHoldRef.current();
        };
        const onVisibilityChange = () => {
            if (document.hidden) cancelHoldRef.current();
        };
        const onWindowBlur = () => cancelHoldRef.current();

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onWindowBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onWindowBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            cancelHoldRef.current();
        };
    }, [disabled, cancelHold]);

    return { isHolding, startHold, cancelHold };
}


export default function GameCashoutBar({
    disabled,
    onHoldStart,
    onHoldEnd,
    onComplete,
    pending = false,
}) {
    const { isHolding, startHold, cancelHold } = useHoldLogic(
        disabled || pending,
        onHoldStart,
        onHoldEnd,
        onComplete
    );

    useEffect(() => {
        if (!isHolding) return undefined;
        const blockOtherButtons = (event) => {
            const control = event.target?.closest?.('button, a, input, select, textarea, [role=button], .btn, .ui-btn');
            if (!control || control.closest('.game-cashout-btn')) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        document.addEventListener('pointerdown', blockOtherButtons, true);
        document.addEventListener('click', blockOtherButtons, true);
        return () => {
            document.removeEventListener('pointerdown', blockOtherButtons, true);
            document.removeEventListener('click', blockOtherButtons, true);
        };
    }, [isHolding]);

    const handleHoldStart = (e) => {
        e.preventDefault();
        startHold();
    };

    const handleHoldEnd = (e) => {
        e.preventDefault();
        cancelHold();
    };

    if (pending) {
        return (
            <div className="game-cashout-wrap" role="status" aria-live="polite">
                <div className="game-cashout-securing">
                    <div className="game-cashout-securing-head">
                        <span className="game-cashout-securing-label">Finalizing payout</span>
                        <span className="game-cashout-securing-time">...</span>
                    </div>
                    <div className="game-cashout-securing-track">
                        <div className="game-cashout-securing-fill game-cashout-securing-fill--pending" />
                    </div>
                </div>
            </div>
        );
    }


    return (
        <>
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
        </>
    );
}
