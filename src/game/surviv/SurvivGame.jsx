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
const WORLD_HALF = 40000;
const SPEC_ZOOM = IS_MOBILE ? 1.6 : 2.2;

const WEAPON_LABELS = {
    pistol: 'M9 Pistol',
    revolver: 'R8 Revolver',
    smg: 'Vector SMG',
    shotgun: 'Pump Shotgun',
    assault: 'Scout Rifle',
    dmr: 'Falcon DMR',
    sniper: 'AWM Sniper',
    lmg: 'M249 LMG',
};

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
    const useMedkitPendingRef = useRef(false);
    const equipSlotPendingRef = useRef(null);
    const openChestPendingRef = useRef(null);
    const takeChestItemPendingRef = useRef(null);
    const prevOpenedContainerIdRef = useRef(null);

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
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [me, setMe] = useState(null);

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
            const k = e.key.toLowerCase();
            if (k === 'tab') {
                e.preventDefault();
                setIsInventoryOpen(prev => !prev);
                return;
            }
            if (k === 'escape') {
                setIsInventoryOpen(false);
                return;
            }
            const action = renderer.handleKeyDown(e);
            if (action === 'reload') reloadPendingRef.current = true;
            if (action === 'useMedkit') useMedkitPendingRef.current = true;
            if (typeof action === 'string' && action.startsWith('equipSlot:')) {
                equipSlotPendingRef.current = Number(action.split(':')[1]);
            }
        };
        const onKeyUp = (e) => renderer.handleKeyUp(e);
        const onPointerMove = (e) => {
            renderer.handlePointerMove(e.clientX, e.clientY);
        };
        const onPointerDown = (e) => {
            if (e.button !== 0) return;
            renderer.handlePointerMove(e.clientX, e.clientY);
            const action = renderer.handlePointerDown();
            if (typeof action === 'string' && action.startsWith('openChest:')) {
                openChestPendingRef.current = action.slice('openChest:'.length);
            }
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
            if (tick.you) {
                setMe(tick.you);
                const chestId = tick.you.openedContainer?.id || null;
                if (chestId && chestId !== prevOpenedContainerIdRef.current) {
                    setIsInventoryOpen(true);
                }
                prevOpenedContainerIdRef.current = chestId;
            }
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
            if (useMedkitPendingRef.current) {
                payload.useMedkit = true;
                useMedkitPendingRef.current = false;
            }
            if (equipSlotPendingRef.current != null) {
                payload.equipSlot = equipSlotPendingRef.current;
                equipSlotPendingRef.current = null;
            }
            if (openChestPendingRef.current) {
                payload.openChestId = openChestPendingRef.current;
                openChestPendingRef.current = null;
            }
            if (takeChestItemPendingRef.current) {
                payload.takeChestItem = takeChestItemPendingRef.current;
                takeChestItemPendingRef.current = null;
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

    const handleAdminSpawnBot = useCallback(() => {
        if (!authToken) return;
        socketRef.current?.emit('adminSpawnBotNearMe', { token: authToken, mode: 'surviv' });
    }, [authToken]);

    const handleAdminClearBots = useCallback(() => {
        if (!authToken) return;
        socketRef.current?.emit('adminClearBots', { token: authToken });
    }, [authToken]);

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

            {user?.isAdmin && gameReady && !showResultModal && (
                <div style={{
                    position: 'absolute',
                    left: 14,
                    top: 96,
                    zIndex: 20,
                    display: 'flex',
                    gap: 8,
                    padding: '8px',
                    borderRadius: 8,
                    background: 'rgba(10, 14, 12, 0.72)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(8px)',
                }}>
                    <button type="button" onClick={handleAdminSpawnBot} style={{
                        border: '1px solid rgba(255,255,255,0.16)',
                        background: '#385f45',
                        color: '#edf5e9',
                        borderRadius: 6,
                        padding: '7px 10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                    }}>
                        Spawn Bot
                    </button>
                    <button type="button" onClick={handleAdminClearBots} style={{
                        border: '1px solid rgba(255,255,255,0.16)',
                        background: '#5c3f3b',
                        color: '#f5ebe8',
                        borderRadius: 6,
                        padding: '7px 10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                    }}>
                        Clear Bots
                    </button>
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

            {/* Side-by-Side React Inventory Overlay */}
            {isInventoryOpen && me && (
                <div className="surviv-inventory-modal" onClick={() => setIsInventoryOpen(false)}>
                    <div className="surviv-inventory-container" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="surviv-inventory-header">
                            <div className="surviv-inventory-title-row">
                                <span className="surviv-inventory-title">INVENTORY</span>
                                <button className="surviv-inventory-close-btn" onClick={() => setIsInventoryOpen(false)}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                            <div className="surviv-inventory-subtitle">Manage weapons and chest contents</div>
                        </div>

                        {/* Side-by-side grids */}
                        <div className="surviv-inventory-body">
                            {/* Left Column: Player Backpack */}
                            <div 
                                className="surviv-inventory-panel player-backpack"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const itemKey = e.dataTransfer.getData('text/plain');
                                    if (itemKey && me.openedContainer?.id) {
                                        takeChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey };
                                    }
                                }}
                            >
                                <h3 className="panel-title">
                                    <svg className="panel-title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 0 0 .5-1.5L19 7H5L3.5 18.5a2 2 0 0 0 .5 1.5M12 2v5M8 7V2a2 2 0 0 1 4 0M12 2a2 2 0 0 1 4 0v5"/></svg>
                                    YOUR BACKPACK
                                </h3>

                                {/* Weapons Grid */}
                                <div className="weapons-section">
                                    <h4 className="section-subtitle">WEAPONS (Slots 1-4)</h4>
                                    <div className="weapons-grid">
                                        {[0, 1, 2, 3].map((slotIdx) => {
                                            const weaponId = me.inventory?.weapons?.[slotIdx];
                                            const weaponLabel = weaponId ? (WEAPON_LABELS[weaponId] || weaponId) : null;
                                            const isActive = weaponId && weaponId === me.weapon;
                                            
                                            const weaponRarity = weaponId ? (weaponId === 'sniper' || weaponId === 'lmg' ? 'military' : (weaponId === 'shotgun' || weaponId === 'assault' || weaponId === 'dmr' ? 'rare' : 'common')) : 'common';
                                            const borderRarityClass = weaponId ? `rarity-border-${weaponRarity}` : '';

                                            return (
                                                <div 
                                                    key={`weapon-slot-${slotIdx}`}
                                                    className={`weapon-slot-card ${isActive ? 'active-slot' : ''} ${borderRarityClass} ${weaponId ? 'has-item' : 'empty-slot'}`}
                                                    onClick={() => {
                                                        if (weaponId) {
                                                            equipSlotPendingRef.current = slotIdx;
                                                        }
                                                    }}
                                                >
                                                    <div className="slot-number">{slotIdx + 1}</div>
                                                    {weaponId ? (
                                                        <div className="weapon-card-content">
                                                            <div className="weapon-card-details">
                                                                <span className="weapon-name">{weaponLabel}</span>
                                                                <span className={`weapon-rarity-badge ${weaponRarity}`}>{weaponRarity.toUpperCase()}</span>
                                                            </div>
                                                            {isActive && <div className="equipped-badge">EQUIPPED</div>}
                                                        </div>
                                                    ) : (
                                                        <span className="empty-slot-label">EMPTY SLOT</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Items Grid (Consumables, Stats) */}
                                <div className="inventory-items-section">
                                    <h4 className="section-subtitle">EQUIPMENT & STATS</h4>
                                    <div className="items-grid">
                                        {/* Medkit Slot (Interactive) */}
                                        <div 
                                            className={`item-slot-card medkit-slot ${(me.inventory?.medkits || 0) > 0 ? 'has-qty' : 'empty-qty'}`}
                                            onClick={() => {
                                                if ((me.inventory?.medkits || 0) > 0) {
                                                    useMedkitPendingRef.current = true;
                                                }
                                            }}
                                        >
                                            <div className="item-slot-icon-container">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5fe08a" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>
                                            </div>
                                            <div className="item-slot-details">
                                                <span className="item-slot-name">MEDKITS</span>
                                                <span className="item-slot-value">{me.inventory?.medkits || 0} / 6</span>
                                            </div>
                                            {(me.inventory?.medkits || 0) > 0 && (
                                                <div className="item-action-badge">CLICK TO HEAL</div>
                                            )}
                                        </div>

                                        {/* Ammo Slot */}
                                        <div className="item-slot-card ammo-slot">
                                            <div className="item-slot-icon-container">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7d1bb" strokeWidth="2"><path d="M6 3h12v18H6zM10 6h4v2h-4zM10 10h4v2h-4zM10 14h4v2h-4z"/></svg>
                                            </div>
                                            <div className="item-slot-details">
                                                <span className="item-slot-name">AMMO PACKS</span>
                                                <span className="item-slot-value">{me.inventory?.ammoPacks || 0} / 9</span>
                                            </div>
                                        </div>

                                        {/* Armor Slot */}
                                        <div className="item-slot-card armor-slot">
                                            <div className="item-slot-icon-container">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5d9cff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                            </div>
                                            <div className="item-slot-details">
                                                <span className="item-slot-name">ARMOR LEVEL</span>
                                                <span className="item-slot-value">{Math.round(me.armor || 0)}%</span>
                                            </div>
                                        </div>

                                        {/* Balance Slot */}
                                        <div className="item-slot-card cash-slot">
                                            <div className="item-slot-icon-container">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd45a" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 8H10.5a2.5 2.5 0 0 0 0 5H13.5a2.5 2.5 0 0 1 0 5H9"/></svg>
                                            </div>
                                            <div className="item-slot-details">
                                                <span className="item-slot-name">BALANCE</span>
                                                <span className="item-slot-value cyan-glow">{formatUsd(me.dollarBalance || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Chest Inventory */}
                            <div className="surviv-inventory-panel chest-loot-panel">
                                <h3 className="panel-title">
                                    <svg className="panel-title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8H3M21 16H3M12 2v20M2 5h20v14H2z"/></svg>
                                    {me.openedContainer ? `${me.openedContainer.tier?.toUpperCase() || 'COMMON'} CHEST` : 'CHEST DETAILS'}
                                </h3>

                                {me.openedContainer ? (
                                    <div className="chest-items-section">
                                        <div className="chest-items-hint">Drag items to your backpack or click to pick them up instantly.</div>
                                        <div className="chest-items-grid">
                                            {me.openedContainer.items?.map((item) => {
                                                const rarityClass = item.rarity || 'common';
                                                
                                                let strokeColor = '#ffffff';
                                                let itemIcon = null;

                                                if (item.kind === 'weapon') {
                                                    strokeColor = '#f2774f';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><path d="M20 4L4 20M14 4h6v6M8 20H4v-4"/></svg>;
                                                } else if (item.kind === 'money') {
                                                    strokeColor = '#ffd45a';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 8H10.5a2.5 2.5 0 0 0 0 5H13.5a2.5 2.5 0 0 1 0 5H9"/></svg>;
                                                } else if (item.kind === 'medkit') {
                                                    strokeColor = '#5fe08a';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>;
                                                } else if (item.kind === 'ammo') {
                                                    strokeColor = '#d7d1bb';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><path d="M6 3h12v18H6zM10 6h4v2h-4zM10 10h4v2h-4zM10 14h4v2h-4z"/></svg>;
                                                } else if (item.kind === 'armor') {
                                                    strokeColor = '#5d9cff';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
                                                }

                                                return (
                                                    <div 
                                                        key={`chest-item-${item.key}`}
                                                        className={`chest-item-card rarity-card-${rarityClass}`}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData('text/plain', item.key);
                                                        }}
                                                        onClick={() => {
                                                            if (me.openedContainer?.id) {
                                                                takeChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: item.key };
                                                            }
                                                        }}
                                                    >
                                                        <div className="chest-item-icon-container">
                                                            {itemIcon}
                                                        </div>
                                                        <div className="chest-item-info">
                                                            <div className="chest-item-label">{item.label}</div>
                                                            <div className="chest-item-action">CLICK TO TAKE</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="chest-empty-state">
                                        <svg className="chest-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"><path d="M21 8H3M21 16H3M12 2v20M2 5h20v14H2z"/></svg>
                                        <p>No chest open</p>
                                        <span>Walk up to a chest on the ground and click to open its contents side-by-side with your backpack.</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer / Controls reminder */}
                        <div className="surviv-inventory-footer">
                            <span>Press <kbd className="game-keycap-mini">TAB</kbd> or <kbd className="game-keycap-mini">ESC</kbd> to Close</span>
                            <span>Press <kbd className="game-keycap-mini">1-4</kbd> to switch weapons  |  Press <kbd className="game-keycap-mini">Q</kbd> to Quick Heal</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
