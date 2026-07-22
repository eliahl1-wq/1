import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { SurvivRenderer } from './SurvivRenderer.js';
import { normalizeSurvivEntryFee, formatUsd } from '../../constants/economy';
import GameResultModal from '../../components/GameResultModal';
import GameSpectateHud from '../../components/GameSpectateHud';
import GameCashoutBar from '../../components/GameCashoutBar';
import GameSocialOverlay from '../../components/GameSocialOverlay';
import { useSpectatorCamera } from '../../hooks/useSpectatorCamera';
import MobileGameSession from '../../components/MobileGameSession';
import SurvivMobileControls from '../../components/SurvivMobileControls';
import { isTouchDevice } from '../../utils/mobile';
import { clearPendingResult, loadPendingResult, savePendingResult } from '../../utils/gamePendingResult.js';
import { getOrCreatePresenceId } from '../../utils/sitePresence.js';
import { stopSessionRecording } from '../../utils/mixpanel';
import { markGamemodePlayed } from '../../constants/gamemodes';
import '../../styles/gameInGame.css';
import { API_URL } from '../../utils/apiBase';
import { nextWeaponSlot } from '../../utils/gameWheel.js';

const IS_MOBILE = isTouchDevice();
const CASHOUT_SECONDS = 0;
const WORLD_HALF = 10000;

const SPEC_ZOOM = IS_MOBILE ? 1.6 : 2.2;

const WEAPON_LABELS = {
    fists: 'Fists',
    knife: 'Combat Knife',
    pistol: 'M9 Pistol',
    revolver: 'R8 Revolver',
    smg: 'Vector SMG',
    shotgun: 'Pump Shotgun',
    assault: 'Scout Rifle',
    dmr: 'Falcon DMR',
    sniper: 'AWM Sniper',
    lmg: 'M249 LMG',
};

// Server slots stay 0/1 for firearms and 2 for melee. The HUD/key order is melee first.
const SURVIV_WEAPON_SLOTS = [2, 0, 1];
const SURVIV_SLOT_KEYS = { 2: 1, 0: 2, 1: 3 };

const WEAPON_CLIP_SIZES = {
    fists: 0,
    pistol: 15,
    revolver: 6,
    smg: 30,
    shotgun: 6,
    assault: 22,
    dmr: 10,
    sniper: 5,
    lmg: 45,
};

const AMMO_TYPES = {
    '9mm': { label: '9mm', color: '#f5d547', max: 180 },
    '12g': { label: '12 Gauge', color: '#f05a5a', max: 48 },
    '556': { label: '5.56mm', color: '#63d471', max: 180 },
    '762': { label: '7.62mm', color: '#5aa9f8', max: 90 },
};

const WEAPON_AMMO_TYPES = {
    pistol: '9mm', smg: '9mm', shotgun: '12g', assault: '556', lmg: '556',
    revolver: '762', dmr: '762', sniper: '762',
};

const SURVIV_RELOAD_UI_STEP_MS = 100;

function createSurvivUiSnapshot(player) {
    const reloadRemaining = Math.max(0, Number(player?.reloadRemainingMs) || 0);
    const medkitRemaining = Math.max(0, Number(player?.medkitRemainingMs) || 0);
    return {
        hp: player?.hp,
        maxHp: player?.maxHp,
        armor: player?.armor,
        weapon: player?.weapon,
        ammo: player?.ammo,
        clipSize: player?.clipSize,
        reloading: !!player?.reloading,
        reloadRemainingMs: player?.reloading
            ? Math.ceil(reloadRemaining / SURVIV_RELOAD_UI_STEP_MS) * SURVIV_RELOAD_UI_STEP_MS
            : 0,
        reloadMs: player?.reloadMs,
        medkitRemainingMs: medkitRemaining > 0
            ? Math.ceil(medkitRemaining / SURVIV_RELOAD_UI_STEP_MS) * SURVIV_RELOAD_UI_STEP_MS
            : 0,
        medkitUseMs: player?.medkitUseMs,
        dollarBalance: player?.dollarBalance,
        kills: player?.kills,
        activeWeaponSlot: Number.isInteger(player?.activeWeaponSlot) ? player.activeWeaponSlot : 2,
        weaponSlotAmmo: Array.isArray(player?.weaponSlotAmmo) ? player.weaponSlotAmmo : [],
        weaponsAmmo: player?.weaponsAmmo || {},
        inventory: player?.inventory || null,
        openedContainer: player?.openedContainer || null,
        outsideZone: !!player?.outsideZone,
    };
}

function renderWeaponIcon(weaponId, strokeColor = 'currentColor', size = 24) {
    switch (weaponId) {
        case 'fists':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M5.5 11.5V8.8a1.3 1.3 0 0 1 2.6 0v1.7-3a1.3 1.3 0 0 1 2.6 0v3-2.2a1.3 1.3 0 0 1 2.6 0v2.9-1.5a1.3 1.3 0 0 1 2.6 0v4.1c0 3.8-2.6 6.2-6.1 6.2-3 0-5.3-2.2-5.3-5.1v-2.2c0-.7.4-1.2 1-1.2Z" />
                    <path d="M15.5 8.5V7.2a1.2 1.2 0 0 1 2.4 0v4.1M18 9.2a1.2 1.2 0 0 1 2.4 0v4.4c0 2.4-1.2 4.4-3.2 5.5" />
                </svg>
            );
        case 'knife':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="m5 19 5.1-5.1 7.9-7.9c1.1-1.1 2.7-1.4 3.9-.7l-1.1 1.1.8.8-1.2 1.2.8.8-1.5 1.5.8.8-2.2 2.2c-1.3 1.3-3.4 1.3-4.7 0L11 18.1 5.9 23H3v-2.9L5 18.1Z" />
                    <path d="m9.2 14.8 2 2" />
                </svg>
            );
        case 'pistol':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M17 8H6c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1h4l1 1.5v.5l2.5 5.5c.2.4.6.5 1 .5h1.5c.5 0 .8-.4.7-.9l-2.2-5.1H17c.6 0 1-.4 1-1V9c0-.6-.4-1-1-1Z" />
                    <path d="M11 12c0 .8.7 1.5 1.5 1.5" />
                </svg>
            );
        case 'revolver':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M19 8H13V7.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5V8H5c-.6 0-1 .4-1 1v1.5c0 .6.4 1 1 1h8v1h-3l2 6.5c.1.4.5.5.9.5h1.7c.5 0 .8-.4.7-.9l-1.8-5.1H19c.6 0 1-.4 1-1V9c0-.6-.4-1-1-1Z" />
                    <rect x="13" y="8" width="4.5" height="3" rx="0.5" fill="none" />
                    <circle cx="15.25" cy="9.5" r="0.75" fill={strokeColor} />
                </svg>
            );
        case 'smg':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M21 8h-4.5L15 7.5c-.3-.3-.8-.5-1.2-.5H5c-.6 0-1 .4-1 1v2.5c0 .6.4 1 1 1h8.5l.5.5v3.5c0 .6.4 1 1 1h1.5c.6 0 1-.4 1-1v-4H21c.6 0 1-.4 1-1V9c0-.6-.4-1-1-1Z" />
                    <path d="M9.5 11l-.5 4.5c0 .3-.3.5-.6.5H7.2c-.3 0-.5-.2-.5-.5l-.7-4.5" />
                    <path d="M17.5 11l1.5 5.5c.1.4.5.5.9.5h1.1c.5 0 .8-.4.7-.9l-2.2-5.1" />
                    <path d="M22 9h-2v2h2V9Z" />
                </svg>
            );
        case 'shotgun':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M2 9.5h15c.3 0 .5-.2.5-.5v-1c0-.3-.2-.5-.5-.5H2v2Z" />
                    <path d="M17 8h3.5a1.5 1.5 0 0 1 1.5 1.5v2c0 .6-.4 1-1 1h-2l-3 4.5c-.2.3-.5.5-.9.5h-1.6c-.5 0-.8-.4-.7-.9l1.2-4.1h-4v-1" />
                    <rect x="7" y="10" width="4.5" height="1.5" rx="0.3" fill="none" />
                </svg>
            );
        case 'assault':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M2 9h16V8c0-.6-.4-1-1-1H3c-.6 0-1 .4-1 1v1Z" />
                    <path d="M18 9h3a1.5 1.5 0 0 1 1.5 1.5v2c0 .6-.4 1-1 1h-1.5L18 17c-.2.3-.5.5-.9.5h-1.7c-.5 0-.8-.4-.7-.9l1.3-4.1h-5l-.5 4.5c0 .3-.3.5-.6.5H9.2c-.3 0-.5-.2-.5-.5l-.7-4.5H4v-1.5h14V9Z" />
                    <rect x="9" y="5.5" width="5.5" height="1.5" rx="0.3" />
                    <path d="M10.5 7v1M13 7v1" />
                </svg>
            );
        case 'dmr':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M1 9h18V8c0-.6-.4-1-1-1H2c-.6 0-1 .4-1 1v1Z" />
                    <path d="M19 9h2.5a1.5 1.5 0 0 1 1.5 1.5v2.5c0 .6-.4 1-1 1h-2l-2.2 4c-.2.3-.5.5-.9.5h-1.4c-.5 0-.8-.4-.7-.9l1.2-3.6h-5.5l-.8 4.5c0 .3-.3.5-.6.5H11c-.4 0-.6-.3-.5-.7l.8-4.3H4v-1.5h15V9Z" />
                    <rect x="8.5" y="4.5" width="7" height="2" rx="0.4" />
                    <path d="M10 6.5v1.5M14 6.5v1.5M1.5 9v1" />
                </svg>
            );
        case 'sniper':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M1 9.5h20V9c0-.6-.4-1-1-1H2c-.6 0-1 .4-1 1v.5Z" />
                    <path d="M21 9h1.5v2H21V9Z" />
                    <path d="M21 10.5h.5a1 1 0 0 1 1 1v2c0 .6-.4 1-1 1h-1.5L18 18.5c-.2.3-.6.5-1 .5h-1.5c-.5 0-.8-.4-.7-.9l1.2-4.1H10.5l-1.5 4.5c0 .3-.3.5-.6.5H7.2c-.4 0-.6-.3-.5-.7l1.3-4.3H3.5v-1h17.5v.5Z" />
                    <rect x="8" y="4.5" width="8.5" height="2.2" rx="0.4" />
                    <path d="M9.5 6.7v1.8M15 6.7v1.8" />
                    <path d="M4 11.5L2 16M5 11.5l2 16" />
                </svg>
            );
        case 'lmg':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M1 9.5h18V8c0-.6-.4-1-1-1H2c-.6 0-1 .4-1 1v1.5Z" />
                    <path d="M19 9.5h2.5a1.5 1.5 0 0 1 1.5 1.5v2.5c0 .6-.4 1-1 1h-1.5l-2.5 4.5c-.2.3-.5.5-.9.5h-2c-.5 0-.8-.4-.7-.9l1.3-4.1H13v3.5c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V12.5H4v-1.5h15v-1.5Z" />
                    <path d="M5.5 8V6.5h7V8" />
                    <path d="M3.5 11L2 16.5M4.5 11l1.5 5.5" />
                </svg>
            );
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="weapon-svg-icon">
                    <path d="M20 4L4 20M14 4h6v6M8 20H4v-4" />
                </svg>
            );
    }
}

