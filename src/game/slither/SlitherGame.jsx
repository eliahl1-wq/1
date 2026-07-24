import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

import { io } from 'socket.io-client';

import { SlitherRenderer } from './SlitherRenderer.js';

import { normalizeEntryFee, normalizeBREntryFee, normalizeCompetitiveEntryFee, formatUsd } from '../../constants/economy';
import { BRIntroOverlay, BRVictoryOverlay } from '../../components/BRGameOverlays';
import GameResultModal from '../../components/GameResultModal';
import GameSpectateHud from '../../components/GameSpectateHud';
import GameCashoutBar from '../../components/GameCashoutBar';
import GameSocialOverlay from '../../components/GameSocialOverlay';
import { useSpectatorCamera } from '../../hooks/useSpectatorCamera';
import { useSpectatorFollow } from '../../hooks/useSpectatorFollow';
import GameBRHud from '../../components/GameBRHud';
import MobileGameSession from '../../components/MobileGameSession';
import { SlitherMobileControls } from '../../components/MobileGameControls';
import { isTouchDevice } from '../../utils/mobile';
import { playFoodEatSound, unlockGameAudio } from '../../audio/synthSounds.js';
import { clearPendingResult, loadPendingResult, savePendingResult } from '../../utils/gamePendingResult.js';
import { getOrCreatePresenceId } from '../../utils/sitePresence.js';
import { stopSessionRecording } from '../../utils/mixpanel';
import '../../styles/gameInGame.css';
import { API_URL } from '../../utils/apiBase';


const IS_MOBILE = isTouchDevice();
const CASHOUT_SECONDS = 0;
const SLITHER_WORLD_HALF = 2400;
const COMPETITIVE_WORLD_HALF = SLITHER_WORLD_HALF * 0.3;
const SLITHER_SPEC_ZOOM = IS_MOBILE ? 2.05 : 2.88;
const SLITHER_SPEC_MIN_ZOOM = IS_MOBILE ? 0.95 : 1.35;
const SLITHER_SPEC_MAX_ZOOM = IS_MOBILE ? 3.5 : 4.2;

function lobbyModeForSession(isCompetitive) {
    return isCompetitive ? 'competitive-slither' : 'slither';
}

function persistLobbyGameMode(isCompetitive) {
    const mode = lobbyModeForSession(isCompetitive);
    localStorage.removeItem('current_game_mode');
    localStorage.setItem('selected_gamemode', mode);
    return mode;
}



