import React, { useRef, useEffect, useState, useCallback } from 'react';
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
import GameSpectateHud from '../../components/GameSpectateHud';
import GameCashoutBar from '../../components/GameCashoutBar';
import GameSocialOverlay from '../../components/GameSocialOverlay';
import { useSpectatorCamera } from '../../hooks/useSpectatorCamera';
import GameBRHud from '../../components/GameBRHud';
import MobileGameSession from '../../components/MobileGameSession';
import { AgarMobileControls, useMobileDoubleTapEject } from '../../components/MobileGameControls';
import { isTouchDevice, getMobileCanvasDpr } from '../../utils/mobile';
import { clearPendingResult, loadPendingResult, savePendingResult } from '../../utils/gamePendingResult.js';
import { getOrCreatePresenceId } from '../../utils/sitePresence.js';
import { getGameScreenSize, mapPointerToGameSpace, GAME_LAYOUT_CHANGE, getMobileViewZoom } from '../../utils/forcedLandscape';
import { drawGameMinimap, normalizeMinimapData } from '../minimap.js';
import { playFoodEatSound, unlockGameAudio } from '../../audio/synthSounds.js';
import { stopSessionRecording } from '../../utils/mixpanel';
import '../../styles/gameInGame.css';
import { API_URL } from '../../utils/apiBase';

const IS_MOBILE = isTouchDevice();
const CASHOUT_SECONDS = 5;

/** True when the local player's cell overlaps this pellet (we ate it or are eating it). */
function foodEatenByPlayer(f, myId, users) {
    if (!myId || !users?.length) return false;
    const me = users.find(u => u.id === myId);
    if (!me) return false;
    const fr = f.radius || 5;
    for (const c of me.cells || []) {
        if (Math.hypot(c.x - f.x, c.y - f.y) < (c.radius || 0) + fr * 0.45) {
            return true;
        }
    }
    return false;
}

/** Drop stale cached pellets; keep edge blobs briefly through spatial-filter gaps. */
function pruneAgarFoodCache(foodMap, px, py, screenW, screenH, users, myId) {
    const margin = 280;
    const halfW = screenW / 2 + margin;
    const halfH = screenH / 2 + margin;
    const IN_VIEW_MISS_LIMIT = 48;
    const OFF_VIEW_MISS_LIMIT = 18;
    for (const [id, f] of foodMap) {
        const miss = f._missStreak || 0;
        if (miss === 0) continue;
        const inView = Math.abs(f.x - px) <= halfW && Math.abs(f.y - py) <= halfH;
        if (foodEatenByPlayer(f, myId, users)) {
            foodMap.delete(id);
        } else if (!inView) {
            if (miss >= OFF_VIEW_MISS_LIMIT) foodMap.delete(id);
        } else if (miss >= IN_VIEW_MISS_LIMIT) {
            foodMap.delete(id);
        }
    }
}

function getAgarCameraZoom(cells) {
    if (!Array.isArray(cells) || cells.length === 0) return 1;
    const areaRadius = Math.sqrt(cells.reduce((sum, cell) => {
        const radius = Number(cell.radius) || 0;
        return sum + radius * radius;
    }, 0));
    if (areaRadius <= 48) return 1;
    return Math.max(0.38, Math.min(1, Math.pow(58 / areaRadius, 0.36)));
}


