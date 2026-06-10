import React, { useEffect, useState } from 'react';

export function BRIntroOverlay({ show, prizePool, playerCount, entryFeeUsd = 5, onComplete }) {
    const [displayPool, setDisplayPool] = useState(0);
    const [phase, setPhase] = useState('pool');

    useEffect(() => {
        if (!show) {
            setDisplayPool(0);
            setPhase('pool');
            return;
        }

        const start = performance.now();
        const duration = 1400;
        let raf;

        const tick = (t) => {
            const p = Math.min(1, (t - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplayPool(eased * (prizePool || 0));
            if (p < 1) raf = requestAnimationFrame(tick);
            else setTimeout(() => setPhase('fight'), 400);
        };
        raf = requestAnimationFrame(tick);

        const done = setTimeout(() => onComplete?.(), 3200);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(done);
        };
    }, [show, prizePool, onComplete]);

    if (!show) return null;

    return (
        <div className="br-overlay-backdrop">
            <div className="br-overlay-card">
                {phase === 'pool' ? (
                    <>
                        <div className="br-overlay-label">PRIZE POOL</div>
                        <div className="br-overlay-amount">
                            <span className="br-unit">$</span>
                            {displayPool.toFixed(2)}
                        </div>
                        <div className="br-overlay-sub">
                            {playerCount} players · ${entryFeeUsd} entry · winner takes all
                        </div>
                    </>
                ) : (
                    <>
                        <div className="br-fight-text">FIGHT</div>
                        <div className="br-overlay-sub">Last one standing wins</div>
                    </>
                )}
            </div>
            <style>{`
                .br-overlay-backdrop {
                    position: fixed; inset: 0; z-index: 99998;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(5, 5, 8, 0.88); backdrop-filter: blur(12px);
                    animation: brFadeIn 0.35s ease-out;
                }
                .br-overlay-card { text-align: center; animation: brScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                .br-overlay-label {
                    font-size: 0.7rem; font-weight: 800; letter-spacing: 3px;
                    color: rgba(255,255,255,0.45); margin-bottom: 12px;
                }
                .br-overlay-amount {
                    font-size: clamp(3.5rem, 12vw, 6rem); font-weight: 900;
                    color: #14F195; font-family: ui-monospace, monospace;
                    text-shadow: 0 0 60px rgba(20, 241, 149, 0.35);
                    letter-spacing: -2px;
                }
                .br-unit { opacity: 0.35; margin-right: 4px; }
                .br-overlay-sub {
                    margin-top: 16px; font-size: 0.85rem; color: rgba(255,255,255,0.45); font-weight: 600;
                }
                .br-fight-text {
                    font-size: clamp(3rem, 10vw, 5rem); font-weight: 900; letter-spacing: 8px;
                    color: #fff; text-shadow: 0 0 40px rgba(124, 58, 255, 0.5);
                    animation: brPulse 0.6s ease-in-out infinite alternate;
                }
                @keyframes brFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes brScaleIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                @keyframes brPulse { from { transform: scale(1); } to { transform: scale(1.06); } }
            `}</style>
        </div>
    );
}

export function BRVictoryOverlay({ show, amount }) {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (!show || amount == null) {
            setDisplay(0);
            return;
        }
        const start = performance.now();
        const duration = 1800;
        let raf;
        const tick = (t) => {
            const p = Math.min(1, (t - start) / duration);
            const eased = 1 - Math.pow(1 - p, 4);
            setDisplay(eased * amount);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [show, amount]);

    if (!show || amount == null) return null;

    return (
        <div className="br-victory-backdrop">
            <div className="br-victory-rays" />
            <div className="br-victory-card">
                <div className="br-victory-badge">VICTORY ROYALE</div>
                <h2 className="br-victory-title">You Won!</h2>
                <div className="br-victory-amount">
                    <span className="br-unit">$</span>{display.toFixed(2)}
                </div>
                <p className="br-victory-caption">Prize sent to your account</p>
            </div>
            <style>{`
                .br-victory-backdrop {
                    position: fixed; inset: 0; z-index: 99999;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(4, 8, 6, 0.95); backdrop-filter: blur(20px);
                    animation: brFadeIn 0.4s ease-out;
                }
                .br-victory-rays {
                    position: absolute; width: 120vmax; height: 120vmax;
                    background: conic-gradient(from 0deg, transparent, rgba(20,241,149,0.06), transparent, rgba(124,58,255,0.06), transparent);
                    animation: brSpin 8s linear infinite;
                }
                .br-victory-card { position: relative; text-align: center; animation: brScaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
                .br-victory-badge {
                    display: inline-block; padding: 8px 16px; border-radius: 100px;
                    background: rgba(20, 241, 149, 0.12); border: 1px solid rgba(20, 241, 149, 0.35);
                    color: #14F195; font-size: 0.65rem; font-weight: 800; letter-spacing: 2px; margin-bottom: 20px;
                }
                .br-victory-title { color: #fff; font-size: 2rem; font-weight: 800; margin: 0 0 24px; }
                .br-victory-amount {
                    font-size: clamp(4rem, 14vw, 7rem); font-weight: 900; color: #14F195;
                    font-family: ui-monospace, monospace; letter-spacing: -3px;
                    text-shadow: 0 0 50px rgba(20, 241, 149, 0.3);
                }
                .br-victory-caption { margin-top: 32px; color: rgba(255,255,255,0.4); font-size: 0.9rem; }
                @keyframes brSpin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
