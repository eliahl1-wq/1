import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { SurvivRenderer } from './SurvivRenderer.js';
import { normalizeSurvivEntryFee, formatUsd } from '../../constants/economy';
import GameResultModal from '../../components/GameResultModal';
import GameSpectateHud from '../../components/GameSpectateHud';
import GameCashoutBar from '../../components/GameCashoutBar';
import { useSpectatorCamera } from '../../hooks/useSpectatorCamera';
import MobileGameSession from '../../components/MobileGameSession';
import { isTouchDevice } from '../../utils/mobile';
import { unlockGameAudio } from '../../audio/synthSounds.js';
import { clearPendingResult, loadPendingResult, savePendingResult } from '../../utils/gamePendingResult.js';
import { getOrCreatePresenceId } from '../../utils/sitePresence.js';
import { stopSessionRecording } from '../../utils/mixpanel';
import { markGamemodePlayed } from '../../constants/gamemodes';
import '../../styles/gameInGame.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');
const IS_MOBILE = isTouchDevice();
const CASHOUT_SECONDS = 10;
const WORLD_HALF = 2000;
const SPEC_ZOOM = IS_MOBILE ? 1.6 : 2.2;

export default function SurvivGame() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token: authToken, refreshUser } = useAuth();

    const pendingAtMount = loadPendingResult('surviv');
    const blockAutoJoinRef = useRef(!!pendingAtMount);

    const canvasRef = useRef(null);
    const viewportRef = useRef(null);
    const socketRef = useRef(null);
    const rendererRef = useRef(null);
    const inputIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const cashoutActiveRef = useRef(false);
    const myIdRef = useRef(null);
    const cashOutTotalRef = useRef(CASHOUT_SECONDS);
    const cashOutEndAtRef = useRef(0);
    const sessionStartAtRef = useRef(null);
    const joinParamsRef = useRef({ nickname: 'Guest', entryFeeUsd: 5 });
    const reloadPendingRef = useRef(false);

    const [isConnected, setIsConnected] = useState(() => !!pendingAtMount);
    const [gameReady, setGameReady] = useState(() => !!pendingAtMount);
    const [currentBalance, setCurrentBalance] = useState(2.0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [isDead, setIsDead] = useState(() => pendingAtMount?.type === 'death');
    const [cashedAmount, setCashedAmount] = useState(() => (
        pendingAtMount?.type === 'cashout' ? pendingAtMount.cashedAmount : null
    ));
    const [showResultModal, setShowResultModal] = useState(() => !!pendingAtMount);
    const [isSpectating, setIsSpectating] = useState(false);
    const [isRejoining, setIsRejoining] = useState(false);
    const [sessionStats, setSessionStats] = useState(() => (
        pendingAtMount
            ? { timeSurvivedMs: pendingAtMount.timeSurvivedMs ?? 0, eliminations: pendingAtMount.eliminations ?? 0 }
            : { timeSurvivedMs: 0, eliminations: 0 }
    ));
    const [liveSession, setLiveSession] = useState(() => !pendingAtMount);
    const [localTimer, setLocalTimer] = useState(0);
    const [cashOutEndAt, setCashOutEndAt] = useState(0);
    const [resetCountdown, setResetCountdown] = useState(null);

    const matchNickname = location.state?.nickname || user?.username || 'Guest';
    const entryFeeUsd = normalizeSurvivEntryFee(localStorage.getItem('selected_entry_fee'));
    joinParamsRef.current = { nickname: matchNickname, entryFeeUsd };

    const { camRef: specCamRef, seed: seedSpecCam } = useSpectatorCamera({
        active: isSpectating,
        canvasRef,
        worldBounds: {
            minX: -WORLD_HALF + 80,
            maxX: WORLD_HALF - 80,
            minY: -WORLD_HALF + 80,
            maxY: WORLD_HALF - 80,
        },
        baseViewZoom: 1,
        minZoom: 1,
        maxZoom: 3,
        initialZoom: SPEC_ZOOM,
    });

    const blockInputRef = useRef(false);
    blockInputRef.current = isSpectating || isDead || cashedAmount !== null;

    const enterSpectate = useCallback(() => {
        const renderer = rendererRef.current;
        const startX = renderer?.camera?.x ?? 0;
        const startY = renderer?.camera?.y ?? 0;
        renderer?.start();
        seedSpecCam(startX, startY, SPEC_ZOOM);
        setIsSpectating(true);
        setShowResultModal(false);
        socketRef.current?.emit('survivSpectateCam', { x: startX, y: startY });
    }, [seedSpecCam]);

    const exitSpectate = useCallback(() => {
        rendererRef.current?.pause();
        setIsSpectating(false);
        setShowResultModal(true);
    }, []);

    const handlePlayAgain = useCallback(() => {
        clearPendingResult('surviv');
        blockAutoJoinRef.current = false;
        localStorage.setItem('current_game_mode', 'surviv');
        localStorage.setItem('selected_gamemode', 'surviv');
        markGamemodePlayed('surviv');

        setIsDead(false);
        setCashedAmount(null);
        setShowResultModal(false);
        setIsSpectating(false);
        setIsRejoining(true);
        setSessionStats({ timeSurvivedMs: 0, eliminations: 0 });
        setLocalTimer(0);
        setCashOutEndAt(0);
        cashoutActiveRef.current = false;
        cashOutEndAtRef.current = 0;

        if (!liveSession) {
            setLiveSession(true);
            return;
        }

        rendererRef.current?.resetSession();
        rendererRef.current?.start();

        if (socketRef.current?.connected) {
            const preferredSkin = localStorage.getItem('selected_skin') || 'random';
            socketRef.current.emit('joinGame', {
                username: joinParamsRef.current.nickname,
                token: authToken,
                mode: 'surviv',
                entryFeeUsd: joinParamsRef.current.entryFeeUsd,
                skinColor: preferredSkin,
            });
        }
    }, [authToken, liveSession]);

    const handleLobby = useCallback(() => {
        clearPendingResult('surviv');
        blockAutoJoinRef.current = false;
        localStorage.setItem('selected_gamemode', 'surviv');
        navigate('/pre-game', { state: { selectedMode: 'surviv' } });
    }, [navigate]);

    const startCashoutCountdown = useCallback((seconds) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        cashoutActiveRef.current = true;
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
    canCashOutRef.current = gameReady && isConnected && localTimer <= 0 && cashedAmount === null && !isDead;

    const handleCashOut = useCallback(() => {
        if (!canCashOutRef.current) return;
        if (!socketRef.current?.connected) return;
        if (cashoutActiveRef.current) return;
        rendererRef.current?.setHoldStart(0);
        startCashoutCountdown(CASHOUT_SECONDS);
        socketRef.current.emit('cashOut');
    }, [startCashoutCountdown]);

    useLayoutEffect(() => {
        rendererRef.current?.setHud({
            balance: currentBalance,
            cashoutSeconds: localTimer,
            cashoutTotal: cashOutTotalRef.current || CASHOUT_SECONDS,
            cashoutEndAt: cashOutEndAtRef.current,
        });
    }, [currentBalance, localTimer]);

    useEffect(() => {
        document.body.style.backgroundColor = '#0a0a0c';
        document.title = 'AgarStake | Surviv';
        stopSessionRecording();
    }, []);

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
            const cam = specCamRef.current;
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
    }, [isSpectating, isDead, cashedAmount, specCamRef]);

    useEffect(() => {
        if (!isSpectating) return undefined;
        const syncCam = () => {
            const cam = specCamRef.current;
            socketRef.current?.emit('survivSpectateCam', { x: cam.x, y: cam.y });
        };
        syncCam();
        const id = setInterval(syncCam, 120);
        return () => clearInterval(id);
    }, [isSpectating, specCamRef]);

    useEffect(() => {
        if (!liveSession) return undefined;
        if (!canvasRef.current) return undefined;
        if (typeof authToken !== 'string' || authToken.length === 0) return undefined;

        if (socketRef.current) {
            socketRef.current.off();
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const renderer = new SurvivRenderer(canvasRef.current);
        renderer.worldHalf = WORLD_HALF;
        rendererRef.current = renderer;

        const socket = io(API_URL, {
            auth: { token: authToken, presenceId: getOrCreatePresenceId() },
            transports: ['polling', 'websocket'],
            reconnection: true,
        });
        socketRef.current = socket;

        const onKeyDown = (e) => {
            if (blockInputRef.current) return;
            const action = renderer.handleKeyDown(e);
            if (action === 'reload') reloadPendingRef.current = true;
        };
        const onKeyUp = (e) => renderer.handleKeyUp(e);
        const onPointerMove = (e) => {
            renderer.handlePointerMove(e.clientX, e.clientY);
        };
        const onPointerDown = (e) => {
            if (e.button === 0) renderer.handlePointerDown();
        };
        const onPointerUp = () => renderer.handlePointerUp();

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvasRef.current.addEventListener('pointermove', onPointerMove);
        canvasRef.current.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('welcome', (player, world) => {
            hasJoinedRef.current = true;
            myIdRef.current = player.id;
            renderer.setMyId(player.id);
            sessionStartAtRef.current = Date.now();
            setCurrentBalance(player.dollarBalance ?? 2);
            setGameReady(true);
            setIsRejoining(false);
            renderer.start();

            if (world?.cashOutRemaining > 0) {
                startCashoutCountdown(world.cashOutRemaining);
            }
        });

        socket.on('survivTick', (tick) => {
            renderer.updateState(tick);
            if (tick.dollarBalance != null) {
                setCurrentBalance(tick.dollarBalance);
            }
            if (tick.resetTime) {
                const left = Math.max(0, Math.floor((tick.resetTime - Date.now()) / 1000));
                setResetCountdown(left);
            }
        });

        socket.on('leaderboard', (data) => {
            if (data?.leaderboard) setLeaderboard(data.leaderboard);
        });

        socket.on('cashOutStarting', ({ seconds }) => {
            startCashoutCountdown(seconds || CASHOUT_SECONDS);
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            cashoutActiveRef.current = false;
            const survived = Date.now() - (sessionStartAtRef.current || Date.now());
            setSessionStats(prev => ({ ...prev, timeSurvivedMs: survived }));
            setCashedAmount(amount);
            setShowResultModal(true);
            setIsDead(false);
            renderer.pause();
            savePendingResult('surviv', {
                type: 'cashout',
                cashedAmount: amount,
                timeSurvivedMs: survived,
                eliminations: sessionStats.eliminations,
            });
            blockAutoJoinRef.current = true;
            refreshUser();
        });

        socket.on('RIP', () => {
            setIsDead(true);
            renderer.pause();
        });

        socket.on('died', (data) => {
            const survived = Date.now() - (sessionStartAtRef.current || Date.now());
            const eliminations = data?.kills ?? sessionStats.eliminations;
            setSessionStats({ timeSurvivedMs: survived, eliminations });
            setIsDead(true);
            setShowResultModal(true);
            renderer.pause();
            savePendingResult('surviv', {
                type: 'death',
                balance: data?.balance ?? currentBalance,
                timeSurvivedMs: survived,
                eliminations,
            });
            blockAutoJoinRef.current = true;
        });

        socket.on('forcedDisconnect', () => {
            window.location.reload();
        });

        socket.on('error', (msg) => {
            console.error('Surviv socket error:', msg);
            alert(typeof msg === 'string' ? msg : msg?.message || 'Connection error');
            navigate('/pre-game', { state: { selectedMode: 'surviv' } });
        });

        inputIntervalRef.current = setInterval(() => {
            if (!socket.connected || blockInputRef.current) return;
            const payload = renderer.getInputPayload();
            if (reloadPendingRef.current) {
                payload.reload = true;
                reloadPendingRef.current = false;
            }
            socket.emit('survivInput', payload);
        }, 1000 / 20);

        if (!blockAutoJoinRef.current) {
            const preferredSkin = localStorage.getItem('selected_skin') || 'random';
            localStorage.setItem('current_game_mode', 'surviv');
            socket.emit('joinGame', {
                username: matchNickname,
                token: authToken,
                mode: 'surviv',
                entryFeeUsd,
                skinColor: preferredSkin,
            });
        } else {
            renderer.start();
        }

        return () => {
            clearInterval(inputIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('pointerup', onPointerUp);
            canvasRef.current?.removeEventListener('pointermove', onPointerMove);
            canvasRef.current?.removeEventListener('pointerdown', onPointerDown);
            renderer.destroy();
            socket.off();
            socket.disconnect();
        };
    }, [liveSession, authToken, matchNickname, entryFeeUsd, navigate, startCashoutCountdown, refreshUser, sessionStats.eliminations, currentBalance]);

    const handleHoldStart = useCallback(() => {
        rendererRef.current?.setHoldStart(Date.now());
    }, []);

    const handleHoldEnd = useCallback(() => {
        rendererRef.current?.setHoldStart(0);
    }, []);

    const cashoutReady = gameReady && isConnected && localTimer <= 0 && cashedAmount === null && !isDead;

    return (
        <div ref={viewportRef} className={`game-viewport${IS_MOBILE ? ' game-viewport--mobile' : ''}`} style={{
            width: '100vw',
            height: '100vh',
            background: '#0a0a0c',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0,
            fontFamily: 'system-ui',
        }}>
            <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', top: 0, left: 0, zIndex: 1, touchAction: 'none' }} />

            <MobileGameSession containerRef={viewportRef} />

            {(!isConnected || !gameReady) && !pendingAtMount && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: 'white', zIndex: 1000 }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '10px' }}>Deploying to Surviv...</h2>
                        <p style={{ opacity: 0.5 }}>
                            Make sure you have at least {formatUsd(entryFeeUsd)} balance.
                        </p>
                    </div>
                </div>
            )}

            {gameReady && cashedAmount === null && (
                <GameCashoutBar
                    disabled={!cashoutReady}
                    onHoldStart={handleHoldStart}
                    onHoldEnd={handleHoldEnd}
                    onComplete={handleCashOut}
                    localTimer={localTimer}
                    cashOutTotal={cashOutTotalRef.current}
                    cashOutEndAt={cashOutEndAtRef.current}
                />
            )}

            {isSpectating && (
                <GameSpectateHud onBack={exitSpectate} />
            )}

            {resetCountdown != null && resetCountdown < 300 && (
                <div className="game-reset-banner">
                    Arena reset in {Math.floor(resetCountdown / 60)}:{String(resetCountdown % 60).padStart(2, '0')}
                </div>
            )}

            {leaderboard.length > 0 && gameReady && !showResultModal && (
                <div className="game-leaderboard-panel">
                    <div className="game-leaderboard-title">Top Earners</div>
                    {leaderboard.slice(0, 5).map((entry, i) => (
                        <div key={`${entry.username}-${i}`} className="game-leaderboard-row">
                            <span>{entry.username}</span>
                            <span>{formatUsd(entry.balance)}</span>
                        </div>
                    ))}
                </div>
            )}

            {showResultModal && (
                <GameResultModal
                    type={cashedAmount != null ? 'cashout' : 'death'}
                    amount={cashedAmount}
                    timeSurvivedMs={sessionStats.timeSurvivedMs}
                    eliminations={sessionStats.eliminations}
                    walletBalanceUsd={user?.balanceUsd ?? 0}
                    walletBalanceSol={user?.balanceSol ?? 0}
                    solPrice={user?.solPrice ?? 57}
                    onPlayAgain={handlePlayAgain}
                    onHome={handleLobby}
                    onSpectate={!cashedAmount && isDead ? enterSpectate : undefined}
                    showSpectate={!cashedAmount && isDead}
                    isJoining={isRejoining}
                    onClose={handleLobby}
                />
            )}
        </div>
    );
}
