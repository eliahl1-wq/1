import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import global from './global.js';
import Canvas from './canvas.js';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatClient from './chat-client.js';
import * as renderUtils from './render.js';

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
    const animationFrameId = useRef(null);
    
    const WORLD_SIZE = 18000; // Synka med serverns nya storlek

    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [cashedAmount, setCashedAmount] = useState(null);
    const [displayCashedAmount, setDisplayCashedAmount] = useState(0);
    const [isDead, setIsDead] = useState(false);
    const [localTimer, setLocalTimer] = useState(0);

    useEffect(() => {
        const itv = setInterval(() => setCurrentTime(Date.now()), 1000);
        document.title = "AgarStake | In Game";
        return () => clearInterval(itv);
    }, []);

    useEffect(() => {
        // Endast anslut om vi har en token och användarnamn, OCH ingen socket är aktiv
        if (!token || !user?.username || socketRef.current) {
            // Om vi har en socket men token/användarnamn blev null (t.ex. utloggning), koppla bort den
            if (socketRef.current && (!token || !user?.username)) {
                console.log('Auth data lost or changed, disconnecting socket.');
                socketRef.current.disconnect(); // Disconnect existing socket
                socketRef.current = null;
                setIsConnected(false);
                hasJoinedGameRef.current = false;
            }
            console.log('useEffect: Skipping socket creation (token/user missing or socket exists).');
            return;
        }

        console.log('useEffect: Attempting to create new socket with valid auth data...');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        
        const socket = io(apiUrl, {
            auth: { token },
            transports: ['websocket'], // Tvinga websocket för Render
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 20000 // Längre timeout för Render cold starts
        });

        socketRef.current = socket; // Spara instansen i ref

        socket.on('connect', () => {
            console.log('Connected to socket server');
            setIsConnected(true);
            if (!hasJoinedGameRef.current) {
                console.log('Emitting joinGame...');
                const matchNickname = location.state?.nickname || user?.username || 'Guest';
                socket.emit('joinGame', { username: matchNickname, token });
                hasJoinedGameRef.current = true;
            }
        });

        socket.on('init', (data) => {
            // Denna används inte längre då servern skickar 'welcome'
        });

        socket.on('welcome', (playerSettings, gameSizes, extra) => {
            console.log('Welcome to Arena');
            myIdRef.current = playerSettings.id;
            gameData.current.player = playerSettings;
            global.game.width = gameSizes.width;
            global.game.height = gameSizes.height;
            setIsConnected(true);
            
            // Återuppta cashout-timer om man refreashar mitt i
            if (gameSizes.cashOutRemaining > 0) {
                startCashoutCountdown(gameSizes.cashOutRemaining);
            }
        });

        socket.on('cashOutStarting', (data) => {
            startCashoutCountdown(data.seconds);
        });

        const startCashoutCountdown = (seconds) => {
            global.cashOutTimer = seconds;
            setLocalTimer(seconds);
            const timerInterval = setInterval(() => {
                global.cashOutTimer--;
                setLocalTimer(prev => prev - 1);
                if (global.cashOutTimer <= 0) {
                    clearInterval(timerInterval);
                }
                if (!socketRef.current?.connected) clearInterval(timerInterval);
            }, 1000);
        };

        socket.on('serverTellPlayerMove', (playerData, userData, foodList, massList, virusList, rewardInfo) => {
            gameData.current = { player: playerData, users: userData, food: foodList, ejected: massList, viruses: virusList, rewardInfo };
            const me = userData.find(p => p.id === myIdRef.current);
            setCurrentBalance(me?.balance ?? 0); // Use nullish coalescing to default to 0 if me or me.balance is undefined
        });

        socket.on('leaderboard', (data) => {
            setLeaderboard(data.leaderboard);
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            setCashedAmount(amount);
            
            // Professional count-up animation for money being "added" to balance
            const startTime = performance.now();
            const duration = 1200;
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 4); // Ease-out Quart
                setDisplayCashedAmount(eased * amount);
                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);

            setTimeout(() => {
                navigate('/pre-game');
            }, 4500);
        });

        const handleDeath = () => {
            setIsDead(true);
            global.cashOutTimer = 0; // Nollställ timern vid död
            // Visa döds-skärmen i 4 sekunder innan vi skickar tillbaka till pre-game
            setTimeout(() => {
                navigate('/pre-game'); 
            }, 4000);
        };

        socket.on('forcedDisconnect', () => {
            alert("Connected from another window. Closing this session.");
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
            console.error('Server error:', msg); // Logga server-side fel
            if (msg.includes('balance')) {
                alert(msg);
                navigate('/pre-game');
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
            console.log('Cleaning up socket connection on component unmount or auth change...');
            window.removeEventListener('keydown', handleKeyDown);
            if (socketRef.current) {
                socketRef.current.off(); // Ta bort alla lyssnare
                socketRef.current.disconnect(); // Koppla bort socketen
                socketRef.current = null; // Nollställ ref
            }
            global.cashOutTimer = 0; // FIX: Nollställ global timer när man lämnar spelet (unmount/back button)
            hasJoinedGameRef.current = false; // Återställ flaggan
            window.removeEventListener('resize', handleResize);
        };
    }, [token, user?.username]); // Körs när vi har inloggningsdata

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
                graph.fillStyle = global.backgroundColor;
                graph.fillRect(0, 0, screen.width, screen.height);
                
                renderUtils.drawGrid(global, player, screen, graph);
                
                food.forEach(f => {
                    const pos = { x: f.x - player.x + screen.width/2, y: f.y - player.y + screen.height/2 };
                    renderUtils.drawFood(pos, f, graph);
                });

                viruses.forEach(v => {
                    const pos = { x: v.x - player.x + screen.width/2, y: v.y - player.y + screen.height/2 };
                    renderUtils.drawVirus(pos, v, graph);
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
                    x: c.x - player.x + screen.width/2, 
                    y: c.y - player.y + screen.height/2
                })));
                
                renderUtils.drawCells(cellsToDraw, { border: 6, textBorderSize: 3, textColor: '#fff', textBorder: '#000' }, 1, borders, graph);
                renderUtils.drawHUD(global, graph);
            }
            if (!isDead) animationFrameId.current = requestAnimationFrame(gameLoop);
        };
        gameLoop();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [isConnected, isDead]); 

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        socketRef.current?.emit('0', { // Agario-protokoll '0' för move
            x: e.clientX - rect.left - canvas.width / 2,
            y: e.clientY - rect.top - canvas.height / 2
        });
    };

    // Beräkna potentiell bonus baserat på leaderboard-position
    const rewardInfo = gameData.current.rewardInfo;
    const myRank = leaderboard.findIndex(p => p.id === myIdRef.current) + 1;
    const rewardsUnlocked = rewardInfo?.unlocked;
    const potentialBonus = rewardsUnlocked ? (myRank === 1 ? 20 : (myRank > 1 && myRank <= 3 ? 10 : 0)) : 0;

    const formatUnlockTimer = () => {
        if (!rewardInfo) return "LOCKED";
        const remaining = Math.max(0, rewardInfo.unlockTime - currentTime);
        if (remaining > 0) {
            const totalSeconds = Math.floor(remaining / 1000);
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            return `UNLOCKS IN ${mins}:${secs.toString().padStart(2, '0')}`;
        }
        if (rewardInfo.playerCount < 4) return "NOT ENOUGH PLAYERS";
        return "LOCKED";
    };

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
                            <span className="unit">$</span>{displayCashedAmount.toFixed(4)}
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
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justifyContent: center;
                    background: rgba(15, 17, 24, 0.98);
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
                        <h2 style={{ marginBottom: '10px' }}>Connecting to Arena...</h2>
                        <p style={{ opacity: 0.5 }}>Make sure you have at least $10 balance.</p>
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
                    background: '#0f1118',
                    backdropFilter: 'blur(16px)',
                    padding: '15px 25px',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, opacity: 0.3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>Active Stake</h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#fff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', letterSpacing: '-1.5px' }}>
                            ${(currentBalance ?? 0).toFixed(4)}
                        </div>
                        
                        {potentialBonus > 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#FFD700', fontWeight: '800', marginTop: '2px', letterSpacing: '1px' }}>
                                + ${potentialBonus.toFixed(2)} RANK BONUS
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => localTimer <= 0 && socketRef.current?.emit('cashOut')}
                        disabled={localTimer > 0}
                        style={{
                            width: '100%',
                            background: localTimer > 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(180deg, #34C759 0%, #28a745 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 0',
                            borderRadius: '100px',
                            fontWeight: '800',
                            fontSize: '0.8rem',
                            letterSpacing: '0.5px',
                            cursor: localTimer > 0 ? 'not-allowed' : 'pointer',
                            transition: '0.2s all ease',
                            boxShadow: localTimer > 0 ? 'none' : '0 8px 20px rgba(52, 199, 89, 0.25)',
                            opacity: localTimer > 0 ? 0.7 : 1
                        }}
                    >
                        {localTimer > 0 ? `WAIT ${localTimer}s` : 'CASH OUT'}
                    </button>
                </div>

                {/* Reward Info Panel */}
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    background: '#0f1118',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    lineHeight: '1.6',
                    width: '100%',
                    boxSizing: 'border-box',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ color: '#34C759', fontWeight: '900', marginBottom: rewardsUnlocked ? '8px' : '4px', letterSpacing: '1px', fontSize: '0.6rem', textTransform: 'uppercase' }}>
                        ARENA REWARDS
                    </div>
                    {!rewardsUnlocked && (
                        <div style={{ fontSize: '0.65rem', color: '#FF3B30', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', opacity: 0.8 }}>
                            {formatUnlockTimer()}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Rank 1 Bonus</span>
                        <span style={{ color: '#fff' }}>$20.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Rank 2-3 Bonus</span>
                        <span style={{ color: '#fff' }}>$10.00</span>
                    </div>
                </div>
            </div>

            {/* Controls Info */}
            <div style={{ 
                position: 'absolute', 
                bottom: '30px', 
                left: '30px', 
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.9rem'
            }}>
                SPACE to Split • W to Eject • Mouse to Move
            </div>

            {/* Logo/Name */}
            <div style={{ 
                position: 'absolute', 
                top: '30px', 
                right: '30px', 
                textAlign: 'right' 
            }}>
                <h2 style={{ 
                    margin: 0, 
                    color: 'white', 
                    fontWeight: '900', 
                    letterSpacing: '-1px',
                    fontStyle: 'italic'
                }} className="game-title">
                    AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
                </h2>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Alpha Demo v0.1</div>
                <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', marginTop: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {formatResetTimer()}
                </div>
            </div>

            {/* Mock Leaderboard */}
            <div style={{
                position: 'absolute',
                top: '120px',
                right: '30px',
                width: '180px',
                background: '#0f1118',
                padding: '20px',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'white',
                boxShadow: '0 15px 35px rgba(0,0,0,0.3)'
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>Leaderboard</h4>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                    {leaderboard.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', opacity: p.id === myIdRef.current ? 1 : 0.5 }}>
                            <span style={{ fontWeight: p.id === myIdRef.current ? '700' : '400' }}>{i + 1}. {p.name || 'Anonymous'}</span>
                            <span>${(p.balance ?? 0).toFixed(4)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