export default function SlitherGame() {

    const navigate = useNavigate();

    const location = useLocation();

    const { user, token: authToken, refreshUser, applyOptimisticBalanceDelta } = useAuth();

    const pendingAtMount = loadPendingResult('slither');
    const blockAutoJoinRef = useRef(!!pendingAtMount);

    const canvasRef = useRef(null);

    const viewportRef = useRef(null);

    const socketRef = useRef(null);

    const rendererRef = useRef(null);
    const handleGameEmote = useCallback((payload) => rendererRef.current?.showEmote(payload), []);
    const handleGameChat = useCallback((payload) => rendererRef.current?.showChat(payload), []);

    const inputIntervalRef = useRef(null);

    const timerIntervalRef = useRef(null);

    const hasJoinedRef = useRef(false);

    const cashoutActiveRef = useRef(false);
    const playAgainPendingRef = useRef(false);
    const cashoutReconnectRef = useRef(false);
    const worldUpdatesEnabledRef = useRef(!pendingAtMount);

    const myIdRef = useRef(null);
    const prevBalanceRef = useRef(null);
    const prevKillsRef = useRef(null);

    const cashOutTotalRef = useRef(CASHOUT_SECONDS);
    const cashOutEndAtRef = useRef(0);
    const sessionStartAtRef = useRef(null);
    const spectatorCamRef = useRef({ x: 0, y: 0 });
    const joinParamsRef = useRef({ nickname: 'Guest', entryFeeUsd: 10, isBR: false });



    const [isConnected, setIsConnected] = useState(() => !!pendingAtMount);

    const [gameReady, setGameReady] = useState(() => !!pendingAtMount);

    const [currentBalance, setCurrentBalance] = useState(1.0);

    const [leaderboard, setLeaderboard] = useState([]);
    const hideNames = localStorage.getItem('hide_player_names') === 'true';

    const [isDead, setIsDead] = useState(() => pendingAtMount?.type === 'death');

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
    const [liveSession, setLiveSession] = useState(() => !pendingAtMount);

    const [localTimer, setLocalTimer] = useState(0);
    const [cashoutPending, setCashoutPending] = useState(false);
    const [cashOutEndAt, setCashOutEndAt] = useState(0);

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

    const lastLeaderboardAtRef = useRef(0);

    const lastBrHudAtRef = useRef(0);

    const lastBalanceUiAtRef = useRef(0);
    const blockInputRef = useRef(false);
    blockInputRef.current = isSpectating || isDead || cashedAmount !== null;

    const dismissBrIntro = useCallback(() => setBrShowIntro(false), []);

    const matchNickname = location.state?.nickname || user?.username || 'Guest';
    const gameModeStored = localStorage.getItem('current_game_mode') || 'slither';
    const tournamentId = location.state?.tournamentId || localStorage.getItem('current_tournament_id');
    const isTournamentMode = gameModeStored === 'tournament-slither'
        || location.state?.selectedMode === 'tournament-slither';
    const isBRMode = gameModeStored.startsWith('br-') || !!location.state?.battleRoyale;
    const isCompetitiveMode = gameModeStored === 'competitive-slither' || location.state?.selectedMode === 'competitive-slither';
    const entryFeeUsd = isTournamentMode ? 1 : isBRMode
        ? normalizeBREntryFee(localStorage.getItem('selected_entry_fee'))
        : isCompetitiveMode
            ? normalizeCompetitiveEntryFee(localStorage.getItem('selected_entry_fee'))
            : normalizeEntryFee(localStorage.getItem('selected_entry_fee'));

    joinParamsRef.current = {
        nickname: matchNickname,
        entryFeeUsd,
        isBR: isBRMode,
        isCompetitive: isCompetitiveMode,
        isTournament: isTournamentMode,
        tournamentId,
    };

    const { camRef: specCamRef, seed: seedSpecCam } = useSpectatorCamera({
        active: isSpectating,
        canvasRef,
        worldBounds: isCompetitiveMode ? {
            minX: -COMPETITIVE_WORLD_HALF + 80,
            maxX: COMPETITIVE_WORLD_HALF - 80,
            minY: -COMPETITIVE_WORLD_HALF + 80,
            maxY: COMPETITIVE_WORLD_HALF - 80,
        } : {
            minX: -SLITHER_WORLD_HALF + 80,
            maxX: SLITHER_WORLD_HALF - 80,
            minY: -SLITHER_WORLD_HALF + 80,
            maxY: SLITHER_WORLD_HALF - 80,
        },
        baseViewZoom: 1,
        minZoom: SLITHER_SPEC_MIN_ZOOM,
        maxZoom: SLITHER_SPEC_MAX_ZOOM,
        initialZoom: SLITHER_SPEC_ZOOM,
    });
    const getSpectatablePlayers = useCallback(() => {
        const renderer = rendererRef.current;
        const snakes = renderer?.targetSnakes || [];
        return snakes
            .filter(snake => snake.id !== myIdRef.current && snake.segments?.[0])
            .map(snake => {
                const smoothHead = renderer?.smooth?.get(snake.id)?.segments?.[0];
                return {
                    id: snake.id,
                    name: snake.name || 'Snake',
                    x: smoothHead?.x ?? snake.segments[0].x,
                    y: smoothHead?.y ?? snake.segments[0].y,
                };
            });
    }, []);
    const {
        target: spectateTarget,
        isFollowing: isFollowingPlayer,
        followNearest,
        cyclePrevious: spectatePrevious,
        cycleNext: spectateNext,
        useFreeCamera,
        getSpectatorCamera,
    } = useSpectatorFollow({
        active: isSpectating,
        cameraRef: specCamRef,
        getPlayers: getSpectatablePlayers,
    });

    const enterSpectate = useCallback(() => {
        const renderer = rendererRef.current;
        const startX = renderer?.camera?.x ?? spectatorCamRef.current.x;
        const startY = renderer?.camera?.y ?? spectatorCamRef.current.y;
        const startZoom = renderer?.zoom ?? SLITHER_SPEC_ZOOM;
        if (myIdRef.current) {
            renderer?.removeSnake(myIdRef.current);
        }
        worldUpdatesEnabledRef.current = true;
        renderer?.start();
        seedSpecCam(startX, startY, startZoom);
        followNearest(startX, startY);
        setIsSpectating(true);
        setShowResultModal(false);
        socketRef.current?.emit('slitherSpectateCam', { x: startX, y: startY });
    }, [followNearest, seedSpecCam]);

    const exitSpectate = useCallback(() => {
        worldUpdatesEnabledRef.current = false;
        rendererRef.current?.pause();
        setIsSpectating(false);
        setShowResultModal(true);
    }, []);

    const handlePlayAgain = useCallback(() => {
        if (playAgainPendingRef.current) return;
        if (joinParamsRef.current.isTournament) {
            clearPendingResult('slither');
            navigate(`/tournaments/${joinParamsRef.current.tournamentId}/lobby`);
            return;
        }
        const { nickname, entryFeeUsd: fee, isCompetitive } = joinParamsRef.current;
        const modeKey = isCompetitive ? 'competitive-slither' : 'slither';
        localStorage.setItem('current_game_mode', modeKey);
        localStorage.setItem('selected_gamemode', modeKey);
        playAgainPendingRef.current = true;
        blockAutoJoinRef.current = false;
        worldUpdatesEnabledRef.current = false;
        setIsRejoining(true);

        if (!liveSession) {
            setLiveSession(true);
            return;
        }

        if (socketRef.current?.connected) {
            const preferredSkin = localStorage.getItem('selected_skin') || '#c080ff';
            localStorage.removeItem('use_free_ticket');
            socketRef.current.emit('joinGame', {
                username: nickname,
                token: authToken,
                mode: isCompetitive ? 'competitive-slither' : 'slither',
                entryFeeUsd: fee,
                skinColor: preferredSkin,
                skinId: preferredSkin === 'random' ? 'rainbow' : 'free',
                useFreeTicket: false,
            });
        }
    }, [authToken, liveSession, navigate]);

    const handleLobby = useCallback(() => {
        clearPendingResult('slither');
        blockAutoJoinRef.current = true;
        worldUpdatesEnabledRef.current = false;
        if (joinParamsRef.current.isTournament) {
            navigate(`/tournaments/${joinParamsRef.current.tournamentId}/lobby`);
            return;
        }
        const mode = persistLobbyGameMode(joinParamsRef.current.isCompetitive);
        navigate('/pre-game', { state: { selectedMode: mode } });
    }, [navigate]);

    const handleBoostChange = useCallback((active) => {
        rendererRef.current?.setBoost(active);
    }, []);

    useEffect(() => {
        document.body.style.backgroundColor = '#0a0a0c';
        document.title = 'AgarStake | Slither';
        stopSessionRecording();
    }, []);

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

    const startCashoutCountdown = useCallback((seconds) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        cashoutActiveRef.current = true;
        setCashoutPending(true);
        cashOutTotalRef.current = seconds;
        const endAt = Date.now() + seconds * 1000;
        cashOutEndAtRef.current = endAt;
        setCashOutEndAt(endAt);

        let timeLeft = seconds;
        setLocalTimer(timeLeft);

        rendererRef.current?.setHud({
            cashoutEndAt: endAt,
            cashoutTotal: seconds,
            cashoutSeconds: timeLeft,
        });

        const intervalId = setInterval(() => {
            timeLeft = Math.max(0, timeLeft - 1);
            setLocalTimer(timeLeft);

            if (timeLeft <= 0) {
                clearInterval(intervalId);
                timerIntervalRef.current = null;
                cashOutEndAtRef.current = 0;
                setCashOutEndAt(0);
                rendererRef.current?.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
            }
        }, 1000);

        timerIntervalRef.current = intervalId;
    }, []);

    const canCashOutRef = useRef(false);
    canCashOutRef.current = !isBattleRoyale && gameReady && isConnected
        && localTimer <= 0 && cashedAmount === null && !isDead;

    const handleCashOut = useCallback(() => {
        if (!canCashOutRef.current) return;
        if (!socketRef.current?.connected) return;
        if (cashoutActiveRef.current) return;
        rendererRef.current?.setHoldStart(0);
        cashoutActiveRef.current = true;
        setCashoutPending(true);
        socketRef.current.emit('cashOut');
    }, []);

    const handleHoldStart = useCallback((atMs) => {
        rendererRef.current?.setHoldStart(atMs);
        rendererRef.current?.setInputEnabled(false, true);
        socketRef.current?.emit('cashOutHold', true);
    }, []);

    const handleHoldEnd = useCallback(() => {
        rendererRef.current?.setHoldStart(0);
        rendererRef.current?.setInputEnabled(true);
        socketRef.current?.emit('cashOutHold', false);
    }, []);

    const cashoutReady = !isBattleRoyale && gameReady && isConnected
        && localTimer <= 0 && cashedAmount === null && !isDead;

    useLayoutEffect(() => {
        rendererRef.current?.setHud({
            balance: currentBalance,
            cashoutSeconds: localTimer,
            cashoutTotal: cashOutTotalRef.current || CASHOUT_SECONDS,
            cashoutEndAt: cashOutEndAtRef.current,
        });
    }, [currentBalance, localTimer]);

    useEffect(() => {
        if (localTimer > 0 || isDead || cashedAmount !== null || isBattleRoyale) {
            // CashoutBar handles its own cancelHold internally when disabled
        }
    }, [localTimer, isDead, cashedAmount, isBattleRoyale]);

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return undefined;
        if (!isSpectating) {
            renderer.setSpectatorMode(false);
            renderer.setExternalCameraGetter(null);
            renderer.setInputEnabled(!blockInputRef.current);
            return undefined;
        }
        renderer.setInputEnabled(false);
        renderer.setExternalCameraGetter(() => {
            const cam = getSpectatorCamera() || specCamRef.current;
            return { x: cam.x, y: cam.y, zoom: cam.zoom };
        });
        renderer.setSpectatorMode(true, {
            x: specCamRef.current.x,
            y: specCamRef.current.y,
            zoom: specCamRef.current.zoom,
        });
        return () => {
            renderer.setExternalCameraGetter(null);
            renderer.setSpectatorMode(false);
            renderer.setInputEnabled(!blockInputRef.current);
        };
    }, [isSpectating, isDead, cashedAmount, getSpectatorCamera, specCamRef]);

    useEffect(() => {
        if (!isSpectating) return undefined;
        const syncCam = () => {
            const cam = getSpectatorCamera() || specCamRef.current;
            socketRef.current?.emit('slitherSpectateCam', { x: cam.x, y: cam.y });
        };
        syncCam();
        const id = setInterval(syncCam, 120);
        return () => clearInterval(id);
    }, [getSpectatorCamera, isSpectating, specCamRef]);



    useEffect(() => {

        if (!liveSession) return undefined;

        if (!canvasRef.current) return undefined;

        if (typeof authToken !== 'string' || authToken.length === 0) return undefined;



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



        const lastInputSentRef = { dx: NaN, dy: NaN, boost: null };

        const emitInput = () => {
            if (blockInputRef.current) return;
            if (!socketRef.current?.connected || !rendererRef.current) return;
            const inp = rendererRef.current.getInput();
            const now = Date.now();
            if (
                inp.dx === lastInputSentRef.dx
                && inp.dy === lastInputSentRef.dy
                && inp.boost === lastInputSentRef.boost
                && (now - (lastInputSentRef.time || 0)) < 250
            ) return;
            lastInputSentRef.dx = inp.dx;
            lastInputSentRef.dy = inp.dy;
            lastInputSentRef.boost = inp.boost;
            lastInputSentRef.time = now;
            socketRef.current.emit('slitherInput', inp);
        };

        renderer.setInputEmitter(emitInput);



        const gameMode = localStorage.getItem('current_game_mode') || 'slither';
        const isBR = gameMode.startsWith('br-') || !!location.state?.battleRoyale;
        const isCompetitive = gameMode === 'competitive-slither' || !!location.state?.selectedMode && location.state.selectedMode === 'competitive-slither';
        if (isBR) setIsBattleRoyale(true);

        const socket = io(API_URL, {
            auth: { token: authToken, presenceId: getOrCreatePresenceId() },
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
            if (!hasJoinedRef.current && !blockAutoJoinRef.current) {
                const { nickname, entryFeeUsd: fee, isBR: br } = joinParamsRef.current;
                if (joinParamsRef.current.isTournament) {
                    socket.emit('joinTournamentGame', {
                        username: nickname,
                        token: authToken,
                        tournamentId: joinParamsRef.current.tournamentId,
                        skinColor: localStorage.getItem('selected_skin') || '#c080ff',
                        skinId: (localStorage.getItem('selected_skin') || '#c080ff') === 'random' ? 'rainbow' : 'free',
                    });
                } else if (br) {
                    socket.emit('brRejoinMatch', { token: authToken });
                } else {
                    const joinMode = joinParamsRef.current.isCompetitive ? 'competitive-slither' : 'slither';
                    const preferredSkin = localStorage.getItem('selected_skin') || '#c080ff';
                    const useFreeTicket = localStorage.getItem('use_free_ticket') === 'true';
                    socket.emit('joinGame', {
                        username: nickname,
                        token: authToken,
                        mode: joinMode,
                        entryFeeUsd: fee,
                        skinColor: preferredSkin,
                skinId: preferredSkin === 'random' ? 'rainbow' : 'free',
                        useFreeTicket,
                    });
                }
                hasJoinedRef.current = true;
            }
        });



        socket.on('welcome', (playerSettings, gameSizes) => {
            playAgainPendingRef.current = false;
            blockAutoJoinRef.current = false;
            worldUpdatesEnabledRef.current = true;
            setCashoutPending(false);
            setIsDead(false);
            setCashedAmount(null);
            setSessionStats({ timeSurvivedMs: 0, eliminations: 0 });
            clearPendingResult('slither');
            const mode = gameSizes?.mode || lobbyModeForSession(joinParamsRef.current.isCompetitive);
            const expectedMode = lobbyModeForSession(joinParamsRef.current.isCompetitive);
            if (!joinParamsRef.current.isBR && !joinParamsRef.current.isTournament && mode !== expectedMode) {
                alert(`You still have an active ${mode === 'agar' ? 'Agar' : mode} game. Finish or cash out before starting Slither.`);
                navigate('/pre-game', { state: { selectedMode: mode === 'agar' ? 'agar' : expectedMode } });
                return;
            }
            const persistedMode = gameSizes?.tournament ? 'tournament-slither' : mode;
            localStorage.setItem('current_game_mode', persistedMode);
            localStorage.setItem('selected_gamemode', persistedMode);
            if (gameSizes?.tournamentId) {
                localStorage.setItem('current_tournament_id', gameSizes.tournamentId);
            }
            if (gameSizes?.entryFeeUsd) {
                localStorage.setItem('selected_entry_fee', String(gameSizes.entryFeeUsd));
            }
            setIsBattleRoyale(!!gameSizes?.battleRoyale);
            if (gameSizes?.prizePool) setBrPrizePool(gameSizes.prizePool);
            if (gameSizes?.playerCount) setBrPlayerCount(gameSizes.playerCount);
            if (gameSizes?.battleRoyale && gameSizes?.zone) {
                renderer.updateState({ zone: gameSizes.zone, battleRoyale: true });
            } else if (gameSizes?.competitiveSlither && gameSizes?.zone) {
                renderer.updateState({
                    zone: gameSizes.zone,
                    battleRoyale: false,
                    competitiveSlither: true,
                    circularMap: true,
                });
            } else {
                renderer.updateState({ zone: null, battleRoyale: false, competitiveSlither: false, circularMap: false });
            }
            if (gameSizes?.battleRoyale && gameSizes?.prizePool && !brIntroTriggeredRef.current) {
                brIntroTriggeredRef.current = true;
                setBrShowIntro(true);
            }
            myIdRef.current = playerSettings.id;
            renderer.resetSession();
            renderer.start();
            sessionStartAtRef.current = Date.now();
            setIsRejoining(false);
            setShowResultModal(false);
            prevKillsRef.current = playerSettings.kills ?? 0;
            if (!gameSizes?.battleRoyale) {
                const bal = isCompetitive
                    ? (playerSettings.dollarBalance ?? playerSettings.balance ?? 5)
                    : (playerSettings.dollarBalance ?? playerSettings.balance ?? 1.0);
                prevBalanceRef.current = bal;
                setCurrentBalance(bal);
                rendererRef.current?.setHud({ balance: bal });
            }
            setGameReady(true);
            refreshUser?.();
            if (gameSizes?.cashOutRemaining > 0 && !gameSizes?.battleRoyale) {
                cashoutActiveRef.current = true;
                setCashoutPending(true);
                setLocalTimer(0);
                cashOutEndAtRef.current = 0;
                setCashOutEndAt(0);
            }
        });

        socket.on('slitherTick', (tick) => {
            if (!worldUpdatesEnabledRef.current) return;
            const mergedTick = tick.competitiveSlither && tick.zone
                ? { ...tick, competitiveSlither: true, circularMap: true }
                : tick;
            renderer.updateState(mergedTick);

            if (tick.snakes && tick.you) {
                let me = null;
                for (let i = 0; i < tick.snakes.length; i++) {
                    if (tick.snakes[i].id === tick.you) {
                        me = tick.snakes[i];
                        break;
                    }
                }
                if (me?.kills != null) {
                    prevKillsRef.current = me.kills;
                }
                if (me?.segments?.[0]) {
                    spectatorCamRef.current = { x: me.segments[0].x, y: me.segments[0].y };
                }
            }

            // Competitive arena food only changes mass. Dollar balance increases
            // exclusively when eating paid death drops, so normal food stays silent.
            const hudBalance = tick.competitiveSlither ? tick.dollarBalance : tick.balance;
            if (!tick.battleRoyale && hudBalance != null) {
                const prev = prevBalanceRef.current;
                if (prev != null && hudBalance > prev + 0.001) {
                    playFoodEatSound();
                }
                prevBalanceRef.current = hudBalance;
                const nowB = Date.now();
                if (nowB - lastBalanceUiAtRef.current >= 400) {
                    lastBalanceUiAtRef.current = nowB;
                    setCurrentBalance((prevBal) => (prevBal === hudBalance ? prevBal : hudBalance));
                    rendererRef.current?.setHud({ balance: hudBalance });
                }
            }
            if (tick.battleRoyale) {
                const now = Date.now();
                if (now - lastBrHudAtRef.current >= 300) {
                    lastBrHudAtRef.current = now;
                    setIsBattleRoyale(true);
                    if (tick.prizePool != null) {
                        setBrPrizePool((prev) => (prev === tick.prizePool ? prev : tick.prizePool));
                    }
                    if (tick.aliveCount != null) {
                        setBrAliveCount((prev) => (prev === tick.aliveCount ? prev : tick.aliveCount));
                    }
                }
            }
            if (tick.resetTime) {
                const secs = Math.max(0, Math.ceil((tick.resetTime - Date.now()) / 1000));
                setResetCountdown((prev) => (prev === secs ? prev : secs));
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



        socket.on('cashOutProcessing', () => {
            cashoutActiveRef.current = true;
            setCashoutPending(true);
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            setLocalTimer(0);
            rendererRef.current?.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
            rendererRef.current?.removeSnake(myIdRef.current);
        });
        socket.on('cashOutStarting', () => {
            cashoutActiveRef.current = true;
            setCashoutPending(true);
            setLocalTimer(0);
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            rendererRef.current?.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
        });



        socket.on('cashOutSuccess', ({ amount }) => {
            cashoutActiveRef.current = false;
            cashoutReconnectRef.current = false;
            blockAutoJoinRef.current = true;
            // The server changes a finished Slither player into a passive
            // spectator. Keep ticks and rendering alive behind the result modal.
            worldUpdatesEnabledRef.current = true;
            hasJoinedRef.current = false;
            setCashoutPending(false);
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            setLocalTimer(0);
            rendererRef.current?.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
            rendererRef.current?.removeSnake(myIdRef.current);
            rendererRef.current?.start();
            const liveCamera = rendererRef.current?.camera ?? spectatorCamRef.current;
            socketRef.current?.emit('slitherSpectateCam', {
                x: liveCamera.x,
                y: liveCamera.y,
            });
            if (joinParamsRef.current.isTournament) {
                localStorage.setItem('current_game_mode', 'tournament-slither');
            } else {
                persistLobbyGameMode(joinParamsRef.current.isCompetitive);
            }
            const startedAt = sessionStartAtRef.current || Date.now();
            const stats = {
                timeSurvivedMs: Date.now() - startedAt,
                eliminations: prevKillsRef.current ?? 0,
            };
            setSessionStats(stats);
            setCashedAmount(amount);
            setShowResultModal(true);
            setIsSpectating(false);
            savePendingResult('slither', {
                type: 'cashout',
                cashedAmount: amount,
                ...stats,
                isCompetitive: joinParamsRef.current.isCompetitive,
            });
            refreshUser?.();
        });



        socket.on('leaderboard', ({ leaderboard: lb, battleRoyale: lbBR }) => {
            if (!worldUpdatesEnabledRef.current) return;
            const now = Date.now();
            if (now - lastLeaderboardAtRef.current < 400) return;
            lastLeaderboardAtRef.current = now;
            if (lbBR && myIdRef.current) {
                const me = lb.find(p => p.id === myIdRef.current);
                if (me) {
                    prevKillsRef.current = me.kills ?? 0;
                }
            }
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
            cashoutReconnectRef.current = false;
            blockAutoJoinRef.current = true;
            // The server changes a finished Slither player into a passive
            // spectator. Keep ticks and rendering alive behind the result modal.
            worldUpdatesEnabledRef.current = true;
            hasJoinedRef.current = false;
            setCashoutPending(false);
            if (myIdRef.current) {
                rendererRef.current?.removeSnake(myIdRef.current);
            }
            setIsDead(true);
            setLocalTimer(0);
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            cashoutActiveRef.current = false;
            rendererRef.current?.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
            const startedAt = sessionStartAtRef.current || Date.now();
            const stats = {
                timeSurvivedMs: Date.now() - startedAt,
                eliminations: prevKillsRef.current ?? 0,
            };
            setSessionStats(stats);
            setShowResultModal(true);
            setIsSpectating(false);
            savePendingResult('slither', {
                type: 'death',
                cashedAmount: null,
                ...stats,
                isCompetitive: joinParamsRef.current.isCompetitive,
            });
            const wasBR = joinParamsRef.current.isBR
                || localStorage.getItem('current_game_mode')?.startsWith('br-');
            if (joinParamsRef.current.isTournament) {
                localStorage.setItem('current_game_mode', 'tournament-slither');
            } else {
                persistLobbyGameMode(joinParamsRef.current.isCompetitive);
            }
            if (wasBR) {
                setTimeout(() => {
                    navigate('/gamemodes', { state: { selectedMode: 'slither' } });
                }, 4000);
            }
        });



        socket.on('tournamentEnded', () => {
            clearPendingResult('slither');
            rendererRef.current?.pause();
            navigate(`/tournaments/${joinParamsRef.current.tournamentId}/lobby`);
        });

        socket.on('forcedDisconnect', () => {
            blockAutoJoinRef.current = true;
            worldUpdatesEnabledRef.current = false;
            if (joinParamsRef.current.isTournament) {
                navigate(`/tournaments/${joinParamsRef.current.tournamentId}/lobby`);
                return;
            }
            const mode = persistLobbyGameMode(joinParamsRef.current.isCompetitive);
            navigate('/pre-game', { state: { selectedMode: mode } });
        });



        socket.on('error', (msg) => {

            setCashoutPending(false);
            if (playAgainPendingRef.current) {
                playAgainPendingRef.current = false;
                blockAutoJoinRef.current = true;
                setIsRejoining(false);
                if (typeof msg === 'string' && /insufficient/i.test(msg)) {
                    refreshUser?.({ forceBalance: true });
                    alert('Not enough funds for another round. Your game result is still saved.');
                    return;
                }
            }

            if (cashoutActiveRef.current) {
                cashoutActiveRef.current = false;
                cashOutEndAtRef.current = 0;
                setCashOutEndAt(0);
                setLocalTimer(0);
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
                rendererRef.current?.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
                if (cashoutReconnectRef.current && socketRef.current?.connected) {
                    cashoutReconnectRef.current = false;
                    blockAutoJoinRef.current = false;
                    worldUpdatesEnabledRef.current = true;
                    setIsRejoining(true);
                    const params = joinParamsRef.current;
                    socketRef.current.emit('joinGame', {
                        username: params.nickname,
                        token: authToken,
                        mode: params.isCompetitive ? 'competitive-slither' : 'slither',
                        entryFeeUsd: params.entryFeeUsd,
                        skinColor: localStorage.getItem('selected_skin') || '#c080ff',
                        skinId: (localStorage.getItem('selected_skin') || '#c080ff') === 'random' ? 'rainbow' : 'free',
                        useFreeTicket: false,
                    });
                }
            }

            if (joinParamsRef.current.isTournament && typeof msg === 'string') {
                alert(msg);
                navigate(`/tournaments/${joinParamsRef.current.tournamentId}/lobby`);
                return;
            }

            if (typeof msg === 'string' && /insufficient/i.test(msg)) {
                refreshUser?.({ forceBalance: true });
                setIsRejoining(false);
                const mode = persistLobbyGameMode(joinParamsRef.current.isCompetitive);
                navigate('/lobby', { state: { depositIntent: true, selectedMode: mode, requiredBalanceUsd: joinParamsRef.current.entryFeeUsd } });
                return;
            }

            if (typeof msg === 'string' && (msg.includes('balance') || msg.includes('Account'))) {

                alert(msg);

                const mode = persistLobbyGameMode(joinParamsRef.current.isCompetitive);
                navigate('/pre-game', { state: { selectedMode: mode } });

            } else if (typeof msg === 'string' && /battle royale/i.test(msg)) {

                navigate('/pre-game', { state: { selectedMode: localStorage.getItem('selected_gamemode') || 'slither' } });

            } else if (typeof msg === 'string') {

                alert(msg);

            }

        });



        socket.on('connect_error', () => setIsConnected(false));



        socket.on('disconnect', () => {
            setIsConnected(false);
            hasJoinedRef.current = false;
            if (cashoutActiveRef.current) {
                cashoutReconnectRef.current = true;
                blockAutoJoinRef.current = true;
                worldUpdatesEnabledRef.current = false;
                rendererRef.current?.pause();
            }
        });



        inputIntervalRef.current = setInterval(emitInput, 25);



        return () => {
            worldUpdatesEnabledRef.current = false;
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

    }, [authToken, navigate, startCashoutCountdown, liveSession]);



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

        <div ref={viewportRef} className={`game-viewport${IS_MOBILE ? ' game-viewport--mobile' : ''}`} style={{

            width: 'var(--game-viewport-width, 100dvw)',

            height: 'var(--game-viewport-height, 100dvh)',

            background: '#0a0a0c',

            overflow: 'hidden',

            position: 'fixed',

            top: 0,

            left: 0,

            fontFamily: 'system-ui',

        }}>

            <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', top: 0, left: 0, zIndex: 1, touchAction: 'none', contain: 'strict' }} />

            <MobileGameSession containerRef={viewportRef} />

            {IS_MOBILE && gameReady && isConnected && !isDead && cashedAmount === null && !isSpectating && (
                <SlitherMobileControls onBoostChange={handleBoostChange} />
            )}

            {isSpectating && (
                <GameSpectateHud
                    onBack={exitSpectate}
                    targetName={spectateTarget?.name}
                    isFollowing={isFollowingPlayer}
                    onPrevious={spectatePrevious}
                    onNext={spectateNext}
                    onFreeCamera={useFreeCamera}
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
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                        <div className="overlay-divider" />
                        <p className="overlay-caption">
                            {`${brAliveCount} players remain. Prize pool: $${brPrizePool.toFixed(2)}`}
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

                    background: rgba(5, 5, 7, 0.96);

                    animation: overlayIn 0.3s ease-out forwards; width: 100vw; height: 100vh;

                }

                .modern-overlay-backdrop.death { background: rgba(12, 3, 3, 0.96); }

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
                    onHoldStart={handleHoldStart}
                    onHoldEnd={handleHoldEnd}
                    onComplete={handleCashOut}
                    localTimer={localTimer}
                    cashOutTotal={cashOutTotalRef.current}
                    cashOutEndAt={cashOutEndAtRef.current}
                    pending={cashoutPending}
                />
            )}



            {!IS_MOBILE && (
            <div className="game-controls-hint">
                {isBattleRoyale
                    ? 'Mouse to Move • Click to Boost'
                    : 'Mouse to Move • Click to Boost'}
            </div>
            )}

            {user?.isAdmin && (
                <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button 
                        className="ui-btn ui-btn-primary" 
                        style={{ fontSize: '0.8rem', padding: '8px 16px', background: '#FF3B30', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => {
                            if (socketRef.current && authToken) {
                                socketRef.current.emit('adminSpawnBotNearMe', { token: authToken, mode: 'slither' });
                            }
                        }}
                    >
                        [Admin] Spawn Bot
                    </button>
                    <button 
                        style={{ fontSize: '0.8rem', padding: '8px 16px', background: '#FF9500', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => {
                            if (socketRef.current && authToken) {
                                socketRef.current.emit('adminClearBots', { token: authToken });
                            }
                        }}
                    >
                        [Admin] Clear Bots
                    </button>
                </div>
            )}



            {/* Logo + reset — matches Agar */}

            <div className="game-logo-wrap" style={{ position: 'absolute', top: '30px', right: '30px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', zIndex: 100 }}>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>

                    <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />

                    <span className="game-logo-text" style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>

                        AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>

                    </span>

                </div>

                <div className="game-logo-sub" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                    {isBattleRoyale ? 'Battle Royale' : (isCompetitiveMode ? 'Slither Arena' : 'Slither Mode')}
                </div>
                {!isBattleRoyale && (
                <div className="game-logo-reset" style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', marginTop: '4px', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {formatResetTimer()}
                </div>
                )}

            </div>



            {/* Leaderboard — matches Agar */}

            <GameSocialOverlay socket={socketRef.current} disabled={IS_MOBILE} onEmote={handleGameEmote} onChat={handleGameChat} />

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

                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',

                zIndex: 100,

            }}>

                <h4 className="game-leaderboard-title" style={{ margin: '0 0 12px 0', fontSize: '0.65rem', opacity: 0.3, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '800' }}>
                    {isBattleRoyale ? 'Eliminations' : 'Leaderboard'}
                </h4>

                <div className="game-leaderboard-list" style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {leaderboard.map((p, i) => (

                        <div key={p.id || i} style={{

                            display: 'flex',

                            justifyContent: 'space-between',

                            opacity: p.id === myIdRef.current ? 1 : 0.6,

                            color: p.id === myIdRef.current ? 'var(--accent)' : 'var(--text-bright)',

                            fontWeight: p.id === myIdRef.current ? '700' : '400',

                        }}>

                            <span className="game-leaderboard-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{i + 1}. {(hideNames && p.id !== myIdRef.current) ? '???' : p.name}</span>

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



