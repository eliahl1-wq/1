import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

import { io } from 'socket.io-client';

import { SlitherRenderer } from './SlitherRenderer.js';

import { normalizeEntryFee, normalizeBREntryFee, formatUsd } from '../../constants/economy';
import { BRIntroOverlay, BRVictoryOverlay } from '../../components/BRGameOverlays';
import { useHoldKeyCashout } from '../../hooks/useHoldKeyCashout';

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

    const myIdRef = useRef(null);

    const cashOutTotalRef = useRef(10);
    const joinParamsRef = useRef({ nickname: 'Guest', entryFeeUsd: 10, isBR: false });



    const [isConnected, setIsConnected] = useState(false);

    const [gameReady, setGameReady] = useState(false);

    const [currentBalance, setCurrentBalance] = useState(1.0);

    const [leaderboard, setLeaderboard] = useState([]);

    const [isDead, setIsDead] = useState(false);

    const [cashedAmount, setCashedAmount] = useState(null);

    const [displayCashedAmount, setDisplayCashedAmount] = useState(0);

    const [localTimer, setLocalTimer] = useState(0);

    const [resetCountdown, setResetCountdown] = useState(null);
    const initialBR = () => {
        const mode = localStorage.getItem('current_game_mode') || '';
        return mode.startsWith('br-') || !!location.state?.battleRoyale;
    };
    const [isBattleRoyale, setIsBattleRoyale] = useState(initialBR);
    const [brPrizePool, setBrPrizePool] = useState(0);
    const [brAliveCount, setBrAliveCount] = useState(0);
    const [brVictoryAmount, setBrVictoryAmount] = useState(null);
    const [brShowIntro, setBrShowIntro] = useState(false);
    const [brPlayerCount, setBrPlayerCount] = useState(0);
    const brIntroTriggeredRef = useRef(false);

    const dismissBrIntro = useCallback(() => setBrShowIntro(false), []);

    const matchNickname = location.state?.nickname || user?.username || 'Guest';
    const gameModeStored = localStorage.getItem('current_game_mode') || 'slither';
    const isBRMode = gameModeStored.startsWith('br-') || !!location.state?.battleRoyale;
    const entryFeeUsd = isBRMode
        ? normalizeBREntryFee(localStorage.getItem('selected_entry_fee'))
        : normalizeEntryFee(localStorage.getItem('selected_entry_fee'));

    joinParamsRef.current = {
        nickname: matchNickname,
        entryFeeUsd,
        isBR: isBRMode,
    };



    useEffect(() => {
        document.body.style.backgroundColor = '#0a0a0c';
        document.title = 'AgarStake | Slither';
    }, []);

    const [isSecuringCashout, setIsSecuringCashout] = useState(false);

    const startCashoutCountdown = useCallback((seconds, securing = false) => {

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        cashoutActiveRef.current = true;
        setIsSecuringCashout(securing);

        cashOutTotalRef.current = seconds;

        let timeLeft = seconds;

        setLocalTimer(timeLeft);

        const intervalId = setInterval(() => {

            timeLeft = Math.max(0, timeLeft - 1);

            setLocalTimer(timeLeft);

            if (timeLeft <= 0) {

                clearInterval(intervalId);

                timerIntervalRef.current = null;
                setIsSecuringCashout(false);

            }

        }, 1000);

        timerIntervalRef.current = intervalId;

    }, []);



    const canCashOutRef = useRef(false);
    canCashOutRef.current = !isBattleRoyale && localTimer <= 0 && cashedAmount === null && !isDead;

    const handleCashOut = useCallback(() => {
        if (!canCashOutRef.current) return;
        socketRef.current?.emit('cashOut');
    }, []);

    const { holdProgress, startHold, cancelHold } = useHoldKeyCashout({
        canStart: () => canCashOutRef.current,
        onComplete: handleCashOut,
    });

    const cashoutButtonHoldProps = {
        onMouseDown: (e) => { e.preventDefault(); startHold(); },
        onMouseUp: cancelHold,
        onMouseLeave: cancelHold,
        onTouchStart: (e) => { e.preventDefault(); startHold(); },
        onTouchEnd: cancelHold,
        onTouchCancel: cancelHold,
        onContextMenu: (e) => e.preventDefault(),
    };

    // Feed balance + cash-out timer to the renderer so it can draw them over the snake
    useLayoutEffect(() => {
        rendererRef.current?.setHud({
            balance: currentBalance,
            cashoutSeconds: localTimer,
            cashoutTotal: cashOutTotalRef.current || 10,
            holdProgress,
            securingCashout: isSecuringCashout,
        });
    }, [currentBalance, localTimer, holdProgress, isSecuringCashout]);

    useEffect(() => {
        if (localTimer > 0 || isDead || cashedAmount !== null || isBattleRoyale) cancelHold();
    }, [localTimer, isDead, cashedAmount, isBattleRoyale, cancelHold]);



    useEffect(() => {

        if (!canvasRef.current) return;

        if (typeof authToken !== 'string' || authToken.length === 0) return;



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



        const gameMode = localStorage.getItem('current_game_mode') || 'slither';
        const isBR = gameMode.startsWith('br-') || !!location.state?.battleRoyale;
        if (isBR) setIsBattleRoyale(true);

        const socket = io(API_URL, {
            auth: { token: authToken },
            // Polling first — more reliable on Railway; upgrades to websocket when ready
            transports: ['polling', 'websocket'],
            upgrade: true,
            rememberUpgrade: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 20000,
        });

        socketRef.current = socket;



        socket.on('connect', () => {
            setIsConnected(true);
            if (!hasJoinedRef.current) {
                const { nickname, entryFeeUsd: fee, isBR: br } = joinParamsRef.current;
                if (br) {
                    socket.emit('brRejoinMatch', { token: authToken });
                } else {
                    socket.emit('joinGame', { username: nickname, token: authToken, mode: 'slither', entryFeeUsd: fee });
                }
                hasJoinedRef.current = true;
            }
        });



        socket.on('welcome', (playerSettings, gameSizes) => {
            localStorage.setItem('current_game_mode', gameSizes?.mode || 'slither');
            if (gameSizes?.entryFeeUsd) {
                localStorage.setItem('selected_entry_fee', String(gameSizes.entryFeeUsd));
            }
            setIsBattleRoyale(!!gameSizes?.battleRoyale);
            if (gameSizes?.prizePool) setBrPrizePool(gameSizes.prizePool);
            if (gameSizes?.playerCount) setBrPlayerCount(gameSizes.playerCount);
            if (gameSizes?.zone) renderer.updateState({ zone: gameSizes.zone });
            if (gameSizes?.battleRoyale && gameSizes?.prizePool && !brIntroTriggeredRef.current) {
                brIntroTriggeredRef.current = true;
                setBrShowIntro(true);
            }
            myIdRef.current = playerSettings.id;
            if (!gameSizes?.battleRoyale) {
                const bal = playerSettings.balance ?? 1.0;
                setCurrentBalance(bal);
                rendererRef.current?.setHud({ balance: bal });
            }
            setGameReady(true);
            if (gameSizes?.cashOutRemaining > 0 && !gameSizes?.battleRoyale) {
                startCashoutCountdown(gameSizes.cashOutRemaining, false);
            }
        });

        socket.on('slitherTick', (tick) => {
            renderer.updateState(tick);
            if (!tick.battleRoyale && tick.balance != null) setCurrentBalance(tick.balance);
            if (tick.battleRoyale) {
                setIsBattleRoyale(true);
                if (tick.prizePool != null) setBrPrizePool(tick.prizePool);
                if (tick.aliveCount != null) setBrAliveCount(tick.aliveCount);
            }
            if (tick.resetTime) {
                setResetCountdown(Math.max(0, Math.ceil((tick.resetTime - Date.now()) / 1000)));
            }
        });

        socket.on('brMatchStart', ({ prizePool, playerCount }) => {
            if (prizePool != null) setBrPrizePool(prizePool);
            if (playerCount != null) setBrPlayerCount(playerCount);
            if (!brIntroTriggeredRef.current) {
                brIntroTriggeredRef.current = true;
                setBrShowIntro(true);
            }
        });

        socket.on('brZoneUpdate', (zone) => {
            renderer.updateState({ zone });
        });
        socket.on('brVictory', ({ amount }) => {
            setBrVictoryAmount(amount);
            localStorage.removeItem('current_game_mode');
            setTimeout(() => navigate('/gamemodes', { state: { selectedMode: 'slither' } }), 5000);
        });
        socket.on('brEliminated', ({ playersRemaining }) => {
            setBrAliveCount(playersRemaining);
        });



        socket.on('cashOutStarting', ({ seconds }) => {

            startCashoutCountdown(seconds, true);

        });



        socket.on('cashOutSuccess', ({ amount }) => {

            cashoutActiveRef.current = false;
            setIsSecuringCashout(false);

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



        socket.on('leaderboard', ({ leaderboard: lb, battleRoyale: lbBR }) => {
            setLeaderboard(lb.map(p => ({
                id: p.id,
                name: p.name,
                balance: parseFloat(p.balance) || 0,
                kills: p.kills || 0,
                length: p.length || 0,
                battleRoyale: lbBR,
            })));
        });



        socket.on('RIP', () => {
            setIsDead(true);
            setLocalTimer(0);
            setIsSecuringCashout(false);
            const wasBR = localStorage.getItem('current_game_mode')?.startsWith('br-');
            localStorage.removeItem('current_game_mode');
            setTimeout(() => {
                navigate(
                    wasBR ? '/gamemodes' : '/pre-game',
                    { state: { selectedMode: 'slither' } },
                );
            }, 4000);
        });



        socket.on('forcedDisconnect', () => {

            navigate('/pre-game', { state: { selectedMode: 'slither' } });

        });



        socket.on('error', (msg) => {

            if (cashoutActiveRef.current) cashoutActiveRef.current = false;

            if (typeof msg === 'string' && (msg.includes('balance') || msg.includes('Account'))) {

                alert(msg);

                navigate('/pre-game', { state: { selectedMode: 'slither' } });

            } else if (typeof msg === 'string' && /battle royale/i.test(msg)) {

                navigate('/pre-game', { state: { selectedMode: localStorage.getItem('selected_gamemode') || 'br-slither' } });

            } else if (typeof msg === 'string') {

                alert(msg);

            }

        });



        socket.on('connect_error', () => setIsConnected(false));



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
            const s = socketRef.current;
            if (s) {
                s.removeAllListeners();
                s.disconnect();
                socketRef.current = null;
            }
            hasJoinedRef.current = false;
        };

    }, [authToken, navigate, startCashoutCountdown]);



    const formatResetTimer = () => {

        if (resetCountdown == null || resetCountdown <= 0) return null;

        const hours = Math.floor(resetCountdown / 3600);

        const mins = Math.floor((resetCountdown % 3600) / 60);

        const secs = resetCountdown % 60;

        const timeStr = hours > 0

            ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

            : `${mins}:${secs.toString().padStart(2, '0')}`;

        return `ARENA RESET IN: ${timeStr}`;

    };



    return (

        <div style={{

            width: '100vw',

            height: '100vh',

            background: '#0a0a0c',

            overflow: 'hidden',

            position: 'fixed',

            top: 0,

            left: 0,

            fontFamily: 'system-ui',

        }}>

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
                        <div className="overlay-badge error">{isBattleRoyale ? 'Eliminated' : 'Session Terminated'}</div>
                        <h2 className="overlay-heading">{isBattleRoyale ? 'Out of the Zone' : 'Eliminated'}</h2>
                        <div className="overlay-icon error">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">
                            {isBattleRoyale
                                ? `${brAliveCount} players remain. Prize pool: $${brPrizePool.toFixed(2)}`
                                : 'Your stake has been liquidated. Redirecting to terminal...'}
                        </p>
                    </div>
                </div>
            )}

            {brVictoryAmount != null && (
                <BRVictoryOverlay show amount={brVictoryAmount} />
            )}

            <BRIntroOverlay
                show={brShowIntro && isBattleRoyale && brVictoryAmount == null}
                prizePool={brPrizePool}
                playerCount={brPlayerCount}
                entryFeeUsd={entryFeeUsd}
                onComplete={dismissBrIntro}
            />



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

                .overlay-heading { color: white; font-size: 2.2rem; font-weight: 800; margin: 0 0 40px 0; letter-spacing: -0.5px; text-align: center; }

                .overlay-amount {

                    font-size: 6rem; font-weight: 900; letter-spacing: -3px;

                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

                    line-height: 0.9; margin-bottom: 90px; text-align: center;

                }

                .overlay-amount.success { color: #14F195; text-shadow: 0 0 40px rgba(20, 241, 149, 0.15); }

                .overlay-amount .unit { opacity: 0.2; margin-right: 4px; }

                .overlay-icon { margin: 40px 0; opacity: 0.7; display: flex; justify-content: center; }

                .overlay-icon.error { color: #FF3B30; }

                .overlay-divider { width: 32px; height: 2px; background: rgba(255,255,255,0.1); margin: 80px auto; }

                .overlay-caption { color: rgba(255,255,255,0.4); font-size: 0.95rem; font-weight: 500; line-height: 1.5; }

                @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

                @keyframes contentIn {

                    from { opacity: 0; transform: translateY(40px) scale(0.96); }

                    to { opacity: 1; transform: translateY(0) scale(1); }

                }

            `}</style>



            {(!isConnected || !gameReady) && (

                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: 'white', zIndex: 1000 }}>

                    <div style={{ textAlign: 'center' }}>

                        <h2 style={{ marginBottom: '10px' }}>
                            {isBattleRoyale ? 'Joining Battle Royale…' : 'Connecting to Arena…'}
                        </h2>

                        <p style={{ opacity: 0.5 }}>
                            {isBattleRoyale
                                ? 'Syncing match — no cash-out in this mode'
                                : `Make sure you have at least ${formatUsd(entryFeeUsd)} balance.`}
                        </p>

                    </div>

                </div>

            )}



            {/* Stake panel — matches Agar */}

            <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 100 }}>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    padding: '15px 25px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    boxShadow: '0 0 20px rgba(124, 58, 255, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '12px',
                    minWidth: '190px',
                }}>

                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, opacity: 0.3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>
                            {isBattleRoyale ? 'Prize Pool' : 'Active Stake'}
                        </h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                            {isBattleRoyale ? `$${brPrizePool.toFixed(2)}` : `$${(currentBalance ?? 0).toFixed(2)}`}
                        </div>
                        {isBattleRoyale && (
                            <div style={{ fontSize: '0.75rem', color: '#FF6B6B', fontWeight: 700, marginTop: '4px' }}>
                                {brAliveCount} ALIVE · WINNER TAKES ${brPrizePool.toFixed(2)}
                            </div>
                        )}
                        {isBattleRoyale && brPlayerCount > 0 && (
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '6px', fontWeight: 600 }}>
                                {brPlayerCount} players · winner takes pool
                            </div>
                        )}
                    </div>

                    {!isBattleRoyale && localTimer > 0 && (

                        <div style={{

                            display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px',

                            background: 'rgba(6, 10, 8, 0.85)', border: '1px solid rgba(20, 241, 149, 0.25)',

                            borderRadius: '14px', width: '100%', boxSizing: 'border-box',

                        }}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '1.2px' }}>SECURING</span>

                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#14F195', fontFamily: 'ui-monospace, monospace' }}>{localTimer}s</span>

                            </div>

                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>

                                <div style={{

                                    height: '100%',

                                    width: `${(localTimer / (cashOutTotalRef.current || 10)) * 100}%`,

                                    background: 'linear-gradient(90deg, #0DBF76, #14F195)',

                                    borderRadius: 2,

                                    transition: 'width 1s linear',

                                }} />

                            </div>

                        </div>

                    )}

                    {!isBattleRoyale && (
                    <button
                        {...cashoutButtonHoldProps}
                        disabled={localTimer > 0 || isDead || cashedAmount !== null}

                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: localTimer > 0 ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #0DBF76 0%, #14F195 100%)',
                            color: localTimer > 0 ? 'rgba(255,255,255,0.2)' : '#001a0d',
                            border: localTimer > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            fontWeight: '800',
                            fontSize: '0.75rem',
                            letterSpacing: '0.6px',

                            cursor: localTimer > 0 ? 'not-allowed' : 'pointer',

                            transition: '0.2s all ease',

                            boxShadow: localTimer > 0 ? 'none' : '0 4px 20px rgba(20, 241, 149, 0.2)',

                            opacity: localTimer > 0 ? 0.6 : 1,

                        }}

                    >

                        Q · CASH OUT
                    </button>
                    )}

                </div>

            </div>



            {/* Controls */}

            <div style={{ position: 'absolute', bottom: '30px', left: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', zIndex: 100 }}>

                {isBattleRoyale
                    ? 'Mouse to Move • Space to Boost'
                    : 'Mouse to Move • Space to Boost • Hold Q to Cash Out'}

            </div>



            {/* Logo + reset — matches Agar */}

            <div style={{ position: 'absolute', top: '30px', right: '30px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', zIndex: 100 }}>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>

                    <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />

                    <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>

                        AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>

                    </span>

                </div>

                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                    {isBattleRoyale ? 'Battle Royale' : 'Slither Mode'}
                </div>
                {!isBattleRoyale && (
                <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', marginTop: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {formatResetTimer()}
                </div>
                )}

            </div>



            {/* Leaderboard — matches Agar */}

            <div style={{

                position: 'absolute',

                top: '120px',

                right: '30px',

                width: '180px',

                background: 'rgba(16, 17, 24, 0.85)',

                backdropFilter: 'blur(20px)',

                padding: '16px',

                borderRadius: '16px',

                border: '1px solid var(--border)',

                color: 'white',

                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',

                zIndex: 100,

            }}>

                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>
                    {isBattleRoyale ? 'Eliminations' : 'Leaderboard'}
                </h4>

                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {leaderboard.map((p, i) => (

                        <div key={p.id || i} style={{

                            display: 'flex',

                            justifyContent: 'space-between',

                            opacity: p.id === myIdRef.current ? 1 : 0.6,

                            color: p.id === myIdRef.current ? 'var(--accent)' : 'var(--text-bright)',

                            fontWeight: p.id === myIdRef.current ? '700' : '400',

                        }}>

                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{i + 1}. {p.name}</span>

                            <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                                {isBattleRoyale ? `${p.kills ?? 0} kills` : `$${(p.balance ?? 0).toFixed(2)}`}
                            </span>

                        </div>

                    ))}

                </div>

            </div>

        </div>

    );

}


