import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { SlitherRenderer } from './SlitherRenderer.js';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

export default function SlitherGame() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token: authToken } = useAuth();
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const rendererRef = useRef(null);
    const inputIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const cashoutActiveRef = useRef(false);

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

    const startCashoutCountdown = useCallback((seconds) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        cashoutActiveRef.current = true;
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

    useEffect(() => {
        document.body.style.backgroundColor = '#000';
        document.title = 'AgarStake | Slither Arena';

        if (!canvasRef.current) return;
        if (typeof authToken !== 'string' || authToken.length === 0) return;

        // React Strict Mode runs effect twice — tear down any prior socket first
        if (socketRef.current) {
            socketRef.current.off();
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        if (inputIntervalRef.current) {
            clearInterval(inputIntervalRef.current);
            inputIntervalRef.current = null;
        }

        const renderer = new SlitherRenderer(canvasRef.current);
        rendererRef.current = renderer;
        renderer.start();

        const emitInput = () => {
            if (socketRef.current?.connected && rendererRef.current) {
                socketRef.current.emit('slitherInput', rendererRef.current.getInput());
            }
        };
        renderer.setInputEmitter(emitInput);

        const socket = io(API_URL, {
            auth: { token: authToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 20000,
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
            localStorage.setItem('current_game_mode', 'slither');
            setCurrentBalance(playerSettings.balance ?? 1.0);
            setGameReady(true);
        });

        socket.on('slitherTick', (tick) => {
            renderer.updateState(tick);
            if (tick.balance != null) setCurrentBalance(tick.balance);
            if (tick.resetTime) {
                setResetCountdown(Math.max(0, Math.ceil((tick.resetTime - Date.now()) / 1000)));
            }
        });

        socket.on('cashOutStarting', ({ seconds }) => {
            startCashoutCountdown(seconds);
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            cashoutActiveRef.current = false;
            localStorage.removeItem('current_game_mode');
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

        socket.on('leaderboard', ({ leaderboard: lb }) => {
            setLeaderboard(lb.map(p => ({
                id: p.id,
                name: p.name,
                balance: parseFloat(p.balance) || 0,
            })));
        });

        socket.on('RIP', () => {
            setIsDead(true);
            setLocalTimer(0);
            localStorage.removeItem('current_game_mode');
            setTimeout(() => navigate('/pre-game', { state: { selectedMode: 'slither' } }), 4000);
        });

        socket.on('forcedDisconnect', () => {
            alert('Connected from another window. Closing this session.');
            navigate('/pre-game', { state: { selectedMode: 'slither' } });
        });

        socket.on('error', (msg) => {
            console.error('Server error:', msg);
            if (cashoutActiveRef.current) cashoutActiveRef.current = false;
            alert(msg);
        });

        socket.on('connect_error', (err) => {
            console.error('Connection failed:', err.message);
            setIsConnected(false);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            hasJoinedRef.current = false;
        });

        inputIntervalRef.current = setInterval(emitInput, 25);

        return () => {
            if (inputIntervalRef.current) clearInterval(inputIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            renderer.destroy();
            rendererRef.current = null;
            if (socketRef.current) {
                socketRef.current.off();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            hasJoinedRef.current = false;
        };
    }, [authToken, navigate, startCashoutCountdown]);

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
                        <p style={{ opacity: 0.5 }}>Verifying session & $10 entry fee...</p>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />

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
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">Your stake has been liquidated. Redirecting to terminal...</p>
                    </div>
                </div>
            )}

            <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 100 }}>
                <div style={{
                    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
                    padding: '15px 25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', boxShadow: '0 0 20px rgba(124, 58, 255, 0.2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, opacity: 0.3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>Active Stake</h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff' }}>
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
                            width: '100%',
                            background: localTimer > 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #0DBF76 0%, #14F195 100%)',
                            color: localTimer > 0 ? 'rgba(255,255,255,0.4)' : '#001a0d',
                            border: 'none', padding: '10px 0', borderRadius: '12px',
                            fontWeight: '800', fontSize: '0.8rem', cursor: localTimer > 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {localTimer > 0 ? `SECURING... ${localTimer}s` : 'CASH OUT'}
                    </button>
                </div>
            </div>

            <div style={{ position: 'absolute', top: '30px', right: '30px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', zIndex: 100 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%' }} />
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                        AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                    </span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Slither Mode — Server Authoritative</div>
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
                color: 'white', zIndex: 100
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>Leaderboard</h4>
                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.map((p, i) => (
                        <div key={p.id || i} style={{
                            display: 'flex', justifyContent: 'space-between',
                            color: p.name === matchNickname ? 'var(--accent)' : '#fff',
                            fontWeight: p.name === matchNickname ? '700' : '400'
                        }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{i + 1}. {p.name}</span>
                            <span>${(p.balance ?? 0).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '30px', left: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                Mouse to Move • Click to Boost
            </div>

            <style>{`
                .modern-overlay-backdrop {
                    position: fixed; inset: 0; z-index: 99999;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(5, 5, 7, 0.98); backdrop-filter: blur(20px);
                }
                .modern-overlay-backdrop.death { background: rgba(12, 3, 3, 0.98); }
                .modern-overlay-card { text-align: center; padding: 80px 40px; max-width: 640px; }
                .overlay-badge { display: inline-block; padding: 6px 12px; border-radius: 100px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-bottom: 40px; }
                .overlay-badge.success { background: rgba(20, 241, 149, 0.1); color: #14F195; }
                .overlay-badge.error { background: rgba(255, 59, 48, 0.1); color: #FF3B30; }
                .overlay-heading { color: white; font-size: 2.2rem; font-weight: 800; margin: 0 0 30px 0; }
                .overlay-amount.success { font-size: 5rem; font-weight: 900; color: #14F195; margin-bottom: 40px; }
                .overlay-amount .unit { opacity: 0.2; }
                .overlay-divider { width: 32px; height: 2px; background: rgba(255,255,255,0.1); margin: 30px auto; }
                .overlay-caption { color: rgba(255,255,255,0.4); }
                .overlay-icon.error { color: #FF3B30; margin-bottom: 30px; }
            `}</style>
        </div>
    );
}
