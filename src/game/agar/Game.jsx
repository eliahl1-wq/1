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
import GameResultModal from '../../components/GameResultModal';
import GameCashoutBar from '../../components/GameCashoutBar';
import GameBRHud from '../../components/GameBRHud';
import { useHoldKeyCashout } from '../../hooks/useHoldKeyCashout';
import MobileGameSession from '../../components/MobileGameSession';
import { AgarMobileControls, useMobileDoubleTapEject } from '../../components/MobileGameControls';
import { isTouchDevice } from '../../utils/mobile';
import { getGameScreenSize, mapPointerToGameSpace, GAME_LAYOUT_CHANGE, getMobileViewZoom } from '../../utils/forcedLandscape';
import { drawGameMinimap, normalizeMinimapData } from '../minimap.js';
import { playFoodEatSound, unlockGameAudio } from '../../audio/synthSounds.js';
import '../../styles/gameInGame.css';

const IS_MOBILE = isTouchDevice();

/** True when any cell overlaps this pellet (server already removed it). */
function foodLikelyEaten(f, users) {
    if (!users?.length) return false;
    const fr = f.radius || 5;
    for (const u of users) {
        for (const c of u.cells || []) {
            if (Math.hypot(c.x - f.x, c.y - f.y) < (c.radius || 0) + fr * 0.5) {
                return true;
            }
        }
    }
    return false;
}

/** True when the local player's cell overlaps this pellet. */
function foodEatenByPlayer(f, myId, users) {
    if (!myId || !users?.length) return false;
    const me = users.find(u => u.id === myId);
    if (!me) return false;
    const fr = f.radius || 5;
    for (const c of me.cells || []) {
        if (Math.hypot(c.x - f.x, c.y - f.y) < (c.radius || 0) + fr * 0.5) {
            return true;
        }
    }
    return false;
}

/** Drop stale cached pellets; keep edge blobs briefly through spatial-filter gaps. */
function pruneAgarFoodCache(foodMap, px, py, screenW, screenH, users, myId) {
    const margin = 240;
    const halfW = screenW / 2 + margin;
    const halfH = screenH / 2 + margin;
    // Keep in-view pellets much longer to avoid visible blinking from packet jitter.
    const IN_VIEW_MISS_LIMIT = 24;
    // Off-screen pellets can be pruned sooner to keep cache bounded.
    const OFF_VIEW_MISS_LIMIT = 12;
    for (const [id, f] of foodMap) {
        const miss = f._missStreak || 0;
        if (miss === 0) continue;
        const inView = Math.abs(f.x - px) <= halfW && Math.abs(f.y - py) <= halfH;
        if (foodLikelyEaten(f, users)) {
            if (foodEatenByPlayer(f, myId, users)) playFoodEatSound();
            foodMap.delete(id);
        } else if (!inView) {
            if (miss >= OFF_VIEW_MISS_LIMIT) foodMap.delete(id);
        } else if (miss >= IN_VIEW_MISS_LIMIT) {
            foodMap.delete(id);
        }
    }
}

