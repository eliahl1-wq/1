import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import global from './global.js';
import Canvas from './canvas.js';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatClient from './chat-client.js';
import * as renderUtils from './render.js';
import { DEFAULT_ENTRY_FEE, normalizeEntryFee, normalizeBREntryFee, formatUsd } from '../../constants/economy';
import { BRIntroOverlay, BRVictoryOverlay } from '../../components/BRGameOverlays';
import { useHoldKeyCashout } from '../../hooks/useHoldKeyCashout';

/**
 * Version v11 - Full Agar.io Clone Logic Integrated
 * Version v12 - Full Agar.io Clone Logic Integrated (Frontend)
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user, token } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const hasJoinedGameRef = useRef(false);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Använd Refs för data som ändras ofta för att slippa starta om loopen
    const gameData = useRef({ player: {}, users: [], food: [], viruses: [], ejected: [], rewardInfo: null });
    const myIdRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const animationFrameId = useRef(null);
    const cashoutActiveRef = useRef(false);
    
    const WORLD_SIZE = 6000;

    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [cashedAmount, setCashedAmount] = useState(null);
    const [displayCashedAmount, setDisplayCashedAmount] = useState(0);
    const [isDead, setIsDead] = useState(false);
    const [localTimer, setLocalTimer] = useState(0);
    const initialBR = () => {
        const mode = localStorage.getItem('current_game_mode') || '';
        return mode.startsWith('br-') || !!location.state?.battleRoyale;
    };
    const [isBattleRoyale, setIsBattleRoyale] = useState(initialBR);
    const [brZone, setBrZone] = useState(null);
    const [brPrizePool, setBrPrizePool] = useState(0);
    const [brAliveCount, setBrAliveCount] = useState(0);
    const [brVictoryAmount, setBrVictoryAmount] = useState(null);
    const [brShowIntro, setBrShowIntro] = useState(false);
    const [brPlayerCount, setBrPlayerCount] = useState(0);
    const brIntroTriggeredRef = useRef(false);
    const foodCacheRef = useRef(new Map());

    const dismissBrIntro = useCallback(() => setBrShowIntro(false), []);

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

    useLayoutEffect(() => {
        global.holdCashoutProgress = holdProgress;
    }, [holdProgress]);

    useEffect(() => {
        if (localTimer > 0 || isDead || cashedAmount !== null || isBattleRoyale) cancelHold();
    }, [localTimer, isDead, cashedAmount, isBattleRoyale, cancelHold]);

    useEffect(() => {
        const itv = setInterval(() => setCurrentTime(Date.now()), 1000);
        document.title = isBattleRoyale ? 'AgarStake | Battle Royale' : 'AgarStake | In Game';
        global.battleRoyale = isBattleRoyale;
        return () => clearInterval(itv);
    }, [isBattleRoyale]);

    useEffect(() => {
        if (!token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                hasJoinedGameRef.current = false;
            }
            return;
        }

        // Tear down any existing socket before creating a new one (Strict Mode / rejoin)
        if (socketRef.current) {
            socketRef.current.off();
            socketRef.current.disconnect();
            socketRef.current = null;
            hasJoinedGameRef.current = false;
        }

        const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');
        const matchNickname = location.state?.nickname || user?.username || 'Guest';
        const gameMode = localStorage.getItem('current_game_mode') || 'agar';
        const isBR = gameMode.startsWith('br-') || !!location.state?.battleRoyale;
        if (isBR) {
            setIsBattleRoyale(true);
            global.battleRoyale = true;
        }
        const entryFeeUsd = isBR
            ? normalizeBREntryFee(localStorage.getItem('selected_entry_fee'))
            : normalizeEntryFee(localStorage.getItem('selected_entry_fee'));

        const socket = io(apiUrl, {
            auth: { token },
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
            console.log('Connected to socket server');
            setIsConnected(true);
            if (!hasJoinedGameRef.current) {
                if (isBR) {
                    socket.emit('brRejoinMatch', { token });
                } else {
                    socket.emit('joinGame', { username: matchNickname, token, mode: gameMode, entryFeeUsd });
                }
                hasJoinedGameRef.current = true;
            }
        });

        socket.on('init', (data) => {
            // Denna används inte längre då servern skickar 'welcome'
        });

        socket.on('welcome', (playerSettings, gameSizes) => {
            const isRejoin = gameSizes?.rejoin === true;
            console.log(isRejoin ? 'Rejoined arena' : 'Welcome to Arena');
            localStorage.setItem('current_game_mode', gameSizes?.mode || 'agar');
            if (gameSizes?.entryFeeUsd) {
                localStorage.setItem('selected_entry_fee', String(gameSizes.entryFeeUsd));
            }
            setIsBattleRoyale(!!gameSizes?.battleRoyale);
            global.battleRoyale = !!gameSizes?.battleRoyale;
            if (gameSizes?.prizePool) setBrPrizePool(gameSizes.prizePool);
            if (gameSizes?.playerCount) setBrPlayerCount(gameSizes.playerCount);
            if (gameSizes?.zone) setBrZone(gameSizes.zone);
            if (gameSizes?.battleRoyale && gameSizes?.prizePool && !brIntroTriggeredRef.current) {
                brIntroTriggeredRef.current = true;
                setBrShowIntro(true);
            }
            myIdRef.current = playerSettings.id;
            gameData.current.player = playerSettings;
            global.game.width = gameSizes.width;
            global.game.height = gameSizes.height;
            setIsConnected(true);
            setCurrentBalance(playerSettings.balance ?? 1.0);
            
            // Återuppta cashout-timer om man refreashar mitt i
            if (gameSizes?.cashOutRemaining > 0 && !gameSizes?.battleRoyale) {
                startCashoutCountdown(gameSizes.cashOutRemaining);
            }
        });

        socket.on('cashOutStarting', (data) => {
            startCashoutCountdown(data.seconds);
        });

        const startCashoutCountdown = (seconds) => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            cashoutActiveRef.current = true;

            let timeLeft = seconds;
            global.cashOutTotal = seconds;
            global.cashOutTimer = timeLeft;
            setLocalTimer(timeLeft);

            const intervalId = setInterval(() => {
                setLocalTimer(prev => {
                    const next = Math.max(0, prev - 1);
                    global.cashOutTimer = next;
                    if (next <= 0 || !socketRef.current?.connected) {
                        clearInterval(intervalId);
                        timerIntervalRef.current = null;
                    }
                    return next;
                });
            }, 1000);
            timerIntervalRef.current = intervalId;
        };

        socket.on('serverTellPlayerMove', (playerData, userData, foodList, massList, virusList, rewardInfo) => {
            const foodMap = foodCacheRef.current;
            const seen = new Set();
            for (const f of foodList || []) {
                seen.add(f.id);
                foodMap.set(f.id, f);
            }
            for (const id of foodMap.keys()) {
                if (!seen.has(id)) foodMap.delete(id);
            }
            gameData.current = {
                player: playerData,
                users: userData,
                food: Array.from(foodMap.values()),
                ejected: massList,
                viruses: virusList,
                rewardInfo,
            };
            if (rewardInfo?.battleRoyale) {
                setIsBattleRoyale(true);
                global.battleRoyale = true;
                if (rewardInfo.zone) setBrZone(rewardInfo.zone);
                if (rewardInfo.prizePool != null) setBrPrizePool(rewardInfo.prizePool);
                if (rewardInfo.aliveCount != null) setBrAliveCount(rewardInfo.aliveCount);
            }
            if (!rewardInfo?.battleRoyale) {
                const me = userData.find(p => p.id === myIdRef.current);
                if (me) setCurrentBalance(me.balance ?? 0);
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
        socket.on('brZoneUpdate', (zone) => setBrZone(zone));
        socket.on('brVictory', ({ amount }) => {
            setBrVictoryAmount(amount);
            localStorage.removeItem('current_game_mode');
            setTimeout(() => navigate('/gamemodes', { state: { selectedMode: 'agar' } }), 5000);
        });
        socket.on('brEliminated', ({ placement, playersRemaining }) => {
            setBrAliveCount(playersRemaining);
        });

        socket.on('leaderboard', (data) => {
            setLeaderboard((data.leaderboard || []).map(p => ({
                ...p,
                balance: parseFloat(p.balance) || 0,
                kills: p.kills || 0,
                mass: p.mass || 0,
            })));
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            cashoutActiveRef.current = false;
            localStorage.removeItem('current_game_mode');
            const usdAmount = amount;
            setCashedAmount(usdAmount);
            
            // Professional count-up animation for money being "added" to balance
            const startTime = performance.now();
            const duration = 1200;
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 4); // Ease-out Quart
                setDisplayCashedAmount(eased * usdAmount);
                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);

            setTimeout(() => {
                navigate('/pre-game');
            }, 4500);
        });

        const handleDeath = () => {
            setIsDead(true);
            global.cashOutTimer = 0;
            foodCacheRef.current.clear();
            const wasBR = localStorage.getItem('current_game_mode')?.startsWith('br-');
            localStorage.removeItem('current_game_mode');
            setTimeout(() => {
                navigate(
                    wasBR ? '/gamemodes' : '/pre-game',
                    wasBR ? { state: { selectedMode: 'agar' } } : undefined,
                );
            }, 4000);
        };

        socket.on('forcedDisconnect', () => {
            console.warn('Session replaced by another window.');
            navigate('/pre-game');
        });

        socket.on('died', handleDeath);
        socket.on('RIP', handleDeath); // Fixar frysningen när man blir uppäten

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setIsConnected(false);
            hasJoinedGameRef.current = false; // Återställ för eventuell återanslutning
        });

        socket.on('connect_error', (err) => {
            console.error('Connection failed, retrying...', err.message);
            setIsConnected(false); // Reflektera att vi inte är anslutna i UI
        });

        socket.on('error', (msg) => {
            console.error('Server error:', msg);
            if (cashoutActiveRef.current) {
                cashoutActiveRef.current = false;
            }
            if (typeof msg === 'string' && msg.includes('balance')) {
                alert(msg);
                navigate('/pre-game');
            } else if (typeof msg === 'string' && /battle royale/i.test(msg)) {
                navigate('/pre-game', { state: { selectedMode: localStorage.getItem('selected_gamemode') || 'br-agar' } });
            } else if (typeof msg === 'string' && msg.includes('Account')) {
                alert(msg);
            }
        });

        const handleKeyDown = (e) => {
            if (e.code === 'Space') { 
                socketRef.current?.emit('2'); // Split
            } else if (e.code === 'KeyW') {
                socketRef.current?.emit('1'); // Eject
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyDown);
        handleResize();

        return () => {
            cancelAnimationFrame(animationFrameId.current);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleResize);

            if (cashoutActiveRef.current) return;

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (socketRef.current) {
                socketRef.current.off();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            global.cashOutTimer = 0;
            global.battleRoyale = false;
            hasJoinedGameRef.current = false;
        };
    }, [token, navigate, location.state?.nickname]);

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const graph = canvas.getContext('2d');
        
        const gameLoop = () => {
            const { player, users, food, viruses, ejected, zoneSize } = gameData.current;
            const screen = { width: window.innerWidth, height: window.innerHeight };
            
            // CRASH FIX: Kontrollera att vi inte är döda och att spelardata finns
            if (isConnected && !isDead && player && player.x !== undefined) {
                const worldToScreen = (wx, wy) => ({
                    x: wx - player.x + screen.width / 2,
                    y: wy - player.y + screen.height / 2,
                });

                graph.fillStyle = global.backgroundColor;
                graph.fillRect(0, 0, screen.width, screen.height);
                
                renderUtils.drawGrid(global, { x: player.x, y: player.y }, screen, graph);

                if (brZone && player.x != null) {
                    const { x: zx, y: zy } = worldToScreen(brZone.cx, brZone.cy);
                    graph.save();
                    graph.fillStyle = 'rgba(255, 59, 48, 0.14)';
                    graph.beginPath();
                    graph.rect(0, 0, screen.width, screen.height);
                    graph.arc(zx, zy, brZone.radius, 0, Math.PI * 2, true);
                    graph.fill('evenodd');
                    graph.strokeStyle = 'rgba(255, 107, 107, 0.85)';
                    graph.lineWidth = 3;
                    graph.setLineDash([12, 8]);
                    graph.beginPath();
                    graph.arc(zx, zy, brZone.radius, 0, Math.PI * 2);
                    graph.stroke();
                    graph.setLineDash([]);
                    graph.restore();
                }
                
                food.forEach(f => {
                    renderUtils.drawFood(worldToScreen(f.x, f.y), f, graph);
                });

                (ejected || []).forEach(m => {
                    renderUtils.drawFireFood(worldToScreen(m.x, m.y), m, { border: 6 }, graph);
                });

                viruses.forEach(v => {
                    renderUtils.drawVirus(worldToScreen(v.x, v.y), v, graph);
                });

                let borders = {
                    left: screen.width / 2 - player.x,
                    right: screen.width / 2 + global.game.width - player.x,
                    top: screen.height / 2 - player.y,
                    bottom: screen.height / 2 + global.game.height - player.y
                };

                // Rita celler
                const cellsToDraw = users.flatMap(u => u.cells.map(c => ({
                    ...c, 
                    name: u.username, 
                    isMe: u.id === myIdRef.current,
                    isCashingOut: u.isCashingOut,
                    color: u.color.fill || u.color, 
                    borderColor: u.color.border || '#000',
                    ...worldToScreen(c.x, c.y),
                })));
                
                renderUtils.drawCells(cellsToDraw, { border: 6, textBorderSize: 3, textColor: '#fff', textBorder: '#000' }, 1, borders, graph);
                renderUtils.drawHUD(global, graph);
            }
            if (!isDead) animationFrameId.current = requestAnimationFrame(gameLoop);
        };
        gameLoop();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [isConnected, isDead, brZone]); 

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        socketRef.current?.emit('0', { // Agario-protokoll '0' för move
            x: e.clientX - rect.left - canvas.width / 2,
            y: e.clientY - rect.top - canvas.height / 2
        });
    };

    const entryFeeUsd = normalizeEntryFee(localStorage.getItem('selected_entry_fee'));

    const rewardInfo = gameData.current.rewardInfo;

    const formatResetTimer = () => {
        if (!rewardInfo?.resetTime) return null;
        const remaining = Math.max(0, rewardInfo.resetTime - currentTime);
        const totalSeconds = Math.floor(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        
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
            fontFamily: 'system-ui'
        }}>
            <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                style={{ display: 'block' }}
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

            <style>{`
                .modern-overlay-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(5, 5, 7, 0.98);
                    backdrop-filter: blur(20px);
                    animation: overlayIn 0.3s ease-out forwards;
                    width: 100vw;
                    height: 100vh;
                }
                .modern-overlay-backdrop.death { background: rgba(12, 3, 3, 0.98); }
                
                .modern-overlay-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    max-width: 640px;
                    padding: 100px 40px;
                    animation: contentIn 0.6s cubic-bezier(0.2, 1, 0.2, 1) forwards;
                }

                .overlay-badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 100px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    margin-bottom: 80px;
                }
                .overlay-badge.success { background: rgba(20, 241, 149, 0.1); color: #14F195; }
                .overlay-badge.error { background: rgba(255, 59, 48, 0.1); color: #FF3B30; }

                .overlay-heading {
                    color: white;
                    font-size: 2.2rem;
                    font-weight: 800;
                    margin: 0 0 40px 0;
                    letter-spacing: -0.5px;
                    line-height: 1.2;
                    text-align: center;
                }

                .overlay-amount {
                    font-size: 6rem;
                    font-weight: 900;
                    letter-spacing: -3px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    line-height: 0.9;
                    margin-bottom: 90px;
                    text-align: center;
                }
                .overlay-amount.success { color: #14F195; text-shadow: 0 0 40px rgba(20, 241, 149, 0.15); }
                .overlay-amount .unit { opacity: 0.2; margin-right: 4px; }

                .overlay-icon { margin: 40px 0; opacity: 0.7; display: flex; justify-content: center; }
                .overlay-icon.error { color: #FF3B30; }

                .overlay-divider {
                    width: 32px;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.1);
                    margin: 80px auto;
                }

                .overlay-caption {
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 0.95rem;
                    font-weight: 500;
                    line-height: 1.5;
                }

                @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes contentIn {
                    from { opacity: 0; transform: translateY(40px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            {!isConnected && (
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

            {/* UI Overlay */}
            <div style={{ 
                position: 'absolute', 
                top: '30px', 
                left: '30px', 
                zIndex: 100
            }}>
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

                    {/* Exit timer badge */}
                    {!isBattleRoyale && localTimer > 0 && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            padding: '10px 12px',
                            background: 'rgba(6, 10, 8, 0.85)',
                            border: '1px solid rgba(20, 241, 149, 0.25)',
                            borderRadius: '14px',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '1.2px' }}>SECURING</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#14F195', fontFamily: 'ui-monospace, monospace' }}>{localTimer}s</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${(localTimer / (global.cashOutTotal || 10)) * 100}%`,
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
                            background: localTimer > 0
                                ? 'rgba(255,255,255,0.04)'
                                : 'linear-gradient(135deg, #0DBF76 0%, #14F195 100%)',
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
                            opacity: localTimer > 0 ? 0.6 : 1
                        }}
                    >
                        Q · CASH OUT
                    </button>
                    )}
                </div>
            </div>

            {brVictoryAmount != null && (
                <BRVictoryOverlay show amount={brVictoryAmount} />
            )}

            <BRIntroOverlay
                show={brShowIntro && isBattleRoyale && brVictoryAmount == null}
                prizePool={brPrizePool}
                playerCount={brPlayerCount}
                entryFeeUsd={normalizeBREntryFee(localStorage.getItem('selected_entry_fee'))}
                onComplete={dismissBrIntro}
            />

            {/* Controls Info */}
            <div style={{ 
                position: 'absolute', 
                bottom: '30px', 
                left: '30px', 
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.9rem'
            }}>
                {isBattleRoyale
                    ? 'SPACE to Split • W to Eject • Mouse to Move'
                    : 'SPACE to Split • W to Eject • Hold Q to Cash Out • Mouse to Move'}
            </div>

            {/* Logo/Name */}
            <div style={{ 
                position: 'absolute', 
                top: '30px', 
                right: '30px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px'
            }}>
                <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                        AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                    </span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                    {isBattleRoyale ? 'Battle Royale' : 'Alpha Demo v0.1'}
                </div>
                {!isBattleRoyale && (
                <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', marginTop: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {formatResetTimer()}
                </div>
                )}
            </div>

            {/* Mock Leaderboard */}
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
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>
                    {isBattleRoyale ? 'Eliminations' : 'Leaderboard'}
                </h4>
                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.map((p, i) => (
                        <div key={p.id} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            opacity: p.id === myIdRef.current ? 1 : 0.6,
                            color: p.id === myIdRef.current ? 'var(--accent)' : 'var(--text-bright)',
                            fontWeight: p.id === myIdRef.current ? '700' : '400'
                        }}>
                            <span>{i + 1}. {p.name || 'An unnamed cell'}</span>
                            <span className="mono">
                                {isBattleRoyale ? `${p.kills ?? 0} kills` : `$${Number(p.balance ?? 0).toFixed(2)}`}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