export default function SurvivGame() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token: authToken, refreshUser, applyOptimisticBalanceDelta } = useAuth();

    const pendingAtMount = loadPendingResult('surviv');
    const blockAutoJoinRef = useRef(!!pendingAtMount);

    const canvasRef = useRef(null);
    const viewportRef = useRef(null);
    const socketRef = useRef(null);
    const rendererRef = useRef(null);
    const handleGameEmote = useCallback((payload) => rendererRef.current?.showEmote(payload), []);
    const inputIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const awaitingWelcomeRef = useRef(false);
    const cashoutActiveRef = useRef(false);
    const playAgainPendingRef = useRef(false);
    const myIdRef = useRef(null);
    const cashOutTotalRef = useRef(CASHOUT_SECONDS);
    const cashOutEndAtRef = useRef(0);
    const sessionStartAtRef = useRef(null);
    const joinParamsRef = useRef({ nickname: 'Guest', entryFeeUsd: 5 });
    const reloadPendingRef = useRef(false);
    const useMedkitPendingRef = useRef(false);
    const pickupWeaponPendingRef = useRef(false);
    const equipSlotPendingRef = useRef(null);
    const openChestPendingRef = useRef(null);
    const chestHoldIdRef = useRef(null);
    const takeChestItemPendingRef = useRef(null);
    const prevOpenedContainerIdRef = useRef(null);
    const closeChestPendingRef = useRef(false);
    const putChestItemPendingRef = useRef(null);
    const dropItemPendingRef = useRef(null);
    const throwGrenadePendingRef = useRef(false);
    const swapWeaponSlotsPendingRef = useRef(null);
    const meUiSignatureRef = useRef('');
    const resetCountdownValueRef = useRef(null);
    const aliveCountValueRef = useRef(0);

    const [isConnected, setIsConnected] = useState(() => !!pendingAtMount);
    const [gameReady, setGameReady] = useState(() => !!pendingAtMount);
    const [currentBalance, setCurrentBalanceState] = useState(0);
    const currentBalanceRef = useRef(0);
    const setCurrentBalance = useCallback((val) => {
        if (Object.is(currentBalanceRef.current, val)) return;
        currentBalanceRef.current = val;
        setCurrentBalanceState(val);
    }, []);

    const [leaderboard, setLeaderboard] = useState([]);
    const [isDead, setIsDead] = useState(() => pendingAtMount?.type === 'death');
    const [cashedAmount, setCashedAmount] = useState(() => (
        pendingAtMount?.type === 'cashout' ? pendingAtMount.cashedAmount : null
    ));
    const [showResultModal, setShowResultModal] = useState(() => !!pendingAtMount);
    const [isSpectating, setIsSpectating] = useState(false);
    const [inventoryDrag, setInventoryDrag] = useState(null);

    const beginInventoryDrag = (event, payload) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-surviv-inventory-item', JSON.stringify(payload));
        event.dataTransfer.setData('text/plain', 'surviv-inventory-item');
        setInventoryDrag(payload);
    };

    const readInventoryDrag = (event) => {
        try {
            const raw = event.dataTransfer.getData('application/x-surviv-inventory-item');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    const finishInventoryDrag = () => setInventoryDrag(null);
    const [isRejoining, setIsRejoining] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const [sessionStats, setSessionStatsState] = useState(() => (
        pendingAtMount
            ? { timeSurvivedMs: pendingAtMount.timeSurvivedMs ?? 0, eliminations: pendingAtMount.eliminations ?? 0 }
            : { timeSurvivedMs: 0, eliminations: 0 }
    ));
    const sessionStatsRef = useRef(
        pendingAtMount
            ? { timeSurvivedMs: pendingAtMount.timeSurvivedMs ?? 0, eliminations: pendingAtMount.eliminations ?? 0 }
            : { timeSurvivedMs: 0, eliminations: 0 }
    );
    const setSessionStats = useCallback((val) => {
        if (typeof val === 'function') {
            setSessionStatsState(prev => {
                const next = val(prev);
                sessionStatsRef.current = next;
                return next;
            });
        } else {
            sessionStatsRef.current = val;
            setSessionStatsState(val);
        }
    }, []);
    const [liveSession, setLiveSession] = useState(() => !pendingAtMount);
    const [localTimer, setLocalTimer] = useState(0);
    const [cashoutPending, setCashoutPending] = useState(false);
    const [cashOutEndAt, setCashOutEndAt] = useState(0);
    const [resetCountdown, setResetCountdown] = useState(null);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const inventoryOpenRef = useRef(false);
    inventoryOpenRef.current = isInventoryOpen;
    const handleCloseInventory = useCallback(() => {
        inventoryOpenRef.current = false;
        setIsInventoryOpen(false);
        closeChestPendingRef.current = true;
    }, []);
    const [me, setMe] = useState(null);
    const [canMobileInteract, setCanMobileInteract] = useState(false);
    const [aliveCount, setAliveCount] = useState(0);
    const hideNames = localStorage.getItem('hide_player_names') === 'true';

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
        playAgainPendingRef.current = true;
        blockAutoJoinRef.current = false;
        awaitingWelcomeRef.current = true;
        hasJoinedRef.current = false;
        localStorage.setItem('current_game_mode', 'surviv');
        localStorage.setItem('selected_gamemode', 'surviv');
        markGamemodePlayed('surviv');
        setIsRejoining(true);

        if (!liveSession) {
            setLiveSession(true);
            return;
        }

        if (socketRef.current?.connected) {
            const preferredSkin = localStorage.getItem('selected_skin_surviv') || 'random';
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
    canCashOutRef.current = gameReady && isConnected && !cashoutPending && localTimer <= 0 && cashedAmount === null && !isDead;

    const handleCashOut = useCallback(() => {
        if (!canCashOutRef.current) return;
        if (!socketRef.current?.connected) return;
        if (cashoutActiveRef.current) return;
        rendererRef.current?.setHoldStart(0);
        cashoutActiveRef.current = true;
        setCashoutPending(true);
        socketRef.current.emit('cashOut');
    }, []);

    useLayoutEffect(() => {
        rendererRef.current?.setHud({
            balance: currentBalance,
            cashoutSeconds: localTimer,
            cashoutTotal: cashOutTotalRef.current || CASHOUT_SECONDS,
            cashoutEndAt: cashOutEndAtRef.current,

        });
    }, [currentBalance, localTimer]);

    useEffect(() => {
        const previousBackground = document.body.style.backgroundColor;
        const previousTitle = document.title;
        document.body.style.backgroundColor = '#0a0a0c';
        document.title = 'AgarStake | Surviv';
        stopSessionRecording();
        return () => {
            document.body.style.backgroundColor = previousBackground;
            document.title = previousTitle;
        };
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
            if (document.hidden || !socketRef.current?.connected) return;
            const cam = specCamRef.current;
            socketRef.current.volatile.emit('survivSpectateCam', { x: cam.x, y: cam.y });
        };
        syncCam();
        const id = setInterval(syncCam, 250);
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
        renderer.hideNames = hideNames;
        rendererRef.current = renderer;

        const socket = io(API_URL, {
            auth: { token: authToken, presenceId: getOrCreatePresenceId() },
            transports: ['websocket', 'polling'],
            reconnection: true,
        });
        socketRef.current = socket;
        let lastContinuousInput = '';
        let lastInputSentAt = 0;

        const clearPendingActions = () => {
            reloadPendingRef.current = false;
            useMedkitPendingRef.current = false;
            pickupWeaponPendingRef.current = false;
            equipSlotPendingRef.current = null;
            openChestPendingRef.current = null;
            takeChestItemPendingRef.current = null;
            putChestItemPendingRef.current = null;
            dropItemPendingRef.current = null;
            closeChestPendingRef.current = false;
        };
        const emitSurvivJoin = () => {
            if (!socket.connected || blockAutoJoinRef.current) return;
            const preferredSkin = localStorage.getItem('selected_skin_surviv') || 'random';
            awaitingWelcomeRef.current = true;
            setGameReady(false);
            setConnectionError('');
            localStorage.setItem('current_game_mode', 'surviv');
            socket.emit('joinGame', {
                username: matchNickname,
                token: authToken,
                mode: 'surviv',
                entryFeeUsd,
                skinColor: preferredSkin,
            });
        };

        const onKeyDown = (e) => {
            if (blockInputRef.current || cashoutActiveRef.current) return;
            const k = e.key.toLowerCase();
            if (k === 'tab' || k === 'i') {
                e.preventDefault();
                if (e.repeat) return;
                setIsInventoryOpen(prev => {
                    const next = !prev;
                    inventoryOpenRef.current = next;
                    if (!next) {
                        closeChestPendingRef.current = true;
                    }
                    return next;
                });
                return;
            }

            if (k === 'escape') {
                if (inventoryOpenRef.current) handleCloseInventory();
                return;
            }
            if (k === 'f') {
                e.preventDefault();
                if (e.repeat) return;
                const chest = renderer.getNearbyChest();
                if (chest?.id) {
                    chestHoldIdRef.current = chest.id;
                    renderer.setChestHold(chest.id, Date.now());
                    return;
                }
            }
            const action = renderer.handleKeyDown(e);
            if (action === 'reload') reloadPendingRef.current = true;
            if (action === 'useMedkit') useMedkitPendingRef.current = true;
            if (action === 'pickupWeapon') pickupWeaponPendingRef.current = true;
            if (action === 'throwGrenade') throwGrenadePendingRef.current = true;
            if (typeof action === 'string' && action.startsWith('equipSlot:')) {
                equipSlotPendingRef.current = Number(action.split(':')[1]);
            }
        };
        const onKeyUp = (e) => {
            if (e.key.toLowerCase() === 'f') {
                chestHoldIdRef.current = null;
                renderer.setChestHold(null);
            }
            renderer.handleKeyUp(e);
        };
        const onPointerMove = (e) => {
            if (cashoutActiveRef.current || (IS_MOBILE && e.pointerType !== 'mouse')) return;
            renderer.handlePointerMove(e.clientX, e.clientY);
        };
        const onPointerDown = (e) => {
            if (cashoutActiveRef.current || (IS_MOBILE && e.pointerType !== 'mouse')) return;
            if (e.button !== 0) return;
            renderer.handlePointerMove(e.clientX, e.clientY);
            renderer.handlePointerDown();

        };
        const onPointerUp = () => { if (!cashoutActiveRef.current) renderer.handlePointerUp(); };
        let lastWeaponWheelAt = 0;
        let wheelWeaponSlot = null;
        const onWheel = (e) => {
            if (IS_MOBILE || blockInputRef.current || inventoryOpenRef.current) return;
            if (!hasJoinedRef.current || awaitingWelcomeRef.current || !e.deltaY) return;
            e.preventDefault();
            const now = performance.now();
            if (now - lastWeaponWheelAt < 90) return;
            const serverSlot = Number.isInteger(renderer.me?.activeWeaponSlot)
                ? renderer.me.activeWeaponSlot
                : 2;
            const currentSlot = now - lastWeaponWheelAt > 300
                ? serverSlot
                : (wheelWeaponSlot ?? serverSlot);
            wheelWeaponSlot = nextWeaponSlot(currentSlot, e.deltaY, SURVIV_WEAPON_SLOTS.length);
            lastWeaponWheelAt = now;
            equipSlotPendingRef.current = wheelWeaponSlot;
        };
        const neutralizeInput = () => {
            renderer.clearInput();
            clearPendingActions();
            chestHoldIdRef.current = null;
            renderer.setChestHold(null);
            if (socket.connected && hasJoinedRef.current && !awaitingWelcomeRef.current) {
                const neutral = renderer.getInputPayload();
                neutral.dx = 0;
                neutral.dy = 0;
                neutral.shooting = false;
                socket.volatile.emit('survivInput', neutral);
            }
        };
        const onWindowBlur = () => neutralizeInput();
        const onVisibilityChange = () => {
            if (document.hidden) neutralizeInput();
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvasRef.current.addEventListener('pointermove', onPointerMove);
        canvasRef.current.addEventListener('pointerdown', onPointerDown);
        canvasRef.current.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('blur', onWindowBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);

        socket.on('connect', () => {
            const rejoining = hasJoinedRef.current;
            setIsConnected(true);
            setConnectionError('');
            if (!blockAutoJoinRef.current) {
                setIsRejoining(rejoining);
                emitSurvivJoin();
            } else {
                renderer.start();
            }
        });
        socket.on('disconnect', () => {
            const cashoutWasActive = cashoutActiveRef.current;
            setIsConnected(false);
            renderer.clearInput();
            renderer.pause();
            clearPendingActions();
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            cashoutActiveRef.current = false;
            setCashoutPending(false);
            cashOutEndAtRef.current = 0;
            setLocalTimer(0);
            setCashOutEndAt(0);
            if (!blockAutoJoinRef.current) {
                awaitingWelcomeRef.current = true;
                setGameReady(false);
                setIsRejoining(!cashoutWasActive);
                setConnectionError(cashoutWasActive
                    ? 'Connection was lost while securing your cashout. Returning safely without starting another paid match.'
                    : '');
                if (cashoutWasActive) {
                    blockAutoJoinRef.current = true;
                    navigate('/pre-game', { state: { selectedMode: 'surviv', cashoutInterrupted: true } });
                }
            }
        });

        socket.on('welcome', (player, world) => {
            awaitingWelcomeRef.current = false;
            playAgainPendingRef.current = false;
            clearPendingResult('surviv');
            setIsDead(false);
            setCashedAmount(null);
            setShowResultModal(false);
            setIsSpectating(false);
            setSessionStats({ timeSurvivedMs: 0, eliminations: 0 });
            setCashoutPending(false);
            hasJoinedRef.current = true;
            myIdRef.current = player.id;
            renderer.setMyId(player.id);
            if (!world?.rejoin || !sessionStartAtRef.current) sessionStartAtRef.current = Date.now();
            setCurrentBalance(player.dollarBalance ?? 0);
            setConnectionError('');
            setGameReady(true);
            refreshUser();
            setIsRejoining(false);
            renderer.setInputEnabled(true);
            renderer.start();

            if (world?.cashOutRemaining > 0) {
                cashoutActiveRef.current = true;
                setCashoutPending(true);
                setLocalTimer(0);
                cashOutEndAtRef.current = 0;
                setCashOutEndAt(0);
            }
        });

        socket.on('survivTick', (tick) => {
            renderer.updateState(tick);
            if (IS_MOBILE) {
                const nearby = !!renderer.getNearbyGroundWeapon() || !!renderer.getNearbyChest();
                setCanMobileInteract(previous => previous === nearby ? previous : nearby);
            }
            if (tick.you) {
                const nextMe = createSurvivUiSnapshot(tick.you);
                sessionStatsRef.current = {
                    ...sessionStatsRef.current,
                    eliminations: Number(nextMe.kills) || 0,
                };
                const nextMeSignature = JSON.stringify(nextMe);
                if (nextMeSignature !== meUiSignatureRef.current) {
                    meUiSignatureRef.current = nextMeSignature;
                    setMe(nextMe);
                }

            }
            if (tick.dollarBalance != null) {
                setCurrentBalance(tick.dollarBalance);
            }
            if (tick.resetTime) {
                const left = Math.max(0, Math.floor((tick.resetTime - Date.now()) / 1000));
                if (left !== resetCountdownValueRef.current) {
                    resetCountdownValueRef.current = left;
                    setResetCountdown(left);
                }
            }
            const alive = tick.aliveCount
                ?? renderer.aliveCount
                ?? (tick.players || []).filter(player => (player.hp || 0) > 0).length;
            if (alive !== aliveCountValueRef.current) {
                aliveCountValueRef.current = alive;
                setAliveCount(alive);
            }
        });

        socket.on('leaderboard', (data) => {
            if (data?.leaderboard) setLeaderboard(data.leaderboard);
        });

        socket.on('cashOutProcessing', () => {
            cashoutActiveRef.current = true;
            setCashoutPending(true);
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            setLocalTimer(0);
            renderer.clearInput();
            renderer.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
        });
        socket.on('cashOutStarting', () => {
            cashoutActiveRef.current = true;
            setCashoutPending(true);
            setLocalTimer(0);
            cashOutEndAtRef.current = 0;
            setCashOutEndAt(0);
            renderer.setHud({ cashoutEndAt: 0, cashoutSeconds: 0 });
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            cashoutActiveRef.current = false;
            setCashoutPending(false);
            hasJoinedRef.current = false;
            const survived = Date.now() - (sessionStartAtRef.current || Date.now());
            const eliminations = Number(renderer.me?.kills) || sessionStatsRef.current.eliminations || 0;
            setSessionStats({ timeSurvivedMs: survived, eliminations });
            setCashedAmount(amount);
            setShowResultModal(true);
            setIsDead(false);
            renderer.clearInput();
            renderer.pause();
            savePendingResult('surviv', {
                type: 'cashout',
                cashedAmount: amount,
                timeSurvivedMs: survived,
                eliminations,
            });
            blockAutoJoinRef.current = true;
            refreshUser();
        });

        socket.on('RIP', () => {
            cashoutActiveRef.current = false;
            setCashoutPending(false);
            renderer.clearInput();
            setIsDead(true);
            renderer.pause();
        });

        socket.on('died', (data) => {
            hasJoinedRef.current = false;
            const survived = Date.now() - (sessionStartAtRef.current || Date.now());
            const eliminations = data?.kills ?? sessionStatsRef.current.eliminations;
            setSessionStats({ timeSurvivedMs: survived, eliminations });
            setIsDead(true);
            setShowResultModal(true);
            renderer.clearInput();
            renderer.pause();
            savePendingResult('surviv', {
                type: 'death',
                balance: data?.balance ?? currentBalanceRef.current,
                timeSurvivedMs: survived,
                eliminations,
            });
            blockAutoJoinRef.current = true;
        });

        socket.on('forcedDisconnect', () => {
            blockAutoJoinRef.current = true;
            awaitingWelcomeRef.current = true;
            hasJoinedRef.current = false;
            renderer.clearInput();
            renderer.pause();
            alert('This match was resumed in another tab or device.');
            navigate('/pre-game', { state: { selectedMode: 'surviv' } });
        });

        socket.on('connect_error', () => {
            setIsConnected(false);
            setGameReady(false);
            setIsRejoining(hasJoinedRef.current);
            setConnectionError('Could not reach the game server. Reconnecting automatically...');
        });
        socket.io.on('reconnect_failed', () => {
            setConnectionError('Automatic reconnect failed. Return to the lobby and try again.');
        });
        socket.on('error', (msg) => {
            const message = typeof msg === 'string' ? msg : msg?.message || 'Connection error';
            if (playAgainPendingRef.current) {
                playAgainPendingRef.current = false;
                blockAutoJoinRef.current = true;
                setIsRejoining(false);
                if (/insufficient/i.test(message)) {
                    refreshUser({ forceBalance: true });
                    alert('Not enough funds for another round. Your game result is still saved.');
                    return;
                }
            }
            console.error('Surviv socket error:', message);
            cashoutActiveRef.current = false;
            setCashoutPending(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            setLocalTimer(0);
            setCashOutEndAt(0);
            if (!hasJoinedRef.current && /insufficient/i.test(message)) {
                refreshUser({ forceBalance: true });
                setIsRejoining(false);
                blockAutoJoinRef.current = true;
                navigate('/lobby', { state: { depositIntent: true, selectedMode: 'surviv', requiredBalanceUsd: joinParamsRef.current.entryFeeUsd } });
                return;
            }
            if (!hasJoinedRef.current) {
                blockAutoJoinRef.current = true;
                alert(message);
                navigate('/pre-game', { state: { selectedMode: 'surviv' } });
                return;
            }
            alert(message);
        });

        inputIntervalRef.current = setInterval(() => {
            if (
                !socket.connected
                || !hasJoinedRef.current
                || awaitingWelcomeRef.current
                || blockInputRef.current
                || cashoutActiveRef.current
                || document.hidden
            ) return;

            const payload = renderer.getInputPayload();
            const heldChest = chestHoldIdRef.current
                ? renderer.getNearbyChest()
                : null;
            if (chestHoldIdRef.current && heldChest?.id !== chestHoldIdRef.current) {
                chestHoldIdRef.current = null;
                renderer.setChestHold(null);
            }
            payload.chestHoldId = chestHoldIdRef.current;
            let hasAction = false;
            if (reloadPendingRef.current) {
                payload.reload = true;
                reloadPendingRef.current = false;
                hasAction = true;
            }
            if (useMedkitPendingRef.current) {
                payload.useMedkit = true;
                useMedkitPendingRef.current = false;
                hasAction = true;
            }
            if (pickupWeaponPendingRef.current) {
                payload.pickupWeapon = true;
                pickupWeaponPendingRef.current = false;
                hasAction = true;
            }
            if (throwGrenadePendingRef.current) {
                payload.throwGrenade = true;
                throwGrenadePendingRef.current = false;
                hasAction = true;
            }
            if (swapWeaponSlotsPendingRef.current) {
                payload.swapWeaponSlots = swapWeaponSlotsPendingRef.current;
                swapWeaponSlotsPendingRef.current = null;
                hasAction = true;
            }
            if (equipSlotPendingRef.current != null) {
                payload.equipSlot = equipSlotPendingRef.current;
                equipSlotPendingRef.current = null;
                hasAction = true;
            }
            if (openChestPendingRef.current) {
                payload.openChestId = openChestPendingRef.current;
                openChestPendingRef.current = null;
                hasAction = true;
            }
            if (takeChestItemPendingRef.current) {
                payload.takeChestItem = takeChestItemPendingRef.current;
                takeChestItemPendingRef.current = null;
                hasAction = true;
            }
            if (putChestItemPendingRef.current) {
                payload.putChestItem = putChestItemPendingRef.current;
                putChestItemPendingRef.current = null;
                hasAction = true;
            }
            if (dropItemPendingRef.current) {
                payload.dropItem = dropItemPendingRef.current;
                dropItemPendingRef.current = null;
                hasAction = true;
            }
            if (closeChestPendingRef.current) {
                payload.closeChest = true;
                closeChestPendingRef.current = false;
                hasAction = true;
            }

            const continuousSignature = [
                Math.round((Number(payload.dx) || 0) * 1000),
                Math.round((Number(payload.dy) || 0) * 1000),
                Math.round((Number(payload.aimAngle) || 0) * 1000),
                payload.shooting ? 1 : 0,
                payload.chestHoldId || '',
            ].join(':');
            const now = Date.now();
            if (!hasAction && continuousSignature === lastContinuousInput && now - lastInputSentAt < 250) return;
            lastContinuousInput = continuousSignature;
            lastInputSentAt = now;
            if (hasAction) socket.emit('survivInput', payload);
            else socket.volatile.emit('survivInput', payload);
        }, 1000 / 30);

        if (blockAutoJoinRef.current) renderer.start();

        return () => {
            clearInterval(inputIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('blur', onWindowBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            canvasRef.current?.removeEventListener('pointermove', onPointerMove);
            canvasRef.current?.removeEventListener('pointerdown', onPointerDown);
            canvasRef.current?.removeEventListener('wheel', onWheel);
            renderer.destroy();
            socket.off();
            socket.disconnect();
        };
    }, [liveSession, authToken, matchNickname, entryFeeUsd, navigate, startCashoutCountdown, refreshUser, handleCloseInventory]);

    const handleHoldStart = useCallback(() => {
        rendererRef.current?.setHoldStart(Date.now());
        socketRef.current?.emit('cashOutHold', true);
    }, []);

    const handleHoldEnd = useCallback(() => {
        rendererRef.current?.setHoldStart(0);
        socketRef.current?.emit('cashOutHold', false);
    }, []);

    const handleMobileMove = useCallback((dx, dy) => {
        rendererRef.current?.setMobileMove(dx, dy);
    }, []);

    const handleMobileAim = useCallback((dx, dy, magnitude) => {
        rendererRef.current?.setMobileAim(dx, dy, magnitude);
    }, []);

    const handleMobileInventory = useCallback(() => {
        setIsInventoryOpen(previous => {
            if (previous) closeChestPendingRef.current = true;
            const next = !previous;
            inventoryOpenRef.current = next;
            return next;
        });
    }, []);

    const handleMobileReload = useCallback(() => {
        reloadPendingRef.current = true;
    }, []);

    const handleMobileHeal = useCallback(() => {
        useMedkitPendingRef.current = true;
    }, []);

    const handleMobileInteract = useCallback(() => {
        const renderer = rendererRef.current;
        const chest = renderer?.getNearbyChest();
        if (chest?.id) {
            chestHoldIdRef.current = chest.id;
            renderer.setChestHold(chest.id, Date.now());
            return;
        }
        const weapon = renderer?.getNearbyGroundWeapon();
        if (weapon?.id) pickupWeaponPendingRef.current = true;
    }, []);

    const handleMobileInteractEnd = useCallback(() => {
        chestHoldIdRef.current = null;
        rendererRef.current?.setChestHold(null);
    }, []);

    const handleAdminSpawnBot = useCallback(() => {
        if (!authToken) return;
        socketRef.current?.emit('adminSpawnBotNearMe', { token: authToken, mode: 'surviv' });
    }, [authToken]);

    const handleAdminClearBots = useCallback(() => {
        if (!authToken) return;
        socketRef.current?.emit('adminClearBots', { token: authToken });
    }, [authToken]);

    const cashoutReady = gameReady && isConnected && !cashoutPending && localTimer <= 0 && cashedAmount === null && !isDead;
    const healthRatio = me ? Math.max(0, Math.min(1, (Number(me.hp) || 0) / (Number(me.maxHp) || 100))) : 0;
    const armorRatio = me ? Math.max(0, Math.min(1, (Number(me.armor) || 0) / 100)) : 0;
    const medkitRemainingMs = Math.max(0, Number(me?.medkitRemainingMs) || 0);
    const medkitUseMs = Math.max(1, Number(me?.medkitUseMs) || 2500);
    const medkitProgress = medkitRemainingMs > 0 ? Math.max(0, Math.min(1, 1 - medkitRemainingMs / medkitUseMs)) : 0;
    const canMobileReload = !!me
        && me.weapon !== 'fists'
        && !me.reloading
        && (Number(me.clipSize) || 0) > 0
        && (Number(me.ammo) || 0) < (Number(me.clipSize) || 0)
        && (Number(me.inventory?.ammoReserves?.[WEAPON_AMMO_TYPES[me.weapon]]) || 0) > 0;
    const canMobileHeal = !!me
        && (Number(me.inventory?.medkits) || 0) > 0
        && (Number(me.hp) || 0) < (Number(me.maxHp) || 100)
        && medkitRemainingMs <= 0;

    return (
        <div ref={viewportRef} className={`game-viewport surviv-game-page${IS_MOBILE ? ' game-viewport--mobile game-viewport--force-landscape' : ''}`} style={{
            width: 'var(--game-viewport-width, 100dvw)',
            height: 'var(--game-viewport-height, 100dvh)',
            background: '#0a0a0c',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0,
            fontFamily: 'system-ui',
        }}>
            <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', top: 0, left: 0, zIndex: 1, touchAction: 'none' }} />

            <MobileGameSession containerRef={viewportRef} orientation="landscape" />

            {IS_MOBILE && gameReady && me && !showResultModal && !isDead && !isSpectating && !isInventoryOpen && (
                <SurvivMobileControls
                    onMove={handleMobileMove}
                    onAim={handleMobileAim}
                    onInventory={handleMobileInventory}
                    onReload={handleMobileReload}
                    onHeal={handleMobileHeal}
                    onInteract={handleMobileInteract}
                    onInteractEnd={handleMobileInteractEnd}
                    canInteract={canMobileInteract}
                    canReload={canMobileReload}
                    canHeal={canMobileHeal}
                    isReloading={!!me?.reloading}
                />
            )}

            {(!isConnected || !gameReady) && !pendingAtMount && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: 'white', zIndex: 1000 }}>
                    <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
                        <h2 style={{ marginBottom: '10px' }}>
                            {connectionError ? 'Connection interrupted' : (isRejoining ? 'Rejoining your match...' : 'Joining Surviv...')}
                        </h2>
                        <p style={{ opacity: 0.62, lineHeight: 1.5 }}>
                            {connectionError || (isRejoining
                                ? 'Your player is protected briefly while the connection recovers.'
                                : `Entry: ${formatUsd(entryFeeUsd)}. Waiting for the server to confirm your session.`)}
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
                    pending={cashoutPending}
                    cashOutTotal={cashOutTotalRef.current}
                    cashOutEndAt={cashOutEndAtRef.current}
                />
            )}

            {isSpectating && (
                <GameSpectateHud onBack={exitSpectate} />
            )}

            {gameReady && resetCountdown != null && resetCountdown > 0 && !showResultModal && (
                <div className={`game-reset-banner surviv-server-timer ${resetCountdown < 300 ? 'is-warning' : ''}`}>
                    SERVER RESET {Math.floor(resetCountdown / 3600) > 0
                        ? `${Math.floor(resetCountdown / 3600)}:${String(Math.floor((resetCountdown % 3600) / 60)).padStart(2, '0')}:${String(resetCountdown % 60).padStart(2, '0')}`
                        : `${Math.floor(resetCountdown / 60)}:${String(resetCountdown % 60).padStart(2, '0')}`}
                </div>
            )}

            {gameReady && me?.outsideZone && !showResultModal && !isDead && (
                <div className="surviv-zone-warning" role="alert" aria-live="assertive">
                    <span className="surviv-zone-warning-icon" aria-hidden>!</span>
                    RETURN TO THE SAFE ZONE
                </div>
            )}

            {gameReady && !IS_MOBILE && !showResultModal && !isDead && !isSpectating && (
                <div className="surviv-controls-hint" aria-label="Game controls">
                    HOLD F OPEN / F PICKUP · R RELOAD · H HEAL · TAB INVENTORY
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
                <div className="game-leaderboard-panel surviv-leaderboard" aria-label="Leaderboard">
                    <h4 className="game-leaderboard-title">
                        Leaderboard
                    </h4>
                    <div className="game-leaderboard-list">
                        {leaderboard.map((entry, i) => (
                            <div
                                key={entry.id || `${entry.username}-${i}`}
                                className={`game-leaderboard-row${entry.id === myIdRef.current ? ' is-me' : ''}`}
                                aria-current={entry.id === myIdRef.current ? 'true' : undefined}
                            >
                                <span className="game-leaderboard-name">
                                    {i + 1}. {(hideNames && entry.id !== myIdRef.current) ? '???' : entry.username}
                                </span>
                                <span className="game-leaderboard-value">
                                    {formatUsd(entry.balance)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HP and Armor Progress Bars */}
            {gameReady && me && !showResultModal && (
                <div className="surviv-hud-status-bars">
                    <div className={`hud-bar-wrapper health${healthRatio <= 0.25 ? ' is-critical' : ''}`}>
                        <div className="hud-bar-header">
                            <span className="hud-bar-title-row">
                                <svg className="hud-bar-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                HEALTH
                            </span>
                            <span className="hud-bar-value">{Math.round(me.hp || 0)} / {Math.round(me.maxHp || 100)}</span>
                        </div>
                        <div className="hud-bar-track" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax={Math.round(me.maxHp || 100)} aria-valuenow={Math.round(me.hp || 0)}>
                            <div className="hud-bar-fill health-fill" style={{ width: `${healthRatio * 100}%` }} />
                        </div>
                    </div>

                    <div className="hud-bar-wrapper armor">
                        <div className="hud-bar-header">
                            <span className="hud-bar-title-row">
                                <svg className="hud-bar-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                ARMOR
                            </span>
                            <span className="hud-bar-value">{Math.round(me.armor || 0)}%</span>
                        </div>
                        <div className="hud-bar-track" role="progressbar" aria-label="Armor" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(me.armor || 0)}>
                            <div className="hud-bar-fill armor-fill" style={{ width: `${armorRatio * 100}%` }} />
                        </div>
                    </div>
                    {medkitRemainingMs > 0 && (
                        <div className="surviv-medkit-timer" role="progressbar" aria-label="Using medkit" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(medkitProgress * 100)}>
                            <div className="surviv-medkit-timer-header">
                                <span>USING MEDKIT</span>
                                <span>{(medkitRemainingMs / 1000).toFixed(1)}s</span>
                            </div>
                            <div className="surviv-medkit-timer-track">
                                <div className="surviv-medkit-timer-fill" style={{ width: `${medkitProgress * 100}%` }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Weapons Vertical Hotbar */}
            {gameReady && me && !showResultModal && (
                <div className="surviv-weapons-hotbar">
                    {SURVIV_WEAPON_SLOTS.map((slotIdx) => {
                        const weaponId = slotIdx === 2 ? (me.inventory?.meleeWeapon || 'fists') : (me.inventory?.weapons?.[slotIdx] || null);
                        const weaponLabel = weaponId ? (WEAPON_LABELS[weaponId] || weaponId) : null;
                        const activeSlot = Number.isInteger(me.activeWeaponSlot)
                            ? me.activeWeaponSlot
                            : (me.inventory?.weapons?.indexOf(me.weapon) ?? 0);
                        const isActive = activeSlot === slotIdx;
                        const isReloading = isActive && me.reloading;
                        const reloadDuration = Math.max(1, Number(me.reloadMs) || 1);
                        const reloadRemaining = Math.max(0, Number(me.reloadRemainingMs) || 0);
                        const reloadProgress = isReloading
                            ? Math.max(0, Math.min(1, 1 - reloadRemaining / reloadDuration))
                            : 0;
                        const weaponRarity = weaponId ? (weaponId === 'sniper' || weaponId === 'lmg' ? 'military' : (weaponId === 'shotgun' || weaponId === 'assault' || weaponId === 'dmr' ? 'rare' : 'common')) : 'common';
                        const borderRarityClass = weaponId ? `rarity-border-${weaponRarity}` : '';
                        const ammoType = WEAPON_AMMO_TYPES[weaponId];
                        const reserveAmmo = ammoType ? (me.inventory?.ammoReserves?.[ammoType] || 0) : 0;
                        
                        return (
                            <button
                                type="button"
                                key={`hotbar-slot-${slotIdx}`}
                                className={`hotbar-slot ${isActive ? 'active-slot' : ''} ${weaponId ? 'has-item' : 'empty-slot'} ${borderRarityClass}`}
                                disabled={!weaponId}
                                aria-pressed={!!isActive}
                                aria-label={weaponId ? `Equip ${weaponLabel}` : `Weapon slot ${SURVIV_SLOT_KEYS[slotIdx]}, empty`}
                                title={weaponLabel || `Empty weapon slot ${SURVIV_SLOT_KEYS[slotIdx]}`}
                                onClick={() => {
                                    if (weaponId) {
                                        equipSlotPendingRef.current = slotIdx;
                                    }
                                }}
                            >
                                <span className="hotbar-slot-key">{SURVIV_SLOT_KEYS[slotIdx]}</span>
                                {weaponId ? (
                                    <>
                                        <div className="hotbar-weapon-icon-wrap">
                                            {renderWeaponIcon(weaponId, isActive ? '#14F195' : 'rgba(255,255,255,0.72)', 32)}
                                        </div>
                                        <span className="hotbar-slot-name-compact">{weaponLabel}</span>
                                        {weaponId === 'fists' || weaponId === 'knife' ? (
                                            <span className="hotbar-slot-ammo">MELEE</span>
                                        ) : (
                                            <span className={`hotbar-slot-ammo ${isReloading ? 'reloading' : ''}`} style={{ color: isReloading ? undefined : AMMO_TYPES[ammoType]?.color }}>
                                                <span>{isActive ? (isReloading ? 'RELOAD' : me.ammo) : (me.weaponSlotAmmo?.[slotIdx] ?? WEAPON_CLIP_SIZES[weaponId] ?? 0)}</span>
                                                {!isReloading && <span className="hotbar-ammo-reserve">/{reserveAmmo}</span>}
                                            </span>
                                        )}
                                        {isActive && isReloading && (
                                            <div
                                                className="hotbar-reload-sweep"
                                                style={{ width: `${reloadProgress * 100}%` }}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <span className="hotbar-slot-empty-label">-</span>
                                )}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        className={`hotbar-slot grenade-hotbar-slot ${(me.inventory?.grenades || 0) > 0 ? 'has-item' : 'empty-slot'}`}
                        disabled={(me.inventory?.grenades || 0) <= 0}
                        aria-label={`Throw grenade, ${me.inventory?.grenades || 0} remaining`}
                        title={(me.inventory?.grenades || 0) > 0 ? 'Throw grenade (G)' : 'No grenades'}
                        onClick={() => {
                            if ((me.inventory?.grenades || 0) > 0) throwGrenadePendingRef.current = true;
                        }}
                    >
                        <span className="hotbar-slot-key">G</span>
                        <div className="hotbar-weapon-icon-wrap grenade-hotbar-icon" aria-hidden="true">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M9 7.2h6l1.6 3.1a7 7 0 1 1-9.2 0L9 7.2Z" />
                                <path d="M10 7V4h4v3M14 4h3.4M17.4 4c0 1.5 1.1 2.1 2.1 2.6" />
                            </svg>
                        </div>
                        <span className="hotbar-slot-name-compact">GRENADE</span>
                        <span className="hotbar-slot-ammo">{me.inventory?.grenades || 0}</span>
                    </button>
                    <button
                        type="button"
                        className={'hotbar-slot medkit-hotbar-slot ' + ((me.inventory?.medkits || 0) > 0 ? 'has-item' : 'empty-slot') + (medkitRemainingMs > 0 ? ' is-using' : '')}
                        disabled={!canMobileHeal}
                        aria-label={'Use medkit, ' + (me.inventory?.medkits || 0) + ' remaining'}
                        title={(me.inventory?.medkits || 0) > 0
                            ? (canMobileHeal ? 'Use medkit (H)' : (medkitRemainingMs > 0 ? 'Using medkit' : 'Health is already full'))
                            : 'No medkits'}
                        onClick={() => {
                            if (canMobileHeal) useMedkitPendingRef.current = true;
                        }}
                    >
                        <span className="hotbar-slot-key">H</span>
                        <div className="hotbar-weapon-icon-wrap medkit-hotbar-icon" aria-hidden="true">
                            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="4" y="4" width="16" height="16" rx="4" />
                                <path d="M12 8v8M8 12h8" />
                            </svg>
                        </div>
                        <span className="hotbar-slot-name-compact">MEDKIT</span>
                        <span className="hotbar-slot-ammo">{me.inventory?.medkits || 0}</span>
                        {medkitRemainingMs > 0 && (
                            <span className="medkit-hotbar-progress" style={{ '--medkit-progress': (medkitProgress * 100) + '%' }} />
                        )}
                    </button>
                </div>
            )}

            {gameReady && !showResultModal && ((me?.kills || 0) > 0 || aliveCount > 0) && (
                <div className="surviv-match-stats" aria-label="Match status" aria-live="polite">
                    {(me?.kills || 0) > 0 && (
                        <div className="surviv-kills-badge">
                            <svg className="elim-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <path d="M9 12h.01M15 12h.01M12 2a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z"/>
                                <path d="M10 22v-3h4v3"/>
                            </svg>
                            <span>{me.kills} {me.kills === 1 ? 'ELIM' : 'ELIMS'}</span>
                        </div>
                    )}
                    {aliveCount > 0 && (
                        <div className="surviv-alive-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            <span>{aliveCount} ALIVE</span>
                        </div>
                    )}
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
                    onSpectate={!cashedAmount && isDead && liveSession ? enterSpectate : undefined}
                    showSpectate={!cashedAmount && isDead && liveSession}
                    isJoining={isRejoining}
                    onClose={handleLobby}
                />
            )}

            <GameSocialOverlay socket={socketRef.current} disabled={IS_MOBILE} onEmote={handleGameEmote} />

            {/* Side-by-Side React Inventory Overlay */}
            {isInventoryOpen && me && (
                <div 
                    className="surviv-inventory-modal" 
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="surviv-inventory-title"
                    onClick={handleCloseInventory}
                    onDragOver={(e) => {
                        if (readInventoryDrag(e)?.source === 'backpack') e.preventDefault();
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        const dragged = readInventoryDrag(e);
                        if (dragged?.source === 'backpack') {
                            dropItemPendingRef.current = dragged.key === 'weapon'
                                ? { itemKey: 'weapon', slotIdx: dragged.slotIdx }
                                : { itemKey: dragged.key, ammoType: dragged.ammoType };
                        }
                        finishInventoryDrag();
                    }}
                >
                    <div className={`surviv-inventory-container ${!me.openedContainer ? 'backpack-only' : 'has-chest'}`} onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="surviv-inventory-header">
                            <div className="surviv-inventory-title-row">
                                <span id="surviv-inventory-title" className="surviv-inventory-title">INVENTORY</span>
                                <button type="button" className="surviv-inventory-close-btn" aria-label="Close inventory" onClick={handleCloseInventory}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                            <div className="surviv-inventory-subtitle">{me.openedContainer ? 'Backpack & open chest' : 'Backpack · Tab to close'}</div>
                        </div>

                        {/* Side-by-side grids */}
                        <div className="surviv-inventory-body">
                            {/* Left Column: Player Backpack */}
                            <div 
                                className={`surviv-inventory-panel player-backpack ${inventoryDrag?.source === 'chest' ? 'is-drop-target' : ''}`}
                                onDragOver={(e) => {
                                    if (readInventoryDrag(e)?.source === 'chest') e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const dragged = readInventoryDrag(e);
                                    if (dragged?.source === 'chest' && me.openedContainer?.id) {
                                        takeChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: dragged.key, ammoType: dragged.ammoType };
                                    }
                                    finishInventoryDrag();
                                }}
                            >
                                <h3 className="panel-title">
                                    <svg className="panel-title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 0 0 .5-1.5L19 7H5L3.5 18.5a2 2 0 0 0 .5 1.5M12 2v5M8 7V2a2 2 0 0 1 4 0M12 2a2 2 0 0 1 4 0v5"/></svg>
                                    YOUR BACKPACK
                                </h3>

                                {/* Weapons Grid */}
                                <div className="weapons-section">
                                    <h4 className="section-subtitle">WEAPONS</h4>
                                    <div className="weapons-grid">
                                        {SURVIV_WEAPON_SLOTS.map((slotIdx) => {
                                            const weaponId = slotIdx === 2 ? (me.inventory?.meleeWeapon || 'fists') : (me.inventory?.weapons?.[slotIdx] || null);
                                            const weaponLabel = weaponId ? (WEAPON_LABELS[weaponId] || weaponId) : null;

                                            const activeSlot = Number.isInteger(me.activeWeaponSlot)
                                                ? me.activeWeaponSlot
                                                : (me.inventory?.weapons?.indexOf(me.weapon) ?? 0);
                                            const isActive = activeSlot === slotIdx;
                                            
                                            const weaponRarity = weaponId ? (weaponId === 'sniper' || weaponId === 'lmg' ? 'military' : (weaponId === 'shotgun' || weaponId === 'assault' || weaponId === 'dmr' ? 'rare' : 'common')) : 'common';
                                            const borderRarityClass = weaponId ? `rarity-border-${weaponRarity}` : '';
                                            return (
                                                <div 
                                                    key={`weapon-slot-${slotIdx}`}
                                                    className={`weapon-slot-card ${isActive ? 'active-slot' : ''} ${borderRarityClass} ${weaponId ? 'has-item' : 'empty-slot'} ${(inventoryDrag?.key === 'weapon' && inventoryDrag?.source !== 'backpack') || (inventoryDrag?.source === 'backpack' && inventoryDrag?.slotIdx !== slotIdx) ? 'is-drop-target' : ''}`}
                                                    draggable={!!weaponId && weaponId !== 'fists'}
                                                    onDragStart={(e) => {
                                                        if (weaponId && weaponId !== 'fists') {
                                                            beginInventoryDrag(e, { source: 'backpack', key: 'weapon', slotIdx, weaponType: weaponId });
                                                        }
                                                    }}
                                                    onDragEnd={finishInventoryDrag}
                                                    onDragOver={(e) => {
                                                        const dragged = readInventoryDrag(e);
                                                        if (dragged?.key === 'weapon' && (dragged.source === 'chest' || dragged.slotIdx !== slotIdx)) e.preventDefault();
                                                    }}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const dragged = readInventoryDrag(e);
                                                        if (dragged?.source === 'chest' && dragged.key === 'weapon' && me.openedContainer?.id) {
                                                            takeChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: 'weapon', targetSlot: slotIdx };
                                                        } else if (dragged?.source === 'backpack' && dragged.key === 'weapon' && dragged.slotIdx !== slotIdx) {
                                                            swapWeaponSlotsPendingRef.current = { fromSlot: dragged.slotIdx, toSlot: slotIdx };
                                                        }
                                                        finishInventoryDrag();
                                                    }}
                                                    onClick={() => {
                                                        if (weaponId) {
                                                            equipSlotPendingRef.current = slotIdx;
                                                        }
                                                    }}
                                                >
                                                    <div className="slot-number">{SURVIV_SLOT_KEYS[slotIdx]}</div>
                                                    {weaponId ? (
                                                        <div className="weapon-card-content-flex" style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '100%', minWidth: 0, overflow: 'hidden' }}>
                                                            <div className="weapon-card-icon-wrap" style={{ flexShrink: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                                                {renderWeaponIcon(weaponId, isActive ? '#14F195' : 'rgba(255,255,255,0.7)', 24)}
                                                            </div>
                                                            <div className="weapon-card-details" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
                                                                <span className="weapon-name" style={{ fontSize: '0.68rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{weaponLabel}</span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px', minWidth: 0, overflow: 'hidden' }}>
                                                                    <span className={`weapon-rarity-badge ${weaponRarity}`}>{weaponRarity.toUpperCase()}</span>
                                                                    {isActive && <span className="equipped-badge" style={{ fontSize: '0.46rem', color: '#14F195', fontWeight: 900 }}>EQ</span>}
                                                                </div>
                                                            </div>
                                                            {weaponId !== 'fists' && (
                                                                <button 
                                                                    className="slot-drop-btn" 
                                                                    style={{
                                                                        background: 'rgba(255, 59, 48, 0.16)',
                                                                        border: '1px solid rgba(255, 59, 48, 0.3)',
                                                                        borderRadius: '3px',
                                                                        color: '#ff6b6b',
                                                                        fontSize: '0.46rem',
                                                                        padding: '1px 3px',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 800,
                                                                        alignSelf: 'center',
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        dropItemPendingRef.current = { itemKey: 'weapon', slotIdx };
                                                                    }}
                                                                >
                                                                    DROP
                                                                </button>
                                                            )}
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
                                            draggable={(me.inventory?.medkits || 0) > 0}
                                            onDragStart={(e) => {
                                                if ((me.inventory?.medkits || 0) > 0) {
                                                    beginInventoryDrag(e, { source: 'backpack', key: 'medkits' });
                                                }
                                            }}
                                            onDragEnd={finishInventoryDrag}
                                            onClick={() => {
                                                const qty = me.inventory?.medkits || 0;
                                                if (qty > 0 && me.openedContainer?.id) {
                                                    putChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: 'medkits' };
                                                } else if (qty > 0) {
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
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', position: 'absolute', top: '4px', right: '6px', gap: '2px' }}>
                                                    <span className="item-action-badge" style={{ position: 'static', color: me.openedContainer ? '#a855f7' : undefined }}>{me.openedContainer ? 'DEPOSIT' : 'HEAL'}</span>
                                                    <button 
                                                        className="slot-drop-btn" 
                                                        style={{
                                                            background: 'rgba(255, 59, 48, 0.16)',
                                                            border: '1px solid rgba(255, 59, 48, 0.3)',
                                                            borderRadius: '3px',
                                                            color: '#ff6b6b',
                                                            fontSize: '0.5rem',
                                                            padding: '1px 3px',
                                                            cursor: 'pointer',
                                                            fontWeight: 800,
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            dropItemPendingRef.current = { itemKey: 'medkits' };
                                                        }}
                                                    >
                                                        DROP
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Caliber-specific ammunition */}
                                        <div className="ammo-reserves-card">
                                            <div className="ammo-reserves-title">AMMUNITION</div>
                                            <div className="ammo-reserves-grid">
                                                {Object.entries(AMMO_TYPES).map(([ammoType, definition]) => {
                                                    const qty = me.inventory?.ammoReserves?.[ammoType] || 0;
                                                    return (
                                                        <div key={ammoType} className={`ammo-reserve ${qty > 0 ? 'has-qty' : 'empty-qty'}`} style={{ '--ammo-color': definition.color }} draggable={qty > 0}
                                                            onDragStart={(e) => qty > 0 && beginInventoryDrag(e, { source: 'backpack', key: 'ammo', ammoType })}
                                                            onDragEnd={finishInventoryDrag}
                                                            onClick={() => {
                                                                if (qty > 0 && me.openedContainer?.id) putChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: 'ammo', ammoType };
                                                            }}>
                                                            <span className="ammo-reserve-round" aria-hidden="true" />
                                                            <span className="ammo-reserve-label">{definition.label}</span>
                                                            <strong>{qty}</strong>
                                                            <span className="ammo-reserve-max">/{definition.max}</span>
                                                            {qty > 0 && (
                                                                <button type="button" className="ammo-reserve-drop" onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dropItemPendingRef.current = { itemKey: 'ammo', ammoType };
                                                                }} aria-label={`Drop ${definition.label} ammo`}>×</button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Grenade Slot */}
                                        <div
                                            className={`item-slot-card grenade-slot ${(me.inventory?.grenades || 0) > 0 ? 'has-qty' : 'empty-qty'}`}
                                            draggable={(me.inventory?.grenades || 0) > 0}
                                            onDragStart={(e) => {
                                                if ((me.inventory?.grenades || 0) > 0) beginInventoryDrag(e, { source: 'backpack', key: 'grenades' });
                                            }}
                                            onDragEnd={finishInventoryDrag}
                                            onClick={() => {
                                                const qty = me.inventory?.grenades || 0;
                                                if (qty > 0 && me.openedContainer?.id) {
                                                    putChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: 'grenades' };
                                                } else if (qty > 0) {
                                                    throwGrenadePendingRef.current = true;
                                                }
                                            }}
                                            style={{ cursor: (me.inventory?.grenades || 0) > 0 ? 'pointer' : 'default' }}
                                        >
                                            <div className="item-slot-icon-container">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M9 4h6v4H9zM7 8h10v3a6 6 0 0 1-10 0V8Z"/><path d="M12 4V2M15 5l2-1"/><path d="M8 14h8M9.5 17h5"/></svg>
                                            </div>
                                            <div className="item-slot-details">
                                                <span className="item-slot-name">GRENADES</span>
                                                <span className="item-slot-value">{me.inventory?.grenades || 0} / 3</span>
                                            </div>
                                            {(me.inventory?.grenades || 0) > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', position: 'absolute', top: '4px', right: '6px', gap: '2px' }}>
                                                    <span className="item-action-badge" style={{ position: 'static', color: me.openedContainer ? '#a855f7' : '#f59e0b' }}>{me.openedContainer ? 'DEPOSIT' : 'G THROW'}</span>
                                                    <button className="slot-drop-btn" style={{ background: 'rgba(255, 59, 48, 0.16)', border: '1px solid rgba(255, 59, 48, 0.3)', borderRadius: '3px', color: '#ff6b6b', fontSize: '0.5rem', padding: '1px 3px', cursor: 'pointer', fontWeight: 800 }} onClick={(e) => { e.stopPropagation(); dropItemPendingRef.current = { itemKey: 'grenades' }; }}>DROP</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Armor Slot */}
                                        <div 
                                            className={`item-slot-card armor-slot ${(me.armor || 0) > 0 ? 'has-qty' : 'empty-qty'}`}
                                            draggable={(me.armor || 0) > 0}
                                            onDragStart={(e) => {
                                                if ((me.armor || 0) > 0) {
                                                    beginInventoryDrag(e, { source: 'backpack', key: 'armor' });
                                                }
                                            }}
                                            onDragEnd={finishInventoryDrag}
                                            onClick={() => {
                                                const isChestOpen = !!me.openedContainer;
                                                if ((me.armor || 0) > 0 && isChestOpen) {
                                                    putChestItemPendingRef.current = {
                                                        chestId: me.openedContainer.id,
                                                        itemKey: 'armor'
                                                    };
                                                }
                                            }}
                                            style={{ cursor: (!!me.openedContainer) && (me.armor || 0) > 0 ? 'pointer' : 'default' }}
                                        >
                                            <div className="item-slot-icon-container">
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5d9cff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                            </div>
                                            <div className="item-slot-details">
                                                <span className="item-slot-name">ARMOR LEVEL</span>
                                                <span className="item-slot-value">{Math.round(me.armor || 0)}%</span>
                                            </div>
                                            {(me.armor || 0) > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', position: 'absolute', top: '4px', right: '6px', gap: '2px' }}>
                                                    {(!!me.openedContainer) && (
                                                        <span className="item-action-badge" style={{ position: 'static', color: '#a855f7' }}>DEPOSIT</span>
                                                    )}
                                                    <button 
                                                        className="slot-drop-btn" 
                                                        style={{
                                                            background: 'rgba(255, 59, 48, 0.16)',
                                                            border: '1px solid rgba(255, 59, 48, 0.3)',
                                                            borderRadius: '3px',
                                                            color: '#ff6b6b',
                                                            fontSize: '0.5rem',
                                                            padding: '1px 3px',
                                                            cursor: 'pointer',
                                                            fontWeight: 800,
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            dropItemPendingRef.current = { itemKey: 'armor' };
                                                        }}
                                                    >
                                                        DROP
                                                    </button>
                                                </div>
                                            )}
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
                            {me.openedContainer && (
                                <div 
                                    className={`surviv-inventory-panel chest-loot-panel ${inventoryDrag?.source === 'backpack' ? 'is-drop-target' : ''}`}
                                    onDragOver={(e) => {
                                        if (readInventoryDrag(e)?.source === 'backpack') e.preventDefault();
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const dragged = readInventoryDrag(e);
                                        if (dragged?.source === 'backpack' && me.openedContainer?.id) {
                                            putChestItemPendingRef.current = dragged.key === 'weapon'
                                                ? { chestId: me.openedContainer.id, itemKey: 'weapon', weaponType: dragged.weaponType, slotIdx: dragged.slotIdx }
                                                : { chestId: me.openedContainer.id, itemKey: dragged.key, ammoType: dragged.ammoType };
                                        }
                                        finishInventoryDrag();
                                    }}
                                >
                                    <h3 className="panel-title">
                                        <svg className="panel-title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8H3M21 16H3M12 2v20M2 5h20v14H2z"/></svg>
                                        {me.openedContainer.tier?.toUpperCase() || 'COMMON'} CHEST
                                    </h3>

                                    <div className="chest-items-section">
                                        <div className="chest-items-hint">{me.openedContainer.items?.length || 0} ITEMS</div>
                                        <div className="chest-items-grid">
                                            {(me.openedContainer.items?.length || 0) === 0 ? (
                                                <div className="chest-empty-state">
                                                    <p>EMPTY</p>
                                                </div>
                                            ) : me.openedContainer.items.map((item) => {
                                                const rarityClass = item.rarity || 'common';
                                                
                                                let strokeColor = '#ffffff';
                                                let itemIcon = null;

                                                if (item.kind === 'weapon') {
                                                    strokeColor = '#f2774f';
                                                    itemIcon = renderWeaponIcon(item.weaponType || 'pistol', strokeColor, 24);
                                                } else if (item.kind === 'money') {
                                                    strokeColor = '#ffd45a';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 8H10.5a2.5 2.5 0 0 0 0 5H13.5a2.5 2.5 0 0 1 0 5H9"/></svg>;
                                                } else if (item.kind === 'medkit') {
                                                    strokeColor = '#5fe08a';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>;
                                                } else if (item.kind === 'ammo') {
                                                    strokeColor = AMMO_TYPES[item.ammoType]?.color || item.color || '#d7d1bb';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><path d="M6 3h12v18H6zM10 6h4v2h-4zM10 10h4v2h-4zM10 14h4v2h-4z"/></svg>;
                                                } else if (item.kind === 'grenade') {
                                                    strokeColor = '#f59e0b';
                                                    itemIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2"><path d="M9 4h6v4H9zM7 8h10v3a6 6 0 0 1-10 0V8Z"/><path d="M12 4V2M15 5l2-1"/><path d="M8 14h8M9.5 17h5"/></svg>;
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
                                                            beginInventoryDrag(e, { source: 'chest', key: item.key, ammoType: item.ammoType });
                                                        }}
                                                        onDragEnd={finishInventoryDrag}
                                                        onClick={() => {
                                                            if (me.openedContainer?.id) {
                                                                takeChestItemPendingRef.current = { chestId: me.openedContainer.id, itemKey: item.key, ammoType: item.ammoType };
                                                            }
                                                        }}
                                                    >
                                                        <div className="chest-item-icon-container">
                                                            {itemIcon}
                                                        </div>
                                                        <div className="chest-item-info">
                                                            <div className="chest-item-label">{item.label}</div>
                                                            <div className="chest-item-action">TAKE</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="surviv-inventory-footer">
                            <span>{me.openedContainer ? 'CHEST OPEN' : 'BACKPACK'}</span>
                            <span>{formatUsd(me.dollarBalance || 0)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