/**
 * Version v11 - Full Agar.io Clone Logic Integrated
 * Version v12 - Full Agar.io Clone Logic Integrated (Frontend)
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const viewportRef = useRef(null);
    const { user, token } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const hasJoinedGameRef = useRef(false);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Använd Refs för data som ändras ofta för att slippa starta om loopen
    const gameData = useRef({ player: {}, users: [], food: [], viruses: [], ejected: [], rewardInfo: null });
    const myIdRef = useRef(null);
    const prevBalanceRef = useRef(null);
    const prevKillsRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const animationFrameId = useRef(null);
    const cashoutActiveRef = useRef(false);
    
    const WORLD_SIZE = 6000;

    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [cashedAmount, setCashedAmount] = useState(null);
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
    const joinParamsRef = useRef({ nickname: 'Guest', entryFeeUsd: DEFAULT_ENTRY_FEE, mode: 'agar' });

    const dismissBrIntro = useCallback(() => setBrShowIntro(false), []);

    const handlePlayAgain = useCallback(() => {
        const { nickname, entryFeeUsd: fee, mode } = joinParamsRef.current;
        const playMode = mode.startsWith('br-') ? mode.replace(/^br-/, '') : mode;
        localStorage.setItem('current_game_mode', playMode);
        localStorage.setItem('selected_gamemode', playMode);

        setIsDead(false);
        setCashedAmount(null);
        setLocalTimer(0);
        prevBalanceRef.current = null;
        prevKillsRef.current = null;
        cashoutActiveRef.current = false;
        global.cashOutTimer = 0;
        global.cashOutEndAt = 0;
        foodCacheRef.current.clear();
        gameData.current = { player: {}, users: [], food: [], viruses: [], ejected: [], rewardInfo: null };

        if (socketRef.current?.connected) {
            socketRef.current.emit('joinGame', {
                username: nickname,
                token,
                mode: playMode,
                entryFeeUsd: fee,
            });
        }
    }, [token]);

    const handleLobby = useCallback(() => {
        localStorage.removeItem('current_game_mode');
        const mode = joinParamsRef.current.mode;
        const selectedMode = mode.startsWith('br-') ? mode.replace(/^br-/, '') : mode;
        navigate('/pre-game', { state: { selectedMode } });
    }, [navigate]);

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
        const canvas = canvasRef.current;
        if (!canvas) return;
        const unlock = () => unlockGameAudio();
        canvas.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            canvas.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, []);

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

        joinParamsRef.current = {
            nickname: matchNickname,
            entryFeeUsd,
            mode: isBR ? gameMode : (gameMode.replace(/^br-/, '') || 'agar'),
        };

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
            const startBal = playerSettings.balance ?? 1.0;
            prevBalanceRef.current = startBal;
            prevKillsRef.current = playerSettings.kills ?? 0;
            setCurrentBalance(startBal);
            
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
            global.cashOutEndAt = Date.now() + seconds * 1000;
            global.cashOutTimer = timeLeft;
            setLocalTimer(timeLeft);

            const intervalId = setInterval(() => {
                setLocalTimer(prev => {
                    const next = Math.max(0, prev - 1);
                    global.cashOutTimer = next;
                    if (next <= 0) {
                        global.cashOutEndAt = 0;
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
                foodMap.set(f.id, { ...f, _missStreak: 0 });
            }
            for (const [id, f] of foodMap) {
                if (seen.has(id)) continue;
                const nextMiss = (f._missStreak || 0) + 1;
                if (foodLikelyEaten(f, userData)) {
                    if (foodEatenByPlayer(f, myIdRef.current, userData)) playFoodEatSound();
                    foodMap.delete(id);
                } else {
                    foodMap.set(id, { ...f, _missStreak: nextMiss });
                }
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
                if (me) {
                    const newBal = me.balance ?? 0;
                    prevBalanceRef.current = newBal;
                    setCurrentBalance(newBal);
                }
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
            const lb = data.leaderboard || [];
            if (data.battleRoyale && myIdRef.current) {
                const me = lb.find(p => p.id === myIdRef.current);
                if (me) {
                    prevKillsRef.current = me.kills ?? 0;
                }
            }
            setLeaderboard(lb.map(p => ({
                ...p,
                balance: parseFloat(p.balance) || 0,
                kills: p.kills || 0,
                mass: p.mass || 0,
            })));
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            cashoutActiveRef.current = false;
            localStorage.removeItem('current_game_mode');
            setCashedAmount(amount);
        });

        const handleDeath = () => {
            setIsDead(true);
            global.cashOutTimer = 0;
            global.cashOutEndAt = 0;
            foodCacheRef.current.clear();
            const wasBR = localStorage.getItem('current_game_mode')?.startsWith('br-');
            localStorage.removeItem('current_game_mode');
            if (wasBR) {
                setTimeout(() => {
                    navigate('/gamemodes', { state: { selectedMode: 'agar' } });
                }, 4000);
            }
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
        window.addEventListener(GAME_LAYOUT_CHANGE, handleResize);
        window.addEventListener('keydown', handleKeyDown);
        handleResize();

        return () => {
            cancelAnimationFrame(animationFrameId.current);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener(GAME_LAYOUT_CHANGE, handleResize);

            if (cashoutActiveRef.current) return;

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (socketRef.current) {
                socketRef.current.off();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            global.cashOutTimer = 0;
            global.cashOutEndAt = 0;
            global.battleRoyale = false;
            hasJoinedGameRef.current = false;
        };
    }, [token, navigate, location.state?.nickname]);

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width, height } = getGameScreenSize();
        const viewZoom = getMobileViewZoom();
        canvas.width = width;
        canvas.height = height;
        if (socketRef.current?.connected) {
            socketRef.current.emit('0', {
                x: 0,
                y: 0,
                screenWidth: width / viewZoom,
                screenHeight: height / viewZoom,
            });
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const graph = canvas.getContext('2d');
        
        const gameLoop = () => {
            const { player, users, viruses, ejected, zoneSize } = gameData.current;
            const screen = { width: canvas.width, height: canvas.height };
            const viewZoom = getMobileViewZoom();
            
            // CRASH FIX: Kontrollera att vi inte är döda och att spelardata finns
            if (isConnected && !isDead && player && player.x !== undefined) {
                const worldToScreen = (wx, wy) => ({
                    x: (wx - player.x) * viewZoom + screen.width / 2,
                    y: (wy - player.y) * viewZoom + screen.height / 2,
                });

                graph.fillStyle = global.backgroundColor;
                graph.fillRect(0, 0, screen.width, screen.height);
                
                renderUtils.drawGrid(global, { x: player.x, y: player.y }, screen, graph, viewZoom);

                if (brZone && player.x != null) {
                    const { x: zx, y: zy } = worldToScreen(brZone.cx, brZone.cy);
                    graph.save();
                    graph.fillStyle = 'rgba(255, 59, 48, 0.14)';
                    graph.beginPath();
                    graph.rect(0, 0, screen.width, screen.height);
                    graph.arc(zx, zy, brZone.radius * viewZoom, 0, Math.PI * 2, true);
                    graph.fill('evenodd');
                    graph.strokeStyle = 'rgba(255, 107, 107, 0.85)';
                    graph.lineWidth = 3;
                    graph.setLineDash([12, 8]);
                    graph.beginPath();
                    graph.arc(zx, zy, brZone.radius * viewZoom, 0, Math.PI * 2);
                    graph.stroke();
                    graph.setLineDash([]);
                    graph.restore();
                }
                
                pruneAgarFoodCache(foodCacheRef.current, player.x, player.y, screen.width / viewZoom, screen.height / viewZoom, users, myIdRef.current);
                const halfW = screen.width / (2 * viewZoom) + 120;
                const halfH = screen.height / (2 * viewZoom) + 120;
                const myCells = users.find(u => u.id === myIdRef.current)?.cells || [];
                for (const f of foodCacheRef.current.values()) {
                    if (Math.abs(f.x - player.x) > halfW || Math.abs(f.y - player.y) > halfH) continue;
                    const underMe = myCells.some(c => Math.hypot(c.x - f.x, c.y - f.y) < (c.radius || 0));
                    if (underMe) continue;
                    renderUtils.drawFood(worldToScreen(f.x, f.y), { ...f, radius: (f.radius || 5) * viewZoom }, graph);
                }

                (ejected || []).forEach(m => {
                    renderUtils.drawFireFood(worldToScreen(m.x, m.y), { ...m, radius: (m.radius || 5) * viewZoom }, { border: 6 * viewZoom }, graph);
                });

                viruses.forEach(v => {
                    renderUtils.drawVirus(worldToScreen(v.x, v.y), { ...v, radius: (v.radius || 50) * viewZoom }, graph);
                });

                let borders = {
                    left: screen.width / 2 - player.x * viewZoom,
                    right: screen.width / 2 + (global.game.width - player.x) * viewZoom,
                    top: screen.height / 2 - player.y * viewZoom,
                    bottom: screen.height / 2 + (global.game.height - player.y) * viewZoom
                };

                // Rita celler
                const cellsToDraw = users.flatMap(u => u.cells.map(c => ({
                    ...c, 
                    name: u.username, 
                    isMe: u.id === myIdRef.current,
                    isCashingOut: u.isCashingOut,
                    color: u.color.fill || u.color, 
                    borderColor: u.color.border || '#000',
                    radius: (c.radius || 0) * viewZoom,
                    ...worldToScreen(c.x, c.y),
                })));
                
                renderUtils.drawCells(cellsToDraw, { border: 6 * viewZoom, textBorderSize: 3 * viewZoom, textColor: '#fff', textBorder: '#000' }, 1, borders, graph);
                renderUtils.drawHUD(global, graph);

                const viewHalfW = screen.width / (2 * viewZoom);
                const viewHalfH = screen.height / (2 * viewZoom);
                const fallback = {
                    players: users.map(u => ({
                        x: u.x,
                        y: u.y,
                        isYou: u.id === myIdRef.current,
                    })),
                    food: Array.from(foodCacheRef.current.values()).map(f => ({
                        x: f.x,
                        y: f.y,
                        golden: f.golden,
                        hue: f.hue,
                    })),
                    viruses: (viruses || []).map(v => ({ x: v.x, y: v.y })),
                    ejected: (ejected || []).map(m => ({ x: m.x, y: m.y })),
                };
                const minimap = normalizeMinimapData(gameData.current.rewardInfo?.minimap, fallback);
                drawGameMinimap(graph, {
                    screenW: screen.width,
                    screenH: screen.height,
                    isMobile: IS_MOBILE,
                    centerX: player.x,
                    centerY: player.y,
                    viewHalfW,
                    viewHalfH,
                    players: minimap.players,
                    food: minimap.food,
                    viruses: minimap.viruses,
                    ejected: minimap.ejected,
                    zone: brZone,
                });
            }
            if (!isDead) animationFrameId.current = requestAnimationFrame(gameLoop);
        };
        gameLoop();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [isConnected, isDead, brZone]); 

    const tryDoubleTapEject = useMobileDoubleTapEject(
        IS_MOBILE && isConnected && !isDead,
        () => socketRef.current?.emit('1'),
    );

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x, y, screenWidth, screenHeight } = mapPointerToGameSpace(e.clientX, e.clientY, canvas);
        socketRef.current?.emit('0', {
            x, y,
            screenWidth,
            screenHeight,
        });
    };

    const handleTouch = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const t = e.touches?.[0];
        if (!t) return;
        tryDoubleTapEject(t.clientX, t.clientY);
        const { x, y, screenWidth, screenHeight } = mapPointerToGameSpace(t.clientX, t.clientY, canvas);
        socketRef.current?.emit('0', {
            x, y,
            screenWidth,
            screenHeight,
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
        <div ref={viewportRef} className={`game-viewport${IS_MOBILE ? ' game-viewport--mobile' : ''}`} style={{ 
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
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                style={{ display: 'block', touchAction: 'none' }}
            />

            <MobileGameSession containerRef={viewportRef} />

            {IS_MOBILE && isConnected && !isDead && (
                <AgarMobileControls onSplit={() => socketRef.current?.emit('2')} />
            )}

            {!isBattleRoyale && cashedAmount !== null && (
                <GameResultModal
                    type="cashout"
                    amount={cashedAmount}
                    onPlayAgain={handlePlayAgain}
                    onLobby={handleLobby}
                />
            )}

            {!isBattleRoyale && isDead && (
                <GameResultModal
                    type="death"
                    onPlayAgain={handlePlayAgain}
                    onLobby={handleLobby}
                />
            )}

            {isBattleRoyale && isDead && (
                <div className="modern-overlay-backdrop death">
                    <div className="modern-overlay-card death">
                        <div className="overlay-badge error">Eliminated</div>
                        <h2 className="overlay-heading">Out of the Zone</h2>
                        <div className="overlay-icon error">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">
                            {`${brAliveCount} players remain. Prize pool: $${brPrizePool.toFixed(2)}`}
                        </p>
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

            {isBattleRoyale && (
                <GameBRHud
                    prizePool={brPrizePool}
                    aliveCount={brAliveCount}
                    playerCount={brPlayerCount}
                />
            )}

            {!isBattleRoyale && (
                <GameCashoutBar
                    disabled={localTimer > 0 || isDead || cashedAmount !== null}
                    holdProgress={holdProgress}
                    onHoldStart={startHold}
                    onHoldEnd={cancelHold}
                    localTimer={localTimer}
                    cashOutTotal={global.cashOutTotal || 10}
                />
            )}

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

            {!IS_MOBILE && (
            <div className="game-controls-hint">
                SPACE to Split • W to Eject • Mouse to Move
            </div>
            )}

            {/* Logo/Name */}
            <div className="game-logo-wrap" style={{ 
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
                    <span className="game-logo-text" style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                        AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                    </span>
                </div>
                <div className="game-logo-sub" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                    {isBattleRoyale ? 'Battle Royale' : 'Alpha Demo v0.1'}
                </div>
                {!isBattleRoyale && (
                <div className="game-logo-reset" style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', marginTop: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {formatResetTimer()}
                </div>
                )}
            </div>

            {/* Mock Leaderboard */}
            <div className="game-leaderboard" style={{
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
                <h4 className="game-leaderboard-title" style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>
                    {isBattleRoyale ? 'Eliminations' : 'Leaderboard'}
                </h4>
                <div className="game-leaderboard-list" style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.map((p, i) => (
                        <div key={p.id} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            opacity: p.id === myIdRef.current ? 1 : 0.6,
                            color: p.id === myIdRef.current ? 'var(--accent)' : 'var(--text-bright)',
                            fontWeight: p.id === myIdRef.current ? '700' : '400'
                        }}>
                            <span className="game-leaderboard-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{i + 1}. {p.name || 'An unnamed cell'}</span>
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
