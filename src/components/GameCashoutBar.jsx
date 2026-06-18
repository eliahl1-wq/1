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
    holdProgress = 0,
    onHoldStart,
    onHoldEnd,
    localTimer = 0,
    cashOutTotal = 10,
    cashOutEndAt = 0,
    /** When true, hold progress is shown on the in-game canvas ring — not the button fill. */
    canvasHoldRing = false,
}) {
    const isHolding = holdProgress > 0 && holdProgress < 1;
    const securingProgress = useSecuringProgress(localTimer, cashOutTotal, cashOutEndAt);
    const showButtonFill = !canvasHoldRing && isHolding;

    const handleHoldStart = (e) => {
        e.preventDefault();
        if (disabled) return;
        onHoldStart?.();
    };

    const handleHoldEnd = (e) => {
        e.preventDefault();
        onHoldEnd?.();
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
                    className={`game-cashout-btn btn btn-primary${isHolding ? ' game-cashout-btn--holding' : ''}${holdProgress >= 1 ? ' game-cashout-btn--complete' : ''}`}
                    onMouseDown={handleHoldStart}
                    onMouseUp={handleHoldEnd}
                    onMouseLeave={handleHoldEnd}
                    onTouchStart={handleHoldStart}
                    onTouchEnd={handleHoldEnd}
                    onTouchCancel={handleHoldEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={disabled}
                >
                    {showButtonFill && (
                        <span
                            className="game-cashout-btn-progress"
                            style={{ transform: `scaleX(${holdProgress})` }}
                            aria-hidden
                        />
                    )}
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
