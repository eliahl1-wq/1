import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import './snake.js';
import './food.js';
import './game.js';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

export default function SlitherGame() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token: authToken } = useAuth();
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const [isConnected, setIsConnected] = useState(false);
    const [gameReady, setGameReady] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(1.0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [isDead, setIsDead] = useState(false);
    const [cashedAmount, setCashedAmount] = useState(null);
    const [displayCashedAmount, setDisplayCashedAmount] = useState(0);
    const [localTimer, setLocalTimer] = useState(0);
    const [resetCountdown, setResetCountdown] = useState(null);

    const matchNickname = location.state?.nickname || user?.username || 'Guest';

    const syncBalanceToServer = useCallback((balance) => {
        socketRef.current?.emit('slitherUpdateBalance', { balance });
    }, []);

    const startCashoutCountdown = useCallback((seconds) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        let timeLeft = seconds;
        setLocalTimer(timeLeft);
        const intervalId = setInterval(() => {
            timeLeft = Math.max(0, timeLeft - 1);
            setLocalTimer(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(intervalId);
                timerIntervalRef.current = null;
            }
        }, 1000);
        timerIntervalRef.current = intervalId;
    }, []);

    const handleCashOut = useCallback(() => {
        if (localTimer > 0 || cashedAmount !== null || isDead) return;
        socketRef.current?.emit('cashOut');
    }, [localTimer, cashedAmount, isDead]);

    const handleDeath = useCallback(() => {
        if (isDead || cashedAmount !== null) return;
        setIsDead(true);
        setLocalTimer(0);
        window.die = true;
        socketRef.current?.emit('playerDied');
        setTimeout(() => navigate('/pre-game', { state: { selectedMode: 'slither' } }), 4000);
    }, [isDead, cashedAmount, navigate]);

    useEffect(() => {
        document.body.style.backgroundColor = '#000';
        document.title = 'AgarStake | Slither Arena';

        if (!canvasRef.current || socketRef.current) return;
        if (typeof authToken !== 'string' || authToken.length === 0) return;

        const socket = io(API_URL, {
            auth: { token: authToken },
            transports: ['websocket'],
            reconnection: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            if (!hasJoinedRef.current) {
                socket.emit('joinGame', { username: matchNickname, token: authToken, mode: 'slither' });
                hasJoinedRef.current = true;
            }
        });

        socket.on('welcome', (playerSettings) => {
            setCurrentBalance(playerSettings.balance ?? 1.0);
            setGameReady(true);

            if (!window.gameInstance) {
                window.gameInstance = new window.game(canvasRef.current, matchNickname);
                window.onSnakeDie = () => handleDeath();
            }
        });

        socket.on('cashOutStarting', ({ seconds }) => {
            window.die = true;
            startCashoutCountdown(seconds);
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            setCashedAmount(amount);
            const startTime = performance.now();
            const duration = 1200;
            const animate = (time) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 4);
                setDisplayCashedAmount(eased * amount);
                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
            setTimeout(() => navigate('/pre-game', { state: { selectedMode: 'slither' } }), 4500);
        });

        socket.on('slitherState', ({ balance, resetTime }) => {
            if (resetTime) {
                const remaining = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
                setResetCountdown(remaining);
            }
        });

        socket.on('leaderboard', ({ leaderboard: lb }) => {
            setLeaderboard(lb.map((p) => ({
                id: p.id,
                name: p.name,
                balance: parseFloat(p.balance) || 0,
            })));
        });

        socket.on('forcedDisconnect', () => {
            alert('Connected from another window. Closing this session.');
            navigate('/pre-game', { state: { selectedMode: 'slither' } });
        });

        socket.on('error', (msg) => {
            console.error('Server error:', msg);
            alert(msg);
            navigate('/pre-game', { state: { selectedMode: 'slither' } });
        });

        socket.on('connect_error', (err) => {
            console.error('Connection failed:', err.message);
            setIsConnected(false);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            hasJoinedRef.current = false;
        });

        const uiUpdateInterval = setInterval(() => {
            if (window.mySnake?.[0]) {
                const score = window.mySnake[0].score || 0;
                const convertedBalance = 1.0 + score * 0.01;
                setCurrentBalance(convertedBalance);
                syncBalanceToServer(convertedBalance);
            }
        }, 500);

        return () => {
            clearInterval(uiUpdateInterval);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            window.die = true;
            window.onSnakeDie = null;
            if (window.gameInstance) {
                window.gameInstance.destroy();
                window.gameInstance = null;
            }
            if (socketRef.current) {
                socketRef.current.off();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            hasJoinedRef.current = false;
        };
    }, [authToken, matchNickname, navigate, handleDeath, startCashoutCountdown, syncBalanceToServer]);

    const formatResetTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, overflow: 'hidden', fontFamily: 'system-ui' }}>
            {(!isConnected || !gameReady) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: 'white', zIndex: 1000 }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '10px' }}>Connecting to Slither Arena...</h2>
                        <p style={{ opacity: 0.5 }}>Verifying session & entry fee...</p>
                    </div>
                </div>
            )}

            <canvas
                ref={canvasRef}
                style={{ display: 'block', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
            />

            {cashedAmount !== null && (
                <div className="modern-overlay-backdrop">
                    <div className="modern-overlay-card success">
                        <div className="overlay-badge success">Transaction Confirmed</div>
                        <h2 className="overlay-heading">Profit Secured</h2>
                        <div className="overlay-amount success">
                            <span className="unit">$</span>{displayCashedAmount.toFixed(2)}
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">Capital has been successfully reconciled to your account balance.</p>
                    </div>
                </div>
            )}

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

            <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 100 }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(20px)',
                    padding: '15px 25px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white', boxShadow: '0 0 20px rgba(124, 58, 255, 0.2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, opacity: 0.3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>Active Stake</h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                            ${(currentBalance ?? 0).toFixed(2)}
                        </div>
                        {localTimer > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#14F195', marginTop: '4px', fontWeight: '700' }}>
                                CASHING OUT: {localTimer}s
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleCashOut}
                        disabled={localTimer > 0 || isDead || cashedAmount !== null}
                        style={{
                            width: '100%', background: localTimer > 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #0DBF76 0%, #14F195 100%)',
                            color: localTimer > 0 ? 'rgba(255,255,255,0.4)' : '#001a0d', border: 'none', padding: '10px 0', borderRadius: '12px',
                            fontWeight: '800', fontSize: '0.8rem', letterSpacing: '1px',
                            cursor: localTimer > 0 ? 'not-allowed' : 'pointer',
                            transition: '0.2s all ease', boxShadow: '0 4px 20px rgba(20, 241, 149, 0.2)'
                        }}
                    >
                        {localTimer > 0 ? `SECURING... ${localTimer}s` : 'CASH OUT'}
                    </button>
                </div>
            </div>

            <div style={{ position: 'absolute', top: '30px', right: '30px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', zIndex: 100 }}>
                <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                        AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                    </span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Slither Mode v0.1</div>
                {resetCountdown != null && resetCountdown > 0 && (
                    <div style={{ color: 'rgba(255,180,80,0.7)', fontSize: '0.7rem', marginTop: '4px' }}>
                        Reset: {formatResetTime(resetCountdown)}
                    </div>
                )}
            </div>

            <div style={{
                position: 'absolute', top: '120px', right: '30px', width: '180px',
                background: 'rgba(16, 17, 24, 0.85)', backdropFilter: 'blur(20px)',
                padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
                color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 100
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>Leaderboard</h4>
                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.map((p, i) => (
                        <div key={p.id || i} style={{
                            display: 'flex', justifyContent: 'space-between',
                            color: p.name === matchNickname ? 'var(--accent)' : 'var(--text-bright)',
                            fontWeight: p.name === matchNickname ? '700' : '400'
                        }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{i + 1}. {p.name}</span>
                            <span className="mono">${(p.balance ?? 0).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>

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
            `}</style>
        </div>
    );
}
