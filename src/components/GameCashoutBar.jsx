import React from 'react';
import { isTouchDevice } from '../utils/mobile';

const IS_MOBILE = isTouchDevice();

function ExitIcon() {
    return (
        <svg
            className="game-cashout-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
    );
}

export default function GameCashoutBar({
    disabled,
    onClick,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    localTimer = 0,
    cashOutTotal = 10,
}) {
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
                            style={{ width: `${(localTimer / (cashOutTotal || 10)) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="game-cashout-wrap">
            <button
                type="button"
                className="game-cashout-btn btn btn-primary"
                onClick={onClick}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                disabled={disabled}
            >
                <ExitIcon />
                Cash Out
            </button>
            {!IS_MOBILE && (
                <>
                    <span className="game-cashout-sep" aria-hidden>—</span>
                    <span className="game-cashout-hint">Hold Q to Cash Out</span>
                </>
            )}
        </div>
    );
}
