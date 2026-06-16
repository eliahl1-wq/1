import React, { useEffect, useState } from 'react';
import { isTouchDevice } from '../utils/mobile';
import { CASHOUT_HOLD_MS } from '../hooks/useHoldKeyCashout';
import { getCashoutRingProgress } from '../game/cashoutRing';

const IS_MOBILE = isTouchDevice();
const HOLD_SECONDS = CASHOUT_HOLD_MS / 1000;

function DollarIcon() {
    return <span className="game-cashout-icon game-cashout-dollar" aria-hidden>$</span>;
}

function KeyCap({ children }) {
    return <kbd className="game-keycap">{children}</kbd>;
}

export default function GameCashoutBar({
    disabled,
    holdProgress = 0,
    onHoldStart,
    onHoldEnd,
    localTimer = 0,
    cashOutTotal = 10,
    cashOutEndAt = 0,
}) {
    const isHolding = holdProgress > 0 && holdProgress < 1;
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (localTimer <= 0) return undefined;
        let rafId = 0;
        const tick = () => {
            setNow(Date.now());
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [localTimer]);

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
        const total = cashOutTotal || 10;
        const progress = cashOutEndAt
            ? getCashoutRingProgress(cashOutEndAt, total)
            : localTimer / total;
        const remainingSec = cashOutEndAt
            ? Math.max(0, Math.ceil((cashOutEndAt - now) / 1000))
            : localTimer;

        return (
            <div className="game-cashout-wrap">
                <div className="game-cashout-securing">
                    <div className="game-cashout-securing-head">
                        <span className="game-cashout-securing-label">Securing</span>
                        <span className="game-cashout-securing-time">{remainingSec}s</span>
                    </div>
                    <div className="game-cashout-securing-track">
                        <div
                            className="game-cashout-securing-fill"
                            style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
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
                    <span
                        className="game-cashout-btn-progress"
                        style={{ transform: `scaleX(${holdProgress})` }}
                        aria-hidden
                    />
                    <span className="game-cashout-btn-shine" aria-hidden />
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
