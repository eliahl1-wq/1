import React, { useEffect, useState } from 'react';

export default function GameResultModal({ type, amount, onPlayAgain, onLobby }) {
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

    return (
        <div className="game-result-backdrop">
            <div className={`game-result-modal${isWin ? ' game-result-modal--win' : ''}`}>
                {isWin ? (
                    <>
                        <div className="game-result-badge game-result-badge--win">Cash out</div>
                        <h2 className="game-result-title">You won</h2>
                        <div className="game-result-amount">
                            <span className="game-result-amount-unit">$</span>
                            {displayAmount.toFixed(2)}
                        </div>
                        <p className="game-result-caption">Added to your account balance</p>
                    </>
                ) : (
                    <>
                        <div className="game-result-badge game-result-badge--loss">Eliminated</div>
                        <h2 className="game-result-title">Game over</h2>
                        <p className="game-result-caption">Your stake was lost. Play again or return to the lobby.</p>
                    </>
                )}

                <div className="game-result-actions">
                    <button type="button" className="game-result-btn game-result-btn--primary" onClick={onPlayAgain}>
                        Play again
                    </button>
                    <button type="button" className="game-result-btn game-result-btn--secondary" onClick={onLobby}>
                        Lobby
                    </button>
                </div>
            </div>
        </div>
    );
}
