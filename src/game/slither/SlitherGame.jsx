import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Vi importerar klasserna men hanterar initieringen manuellt i useEffect
import './snake.js';
import './food.js';
import './game.js';

export default function SlitherGame() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshUser } = useAuth();
    const gameInstance = useRef(null);
    
    // State för UI (samma som i Game.jsx)
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [isDead, setIsDead] = useState(false);
    const [cashedAmount, setCashedAmount] = useState(null);
    const [displayCashedAmount, setDisplayCashedAmount] = useState(0);
    const [localTimer, setLocalTimer] = useState(0);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        document.body.style.backgroundColor = '#000';
        document.title = "AgarStake | Slither Arena";
        
        // Global callback för när man dör i spelet
        window.onSnakeDie = (score) => {
            setIsDead(true);
            setTimeout(() => navigate('/pre-game'), 4000);
        };

        // Initiera spelet
        if (window.game) {
            gameInstance.current = new window.game();
            // Sätt spelarens namn direkt
            const matchNickname = location.state?.nickname || user?.username || 'Guest';
            if (window.mySnake && window.mySnake[0]) {
                window.mySnake[0].name = matchNickname;
            }
        }

        // Uppdateringsloop för UI (60fps för att läsa värden från spelmotorn)
        const uiInterval = setInterval(() => {
            if (window.mySnake && window.mySnake[0]) {
                // Konvertera Slither-score till dollar ($1 start + ökning)
                // AgarStake ratio: Varje 200 poäng är ca $1.00 vinst utöver start
                const score = window.mySnake[0].score || 0;
                const convertedBalance = 1.00 + (Math.max(0, score - 200) / 200);
                setCurrentBalance(convertedBalance);

                // Uppdatera leaderboarden från spelmotorn
                const snakes = [...(window.mySnake || [])]
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10)
                    .map(s => ({
                        id: s.name,
                        name: s.name,
                        balance: 1.00 + (Math.max(0, s.score - 200) / 200)
                    }));
                setLeaderboard(snakes);
            }
            setCurrentTime(Date.now());
        }, 100);

        return () => {
            clearInterval(uiInterval);
            window.die = true; 
            window.onSnakeDie = null;
            const canvas = document.querySelector('canvas');
            if (canvas && canvas.parentNode === document.body) {
                document.body.removeChild(canvas);
            }
        };
    }, [user, navigate, location.state]);

    const handleCashOut = () => {
        // Simulera cashout (precis som i Agar)
        const finalAmount = currentBalance;
        setCashedAmount(finalAmount);
        window.die = true;

        const startTime = performance.now();
        const duration = 1200;
        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplayCashedAmount(eased * finalAmount);
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        setTimeout(() => navigate('/pre-game'), 4500);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, overflow: 'hidden', fontFamily: 'system-ui' }}>
            {/* Overlay: Vinst */}
            {cashedAmount !== null && (
                <div className="modern-overlay-backdrop">
                    <div className="modern-overlay-card success">
                        <div className="overlay-badge success">Transaction Confirmed</div>
                        <h2 className="overlay-heading">Profit Secured</h2>
                        <div className="overlay-amount success">
                            <span className="unit">$</span>{displayCashedAmount.toFixed(4)}
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">Capital has been successfully reconciled to your account balance.</p>
                    </div>
                </div>
            )}

            {/* Overlay: Död */}
            {isDead && (
                <div className="modern-overlay-backdrop death">
                    <div className="modern-overlay-card death">
                        <div className="overlay-badge error">Session Terminated</div>
                        <h2 className="overlay-heading">Eliminated</h2>
                        <div className="overlay-icon error">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">Your stake has been liquidated. Redirecting to terminal...</p>
                    </div>
                </div>
            )}

            {/* UI: Active Stake */}
            <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 100 }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(20px)',
                    padding: '15px 25px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white', boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, opacity: 0.3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>Active Stake</h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                            ${(currentBalance ?? 0).toFixed(4)}
                        </div>
                    </div>
                    <button
                        onClick={handleCashOut}
                        style={{
                            width: '100%', background: 'linear-gradient(135deg, #0DBF76 0%, #14F195 100%)',
                            color: '#001a0d', border: 'none', padding: '10px 0', borderRadius: '12px',
                            fontWeight: '800', fontSize: '0.8rem', letterSpacing: '1px', cursor: 'pointer',
                            transition: '0.2s all ease', boxShadow: '0 4px 20px rgba(20, 241, 149, 0.2)'
                        }}
                    >
                        CASH OUT
                    </button>
                </div>
            </div>

            {/* UI: Logo */}
            <div style={{ position: 'absolute', top: '30px', right: '30px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 7, height: 7, background: '#007AFF', borderRadius: '50%', boxShadow: '0 0 10px #007AFF' }} />
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                        AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
                    </span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Slither Mode v0.1</div>
            </div>

            {/* UI: Leaderboard */}
            <div style={{
                position: 'absolute', top: '120px', right: '30px', width: '180px',
                background: 'rgba(16, 17, 24, 0.85)', backdropFilter: 'blur(20px)',
                padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
                color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>Leaderboard</h4>
                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.map((p, i) => (
                        <div key={i} style={{ 
                            display: 'flex', justifyContent: 'space-between', 
                            color: p.name === (location.state?.nickname || user?.username) ? '#007AFF' : 'var(--text-bright)',
                            fontWeight: p.name === (location.state?.nickname || user?.username) ? '700' : '400'
                        }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{i + 1}. {p.name}</span>
                            <span className="mono">${(p.balance ?? 0).toFixed(4)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls Info */}
            <div style={{ position: 'absolute', bottom: '30px', left: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                Mouse to Move • Click to Boost
            </div>

            <style>{`
                .modern-overlay-backdrop {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    background: rgba(5, 5, 7, 0.98); backdrop-filter: blur(20px);
                    animation: overlayIn 0.3s ease-out forwards; width: 100vw; height: 100vh;
                }
                .modern-overlay-backdrop.death { background: rgba(12, 3, 3, 0.98); }
                .modern-overlay-card {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    width: 100%; max-width: 640px; padding: 100px 40px;
                    animation: contentIn 0.6s cubic-bezier(0.2, 1, 0.2, 1) forwards;
                }
                .overlay-badge {
                    display: inline-block; padding: 6px 12px; border-radius: 100px;
                    font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
                    letter-spacing: 1.2px; margin-bottom: 80px;
                }
                .overlay-badge.success { background: rgba(20, 241, 149, 0.1); color: #14F195; }
                .overlay-badge.error { background: rgba(255, 59, 48, 0.1); color: #FF3B30; }
                .overlay-heading { color: white; font-size: 2.2rem; font-weight: 800; margin: 0 0 40px 0; text-align: center; }
                .overlay-amount {
                    font-size: 6rem; font-weight: 900; letter-spacing: -3px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    line-height: 0.9; margin-bottom: 90px; text-align: center;
                }
                .overlay-amount.success { color: #14F195; text-shadow: 0 0 40px rgba(20, 241, 149, 0.15); }
                .overlay-amount .unit { opacity: 0.2; margin-right: 4px; }
                .overlay-divider { width: 32px; height: 2px; background: rgba(255, 255, 255, 0.1); margin: 80px auto; }
                .overlay-caption { color: rgba(255, 255, 255, 0.4); font-size: 0.95rem; font-weight: 500; text-align: center; }
                .overlay-icon.error { color: #FF3B30; margin-bottom: 40px; }
                @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes contentIn {
                    from { opacity: 0; transform: translateY(40px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                canvas { position: absolute; top: 0; left: 0; z-index: 1; }
            `}</style>
        </div>
    );
}