/**
 * Version v11 - Full Agar.io Clone Logic Integrated
 * Version v12 - Full Agar.io Clone Logic Integrated (Frontend)
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const viewportRef = useRef(null);
    const { user, token, refreshUser } = useAuth();

    const pendingAtMount = loadPendingResult('agar');
    const blockAutoJoinRef = useRef(!!pendingAtMount);
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
    const cashOutEndAtRef = useRef(0);
    const cashOutTotalRef = useRef(CASHOUT_SECONDS);
    const sessionStartAtRef = useRef(null);
    const spectatorCamRef = useRef({ x: 3000, y: 3000 });
    
    const WORLD_SIZE = 6000;

    const [isConnected, setIsConnected] = useState(() => !!pendingAtMount);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [cashedAmount, setCashedAmount] = useState(() => (
        pendingAtMount?.type === 'cashout' ? pendingAtMount.cashedAmount : null
    ));
    const [showResultModal, setShowResultModal] = useState(() => !!pendingAtMount);
    const [isSpectating, setIsSpectating] = useState(false);
    const [isRejoining, setIsRejoining] = useState(false);
    const [sessionStats, setSessionStats] = useState(() => (
        pendingAtMount
            ? {
                timeSurvivedMs: pendingAtMount.timeSurvivedMs ?? 0,
                eliminations: pendingAtMount.eliminations ?? 0,
            }
            : { timeSurvivedMs: 0, eliminations: 0 }
    ));
    const [isDead, setIsDead] = useState(() => pendingAtMount?.type === 'death');
    const [liveSession, setLiveSession] = useState(() => !pendingAtMount);
    const [localTimer, setLocalTimer] = useState(0);
    const [cashOutEndAt, setCashOutEndAt] = useState(0);
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
    const canvasDprRef = useRef(1);
    const joinParamsRef = useRef({ nickname: 'Guest', entryFeeUsd: DEFAULT_ENTRY_FEE, mode: 'agar' });
    const cameraZoomRef = useRef(1);
    const cameraFrameTimeRef = useRef(0);
    const cameraViewportRef = useRef({ zoom: 1, sentAt: 0 });

    const dismissBrIntro = useCallback(() => setBrShowIntro(false), []);

    const baseViewZoom = getMobileViewZoom();
    const { camRef: specCamRef, seed: seedSpecCam } = useSpectatorCamera({
        active: isSpectating,
        canvasRef,
        worldWidth: WORLD_SIZE,
        worldHeight: WORLD_SIZE,
        baseViewZoom,
    });

    const enterSpectate = useCallback(() => {
        seedSpecCam(spectatorCamRef.current.x, spectatorCamRef.current.y, 1);
        setIsSpectating(true);
        setShowResultModal(false);
    }, [seedSpecCam]);

    const exitSpectate = useCallback(() => {
        setIsSpectating(false);
        setShowResultModal(true);
    }, []);

    const handlePlayAgain = useCallback(() => {
        const { nickname, entryFeeUsd: fee, mode } = joinParamsRef.current;
        const playMode = mode.startsWith('br-') ? mode.replace(/^br-/, '') : mode;
        localStorage.setItem('current_game_mode', playMode);
        localStorage.setItem('selected_gamemode', playMode);

        clearPendingResult('agar');
        blockAutoJoinRef.current = false;

        setIsDead(false);
        setCashedAmount(null);
        setShowResultModal(false);
        setIsSpectating(false);
        setIsRejoining(true);
        setSessionStats({ timeSurvivedMs: 0, eliminations: 0 });
        setLocalTimer(0);
        prevBalanceRef.current = null;
        prevKillsRef.current = null;
        cashoutActiveRef.current = false;
        global.cashOutTimer = 0;
        global.cashOutEndAt = 0;
        cashOutEndAtRef.current = 0;
        setCashOutEndAt(0);
        foodCacheRef.current.clear();
        gameData.current = { player: {}, users: [], food: [], viruses: [], ejected: [], rewardInfo: null };

        if (!liveSession) {
            setLiveSession(true);
            return;
        }

        if (socketRef.current?.connected) {
            const preferredSkinAgar = localStorage.getItem('selected_skin_agar') || 'random';
            const useFreeTicket = localStorage.getItem('use_free_ticket') === 'true';
            
            socketRef.current.emit('joinGame', {
                username: nickname,
                token,
                mode: playMode,
                entryFeeUsd: fee,
                skinColor: preferredSkinAgar,
                useFreeTicket,
            });
        }
    }, [token, liveSession]);

    const handleLobby = useCallback(() => {
        clearPendingResult('agar');
        blockAutoJoinRef.current = false;
        localStorage.removeItem('current_game_mode');
        const mode = joinParamsRef.current.mode;
        const selectedMode = mode.startsWith('br-') ? mode.replace(/^br-/, '') : mode;
        navigate('/pre-game', { state: { selectedMode } });
    }, [navigate]);

    const startCashoutCountdown = useCallback((seconds) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        cashoutActiveRef.current = true;

        let timeLeft = seconds;
        cashOutTotalRef.current = seconds;
        global.cashOutTotal = seconds;
        const endAt = Date.now() + seconds * 1000;
        cashOutEndAtRef.current = endAt;
        global.cashOutEndAt = endAt;
        global.cashOutTimer = timeLeft;
        setCashOutEndAt(endAt);
        setLocalTimer(timeLeft);

        const intervalId = setInterval(() => {
            setLocalTimer((prev) => {
                const next = Math.max(0, prev - 1);
                global.cashOutTimer = next;
                if (next <= 0) {
                    global.cashOutEndAt = 0;
                    cashOutEndAtRef.current = 0;
                    setCashOutEndAt(0);
                    clearInterval(intervalId);
                    timerIntervalRef.current = null;
                    cashoutActiveRef.current = false;
                }
                return next;
            });
        }, 1000);
        timerIntervalRef.current = intervalId;
    }, []);

    const canCashOutRef = useRef(false);
    canCashOutRef.current = !isBattleRoyale && localTimer <= 0 && cashedAmount === null && !isDead;

    const cashoutReady = !isBattleRoyale && isConnected && !isDead && cashedAmount === null;

    const handleCashOut = useCallback(() => {
        if (!canCashOutRef.current) return;
        if (cashoutActiveRef.current) return;
        global.holdStartAt = 0;
        startCashoutCountdown(CASHOUT_SECONDS);
        socketRef.current?.emit('cashOut');
    }, [startCashoutCountdown]);

    const handleHoldStart = useCallback((atMs) => {
        global.holdStartAt = atMs;
    }, []);

    const handleHoldEnd = useCallback(() => {
        global.holdStartAt = 0;
    }, []);

    useEffect(() => {
        stopSessionRecording();
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
        if (!liveSession) return undefined;

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

        const matchNickname = location.state?.nickname || user?.username || 'Guest';
        const storedMode = localStorage.getItem('current_game_mode') || localStorage.getItem('selected_gamemode') || 'agar';
        const wantsBattleRoyale = storedMode === 'br-agar' || !!location.state?.battleRoyale;
        const sessionMode = wantsBattleRoyale ? 'br-agar' : 'agar';
        if (wantsBattleRoyale) {
            setIsBattleRoyale(true);
            global.battleRoyale = true;
        }
        const entryFeeUsd = wantsBattleRoyale
            ? normalizeBREntryFee(localStorage.getItem('selected_entry_fee'))
            : normalizeEntryFee(localStorage.getItem('selected_entry_fee'));

        joinParamsRef.current = {
            nickname: matchNickname,
            entryFeeUsd,
            mode: sessionMode,
        };

        const socket = io(API_URL, {
            auth: { token, presenceId: getOrCreatePresenceId() },
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
            if (!hasJoinedGameRef.current && !blockAutoJoinRef.current) {
                if (wantsBattleRoyale) {
                    socket.emit('brRejoinMatch', { token });
                } else {
                    const preferredSkinAgar = localStorage.getItem('selected_skin_agar') || 'random';
                    const useFreeTicket = localStorage.getItem('use_free_ticket') === 'true';
                    localStorage.removeItem('use_free_ticket');
                    socket.emit('joinGame', {
                        username: matchNickname,
                        token,
                        mode: sessionMode,
                        entryFeeUsd,
                        skinColor: preferredSkinAgar,
                        useFreeTicket,
                    });
                }
                hasJoinedGameRef.current = true;
            }
        });

        socket.on('init', (data) => {
            // Denna används inte längre då servern skickar 'welcome'
        });

        socket.on('welcome', (playerSettings, gameSizes) => {
            clearPendingResult('agar');
            const isRejoin = gameSizes?.rejoin === true;
            console.log(isRejoin ? 'Rejoined arena' : 'Welcome to Arena');
            foodCacheRef.current.clear(); // Prevent flickering from old food cache
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
            cameraZoomRef.current = 1;
            cameraFrameTimeRef.current = 0;
            cameraViewportRef.current = { zoom: getMobileViewZoom(), sentAt: 0 };
            global.game.width = gameSizes.width;
            global.game.height = gameSizes.height;
            sessionStartAtRef.current = Date.now();
            setIsRejoining(false);
            setShowResultModal(false);
            setIsConnected(true);
            const startBal = playerSettings.balance ?? 1.0;
            prevBalanceRef.current = startBal;
            prevKillsRef.current = playerSettings.kills ?? 0;
            setCurrentBalance(startBal);

            const canvas = canvasRef.current;
            if (canvas && socketRef.current?.connected) {
                const { width, height } = getGameScreenSize();
                const viewZoom = getMobileViewZoom();
                socketRef.current.emit('0', {
                    x: playerSettings.x ?? playerSettings.cells?.[0]?.x ?? 0,
                    y: playerSettings.y ?? playerSettings.cells?.[0]?.y ?? 0,
                    screenWidth: width / viewZoom,
                    screenHeight: height / viewZoom,
                });
            }
            
            // Återuppta cashout-timer om man refreashar mitt i
            if (gameSizes?.cashOutRemaining > 0 && !gameSizes?.battleRoyale) {
                startCashoutCountdown(gameSizes.cashOutRemaining);
            }
        });

        socket.on('cashOutStarting', (data) => {
            const seconds = data?.seconds ?? CASHOUT_SECONDS;
            if (!cashoutActiveRef.current) {
                startCashoutCountdown(seconds);
                return;
            }
            cashOutTotalRef.current = seconds;
            global.cashOutTotal = seconds;
            const endAt = Date.now() + seconds * 1000;
            cashOutEndAtRef.current = endAt;
            global.cashOutEndAt = endAt;
            setCashOutEndAt(endAt);
            setLocalTimer(seconds);
            global.cashOutTimer = seconds;
        });

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
                if (foodEatenByPlayer(f, myIdRef.current, userData)) {
                    playFoodEatSound();
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
                    if (me.kills != null) prevKillsRef.current = me.kills;
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
            global.cashOutTimer = 0;
            global.cashOutEndAt = 0;
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            setLocalTimer(0);
            localStorage.removeItem('current_game_mode');
            const startedAt = sessionStartAtRef.current || Date.now();
            const stats = {
                timeSurvivedMs: Date.now() - startedAt,
                eliminations: prevKillsRef.current ?? 0,
            };
            setSessionStats(stats);
            setCashedAmount(amount);
            setShowResultModal(true);
            setIsSpectating(false);
            savePendingResult('agar', {
                type: 'cashout',
                cashedAmount: amount,
                ...stats,
            });
            refreshUser?.();
        });

        const handleDeath = () => {
            setIsDead(true);
            global.cashOutTimer = 0;
            global.cashOutEndAt = 0;
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            setLocalTimer(0);
            cashoutActiveRef.current = false;
            const startedAt = sessionStartAtRef.current || Date.now();
            const stats = {
                timeSurvivedMs: Date.now() - startedAt,
                eliminations: prevKillsRef.current ?? 0,
            };
            setSessionStats(stats);
            setShowResultModal(true);
            setIsSpectating(false);
            savePendingResult('agar', {
                type: 'death',
                cashedAmount: null,
                ...stats,
            });
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
                global.cashOutTimer = 0;
                global.cashOutEndAt = 0;
                cashOutEndAtRef.current = 0;
                setCashOutEndAt(0);
                setLocalTimer(0);
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
            }
            if (typeof msg === 'string' && msg.includes('balance')) {
                alert(msg);
                navigate('/pre-game');
            } else if (typeof msg === 'string' && /battle royale/i.test(msg)) {
                navigate('/pre-game', { state: { selectedMode: localStorage.getItem('selected_gamemode') || 'agar' } });
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
    }, [token, navigate, location.state?.nickname, startCashoutCountdown, liveSession]);

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width, height } = getGameScreenSize();
        const viewZoom = getMobileViewZoom() * cameraZoomRef.current;
        const dpr = IS_MOBILE ? getMobileCanvasDpr() : 1;
        canvasDprRef.current = dpr;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
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
            const { width, height } = getGameScreenSize();
            const dpr = canvasDprRef.current;
            graph.setTransform(dpr, 0, 0, dpr, 0, 0);
            graph.imageSmoothingEnabled = true;
            graph.imageSmoothingQuality = IS_MOBILE ? 'high' : 'medium';
            const screen = { width, height };
            const hasPlayer = player && player.x !== undefined;
            const frameNow = performance.now();
            const previousFrame = cameraFrameTimeRef.current || frameNow - 16.67;
            const frameDelta = Math.min(0.1, Math.max(0.001, (frameNow - previousFrame) / 1000));
            cameraFrameTimeRef.current = frameNow;
            if (hasPlayer && !isSpectating) {
                const targetZoom = getAgarCameraZoom(player.cells);
                const easing = 1 - Math.exp(-frameDelta * 4.5);
                cameraZoomRef.current += (targetZoom - cameraZoomRef.current) * easing;
            }

            if (hasPlayer && !isSpectating) {
                spectatorCamRef.current = { x: player.x, y: player.y };
            }
            const camX = isSpectating
                ? specCamRef.current.x
                : (hasPlayer ? player.x : spectatorCamRef.current.x);
            const camY = isSpectating
                ? specCamRef.current.y
                : (hasPlayer ? player.y : spectatorCamRef.current.y);
            const viewZoom = baseViewZoom * (isSpectating ? specCamRef.current.zoom : cameraZoomRef.current);
            if (hasPlayer && !isSpectating && socketRef.current?.connected) {
                const sentViewport = cameraViewportRef.current;
                const sentAt = Date.now();
                if (sentAt - sentViewport.sentAt >= 250 && Math.abs(viewZoom - sentViewport.zoom) >= 0.015) {
                    socketRef.current.emit('0', {
                        screenWidth: width / viewZoom,
                        screenHeight: height / viewZoom,
                    });
                    cameraViewportRef.current = { zoom: viewZoom, sentAt };
                }
            }
            const canRenderWorld = isConnected && (!isDead || isSpectating) && (hasPlayer || cashedAmount !== null || isSpectating);
            
            if (canRenderWorld) {
                const worldToScreen = (wx, wy) => ({
                    x: (wx - camX) * viewZoom + screen.width / 2,
                    y: (wy - camY) * viewZoom + screen.height / 2,
                });

                graph.fillStyle = global.backgroundColor;
                graph.fillRect(0, 0, screen.width, screen.height);
                
                renderUtils.drawGrid(global, { x: camX, y: camY }, screen, graph, viewZoom);

                if (brZone && camX != null) {
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
                
                pruneAgarFoodCache(foodCacheRef.current, camX, camY, screen.width / viewZoom, screen.height / viewZoom, users, myIdRef.current);
                const halfW = screen.width / (2 * viewZoom) + 120;
                const halfH = screen.height / (2 * viewZoom) + 120;
                const myCells = users.find(u => u.id === myIdRef.current)?.cells || [];
                for (const f of foodCacheRef.current.values()) {
                    if (Math.abs(f.x - camX) > halfW || Math.abs(f.y - camY) > halfH) continue;
                    const fr = (f.radius || 5);
                    const underMe = myCells.some((c) => {
                        const d = Math.hypot(c.x - f.x, c.y - f.y);
                        return d < Math.max((c.radius || 0) - fr * 0.15, fr * 0.25);
                    });
                    if (underMe) continue;
                    renderUtils.drawFood(worldToScreen(f.x, f.y), { ...f, radius: fr * viewZoom }, graph, IS_MOBILE);
                }

                (ejected || []).forEach(m => {
                    renderUtils.drawFireFood(worldToScreen(m.x, m.y), { ...m, radius: (m.radius || 5) * viewZoom }, { border: 6 * viewZoom }, graph);
                });

                viruses.forEach(v => {
                    renderUtils.drawVirus(worldToScreen(v.x, v.y), { ...v, radius: (v.radius || 50) * viewZoom }, graph);
                });

                let borders = {
                    left: screen.width / 2 - camX * viewZoom,
                    right: screen.width / 2 + (global.game.width - camX) * viewZoom,
                    top: screen.height / 2 - camY * viewZoom,
                    bottom: screen.height / 2 + (global.game.height - camY) * viewZoom
                };

                // Rita celler
                const cellsToDraw = users.flatMap(u => {
                    const totalCellMass = (u.cells || []).reduce((sum, cell) => sum + (Number(cell.balance) || 0), 0);
                    const totalDollarBalance = Number(u.balance ?? u.dollarBalance ?? 0) || 0;
                    return (u.cells || []).map(c => {
                        const massShare = totalCellMass > 0 ? (Number(c.balance) || 0) / totalCellMass : 0;
                        return {
                            ...c,
                            name: u.username,
                            isMe: u.id === myIdRef.current,
                            isCashingOut: u.isCashingOut,
                            dollarBalance: totalDollarBalance * massShare,
                            color: u.color.fill || u.color,
                            borderColor: u.color.border || '#000',
                            radius: (c.radius || 0) * viewZoom,
                            ...worldToScreen(c.x, c.y),
                        };
                    });
                });
                
                renderUtils.drawCells(cellsToDraw, { border: 6 * viewZoom, textBorderSize: 3 * viewZoom, textColor: '#fff', textBorder: '#000' }, 1, borders, graph, IS_MOBILE);
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
                    centerX: camX,
                    centerY: camY,
                    viewHalfW,
                    viewHalfH,
                    players: minimap.players,
                    food: minimap.food,
                    viruses: minimap.viruses,
                    ejected: minimap.ejected,
                    zone: brZone,
                });
            }
            if (!isDead || isSpectating) animationFrameId.current = requestAnimationFrame(gameLoop);
        };
        gameLoop();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [isConnected, isDead, brZone, cashedAmount, isSpectating, baseViewZoom]); 

    const tryDoubleTapEject = useMobileDoubleTapEject(
        IS_MOBILE && isConnected && !isDead && !isSpectating && cashedAmount === null,
        () => socketRef.current?.emit('1'),
    );

    const handleMouseMove = (e) => {
        if (isSpectating || isDead || cashedAmount !== null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x, y, screenWidth, screenHeight } = mapPointerToGameSpace(e.clientX, e.clientY, canvas);
        socketRef.current?.emit('0', {
            x: x / cameraZoomRef.current,
            y: y / cameraZoomRef.current,
            screenWidth: screenWidth / cameraZoomRef.current,
            screenHeight: screenHeight / cameraZoomRef.current,
        });
    };

    const handleTouch = (e) => {
        if (isSpectating || isDead || cashedAmount !== null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const t = e.touches?.[0];
        if (!t) return;
        tryDoubleTapEject(t.clientX, t.clientY);
        const { x, y, screenWidth, screenHeight } = mapPointerToGameSpace(t.clientX, t.clientY, canvas);
        socketRef.current?.emit('0', {
            x: x / cameraZoomRef.current,
            y: y / cameraZoomRef.current,
            screenWidth: screenWidth / cameraZoomRef.current,
            screenHeight: screenHeight / cameraZoomRef.current,
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

            {isSpectating && (
                <GameSpectateHud onBack={exitSpectate} />
            )}

            {IS_MOBILE && isConnected && !isDead && cashedAmount === null && !isSpectating && (
                <AgarMobileControls 
                    onSplit={() => socketRef.current?.emit('2')} 
                    onEject={() => socketRef.current?.emit('1')} 
                />
            )}

            {!isBattleRoyale && (cashedAmount !== null || isDead) && showResultModal && (
                <GameResultModal
                    type={cashedAmount !== null ? 'cashout' : 'death'}
                    amount={cashedAmount ?? undefined}
                    timeSurvivedMs={sessionStats.timeSurvivedMs}
                    eliminations={sessionStats.eliminations}
                    walletBalanceUsd={user?.balanceUsd ?? (user?.balanceSol ?? 0) * (user?.solPrice ?? 0)}
                    walletBalanceSol={user?.balanceSol ?? user?.balance ?? 0}
                    solPrice={user?.solPrice ?? 0}
                    isJoining={isRejoining}
                    onPlayAgain={handlePlayAgain}
                    onHome={handleLobby}
                    onSpectate={enterSpectate}
                    onClose={enterSpectate}
                    showSpectate
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

            {!isBattleRoyale && cashedAmount === null && (
                <GameCashoutBar
                    disabled={!cashoutReady}
                    onHoldStart={() => { cashoutActiveRef.current = true; }}
                    onHoldEnd={() => { cashoutActiveRef.current = false; }}
                    onComplete={handleCashOut}
                    localTimer={localTimer}
                    cashOutTotal={cashOutTotalRef.current}
                    cashOutEndAt={cashOutEndAtRef.current}
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

            {user?.isAdmin && (
                <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button 
                        className="ui-btn ui-btn-primary" 
                        style={{ fontSize: '0.8rem', padding: '8px 16px', background: '#FF3B30', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => {
                            if (socketRef.current && token) {
                                socketRef.current.emit('adminSpawnBotNearMe', { token, mode: 'agar' });
                            }
                        }}
                    >
                        [Admin] Spawn Bot
                    </button>
                    <button 
                        style={{ fontSize: '0.8rem', padding: '8px 16px', background: '#FF9500', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => {
                            if (socketRef.current && token) {
                                socketRef.current.emit('adminClearBots', { token });
                            }
                        }}
                    >
                        [Admin] Clear Bots
                    </button>
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

            <GameSocialOverlay socket={socketRef.current} disabled={IS_MOBILE} />

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



