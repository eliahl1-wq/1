import React, { useEffect, useState } from 'react';

function formatTimeSurvived(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

function TrophyIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0V4zM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M7 7H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function SkullIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 3C8.5 3 6 5.8 6 9.2c0 2.1 1 3.9 2.5 5.1V17h7v-2.7c1.5-1.2 2.5-3 2.5-5.1C18 5.8 15.5 3 12 3z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
            />
            <circle cx="9.5" cy="9.5" r="1.1" fill="currentColor" />
            <circle cx="14.5" cy="9.5" r="1.1" fill="currentColor" />
            <path d="M10 13.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M9 17v2M12 17v2M15 17v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function WalletIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

function EyeIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

function RefreshIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M21 12a9 9 0 1 1-2.64-6.36"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function HomeIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function GameResultModal({
    type,
    amount,
    timeSurvivedMs = 0,
    eliminations = 0,
    walletBalanceUsd = 0,
    walletBalanceSol = 0,
    solPrice = 0,
    isJoining = false,
    onPlayAgain,
    onHome,
    onSpectate,
    onClose,
    showSpectate = false,
}) {
    const isWin = type === 'cashout';
    const [displayAmount, setDisplayAmount] = useState(0);

    useEffect(() => {
        if (!isWin || amount == null) {
            setDisplayAmount(0);
            return undefined;
        }

        const target = Number(amount) || 0;
        const start = performance.now();
        const duration = 900;
        let raf;

        const tick = (t) => {
            const p = Math.min(1, (t - start) / duration);
            const eased = 1 - Math.pow(1 - p, 4);
            setDisplayAmount(eased * target);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(raf);
    }, [isWin, amount]);

    const amountSol = solPrice > 0 ? displayAmount / solPrice : 0;

    return (
        <div className="game-result-backdrop">
            <div className={`game-result-modal${isWin ? ' game-result-modal--win' : ''}`}>
                <button type="button" className="game-result-close" onClick={onClose} aria-label="Close">
                    ×
                </button>

                {isWin ? (
                    <>
                        <div className="game-result-trophy" aria-hidden="true">
                            <TrophyIcon />
                        </div>
                        <h2 className="game-result-title game-result-title--win">Cashout Successful!</h2>

                        <p className="game-result-label">Amount Received</p>
                        <div className="game-result-amount">
                            ${displayAmount.toFixed(2)}
                        </div>
                        <p className="game-result-sol">
                            {amountSol.toFixed(6)} SOL
                        </p>

                        <div className="game-result-divider" />

                        <div className="game-result-stats">
                            <div className="game-result-stat">
                                <div className="game-result-stat-icon game-result-stat-icon--time">
                                    <ClockIcon />
                                </div>
                                <div className="game-result-stat-value game-result-stat-value--time">
                                    {formatTimeSurvived(timeSurvivedMs)}
                                </div>
                                <div className="game-result-stat-label">Time Survived</div>
                            </div>
                            <div className="game-result-stat">
                                <div className="game-result-stat-icon game-result-stat-icon--kills">
                                    <SkullIcon />
                                </div>
                                <div className="game-result-stat-value game-result-stat-value--kills">
                                    {eliminations}
                                </div>
                                <div className="game-result-stat-label">Eliminations</div>
                            </div>
                        </div>

                        <div className="game-result-wallet">
                            <WalletIcon />
                            <span>
                                ${Number(walletBalanceUsd).toFixed(2)} / {Number(walletBalanceSol).toFixed(6)} SOL
                            </span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="game-result-badge game-result-badge--loss">Eliminated</div>
                        <h2 className="game-result-title">Game over</h2>
                        <p className="game-result-caption">Your stake was lost. Play again or return home.</p>
                    </>
                )}

                <div className="game-result-actions">
                    {!isWin && showSpectate && (
                        <button type="button" className="game-result-btn game-result-btn--ghost" onClick={onSpectate}>
                            <EyeIcon />
                            Spectate
                        </button>
                    )}
                    <button
                        type="button"
                        className="game-result-btn btn btn-primary game-result-btn--play"
                        onClick={onPlayAgain}
                        disabled={isJoining}
                    >
                        <RefreshIcon />
                        {isJoining ? 'Joining…' : 'Play Again'}
                    </button>
                    <button type="button" className="game-result-btn game-result-btn--ghost" onClick={onHome}>
                        <HomeIcon />
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
}
