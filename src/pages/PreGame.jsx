import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createQR } from '@solana/pay';
import '../styles/ui.css';
import '../styles/tournaments.css';
import '../styles/slitherSpecialSkins.css';
import '../styles/pregameModeSelector.css';
import CurrencySwitchButton from '../components/CurrencySwitchButton';
import PregameGameBackground from '../components/PregameGameBackground';
import { drawSurvivPlayerPreview } from '../game/surviv/SurvivRenderer.js';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import GuestWelcomeBanner from '../components/GuestWelcomeBanner';
import PregameGamemodeSelector, { getGamemodePlayingCount } from '../components/PregameGamemodeSelector';
import RewardsWidget from '../components/RewardsWidget';
import { markGamemodePlayed } from '../constants/gamemodes';
import { ENTRY_TIERS, BR_ENTRY_TIERS, COMPETITIVE_ENTRY_TIERS, SURVIV_ENTRY_TIERS, DEFAULT_ENTRY_FEE, DEFAULT_BR_ENTRY_FEE, DEFAULT_COMPETITIVE_ENTRY_FEE, DEFAULT_SURVIV_ENTRY_FEE, tierEconomy, competitiveTierEconomy, survivTierEconomy, formatUsd } from '../constants/economy';
import { setPageSeo, SEO } from '../utils/seo';
import { trackMixpanelEvent } from '../utils/mixpanel';
import { isBattleRoyaleAvailable, isBattleRoyaleMode as isBRGamemode, normalizeGamemodeForLobby } from '../constants/features';
import { buildPresenceHeaders } from '../utils/sitePresence';
import { API_URL } from '../utils/apiBase';
import { getSnakeSegmentCanvas, getSnakeShadowCanvas } from '../utils/snakeRender';
import { clearAllPendingResults } from '../utils/gamePendingResult';
import { CHROMA_SKIN_COLORS } from '../constants/skins';
import { DEFAULT_FLAG_CODE, FLAG_SKINS, drawFlag, flagSkinValue, getFlagBorderColor, getFlagSegmentColors, getFlagSkin, parseFlagSkin } from '../constants/flagSkins';
import { SLITHER_SPECIAL_SKINS, drawSlitherSpecialBody, drawSlitherSpecialDetails, getSlitherSpecialSkin } from '../constants/slitherSpecialSkins';
import { useAgarToken } from '../features/agar/ui/AgarTokenContext';
import AgarLogo from '../features/agar/ui/AgarLogo';
import { formatAgarAmount } from '../features/agar/formatAgarAmount';
import { hasUnlockedFreeTicket } from '../utils/freeTicket';
import { FREE_MODE_STORAGE_KEY, getFreeModeEntryFee, setPublicFreeModeEnabled } from '../utils/freeMode';
import { formatGameSolAmount, formatWalletBalanceAmount } from '../utils/displayCurrency';
import useBalanceCurrency from '../hooks/useBalanceCurrency';

const DISCORD_URL = import.meta.env.VITE_DISCORD_URL?.trim() || 'https://discord.gg/m5mWMu8aF';

/* ── Solana logo icon ── */
const SolLogo = ({ size = 13, style }) => (
    <img
        src="/solana-sol-logo.png"
        alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    />
);

function formatLiveTime(iso) {
    if (!iso) return '';
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 10) return 'now';
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    return `${Math.floor(hr / 24)}d`;
}

function formatCountdown(target, now) {
    const total = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const WalletIcon = ({ size = 14, style }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ opacity: 0.55, flexShrink: 0, ...style }}
    >
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
);

/* ── Currency toggle options ── */
const PlayIcon = ({ size = 18 }) => (
    <svg className="play-button-icon" width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
        <path d="M6.75 4.9v10.2c0 .83.92 1.32 1.6.85l7.15-5.1a1.04 1.04 0 0 0 0-1.7l-7.15-5.1c-.68-.47-1.6.02-1.6.85Z" fill="currentColor" />
    </svg>
);

const DepositIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 3.5v8M6.75 8.25 10 11.5l3.25-3.25M4 14.5h12" />
    </svg>
);

const WithdrawIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 16.5v-8M6.75 11.75 10 8.5l3.25 3.25M4 5.5h12" />
    </svg>
);
function readStoredGameMode() {
    return localStorage.getItem('selected_gamemode') || localStorage.getItem('current_game_mode') || null;
}

function resolvePreGameMode(pathname, locationStateMode, isAdmin = false) {
    const stored = readStoredGameMode();
    const brAvailable = isBattleRoyaleAvailable(isAdmin);
    if (pathname === '/agar') return 'agar';
    if (pathname === '/slither') {
        if (stored === 'competitive-slither') return stored;
        if (brAvailable && stored === 'br-slither') return stored;
        return 'slither';
    }
    if (pathname === '/surviv') return 'surviv';
    const raw = locationStateMode || stored || 'agar';
    return normalizeGamemodeForLobby(raw, isAdmin);
}

const getChromaName = (color) => {
    const flagCode = parseFlagSkin(color);
    if (flagCode) {
        const flag = getFlagSkin(flagCode);
        return `${flag.emoji} ${flag.name}`;
    }
    if (color === 'random') return 'Rainbow';
    switch (color) {
        case '#c080ff': return 'Lavender Purple';
        case '#9099ff': return 'Indigo Blue';
        case '#80d0d0': return 'Turquoise Cyan';
        case '#80ff80': return 'Lime Green';
        case '#eeee70': return 'Tinted Yellow';
        case '#ffa060': return 'Orange';
        case '#ff9050': return 'Pink Red';
        case '#ff4040': return 'Dark Red';
        case '#e030e0': return 'Magenta';
        default: return color.toUpperCase();
    }
};

export default function PreGame() {
    const { user, logout, token, login, refreshUser, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        openAgarModal,
        walletBalance: agarBalance,
        balanceLoading: agarBalanceLoading,
        launchReady: agarLaunchReady,
        config: agarConfig,
    } = useAgarToken();

    // ── Tournament States ───────────────────────────────
    const { tournamentId } = useParams();
    const [tournament, setTournament] = useState(null);
    const [tournamentLoading, setTournamentLoading] = useState(true);
    const [tournamentError, setTournamentError] = useState('');
    const [tournamentNow, setTournamentNow] = useState(Date.now());

    useEffect(() => {
        if (!tournamentId) return undefined;
        const timer = setInterval(() => setTournamentNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [tournamentId]);

    useEffect(() => {
        if (!tournamentId) return undefined;
        let active = true;
        setTournamentLoading(true);
        const load = async () => {
            try {
                const response = await fetch(`${API_URL}/api/tournaments/${tournamentId}?t=${Date.now()}`, {
                    headers: token ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' } : { 'Cache-Control': 'no-cache' },
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not load tournament');
                if (active) {
                    setTournament(data.tournament);
                    setTournamentError('');
                    document.title = `${data.tournament.name} | Arenifi`;
                }
            } catch (err) {
                if (active) setTournamentError(err.message);
            } finally {
                if (active) setTournamentLoading(false);
            }
        };
        load();
        const poll = setInterval(load, 3000);
        return () => { active = false; clearInterval(poll); };
    }, [token, tournamentId]);

    // Reaching the lobby means the previous result screen was intentionally
    // left (including via the browser Back button). It must not reopen on Play.
    useEffect(() => {
        clearAllPendingResults();
    }, []);

    // ── State ──────────────────────────────────────────
    const modeCardRef = useRef(null);
    const mainCardRef = useRef(null);
    const [leaderboardHeight, setLeaderboardHeight] = useState('auto');

    useEffect(() => {
        const targetRef = modeCardRef;
        if (!targetRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.target.offsetHeight > 100) {
                    setLeaderboardHeight(entry.target.offsetHeight);
                }
            }
        });
        observer.observe(targetRef.current);
        return () => observer.disconnect();
    }, [tournamentId, tournamentLoading]);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showBugReport, setShowBugReport] = useState(false);
    const [bugReportMessage, setBugReportMessage] = useState('');
    const [bugReportStatus, setBugReportStatus] = useState('');
    const [bugReportSubmitting, setBugReportSubmitting] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [isWalletExpanded, setIsWalletExpanded] = useState(false);
    const [isWithdrawExpanded, setIsWithdrawExpanded] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawAll, setWithdrawAll] = useState(false);
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [isValidWithdrawAddress, setIsValidWithdrawAddress] = useState(true);
    const [displayFullAddress, setDisplayFullAddress] = useState(false);
    const [balanceCurrency, setBalanceCurrency] = useBalanceCurrency();
    const isCurSOL = balanceCurrency === 'SOL';
    const setIsCurSOL = useCallback(value => setBalanceCurrency(value ? 'SOL' : 'USD'), [setBalanceCurrency]);
    const [isMatchmaking, setIsMatchmaking] = useState(false);

    const [isAlreadyInGame, setIsAlreadyInGame] = useState(
        () => !!localStorage.getItem('current_game_mode')
    );
    const [activeGameBalance, setActiveGameBalance] = useState(null);
    const [liveStats, setLiveStats] = useState({
        playersOnline: 0,
        totalPlayersOnline: 0,
        totalUserBalanceUsd: 0,
        biggestPayout: 0,
        topPlayer: null,
        topPlayers: [],
        topPlayersByGamemode: { agar: [], slither: [] },
        recentBRVictories: { agar: [], slither: [] },
        playersByEntryFee: {},
        playersByModeAndFee: { agar: {}, slither: {} },
        brPlayersByFee: {},
        playersByGamemode: { agar: 0, slither: 0, brAgar: 0, brSlither: 0, competitiveSlither: 0, surviv: 0 },
        siteUsersOnline: 0,
    });
    const solPrice = liveStats?.solPrice || user?.solPrice || 64;
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [leaderboardTab, setLeaderboardTab] = useState('alltime');
    const [statusMsg, setStatusMsg] = useState(''); // Moved here to avoid conflicts
    const [leaderboardData, setLeaderboardData] = useState({ alltime: [], week: [], globalEarningsUsd: 0 });
    const [liveLeaderboardEvents, setLiveLeaderboardEvents] = useState([]);
    const [liveTabPulse, setLiveTabPulse] = useState(false);
    const liveTabSeenIdRef = useRef(null);
    const leaderboardListRef = useRef(null);
    const leaderboardScrollHideRef = useRef(null);
    const [nickname, setNickname] = useState(
        () => localStorage.getItem('match_nickname') || user?.username || ''
    );
    const [hideNames, setHideNames] = useState(
        () => localStorage.getItem('hide_player_names') === 'true'
    );

    const [selectedSkin, setSelectedSkin] = useState(
        () => localStorage.getItem('selected_skin') || '#c080ff'
    );
    const [selectedSkinAgar, setSelectedSkinAgar] = useState(
        () => localStorage.getItem('selected_skin_agar') || '#c080ff'
    );
    const [selectedSkinSurviv, setSelectedSkinSurviv] = useState(
        () => localStorage.getItem('selected_skin_surviv') || 'random_color'
    );

    const [hasSeenRainbow, setHasSeenRainbow] = useState(
        () => localStorage.getItem('has_seen_rainbow') === 'true'
    );
    const [skinInventoryLoaded, setSkinInventoryLoaded] = useState(false);
    const [ownedSkinProducts, setOwnedSkinProducts] = useState(() => new Set());
    const [shopProducts, setShopProducts] = useState([]);

    const [showCustomizer, setShowCustomizer] = useState(false);
    const [showCoinLaunchHint, setShowCoinLaunchHint] = useState(false);

    useEffect(() => {
        if (!agarLaunchReady || !agarConfig.mint) {
            setShowCoinLaunchHint(false);
            return;
        }
        setShowCoinLaunchHint(localStorage.getItem(`arenifi_coin_launch_seen:${agarConfig.mint}`) !== 'true');
    }, [agarConfig.mint, agarLaunchReady]);

    const openCoinAndDismissLaunchHint = () => {
        if (agarConfig.mint) localStorage.setItem(`arenifi_coin_launch_seen:${agarConfig.mint}`, 'true');
        setShowCoinLaunchHint(false);
        openAgarModal({ action: 'BUY' });
    };

    useEffect(() => {
        localStorage.setItem('has_seen_rainbow', hasSeenRainbow);
    }, [hasSeenRainbow]);

    useEffect(() => {
        if (!token) return undefined;
        let active = true;
        Promise.all([
            fetch(`${API_URL}/api/shop/inventory`, {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_URL}/api/shop/catalog`, { cache: 'no-store' }),
        ]).then(async ([inventoryResponse, catalogResponse]) => {
            if (!active) return;
            const inventory = inventoryResponse.ok ? await inventoryResponse.json() : { entitlements: [] };
            const catalog = catalogResponse.ok ? await catalogResponse.json() : { products: [] };
            const ownedProducts = new Set((inventory.entitlements || []).map((entry) => entry.productId));
            if (user?.isAdmin) {
                (catalog.products || []).forEach((product) => ownedProducts.add(product.id));
            }
            setOwnedSkinProducts(ownedProducts);
            setShopProducts(catalog.products || []);
            setSkinInventoryLoaded(true);
        }).catch(() => {
            if (active) setSkinInventoryLoaded(true);
        });
        return () => { active = false; };
    }, [token, user?.isAdmin]);

    useEffect(() => {
        if (!skinInventoryLoaded) return;
        if (selectedSkin === 'random' && !user?.isAdmin && !ownedSkinProducts.has('slither:rainbow')) {
            setSelectedSkin('#c080ff');
        }
        if (selectedSkinAgar === 'random' && !user?.isAdmin && !ownedSkinProducts.has('agar:rainbow')) {
            setSelectedSkinAgar('#c080ff');
        }
        if (parseFlagSkin(selectedSkin) && !user?.isAdmin && !ownedSkinProducts.has('flags:bundle')) {
            setSelectedSkin('#c080ff');
        }
        const selectedSpecialSkin = getSlitherSpecialSkin(selectedSkin);
        if (selectedSpecialSkin && !user?.isAdmin && !ownedSkinProducts.has(selectedSpecialSkin.productId)) {
            setSelectedSkin('#c080ff');
        }
        if (parseFlagSkin(selectedSkinAgar) && !user?.isAdmin && !ownedSkinProducts.has('flags:bundle')) {
            setSelectedSkinAgar('#c080ff');
        }
    }, [ownedSkinProducts, selectedSkin, selectedSkinAgar, skinInventoryLoaded, user?.isAdmin]);

    useEffect(() => {
        localStorage.setItem('selected_skin', selectedSkin);
    }, [selectedSkin]);

    useEffect(() => {
        localStorage.setItem('selected_skin_agar', selectedSkinAgar);
    }, [selectedSkinAgar]);

    useEffect(() => {
        localStorage.setItem('selected_skin_surviv', selectedSkinSurviv);
    }, [selectedSkinSurviv]);

    const [selectedMode, setSelectedMode] = useState(
        () => resolvePreGameMode(location.pathname, location.state?.selectedMode)
    );
    const [selectedEntryFee, setSelectedEntryFee] = useState(() => {
        const stored = localStorage.getItem('selected_entry_fee');
        return (stored && stored !== 'null') ? Number(stored) : null;
    });
    const [publicFreeMode, setPublicFreeMode] = useState(
        () => localStorage.getItem(FREE_MODE_STORAGE_KEY) === 'true'
    );
    const [activeEntryFee, setActiveEntryFee] = useState(null);
    const [currentGameMode, setCurrentGameMode] = useState(
        () => localStorage.getItem('current_game_mode') || null
    );
    const modeSelectionMadeRef = useRef(Boolean(
        localStorage.getItem('selected_gamemode')
        || localStorage.getItem('current_game_mode')
        || location.state?.selectedMode
        || ['/agar', '/slither', '/surviv'].includes(location.pathname)
    ));
    const freshSelectionInitializedRef = useRef(false);
    const freshSelectionPendingRef = useRef(false);

    useEffect(() => {
        if (selectedMode && modeSelectionMadeRef.current) {
            localStorage.setItem('selected_gamemode', selectedMode);
        } else if (!selectedMode) {
            localStorage.removeItem('selected_gamemode');
        }
    }, [selectedMode]);

    useEffect(() => {
        if (!isAuthenticated) {
            freshSelectionInitializedRef.current = false;
            freshSelectionPendingRef.current = false;
            return;
        }
        if (freshSelectionInitializedRef.current) return;
        freshSelectionInitializedRef.current = true;

        const isPlainPregameVisit = location.pathname === '/pre-game'
            && !location.state?.selectedMode
            && !tournamentId;
        if (!isPlainPregameVisit) return;

        // A real user choice survives reloads. Only a completely fresh lobby
        // should begin with no selected gamemode or amount.
        if (localStorage.getItem('selected_gamemode')) return;

        freshSelectionPendingRef.current = true;
        if (!isAlreadyInGame) {
            modeSelectionMadeRef.current = false;
            setSelectedMode(null);
            setSelectedEntryFee(null);
            freshSelectionPendingRef.current = false;
        }
    }, [isAuthenticated, isAlreadyInGame, location.pathname, location.state?.selectedMode, tournamentId]);

    useEffect(() => {
        if (selectedEntryFee !== null && !isNaN(selectedEntryFee)) {
            localStorage.setItem('selected_entry_fee', String(selectedEntryFee));
        } else {
            localStorage.removeItem('selected_entry_fee');
        }
    }, [selectedEntryFee]);

    useEffect(() => {
        if (location.pathname === '/slither') {
            setSelectedMode(resolvePreGameMode('/slither', location.state?.selectedMode, !!user?.isAdmin));
        } else if (location.pathname === '/agar') {
            setSelectedMode('agar');
        } else if (location.state?.selectedMode) {
            setSelectedMode(normalizeGamemodeForLobby(location.state.selectedMode, !!user?.isAdmin));
        }
    }, [location.pathname, location.state?.selectedMode, user?.isAdmin]);

    useEffect(() => {
        if (currentGameMode) {
            localStorage.setItem('current_game_mode', currentGameMode);
        } else {
            localStorage.removeItem('current_game_mode');
        }
    }, [currentGameMode]);

    // Panel drag
    const [panelPos, setPanelPos] = useState({ x: null, y: 60 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // Refs
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const walletDropRef = useRef(null);
    const walletExpandRef = useRef(null);
    const withdrawExpandRef = useRef(null);
    const qrRef = useRef(null);

    const depositAddress = user?.depositAddress;
    const SOL_ADDR_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const brAvailable = isBattleRoyaleAvailable(!!user?.isAdmin);

    const entryFeeForSession = isAlreadyInGame && activeEntryFee != null ? activeEntryFee : selectedEntryFee;
    const isBattleRoyaleMode = isBRGamemode(selectedMode)
        && (brAvailable || (isAlreadyInGame && isBRGamemode(currentGameMode)));
    const isCompetitiveSlitherMode = selectedMode === 'competitive-slither';
    const isSurvivMode = selectedMode === 'surviv';
    const fixedFreeModeEntryFee = getFreeModeEntryFee(selectedMode);
    const economyFeeForDisplay = entryFeeForSession || (
        isSurvivMode
            ? DEFAULT_SURVIV_ENTRY_FEE
            : isCompetitiveSlitherMode
                ? DEFAULT_COMPETITIVE_ENTRY_FEE
                : isBattleRoyaleMode
                    ? DEFAULT_BR_ENTRY_FEE
                    : DEFAULT_ENTRY_FEE
    );
    const economy = isSurvivMode
        ? survivTierEconomy(economyFeeForDisplay)
        : isCompetitiveSlitherMode
            ? competitiveTierEconomy(economyFeeForDisplay)
            : tierEconomy(economyFeeForDisplay);
    const brVariant = isBattleRoyaleMode ? selectedMode.replace(/^br-/, '') : null;
    const isSlitherFamily = selectedMode === 'slither'
        || selectedMode === 'competitive-slither'
        || (isBattleRoyaleMode && brVariant === 'slither');
    const isSurvivFamily = isSurvivMode;
    const isAgarFamily = selectedMode === 'agar'
        || selectedMode === 'competitive-agar'
        || (isBattleRoyaleMode && brVariant === 'agar');

    const [customizerTab, setCustomizerTab] = useState('slither');
    useEffect(() => {
        if (showCustomizer) {
            setCustomizerTab(isSurvivFamily ? 'surviv' : (isSlitherFamily ? 'slither' : 'agar'));
        }
    }, [showCustomizer, isSlitherFamily, isSurvivFamily]);

    const tierOptions = isSurvivMode
        ? SURVIV_ENTRY_TIERS
        : isCompetitiveSlitherMode
            ? COMPETITIVE_ENTRY_TIERS
            : (isBattleRoyaleMode ? BR_ENTRY_TIERS : ENTRY_TIERS);

    const defaultEntryFeeForMode = isSurvivMode
        ? DEFAULT_SURVIV_ENTRY_FEE
        : isCompetitiveSlitherMode
            ? DEFAULT_COMPETITIVE_ENTRY_FEE
            : isBattleRoyaleMode
                ? DEFAULT_BR_ENTRY_FEE
                : DEFAULT_ENTRY_FEE;

    const freePlay = !!user?.freePlay || publicFreeMode;

    useEffect(() => {
        setPublicFreeModeEnabled(publicFreeMode);
        if (publicFreeMode) localStorage.removeItem('admin_free_surviv_entry');
    }, [publicFreeMode]);

    useEffect(() => {
        if (isAlreadyInGame) return;
        if (publicFreeMode && (!selectedMode || isBattleRoyaleMode)) {
            setPublicFreeMode(false);
            return;
        }
        if (!freePlay || !selectedMode || isBattleRoyaleMode) return;
        if (selectedEntryFee !== fixedFreeModeEntryFee) {
            setSelectedEntryFee(fixedFreeModeEntryFee);
        }
    }, [freePlay, publicFreeMode, isAlreadyInGame, selectedMode, isBattleRoyaleMode, fixedFreeModeEntryFee, selectedEntryFee]);

    useEffect(() => {
        if (selectedEntryFee !== null && !tierOptions.includes(selectedEntryFee)) {
            setSelectedEntryFee(defaultEntryFeeForMode);
        }
    }, [selectedMode, selectedEntryFee, tierOptions, defaultEntryFeeForMode]);

    useEffect(() => {
        const raw = localStorage.getItem('selected_gamemode');
        if (!raw || !isBRGamemode(raw)) return;
        if (isAlreadyInGame) return;

        if (brAvailable) {
            setSelectedMode(raw);
            return;
        }

        const normalized = normalizeGamemodeForLobby(raw, false);
        setSelectedMode(normalized);
        localStorage.setItem('selected_gamemode', normalized);
    }, [user?.isAdmin, brAvailable, isAlreadyInGame]);


    const displayedPlayersByGamemode = liveStats.displayPlayersByGamemode || liveStats.playersByGamemode || {};
    const pregamePlayingCount = getGamemodePlayingCount(displayedPlayersByGamemode, selectedMode);
    const globalCashoutTotalUsd =
        liveStats.globalPlayerEarningsUsd
        ?? liveStats.totalUserBalanceUsd
        ?? leaderboardData.globalEarningsUsd
        ?? 0;

    const balanceSol = user?.balanceSol || 0;
    const balanceUsd = user?.balanceUsd ?? (balanceSol * solPrice);
    const isNormal5 = entryFeeForSession === 5 && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode;
    const hasFreeTicket = hasUnlockedFreeTicket(user);
    const canJoin = !!selectedMode && selectedEntryFee !== null && (freePlay || (isNormal5 && hasFreeTicket) || balanceUsd >= entryFeeForSession);

    // ── Format helpers ─────────────────────────────────
    const fmt = formatWalletBalanceAmount;
    const renderEntryFee = (feeUsd, logoSize = 11) => (
        isCurSOL && solPrice > 0 ? (
            <span className="lobby-tier-btn__amount">
                <SolLogo size={logoSize} />
                {formatGameSolAmount(Number(feeUsd) / solPrice)}
            </span>
        ) : `$${feeUsd}`
    );

    const shortAddr = (addr, chars = 5) =>
        addr && addr.length > chars * 2 + 3
            ? `${addr.slice(0, chars)}…${addr.slice(-chars)}`
            : addr;

    const statusClass = statusMsg.startsWith('✅') || statusMsg.includes('copied')
        ? 'success' : statusMsg.startsWith('❌') ? 'error' : 'info';

    const handleLeaderboardScroll = useCallback(() => {
        const el = leaderboardListRef.current;
        if (!el) return;
        el.classList.add('leaderboard-list--scrolling');
        clearTimeout(leaderboardScrollHideRef.current);
        leaderboardScrollHideRef.current = setTimeout(() => {
            el.classList.remove('leaderboard-list--scrolling');
        }, 700);
    }, []);

    // ── Effects ────────────────────────────────────────
    useEffect(() => {
        if (location.pathname === '/agar') {
            setPageSeo(SEO.agar);
            return;
        }
        if (location.pathname === '/slither') {
            setPageSeo(SEO.slither);
            return;
        }
        setPageSeo(SEO.home);
    }, [location.pathname]);


    useEffect(() => {
        setIsValidWithdrawAddress(withdrawAddress ? SOL_ADDR_REGEX.test(withdrawAddress) : true);
    }, [withdrawAddress]);

    useEffect(() => {
        if (!isWalletExpanded) setPanelPos({ x: null, y: 60 });
    }, [isWalletExpanded]);

    useEffect(() => {
        if (!isWithdrawExpanded) setPanelPos({ x: null, y: 120 });
    }, [isWithdrawExpanded]);

    useEffect(() => {
        if (qrRef.current && depositAddress && isWalletExpanded) {
            qrRef.current.innerHTML = '';
            try {
                const qr = createQR(
                    `solana:${depositAddress}?amount=0&label=Arenifi&message=Deposit`,
                    190, 'white', 'black'
                );
                qr.append(qrRef.current);
            } catch (e) { }
        }
        return () => { if (qrRef.current) qrRef.current.innerHTML = ''; };
    }, [depositAddress, isWalletExpanded]);

    // Click outside
    const handleClickOutside = useCallback((e) => {
        const walletOpen = !!document.querySelector('.wallet-adapter-modal');
        if (walletOpen) return;
        const path = e.composedPath?.() || [];
        const isWalletAdapter = path.some(el =>
            el instanceof HTMLElement &&
            el.className?.toString?.().includes?.('wallet-adapter')
        );

        if (userMenuRef.current && !userMenuRef.current.contains(e.target) &&
            userPillRef.current && !userPillRef.current.contains(e.target)) {
            setShowUserMenu(false);
        }
        if (walletDropRef.current && !walletDropRef.current.contains(e.target) &&
            !e.target.closest('#balance-pill')) {
            setIsWalletOpen(false);
        }
        if (walletExpandRef.current && !walletExpandRef.current.contains(e.target) && !isWalletAdapter) {
            setIsWalletExpanded(false);
        }
        if (withdrawExpandRef.current && !withdrawExpandRef.current.contains(e.target) && !isWalletAdapter) {
            setIsWithdrawExpanded(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    // Live stats poll — gamemode counts + site presence
    useEffect(() => {
        let alive = true;
        const fetchStats = async () => {
            try {
                const r = await fetch(API_URL + '/api/stats?t=' + Date.now(), {
                    headers: {
                        'bypass-tunnel-reminders': 'true',
                        'Cache-Control': 'no-cache',
                        ...buildPresenceHeaders({
                            page: location.pathname,
                            gamemode: selectedMode,
                        }),
                    },
                });
                if (r.ok && alive) setLiveStats(await r.json());
            } catch { }
        };
        fetchStats();
        const id = setInterval(fetchStats, 5000);
        return () => { alive = false; clearInterval(id); };
    }, [API_URL, location.pathname, selectedMode]);

    // Leaderboard poll
    useEffect(() => {
        let alive = true;
        const fetchLeaderboard = async () => {
            try {
                const r = await fetch(`${API_URL}/api/leaderboard?t=${Date.now()}`, {
                    headers: { 'bypass-tunnel-reminders': 'true', 'Cache-Control': 'no-cache' }
                });
                if (r.ok && alive) {
                    const d = await r.json();
                    setLeaderboardData({
                        alltime: d.alltime || [],
                        week: d.week || [],
                        globalEarningsUsd: d.globalEarningsUsd ?? 0,
                    });
                }
            } catch { }
        };
        fetchLeaderboard();
        const id = setInterval(fetchLeaderboard, 90000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    // Live leaderboard events (cashouts/deaths)
    useEffect(() => {
        let alive = true;
        const fetchLiveLeaderboard = async () => {
            try {
                const r = await fetch(`${API_URL}/api/leaderboard-live?t=${Date.now()}`, {
                    headers: { 'bypass-tunnel-reminders': 'true', 'Cache-Control': 'no-cache' }
                });
                if (!r.ok || !alive) return;
                const d = await r.json();
                const events = Array.isArray(d.events) ? d.events : [];

                const latestId = events[0]?.id || null;
                if (latestId) {
                    if (liveTabSeenIdRef.current == null) {
                        liveTabSeenIdRef.current = latestId;
                    } else if (latestId !== liveTabSeenIdRef.current) {
                        if (leaderboardTab === 'alltime') {
                            setLiveTabPulse(true);
                            setTimeout(() => setLiveTabPulse(false), 900);
                        }
                        liveTabSeenIdRef.current = latestId;
                    }
                }

                setLiveLeaderboardEvents(events);
            } catch { }
        };

        fetchLiveLeaderboard();
        const id = setInterval(fetchLiveLeaderboard, 3000);
        return () => { alive = false; clearInterval(id); };
    }, [API_URL, leaderboardTab]);

    // AuthContext owns the shared balance poll. Keep one immediate route refresh
    // without starting a second interval for the same account.
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);
    // Game status — poll so rejoin button stays accurate
    useEffect(() => {
        if (!token) {
            setIsAlreadyInGame(false);
            setCurrentGameMode(null);
            return;
        }

        let alive = true;
        const checkGameStatus = async () => {
            try {
                const r = await fetch(`${API_URL}/api/game-status?t=${Date.now()}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'bypass-tunnel-reminders': 'true',
                        'Cache-Control': 'no-cache',
                    },
                });
                if (!r.ok || !alive) return;
                const d = await r.json();

                setIsAlreadyInGame(!!d.inGame);

                if (d.inGame && d.mode) {
                    setCurrentGameMode(d.mode);
                    setSelectedMode(d.mode);
                    setPublicFreeMode(d.freeMode === true);
                    setActiveGameBalance(d.balance ?? null);
                    if (d.entryFeeUsd) {
                        setActiveEntryFee(d.entryFeeUsd);
                        setSelectedEntryFee(d.entryFeeUsd);
                    }
                    localStorage.setItem('current_game_mode', d.mode);
                    localStorage.setItem('selected_gamemode', d.mode);
                    if (d.entryFeeUsd) localStorage.setItem('selected_entry_fee', String(d.entryFeeUsd));
                } else if (r.ok) {
                    setCurrentGameMode(null);
                    setActiveGameBalance(null);
                    setActiveEntryFee(null);
                    localStorage.removeItem('current_game_mode');
                    if (freshSelectionPendingRef.current) {
                        modeSelectionMadeRef.current = false;
                        setSelectedMode(null);
                        setSelectedEntryFee(null);
                        freshSelectionPendingRef.current = false;
                    }
                }
            } catch { /* ignore */ }
        };

        checkGameStatus();
        const id = setInterval(checkGameStatus, 10000);
        const onFocus = () => checkGameStatus();
        window.addEventListener('focus', onFocus);

        return () => {
            alive = false;
            clearInterval(id);
            window.removeEventListener('focus', onFocus);
        };
    }, [token, API_URL, user?.isAdmin]);

    // ── Drag panel ─────────────────────────────────────
    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e) => {
            const cx = e.clientX ?? e.touches?.[0]?.clientX;
            const cy = e.clientY ?? e.touches?.[0]?.clientY;
            if (cx == null) return;
            setPanelPos({
                x: Math.max(16, Math.min(window.innerWidth - 330, cx - dragOffsetRef.current.x)),
                y: Math.max(16, Math.min(window.innerHeight - 200, cy - dragOffsetRef.current.y)),
            });
        };
        const onStop = () => setIsDragging(false);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onStop);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onStop);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onStop);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onStop);
        };
    }, [isDragging]);

    const startDrag = useCallback((e) => {
        if (window.innerWidth <= 768) return;
        const cx = e.clientX ?? e.touches?.[0]?.clientX;
        const cy = e.clientY ?? e.touches?.[0]?.clientY;
        const panel = (walletExpandRef.current || withdrawExpandRef.current);
        const rect = panel?.getBoundingClientRect();
        if (!rect || cx == null) return;
        e.preventDefault();
        dragOffsetRef.current = { x: cx - rect.left, y: cy - rect.top };
        setIsDragging(true);
    }, []);

    const attemptsUsed = tournament?.me?.entries || 0;
    const maxTournamentAttempts = tournament?.maxAttempts ?? 3;
    const attemptsRemaining = tournament?.me?.attemptsRemaining ?? maxTournamentAttempts;
    const canPlayTournament = tournament?.status === 'live' && attemptsRemaining > 0;
    const tournamentStatusText = (() => {
        if (!tournament) return '';
        if (tournament.status === 'scheduled') return `Tournament starting in ${formatCountdown(tournament.startAt, tournamentNow)}`;
        if (tournament.status === 'live') return `Tournament ends in ${formatCountdown(tournament.endAt, tournamentNow)}`;
        if (tournament.status === 'ended') return 'Tournament ended';
        return tournament.status;
    })();

    const playTournament = () => {
        if (!canPlayTournament) return;
        clearAllPendingResults();
        localStorage.setItem('current_game_mode', 'tournament-slither');
        localStorage.setItem('selected_gamemode', 'tournament-slither');
        localStorage.setItem('selected_entry_fee', '1');
        localStorage.setItem('current_tournament_id', tournament.id);
        navigate('/slither-game', {
            state: {
                selectedMode: 'tournament-slither',
                tournamentId: tournament.id,
                nickname: user?.username || nickname,
            },
        });
    };

    // ── Handlers ───────────────────────────────────────
    const handleStartMatch = () => {
        if (!isAuthenticated) { navigate('/login'); return; }
        if (!selectedMode) return;

        if (isAlreadyInGame && !canRejoinThisMode) return;

        if (!canJoin && !isAlreadyInGame) {
            navigate('/lobby', { state: { depositIntent: true, selectedMode, requiredBalanceUsd: entryFeeForSession } });
            return;
        }

        trackMixpanelEvent('game_started', {
            mode: selectedMode,
            entry_fee_usd: entryFeeForSession,
            free_mode: freePlay,
            is_battle_royale: isBattleRoyaleMode,
            is_rejoin: isAlreadyInGame && canRejoinThisMode,
            platform: 'web',
        });

        setIsMatchmaking(true);
        refreshUser();
        localStorage.setItem('match_nickname', nickname);
        localStorage.setItem('selected_entry_fee', String(entryFeeForSession));
        setPublicFreeModeEnabled(freePlay);
        localStorage.removeItem('admin_free_surviv_entry');

        // Use Free Ticket check
        const isNormal5 = entryFeeForSession === 5 && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode;
        const hasFreeTicket = hasUnlockedFreeTicket(user);
        if (!isAlreadyInGame && isNormal5 && hasFreeTicket) {
            localStorage.setItem('use_free_ticket', 'true');
        } else {
            localStorage.removeItem('use_free_ticket');
        }

        const activeMode = (isAlreadyInGame && currentGameMode) ? currentGameMode : selectedMode;
        markGamemodePlayed(activeMode);
        setCurrentGameMode(activeMode);
        localStorage.setItem('current_game_mode', activeMode);
        localStorage.setItem('selected_gamemode', activeMode);

        const isBR = isBRGamemode(activeMode) && brAvailable;
        if (isBR) {
            const variant = activeMode.replace(/^br-/, '');
            if (isAlreadyInGame && canRejoinThisMode) {
                const path = variant === 'slither' ? '/slither-game' : '/game';
                setTimeout(() => navigate(path, {
                    state: { nickname, battleRoyale: true },
                }), 400);
                return;
            }
            setTimeout(() => navigate('/br-lobby', {
                state: {
                    nickname,
                    variant,
                    entryFeeUsd: entryFeeForSession,
                },
            }), 800);
            return;
        }

        const targetPath = activeMode === 'surviv'
            ? '/surviv-game'
            : (activeMode === 'slither' || activeMode === 'competitive-slither')
                ? '/slither-game'
                : '/game';
        const baseMode = activeMode.replace(/^br-/, '');
        setTimeout(() => navigate(targetPath, {
            state: {
                nickname,
                selectedMode: baseMode,
                useFreeTicket: !isAlreadyInGame && isNormal5 && hasFreeTicket,
                publicFreeMode: !isAlreadyInGame && freePlay,
            },
        }), 1200);
    };

    const normalizeMode = (mode) => (mode || '').replace(/^br-/, '');
    const canRejoinThisMode = isAlreadyInGame && currentGameMode
        && normalizeMode(selectedMode) === normalizeMode(currentGameMode)
        && (activeEntryFee == null || activeEntryFee === entryFeeForSession);

    const handleWithdraw = async () => {
        if (!token) return;
        if (!withdrawAddress || !isValidWithdrawAddress) { setStatusMsg('❌ Invalid Solana address.'); return; }
        const parsed = parseFloat(withdrawAmount);
        if ((!withdrawAll && (!Number.isFinite(parsed) || parsed <= 0)) || (withdrawAll && balanceSol <= 0)) { setStatusMsg('❌ Enter a valid withdrawal amount.'); return; }
        const usdAmt = Number.isFinite(parsed) ? (isCurSOL ? parsed * solPrice : parsed) : 0;
        if (!withdrawAll && usdAmt < 1) { setStatusMsg('❌ Minimum withdrawal is $1.00'); return; }
        setStatusMsg('⏳ Processing withdrawal…');
        try {
            const r = await fetch(`${API_URL}/api/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ amountUSD: usdAmt, destinationAddress: withdrawAddress, withdrawAll })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || 'Withdrawal failed');
            await refreshUser();
            setStatusMsg('✅ Funds sent to your wallet!');
            setWithdrawAmount('');
            setWithdrawAll(false);
        } catch (e) { setStatusMsg(`❌ ${e.message}`); }
    };

    const openBugReport = () => {
        if (!token) {
            navigate('/login');
            return;
        }
        setBugReportStatus('');
        setShowBugReport(true);
    };

    const submitBugReport = async (event) => {
        event.preventDefault();
        const message = bugReportMessage.trim();
        if (message.length < 3 || bugReportSubmitting) return;
        setBugReportSubmitting(true);
        setBugReportStatus('');
        try {
            const response = await fetch(`${API_URL}/api/bug-reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    message,
                    page: `${location.pathname}${location.search || ''}`,
                    gamemode: selectedMode || '',
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Could not submit the report.');
            setBugReportMessage('');
            setBugReportStatus('Thanks — your report is now in the admin dashboard.');
        } catch (error) {
            setBugReportStatus(error.message || 'Could not submit the report.');
        } finally {
            setBugReportSubmitting(false);
        }
    };

    // ── Panel position ─────────────────────────────────
    const panelStyle = {
        position: 'absolute',
        left: panelPos.x !== null ? panelPos.x : '50%',
        top: panelPos.y,
        transform: panelPos.x !== null ? 'none' : 'translateX(-50%)',
        cursor: isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : undefined,
    };

    // ── Play button variant ─────────────────────────────
    const playBtnClass = !isAuthenticated ? 'play-btn play-btn-login'
        : (isAlreadyInGame && canRejoinThisMode) ? 'play-btn play-btn-rejoin'
            : (isAlreadyInGame && !canRejoinThisMode) ? 'play-btn play-btn-disabled'
                : !selectedMode || selectedEntryFee === null ? 'play-btn play-btn-disabled'
                    : canJoin ? 'play-btn play-btn-ready'
                        : 'play-btn play-btn-disabled';

    const modeCardTitle = isSurvivFamily ? 'Surviv' : isSlitherFamily ? 'Slither' : 'Agar';
    const modeSubtitle = isBattleRoyaleMode
        ? 'Battle Royale'
        : isCompetitiveSlitherMode
            ? 'Arena'
            : 'Normal';
    const modeBaseName = modeSubtitle === 'Normal'
        ? `${modeCardTitle} Normal`
        : `${modeCardTitle} ${modeSubtitle}`;

    const playBtnLabel = isMatchmaking
        ? <><span className="spinner" /> {isBattleRoyaleMode ? 'Finding match…' : 'Joining…'}</>
        : !isAuthenticated ? 'Play Now'
            : (isAlreadyInGame && canRejoinThisMode)
                ? 'Rejoin'
                : (isAlreadyInGame && !canRejoinThisMode)
                    ? `In ${currentGameMode?.startsWith('br-') ? 'BR' : (currentGameMode === 'surviv' ? 'Surviv' : currentGameMode === 'slither' || currentGameMode === 'competitive-slither' ? 'Slither' : 'Agar')} — switch mode`
                    : !selectedMode
                        ? 'Choose Gamemode'
                        : selectedEntryFee === null
                        ? (isBattleRoyaleMode ? 'Select Entry Fee' : 'Select Entry Stake')
                        : canJoin ? (isBattleRoyaleMode ? 'Find Match' : 'Play')
                            : 'Deposit to Play';

    const showPlayIcon = !isMatchmaking && (
        !isAuthenticated ||
        (isAlreadyInGame && canRejoinThisMode) ||
        (!isAlreadyInGame && !!selectedMode && selectedEntryFee !== null)
    );
    const panelOpen = isWalletExpanded || isWithdrawExpanded;

    // ── Render ─────────────────────────────────────────
    return (
        <div className="page-shell page-shell--pregame">
            <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                <h1>Arenifi — {modeBaseName} multiplayer arenas</h1>
                <p>Play {modeBaseName}.io on Arenifi. Choose free play or a SOL-staked match, compete live, and cash out your balance.</p>
            </div>
            <PregameGameBackground
                mode={selectedMode}
                slitherColor={selectedSkin}
                agarColor={selectedSkinAgar}
                survivColor={selectedSkinSurviv}
                paused={showCustomizer}
            />

            <AppTopbar>
                {/* Nav right */}
                <div className="pregame-topbar-actions">
                    {isAuthenticated ? (
                        <>
                            <div className="agar-nav-balance-anchor">
                                <button
                                    type="button"
                                    className="agar-nav-balance"
                                    onClick={openCoinAndDismissLaunchHint}
                                    aria-label={agarLaunchReady ? `Buy ${agarConfig.symbol} with account balance` : `${agarConfig.symbol} Coming Soon`}
                                    title={agarLaunchReady ? `Exchange account SOL for ${agarConfig.symbol}` : 'Coming Soon'}
                                >
                                    <AgarLogo size={22} />
                                    <strong className="mono">
                                        {!agarLaunchReady
                                            ? 'Coming Soon'
                                            : agarBalanceLoading
                                                ? '…'
                                                : formatAgarAmount(agarBalance)}
                                    </strong>
                                    {agarLaunchReady && <span className="agar-nav-balance__add" aria-hidden="true">+</span>}
                                </button>
                                {showCoinLaunchHint && (
                                    <span className="agar-nav-launch-hint" aria-hidden="true">
                                        <svg viewBox="0 0 20 20"><path d="M3 16c4-1 7-4 9-9M8 7h4V3" /></svg>
                                        <b>NEW COIN</b>
                                    </span>
                                )}
                            </div>

                            {/* Balance pill */}
                            {(user?.balance || 0) > 0 && (
                                <div className="topbar-popover-anchor">
                                    <button
                                        id="balance-pill"
                                        className={`balance-pill mono${isWalletOpen ? ' balance-pill--open' : ''}`}
                                        onClick={() => { setIsWalletOpen(v => !v); setStatusMsg(''); }}
                                        aria-expanded={isWalletOpen}
                                        aria-haspopup="dialog"
                                    >
                                        <WalletIcon size={14} />
                                        {isCurSOL ? (
                                            <>
                                                <SolLogo size={12} />
                                                <span className="balance-pill__value">
                                                    {fmt(balanceSol)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="balance-pill__value">
                                                ${fmt(balanceUsd)}
                                            </span>
                                        )}
                                        <svg className="balance-pill__chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </button>

                                    {isWalletOpen && (
                                        <div ref={walletDropRef} className="wallet-card">
                                            {/* Header row */}
                                            <div className="wallet-card-header">
                                                <button
                                                    className="wallet-card-history"
                                                    onClick={() => { setIsWalletOpen(false); navigate('/transactions'); }}
                                                >
                                                    History
                                                </button>
                                                <CurrencySwitchButton
                                                    value={isCurSOL ? 'SOL' : 'USD'}
                                                    onChange={v => setIsCurSOL(v === 'SOL')}
                                                />
                                            </div>

                                            {/* Balance */}
                                            <div className="wallet-card-balance">
                                                {isCurSOL && <SolLogo size={28} />}
                                                <span className={isCurSOL ? 'wallet-card-balance__with-logo' : undefined}>
                                                    {isCurSOL
                                                        ? fmt(balanceSol)
                                                        : `$${fmt(balanceUsd)}`}
                                                </span>
                                            </div>
                                            <div className="wallet-card-sub">
                                                {isCurSOL
                                                    ? `≈ $${fmt(balanceUsd)} USD`
                                                    : `≈ ${fmt(balanceSol)} SOL`}
                                            </div>

                                            {/* Action buttons */}
                                            <div className="wallet-card-actions">
                                                <button
                                                    className="btn btn-primary wallet-card-action"
                                                    onClick={() => {
                                                        trackMixpanelEvent('deposit_clicked', { source: 'wallet_menu', platform: 'web' });
                                                        setIsWalletOpen(false); setIsWithdrawExpanded(false); setIsWalletExpanded(true);
                                                    }}
                                                >
                                                    <DepositIcon />
                                                    <span>Deposit</span>
                                                </button>
                                                <button
                                                    className="btn btn-ghost wallet-card-action"
                                                    onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(false); setIsWithdrawExpanded(true); }}
                                                >
                                                    <WithdrawIcon />
                                                    <span>Withdraw</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                            {/* Deposit button */}
                            <button
                                className="nav-deposit-btn nav-deposit-btn--compact nav-deposit-btn--deposit"
                                onClick={() => {
                                    trackMixpanelEvent('deposit_clicked', { source: 'nav_button', platform: 'web' });
                                    setIsWalletOpen(false);
                                    setIsWithdrawExpanded(false);
                                    setIsWalletExpanded(true);
                                }}
                            >
                                <span className="nav-deposit-btn-text">{(user?.balance || 0) === 0 ? '+ Add funds' : 'Deposit'}</span>
                            </button>

                            {/* User avatar pill */}
                            <div className="topbar-popover-anchor">
                                <button
                                    type="button"
                                    ref={userPillRef}
                                    className={`user-pill${showUserMenu ? ' active' : ''}`}
                                    onClick={() => setShowUserMenu(v => !v)}
                                    aria-label="Open account menu"
                                    aria-expanded={showUserMenu}
                                    aria-haspopup="menu"
                                >
                                    <div className="avatar">
                                        {user?.username?.charAt(0).toUpperCase()}
                                    </div>
                                </button>

                                {showUserMenu && (
                                    <div ref={userMenuRef} className="user-menu">
                                        <div className="user-menu-header">{user?.username}</div>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/profile', { state: { tab: 'profile' } }); }}>Profile</button>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/profile', { state: { tab: 'stats' } }); }}>Stats</button>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/transactions'); }}>Transactions</button>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/rewards#affiliate-rewards'); }}>Refer & Earn</button>
                                        <div className="user-menu-mobile-links">
                                            <div className="user-menu-divider" />
                                            <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/how-it-works'); }}>How it Works</button>
                                            <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/faq'); }}>FAQ</button>
                                            <a className="user-menu-item" href="mailto:support@arenifi.fun" onClick={() => setShowUserMenu(false)}>Support</a>
                                            <div className="user-menu-status"><span className="live-dot" />EU-West · Online</div>
                                        </div>
                                        <button className="user-menu-item danger" onClick={logout}>Log Out</button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <button className="nav-deposit-btn" onClick={() => navigate('/login')}>
                            Login
                        </button>
                    )}
                </div>
            </AppTopbar>

            {panelOpen && (
                <div
                    className="panel-backdrop"
                    aria-hidden="true"
                    onClick={() => {
                        setIsWalletExpanded(false);
                        setIsWithdrawExpanded(false);
                        setStatusMsg('');
                    }}
                />
            )}

            {/* ── Deposit Float Panel ── */}
            {isWalletExpanded && (
                <div ref={walletExpandRef} className="float-panel" style={panelStyle}>
                    <div
                        className="float-panel-header float-panel-header--draggable"
                        onMouseDown={startDrag}
                        onTouchStart={startDrag}
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                        <span className="float-panel-title">Deposit Funds</span>
                        <button className="float-panel-close" onClick={() => { setIsWalletExpanded(false); setStatusMsg(''); }}>✕</button>
                    </div>

                    <div className="deposit-address-card">
                        <div ref={qrRef} className="qr-container" />
                        <div className="deposit-address-card__body">
                            <div className="label deposit-address-card__label">Deposit Address</div>
                            <div className="mono deposit-address-card__value">
                                {depositAddress || 'Generating…'}
                            </div>
                            <button
                                type="button"
                                onClick={() => { if (depositAddress) navigator.clipboard.writeText(depositAddress); setStatusMsg('✅ Address copied!'); }}
                                className="deposit-address-card__copy"
                            >
                                Copy address
                            </button>
                        </div>
                    </div>

                    {statusMsg && <div className={`status-msg ${statusClass}`}>{statusMsg}</div>}
                    <div className="float-panel-note">
                        Custodial · Secure Processing
                    </div>
                </div>
            )}

            {/* ── Withdraw Float Panel ── */}
            {isWithdrawExpanded && (
                <div ref={withdrawExpandRef} className="float-panel" style={{ ...panelStyle, top: panelPos.y + 20 }}>
                    <div
                        className="float-panel-header float-panel-header--draggable"
                        onMouseDown={startDrag}
                        onTouchStart={startDrag}
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                        <span className="float-panel-title">Withdraw Funds</span>
                        <button className="float-panel-close" onClick={() => { setIsWithdrawExpanded(false); setStatusMsg(''); }}>✕</button>
                    </div>

                    <div className="withdraw-form">
                        {/* Address */}
                        <div>
                            <div className="label withdraw-form__label">Destination Address</div>
                            <div className="withdraw-address-field">
                                <input
                                    type="text"
                                    placeholder="Paste Solana address"
                                    value={displayFullAddress ? withdrawAddress : shortAddr(withdrawAddress)}
                                    onChange={e => setWithdrawAddress(e.target.value)}
                                    onFocus={() => setDisplayFullAddress(true)}
                                    onBlur={() => setDisplayFullAddress(false)}
                                    className={`amount-input withdraw-address-input${!isValidWithdrawAddress ? ' withdraw-address-input--invalid' : ''}`}
                                />
                                <div className="withdraw-address-field__icon">
                                    <SolLogo size={11} />
                                </div>
                            </div>
                            {!isValidWithdrawAddress && (
                                <div className="withdraw-form__error">
                                    Invalid Solana address
                                </div>
                            )}
                        </div>

                        {/* Amount */}
                        <div>
                            <div className="withdraw-form__row">
                                <span className="label">Amount</span>
                                <CurrencySwitchButton
                                    value={isCurSOL ? 'SOL' : 'USD'}
                                    onChange={v => {
                                        setIsCurSOL(v === 'SOL');
                                        setWithdrawAll(false);
                                    }}
                                />
                            </div>
                            <div className="amount-field">
                                <span className="amount-prefix">
                                    {isCurSOL ? <SolLogo size={13} /> : <span>$</span>}
                                </span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={withdrawAmount}
                                    onChange={e => {
                                        setWithdrawAmount(e.target.value);
                                        setWithdrawAll(false);
                                    }}
                                    className="amount-input withdraw-amount-input"
                                />
                                <button
                                    type="button"
                                    className="amount-max-btn"
                                    onClick={() => {
                                        setWithdrawAmount(isCurSOL ? balanceSol.toFixed(9) : balanceUsd.toFixed(6));
                                        setWithdrawAll(true);
                                    }}
                                >
                                    MAX
                                </button>
                            </div>
                            <div className="amount-hint">
                                {isCurSOL
                                    ? `≈ $${(parseFloat(withdrawAmount || 0) * solPrice).toFixed(2)}`
                                    : `≈ ${(parseFloat(withdrawAmount || 0) / solPrice).toFixed(2)} SOL`}
                            </div>
                        </div>

                        <button className="btn btn-primary withdraw-submit" onClick={handleWithdraw}>
                            Withdraw
                        </button>
                    </div>

                    {statusMsg && <div className={`status-msg ${statusClass}`}>{statusMsg}</div>}
                    <div className="float-panel-note">
                        Custodial · Secure Transfer
                    </div>
                </div>
            )}

            {/* ── Main layout ── */}
            {!isAuthenticated && <GuestWelcomeBanner />}

            {tournamentId && tournamentLoading ? (
                <div className="tournament-empty" style={{ margin: '15vh auto', maxWidth: 520, textAlign: 'center', color: 'var(--text-2)' }}>
                    <span className="spinner" style={{ marginRight: 8 }} />
                    Loading tournament lobby…
                </div>
            ) : (
                <div className={tournamentId ? "pre-game-grid pre-game-grid--tournament" : "pre-game-grid"}>
                    {/* Left Column */}
                    {tournamentId ? (
                        <div className="mode-card mode-card--tournament" ref={modeCardRef}>
                            <img
                                src="/normal slither.png"
                                alt=""
                                className="mode-card-preview"
                                style={{ opacity: 0.15, filter: 'blur(2px)' }}
                            />

                            <div className="mode-card-overlay" style={{ zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', padding: '24px' }}>
                                <div className="mode-card-header">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="tournament-live-badge-orange">
                                            <span className="tournament-live-dot-orange" />
                                            {tournament?.status === 'live' ? 'Live now' : tournament?.status === 'ended' ? 'Ended' : 'Scheduled'}
                                        </span>
                                    </div>
                                    <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-h)', marginTop: '16px', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                                        {tournament?.name || 'Tournament'}
                                    </h1>
                                    <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginTop: '4px' }}>
                                        {tournamentStatusText}
                                    </div>
                                </div>

                                <div style={{ margin: 'auto 0', padding: '16px 0' }}>
                                    <span className="mode-card-label" style={{ fontSize: '0.62rem', letterSpacing: '0.08em', color: 'var(--text-3)' }}>Your tournament balance</span>
                                    <div style={{ color: '#34d399', fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-.05em', margin: '4px 0 2px', textShadow: '0 0 15px rgba(16, 185, 129, 0.25)' }}>
                                        ${(tournament?.me?.balanceUsd || 0).toFixed(2)}
                                    </div>
                                    <p style={{ color: 'var(--text-3)', fontSize: '0.65rem', lineHeight: '1.4', margin: 0 }}>
                                        Banked cashouts across all 5 runs are accumulated here.
                                    </p>
                                </div>

                                <div className="mode-card-footer" style={{ marginTop: 'auto' }}>
                                    <button
                                        type="button"
                                        className="mode-card-action"
                                        onClick={() => navigate('/tournaments')}
                                        style={{ width: '100%', borderColor: 'rgba(249, 115, 22, 0.4)', background: 'rgba(249, 115, 22, 0.05)', color: 'var(--text-h)' }}
                                    >
                                        Change Tournament
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <PregameGamemodeSelector
                            selectedMode={selectedMode}
                            brAvailable={brAvailable}
                            playersByGamemode={displayedPlayersByGamemode}
                            heroPlayingCount={pregamePlayingCount}
                            guideSelection={isAuthenticated && !isAlreadyInGame}
                            entryFeeLabel={freePlay
                                ? 'FREE'
                                : entryFeeForSession != null
                                    ? formatUsd(entryFeeForSession)
                                    : `From ${formatUsd(Math.min(...tierOptions))}`}
                            onSelectMode={(modeId) => {
                                if (isBRGamemode(modeId) && !brAvailable) return;
                                const nextMode = normalizeGamemodeForLobby(modeId, !!user?.isAdmin);
                                modeSelectionMadeRef.current = true;
                                localStorage.setItem('selected_gamemode', nextMode);
                                setSelectedEntryFee(null);
                                setSelectedMode(nextMode);
                            }}
                            cardRef={modeCardRef}
                        />
                    )}

                    {/* Center Column */}
                    {tournamentId ? (
                        <div className="center-panel-stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                            {tournamentError && (
                                <div className="tournament-ended-callout" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#fecaca', margin: 0 }}>
                                    {tournamentError}
                                </div>
                            )}

                            {tournament?.status === 'ended' && (
                                <div className="tournament-ended-callout" style={{ margin: 0 }}>
                                    <strong>Tournament ended.</strong>{' '}
                                    {tournament.me?.winningsUsd > 0
                                        ? `You placed #${tournament.me.placement} and have $${tournament.me.winningsUsd.toFixed(2)} ready in Rewards.`
                                        : `Your final tournament balance was $${tournament.me?.balanceUsd?.toFixed(2) || '0.00'}.`}
                                    {tournament.me?.winningsUsd > 0 && (
                                        <button className="tournament-secondary-btn" style={{ marginLeft: 14, border: '1px solid rgba(34, 197, 94, 0.4)', background: 'rgba(255,255,255,0.04)' }} onClick={() => navigate('/rewards')}>
                                            Claim in Rewards
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="game-card main-card" ref={mainCardRef}>
                                <div className="pregame-nickname-block">
                                    <label className="label" style={{ display: 'block', marginBottom: '5px' }}>
                                        Nickname
                                    </label>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={e => setNickname(e.target.value)}
                                        maxLength={15}
                                        placeholder="Enter name…"
                                        className="nickname-input"
                                    />
                                </div>

                                <div className="divider" style={{ marginBottom: '14px' }} />

                                <div className="entry-row" style={{ marginBottom: '14px' }}>
                                    <span className="label">Entry fee</span>
                                    <span className="mono" style={{ color: 'var(--text-h)', fontSize: '0.85rem', fontWeight: 700 }}>
                                        $1.00 per attempt
                                    </span>
                                </div>

                                <div className="tournament-attempts-block">
                                    <div className="tournament-attempts-head">
                                        <span className="label">Attempts Tracker</span>
                                        <span className="mono" style={{ color: 'var(--text-2)' }}>{attemptsRemaining} left</span>
                                    </div>
                                    <div className="tournament-attempts tournament-attempts--pregame">
                                        {Array.from({ length: maxTournamentAttempts }, (_, index) => (
                                            <span key={index} className={`tournament-attempt-dot${index < attemptsUsed ? ' tournament-attempt-dot--used' : ''}`} />
                                        ))}
                                    </div>
                                </div>

                                <div className="divider" style={{ marginBottom: '20px' }} />

                                <button
                                    className={canPlayTournament ? "play-btn play-btn-ready" : "play-btn play-btn-disabled"}
                                    disabled={!canPlayTournament}
                                    onClick={playTournament}
                                >
                                    <PlayIcon />
                                    <span className="play-btn-label">Play $1</span>
                                </button>
                            </div>

                            {/* Customize Skin Card */}
                            {isAuthenticated && (
                                <div
                                    className="leaderboard-card customize-lobby-card"
                                    onClick={() => setShowCustomizer(true)}
                                    style={{ cursor: 'pointer', marginTop: 0 }}
                                >
                                    <div className="customize-lobby-card-header" style={{ position: 'relative' }}>
                                        {!hasSeenRainbow && <div className="notify-dot" style={{ right: '-8px', top: '-8px' }}></div>}
                                        <div className="customize-lobby-card-title-group">
                                            <svg className="customize-lobby-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.06 0 1.94-.92 1.94-2 0-.49-.18-.95-.5-1.3-.32-.34-.5-.81-.5-1.3 0-1.03.87-1.9 1.9-1.9H17c3.31 0 6-2.69 6-6 0-4.97-4.92-9-11-9z" />
                                                <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" />
                                                <circle cx="10" cy="7" r="1.5" fill="currentColor" />
                                                <circle cx="15" cy="7" r="1.5" fill="currentColor" />
                                                <circle cx="18.5" cy="11.5" r="1.5" fill="currentColor" />
                                            </svg>
                                            <span className="customize-lobby-title">Customize Appearance</span>
                                        </div>
                                        <span className="customize-lobby-status-pill" style={selectedSkin === 'random' ? { backgroundImage: 'linear-gradient(90deg, #ff4040, #ffa060, #eeee70, #80ff80, #80d0d0, #9099ff, #c080ff)' } : { backgroundColor: selectedSkin }}>
                                            {selectedSkin === 'random' ? 'Rainbow' : getChromaName(selectedSkin)}
                                        </span>
                                    </div>

                                    <div className="customize-lobby-preview-box">
                                        <SnakeSkinPreview color={selectedSkin} isLarge={false} active={!showCustomizer} />
                                    </div>

                                    <div className="customize-lobby-footer">
                                        <span>Click to Customize Skin</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="center-panel-stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                            <div className="game-card main-card pregame-play-card">
                                {/* Nickname field */}
                                <div style={{ marginBottom: '18px' }}>
                                    <label className="label" style={{ display: 'block', marginBottom: '5px' }}>
                                        Nickname
                                    </label>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={e => setNickname(e.target.value)}
                                        maxLength={15}
                                        placeholder="Enter name…"
                                        className="nickname-input"
                                    />
                                    <label
                                        htmlFor="hide-names-toggle"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <input
                                            id="hide-names-toggle"
                                            type="checkbox"
                                            checked={hideNames}
                                            onChange={e => {
                                                const val = e.target.checked;
                                                setHideNames(val);
                                                localStorage.setItem('hide_player_names', val ? 'true' : 'false');
                                            }}
                                            style={{ accentColor: '#9099ff', width: '11px', height: '11px', cursor: 'pointer', flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 500 }}>Turn off names</span>
                                    </label>
                                </div>

                                {/* Stake selection and simulated free room toggle */}
                                <div className="lobby-stake-selection">
                                    {!isBattleRoyaleMode && (
                                        <label className={`free-mode-option${freePlay ? ' free-mode-option--active' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={freePlay}
                                                disabled={!selectedMode || isAlreadyInGame || isMatchmaking || !!user?.freePlay}
                                                onChange={event => {
                                                    const enabled = event.target.checked;
                                                    setPublicFreeMode(enabled);
                                                    setSelectedEntryFee(enabled ? fixedFreeModeEntryFee : null);
                                                }}
                                            />
                                            <span className="free-mode-option__control" aria-hidden="true">
                                                <svg viewBox="0 0 12 10" fill="none">
                                                    <path d="m1.5 5 3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                            <span className="free-mode-option__copy">
                                                <strong>Free play</strong>
                                            </span>
                                        </label>
                                    )}
                                    <div className="lobby-tier-row">
                                        {tierOptions.map(tier => {
                                            const locked = isAlreadyInGame && activeEntryFee != null && tier !== activeEntryFee;
                                            const active = entryFeeForSession === tier;
                                            const isFreeCovered = freePlay && !isBattleRoyaleMode;
                                            const needsSelection = isAuthenticated && !!selectedMode && selectedEntryFee === null && !isAlreadyInGame;
                                            const isNormal5 = tier === 5 && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode;
                                            const hasFreeTicket = hasUnlockedFreeTicket(user);
                                            const isFreeTicketButton = isNormal5 && hasFreeTicket;

                                            return (
                                                <button
                                                    key={tier}
                                                    type="button"
                                                    className={`lobby-tier-btn${active && !isFreeCovered ? ' lobby-tier-btn--active' : ''}${locked ? ' lobby-tier-btn--locked' : ''}${needsSelection ? ' lobby-tier-btn--needs-selection' : ''}${isFreeCovered ? ' lobby-tier-btn--free-covered' : ''}`}
                                                    disabled={!selectedMode || locked || isMatchmaking || (freePlay && !isBattleRoyaleMode)}
                                                    onClick={() => !isAlreadyInGame && setSelectedEntryFee(tier)}
                                                >
                                                    {isFreeCovered ? (
                                                        <>
                                                            <span className="lobby-tier-btn__free-price">{renderEntryFee(tier, 10)}</span>
                                                            <span className="lobby-tier-btn__free-label">Free</span>
                                                        </>
                                                    ) : (isFreeTicketButton && !freePlay ? 'Free Ticket' : renderEntryFee(tier))}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedMode && !freePlay && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode && hasUnlockedFreeTicket(user) && (
                                        <div className="lobby-stake-note" aria-live="polite">
                                            ✨ free ticket available
                                        </div>
                                    )}
                                </div>

                                <button
                                    className={playBtnClass}
                                    onClick={handleStartMatch}
                                    disabled={isMatchmaking || (isAlreadyInGame && !canRejoinThisMode) || (isAuthenticated && !isAlreadyInGame && (!selectedMode || selectedEntryFee === null))}
                                >
                                    {showPlayIcon && <PlayIcon />}
                                    <span className="play-btn-label">{playBtnLabel}</span>
                                </button>

                                {isAlreadyInGame && currentGameMode && (
                                    <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--accent)', textAlign: 'center', fontWeight: 600 }}>
                                        Active session: {currentGameMode.startsWith('br-') ? 'Battle Royale' : (currentGameMode === 'slither' ? 'Slither' : 'Agar')}
                                        {activeEntryFee != null && !freePlay && ` · ${formatUsd(activeEntryFee)} entry`}
                                        {activeGameBalance != null && !currentGameMode.startsWith('br-') && ` · $${Number(activeGameBalance).toFixed(2)} in arena`}
                                    </div>
                                )}


                                <div className={`hiw-wrap${selectedMode ? '' : ' hiw-wrap--placeholder'}`} aria-hidden={!selectedMode}>
                                    <div
                                        className="hiw-toggle"
                                        onClick={() => selectedMode && setShowHowItWorks(v => !v)}
                                    >
                                        <span>Game details</span>
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                                            style={{ transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }}>
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </div>
                                    <div className={`hiw-dropdown${showHowItWorks ? ' hiw-dropdown--open' : ''}`}>
                                        <div className="hiw-content">
                                            {isSurvivMode ? (
                                                <>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Entry fee</span>
                                                        <span className="mono">{formatUsd(economyFeeForDisplay)}</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Starting balance</span>
                                                        <span className="mono">{formatUsd(economy.dollarStart)}</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Map loot pool</span>
                                                        <span className="mono">{formatUsd(economy.lootPoolOnJoin)}</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Cashout fee</span>
                                                        <span className="mono">{(economy.cashoutFeePct * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div style={{ marginTop: '8px', marginBottom: '4px', opacity: 0.5, fontSize: '0.6rem', lineHeight: 1.45 }}>
                                                        Top-down battle royale shooter. Your entry seeds cash across the map while you start at $0.
                                                        Loot weapons, armor, medkits, and cash from chests. Fight players and bots. Cash out anytime, or risk it all for more.
                                                    </div>
                                                </>
                                            ) : isCompetitiveSlitherMode ? (
                                                <>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Entry fee</span>
                                                        <span className="mono">{formatUsd(economyFeeForDisplay)}</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Starting dollars</span>
                                                        <span className="mono">{formatUsd(economy.dollarStart)}</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Cashout fee</span>
                                                        <span className="mono">{(economy.cashoutFeePct * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>You keep on cashout</span>
                                                        <span className="mono">{(economy.cashoutPlayerPct * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div style={{ marginTop: '8px', marginBottom: '4px', opacity: 0.5, fontSize: '0.6rem', lineHeight: 1.45 }}>
                                                        Real players only — ${economyFeeForDisplay} matches are a separate pool from other stakes.
                                                        Your entry becomes your starting dollar balance. Snake size (mass) is separate from dollars.
                                                        Kill snakes to pick up their dropped dollar loot. Cash out your dollar balance anytime after a short timer.
                                                        Die and your dollars drop on the map for others. The circular arena shrinks before each reset.
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Entry fee</span>
                                                        <span className="mono">{formatUsd(economyFeeForDisplay)}</span>
                                                    </div>
                                                    <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                        <span>Starting balance</span>
                                                        <span className="mono">{formatUsd(economy.startBalance)}</span>
                                                    </div>
                                                    <div style={{ marginTop: '8px', marginBottom: '4px', opacity: 0.5, fontSize: '0.6rem' }}>
                                                        Eat food & other players. Cash out anytime.
                                                    </div>
                                                    <div className="divider" style={{ margin: '6px 0' }} />
                                                    <div className="stat-row">
                                                        <span>Golden Blob value</span>
                                                        <span className="mono text-green">{formatUsd(economy.goldenBlobValue)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Customize Lobby Card */}
                            {isAuthenticated && (isSlitherFamily || isAgarFamily || isSurvivFamily) && (
                                <div
                                    className="leaderboard-card customize-lobby-card"
                                    onClick={() => setShowCustomizer(true)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="customize-lobby-card-header">
                                        <div className="customize-lobby-card-title-group">
                                            <svg className="customize-lobby-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.06 0 1.94-.92 1.94-2 0-.49-.18-.95-.5-1.3-.32-.34-.5-.81-.5-1.3 0-1.03.87-1.9 1.9-1.9H17c3.31 0 6-2.69 6-6 0-4.97-4.92-9-11-9z" />
                                                <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" />
                                                <circle cx="10" cy="7" r="1.5" fill="currentColor" />
                                                <circle cx="15" cy="7" r="1.5" fill="currentColor" />
                                                <circle cx="18.5" cy="11.5" r="1.5" fill="currentColor" />
                                            </svg>
                                            <span className="customize-lobby-title">Customize Appearance</span>
                                        </div>
                                        {isSurvivFamily ? (
                                            <span className="customize-lobby-status-pill" style={selectedSkinSurviv === 'random' ? { backgroundImage: 'linear-gradient(135deg, #80d0d0, #c080ff, #ffa060)' } : { backgroundColor: selectedSkinSurviv }}>
                                                {selectedSkinSurviv === 'random' ? 'Random' : getChromaName(selectedSkinSurviv)}
                                            </span>
                                        ) : isSlitherFamily ? (
                                            <span className="customize-lobby-status-pill" style={selectedSkin === 'random' ? { backgroundImage: 'linear-gradient(90deg, #ff4040, #ffa060, #eeee70, #80ff80, #80d0d0, #9099ff, #c080ff)' } : { backgroundColor: selectedSkin }}>
                                                {getChromaName(selectedSkin)}
                                            </span>
                                        ) : (
                                            <span className="customize-lobby-status-pill" style={selectedSkinAgar === 'random' ? { backgroundImage: 'linear-gradient(90deg, #ff4040, #ffa060, #eeee70, #80ff80, #80d0d0, #9099ff, #c080ff)' } : { backgroundColor: selectedSkinAgar }}>
                                                {getChromaName(selectedSkinAgar)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="customize-lobby-preview-box">
                                        {isSurvivFamily ? (
                                            <SurvivSkinPreview color={selectedSkinSurviv} isLarge={false} nickname={nickname} />
                                        ) : isSlitherFamily ? (
                                            <SnakeSkinPreview color={selectedSkin} isLarge={false} active={!showCustomizer} />
                                        ) : (
                                            <AgarBlobPreview color={selectedSkinAgar} isLarge={false} nickname={nickname} />
                                        )}
                                    </div>

                                    <div className="customize-lobby-footer">
                                        <span>Click to Customize Skin</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Right Column */}
                    {tournamentId ? (
                        <div className="right-panel-stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'stretch' }}>
                            <div className="leaderboard-card tournament-pulse-glow" style={{ flex: '1 1 auto', minHeight: 340, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '20px 20px 16px', background: 'rgba(249, 115, 22, 0.03)', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <span className="tournament-panel-label" style={{ fontSize: '0.65rem', letterSpacing: '0.08em', textAlign: 'center' }}>Total Prize Pot</span>
                                    </div>
                                    <div style={{ color: '#f97316', textShadow: '0 0 15px rgba(249, 115, 22, 0.3)', fontSize: '2rem', fontWeight: 950, letterSpacing: '-.04em', margin: '6px 0 12px', textAlign: 'center' }}>
                                        ${(tournament?.prizePotUsd || 0).toFixed(2)}
                                    </div>
                                    <div className="tournament-splits" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: 0 }}>
                                        <div className="tournament-split" style={{ padding: '8px 4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>1st<strong>60%</strong></div>
                                        <div className="tournament-split" style={{ padding: '8px 4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>2nd<strong>30%</strong></div>
                                        <div className="tournament-split" style={{ padding: '8px 4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>3rd<strong>10%</strong></div>
                                    </div>
                                </div>

                                <div className="tab-bar leaderboard-tab-bar" style={{ background: 'transparent', padding: '12px 20px 4px' }}>
                                    <span className="tournament-panel-label" style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--text-h)' }}>Live Standings</span>
                                </div>

                                {(tournament?.leaderboard || []).length === 0 ? (
                                    <div className="empty-state" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
                                        <div className="empty-state-icon" aria-hidden="true" style={{ fontSize: '1.4rem', marginBottom: '8px', color: '#f97316' }}>🏆</div>
                                        <p className="empty-state-title" style={{ fontSize: '0.78rem' }}>No cashouts yet</p>
                                        <p className="empty-state-sub" style={{ fontSize: '0.68rem' }}>Be the first to bank a cashout!</p>
                                    </div>
                                ) : (
                                    <div className="leaderboard-list" style={{ flexGrow: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
                                        {(tournament?.leaderboard || []).map((entry, index) => {
                                            const isTop3 = index < 3;
                                            
                                            // Assign background & border styling based on placement
                                            let bg = 'transparent';
                                            let border = '1px solid transparent';
                                            let digitColor = '#94a3b8'; // default gray for 4+
                                            
                                            if (index === 0) {
                                                bg = 'rgba(255, 215, 0, 0.08)';
                                                border = '1px solid rgba(255, 215, 0, 0.22)';
                                                digitColor = '#ffd700'; // Gold
                                            } else if (index === 1) {
                                                bg = 'rgba(203, 213, 225, 0.08)';
                                                border = '1px solid rgba(203, 213, 225, 0.22)';
                                                digitColor = '#cbd5e1'; // Silver
                                            } else if (index === 2) {
                                                bg = 'rgba(205, 127, 50, 0.08)';
                                                border = '1px solid rgba(205, 127, 50, 0.22)';
                                                digitColor = '#cd7f32'; // Bronze
                                            }
                                            
                                            return (
                                                <div 
                                                    key={`${entry.username}-${index}`} 
                                                    className="leaderboard-entry" 
                                                    style={{ 
                                                        margin: '0 8px 6px', 
                                                        padding: '10px 12px', 
                                                        borderRadius: '10px', 
                                                        background: bg, 
                                                        border: border,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isTop3 ? 'var(--text-h)' : 'var(--text-bright)', fontWeight: isTop3 ? 750 : 500 }}>
                                                        <span style={{ 
                                                            width: '20px', 
                                                            textAlign: 'center', 
                                                            color: digitColor, 
                                                            fontWeight: 900,
                                                            fontSize: '0.82rem',
                                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                            textShadow: 'none',
                                                            WebkitTextStroke: '0px transparent'
                                                        }}>
                                                            {index + 1}
                                                        </span>
                                                        {entry.username}
                                                    </span>
                                                    <span className="mono" style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                                                        ${entry.balanceUsd.toFixed(2)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="right-panel-stack">
                            <div className="leaderboard-card" style={{ height: leaderboardHeight }}>
                                <div className="tab-bar leaderboard-tab-bar">
                                    {[{ id: 'alltime', label: 'Leaderboard' }, { id: 'live', label: 'LIVE', dot: true }].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setLeaderboardTab(tab.id)}
                                            className={[
                                                'tab-btn',
                                                leaderboardTab === tab.id ? 'active' : '',
                                                tab.id === 'live' ? 'tab-btn--live' : '',
                                                tab.id === 'live' && liveTabPulse ? 'tab-btn-live-pulse' : '',
                                            ].filter(Boolean).join(' ')}
                                        >
                                            {tab.dot && <span className="live-dot live-dot--tab" aria-hidden="true" />}
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {(leaderboardTab === 'alltime' ? leaderboardData.alltime : liveLeaderboardEvents).length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon" aria-hidden="true">🏆</div>
                                        <p className="empty-state-title">No champions yet</p>
                                        <p className="empty-state-sub">Be the first to cash out big — your name goes here.</p>
                                    </div>
                                ) : (
                                    <div
                                        ref={leaderboardListRef}
                                        className={`leaderboard-list${leaderboardTab === 'live' ? ' leaderboard-list--live' : ''}`}
                                        onScroll={handleLeaderboardScroll}
                                    >
                                        {leaderboardTab === 'alltime' ? (
                                            leaderboardData.alltime.map((entry, i) => (
                                                <div key={i} className="leaderboard-entry">
                                                    <span style={{ color: i === 0 ? '#FFD700' : 'var(--text-bright)', fontWeight: i === 0 ? 700 : 500 }}>
                                                        {i + 1}. {entry.username}
                                                    </span>
                                                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-bright)' }}>
                                                        ${Number(entry.amount || entry.balance || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            liveLeaderboardEvents.map((event, i) => (
                                                <div key={event.id || i} className={`live-feed-item live-feed-item--${event.type}`}>
                                                    <div className="live-feed-icon" aria-hidden="true">
                                                        {event.type === 'cashout' ? (
                                                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                                                <path d="M6 9V3M6 3L3.5 5.5M6 3L8.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        ) : (
                                                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                                                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="live-feed-body">
                                                        <span className="live-feed-name">{event.username}</span>
                                                        <span className="live-feed-action">
                                                            {event.freePlay && <span className="live-feed-free-badge">Free play</span>}
                                                            {event.type === 'cashout' ? 'Cashed out' : 'Died with'}
                                                        </span>
                                                    </div>
                                                    <div className="live-feed-right">
                                                        <span className="live-feed-amount mono">${Number(event.amountUsd || 0).toFixed(2)}</span>
                                                        {event.createdAt && (
                                                            <span className="live-feed-time">{formatLiveTime(event.createdAt)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                                <div className="leaderboard-footer">
                                    <div className="divider" style={{ margin: '10px 0 8px' }} />
                                    <div className="leaderboard-total">
                                        <span className="leaderboard-total-label">Global earnings</span>
                                        <span className="mono leaderboard-total-value">
                                            ${Math.round(Number(globalCashoutTotalUsd))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom navigation bar */}
            <div className="pregame-bottom-dock">
                <div className="pregame-bottom-dock__left">
                    <a
                        className="pregame-discord-link pregame-discord-link--dock"
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Join our Discord server"
                        title="Join our Discord"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M19.5 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.02a15.1 15.1 0 0 0-5.87 0L8.56 4A16.5 16.5 0 0 0 4.5 5.35C1.93 9.15 1.23 12.85 1.58 16.5a16.6 16.6 0 0 0 4.98 2.52l1.2-1.65a10.6 10.6 0 0 1-1.89-.91l.46-.36c3.64 1.69 7.6 1.69 11.2 0l.47.36c-.6.36-1.24.67-1.9.91l1.2 1.65a16.5 16.5 0 0 0 4.98-2.52c.42-4.23-.72-7.9-2.78-11.16ZM8.52 14.3c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27c1.13 0 2.02 1.03 2 2.27 0 1.25-.88 2.27-2 2.27Zm6.96 0c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27c1.13 0 2.02 1.03 2 2.27 0 1.25-.87 2.27-2 2.27Z"
                            />
                        </svg>
                    </a>
                    <button
                        type="button"
                        className="pregame-bug-report-link"
                        aria-label="Report a bug"
                        title="Report a bug"
                        onClick={openBugReport}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8.5 9.5h7M8 13h8M9.5 16.5h5" />
                            <path d="M7.5 6.5 6 4.5M16.5 6.5l1.5-2M5 10H2.5M21.5 10H19M5 15H2.5M21.5 15H19" />
                            <rect x="5" y="6.5" width="14" height="13" rx="6" />
                        </svg>
                        <span>Report bug</span>
                    </button>
                    {!user?.affiliateActive && !user?.isAdmin && !user?.personalFreePlay && (
                        <Link
                            className="pregame-affiliate-link"
                            to="/rewards#affiliate-rewards"
                            aria-label="Become an affiliate"
                            title="Become an affiliate"
                        >
                            <span aria-hidden="true">$</span>
                            <span>Become Affiliate</span>
                        </Link>
                    )}
                </div>

                <div className="pregame-bottom-dock__center">
                    <AppFooter />
                </div>

                <div className="pregame-bottom-dock__right">
                    <RewardsWidget />
                </div>
            </div>

            {showBugReport && (
                <div className="bug-report-backdrop" role="presentation" onMouseDown={() => !bugReportSubmitting && setShowBugReport(false)}>
                    <form className="bug-report-modal" onSubmit={submitBugReport} onMouseDown={event => event.stopPropagation()}>
                        <div className="bug-report-modal__header">
                            <div>
                                <span>INTERNAL REPORT</span>
                                <h2>Report a bug</h2>
                            </div>
                            <button type="button" aria-label="Close bug report" disabled={bugReportSubmitting} onClick={() => setShowBugReport(false)}>×</button>
                        </div>
                        <p>Describe what happened. The message is sent directly to the Arenifi admin dashboard.</p>
                        <textarea
                            autoFocus
                            maxLength={2000}
                            value={bugReportMessage}
                            placeholder="What happened, and how can we reproduce it?"
                            onChange={event => {
                                setBugReportMessage(event.target.value);
                                if (bugReportStatus) setBugReportStatus('');
                            }}
                        />
                        <div className="bug-report-modal__meta">
                            <span>{selectedMode || 'pregame'}</span>
                            <span>{bugReportMessage.length}/2000</span>
                        </div>
                        {bugReportStatus && <div className="bug-report-modal__status" role="status">{bugReportStatus}</div>}
                        <div className="bug-report-modal__actions">
                            <button type="button" className="btn btn-ghost" disabled={bugReportSubmitting} onClick={() => setShowBugReport(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={bugReportMessage.trim().length < 3 || bugReportSubmitting}>
                                {bugReportSubmitting ? 'Sending…' : 'Send report'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Customizer Modal Overlay */}
            {showCustomizer && (() => {
                const getChromaName = (color) => {
                    const flagCode = parseFlagSkin(color);
                    if (flagCode) {
                        const flag = getFlagSkin(flagCode);
                        return `${flag.emoji} ${flag.name}`;
                    }
                    const specialNameSkin = getSlitherSpecialSkin(color);
                    if (specialNameSkin) return specialNameSkin.name;
                    if (color === 'random_color') return 'Random';
                    if (color === 'random') return customizerTab === 'surviv' ? 'Random' : 'Rainbow';
                    switch (color) {
                        case '#c080ff': return 'Lavender Purple';
                        case '#9099ff': return 'Indigo Blue';
                        case '#80d0d0': return 'Turquoise Cyan';
                        case '#80ff80': return 'Lime Green';
                        case '#eeee70': return 'Tinted Yellow';
                        case '#ffa060': return 'Orange';
                        case '#ff9050': return 'Pink Red';
                        case '#ff4040': return 'Dark Red';
                        case '#e030e0': return 'Magenta';
                        default: return color.toUpperCase();
                    }
                };

                const currentChroma = customizerTab === 'slither'
                    ? selectedSkin
                    : customizerTab === 'surviv'
                        ? selectedSkinSurviv
                        : selectedSkinAgar;
                const isRandomColor = currentChroma === 'random_color';
                const isRainbow = currentChroma === 'random' && customizerTab !== 'surviv';
                const activeFlagCode = parseFlagSkin(currentChroma);
                const isFlag = !!activeFlagCode && customizerTab !== 'surviv';
                const specialSkin = customizerTab === 'slither' ? getSlitherSpecialSkin(currentChroma) : null;
                const isSpecialSkin = !!specialSkin;
                const isRandomSelection = currentChroma === 'random' || currentChroma === 'random_color';
                const displayChroma = specialSkin ? specialSkin.colors[4] : (isRandomSelection || isFlag) ? '#80d0d0' : currentChroma;
                const rainbowProductId = customizerTab === 'slither' ? 'slither:rainbow' : 'agar:rainbow';
                const ownsRainbow = customizerTab !== 'surviv' && (user?.isAdmin || ownedSkinProducts.has(rainbowProductId));
                const ownsFlagPack = customizerTab !== 'surviv' && (user?.isAdmin || ownedSkinProducts.has('flags:bundle'));
                const ownedSpecialSkinIds = new Set(SLITHER_SPECIAL_SKINS.filter((skin) => user?.isAdmin || ownedSkinProducts.has(skin.productId)).map((skin) => skin.id));

                const cycleChroma = (direction) => {
                    if (isFlag) {
                        let index = FLAG_SKINS.findIndex((flag) => flag.code === activeFlagCode);
                        if (index === -1) index = 0;
                        const nextIndex = (index + direction + FLAG_SKINS.length) % FLAG_SKINS.length;
                        const value = flagSkinValue(FLAG_SKINS[nextIndex].code);
                        if (customizerTab === 'slither') setSelectedSkin(value);
                        else setSelectedSkinAgar(value);
                        return;
                    }
                    if (isRandomSelection) return;

                    const chromas = CHROMA_SKIN_COLORS;
                    let idx = chromas.indexOf(currentChroma);
                    if (idx === -1) idx = 0;

                    let nextIdx = idx + direction;
                    if (nextIdx < 0) nextIdx = chromas.length - 1;
                    if (nextIdx >= chromas.length) nextIdx = 0;

                    if (customizerTab === 'slither') {
                        setSelectedSkin(chromas[nextIdx]);
                    } else if (customizerTab === 'surviv') {
                        setSelectedSkinSurviv(chromas[nextIdx]);
                    } else {
                        setSelectedSkinAgar(chromas[nextIdx]);
                    }
                };

                const setSkinStyle = (style) => {
                    const requestedSpecialSkin = getSlitherSpecialSkin(style);
                    if ((style === 'rainbow' && !ownsRainbow) || (style === 'flags' && !ownsFlagPack) || (requestedSpecialSkin && !ownedSpecialSkinIds.has(requestedSpecialSkin.id))) {
                        setShowCustomizer(false);
                        navigate('/shop');
                        return;
                    }
                    let newSkin = style;
                    if (style === 'rainbow') newSkin = 'random';
                    else if (style === 'flags') newSkin = flagSkinValue(activeFlagCode || DEFAULT_FLAG_CODE);
                    else if (requestedSpecialSkin) newSkin = requestedSpecialSkin.value;
                    else if (style === 'classic') newSkin = '#c080ff';
                    
                    if (customizerTab === 'slither') setSelectedSkin(newSkin);
                    else if (customizerTab === 'surviv') setSelectedSkinSurviv(newSkin);
                    else setSelectedSkinAgar(newSkin);
                };

                return (
                    <div className="customizer-overlay-backdrop" onClick={() => setShowCustomizer(false)}>
                        <div className="customizer-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="customizer-modal-header">
                                <div>
                                    <h2 className="customizer-modal-title">Customize Appearance</h2>
                                    <p className="customizer-modal-subtitle">Stand out on the battlefield</p>
                                </div>
                                <button className="customizer-close-btn" onClick={() => setShowCustomizer(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <div className="customizer-segmented-control-wrapper">
                                <div className="customizer-segmented-control">
                                    <button
                                        type="button"
                                        className={`seg-btn ${customizerTab === 'slither' ? 'active' : ''}`}
                                        onClick={() => setCustomizerTab('slither')}
                                    >
                                        Slither Skin
                                    </button>
                                    <button
                                        type="button"
                                        className={`seg-btn ${customizerTab === 'agar' ? 'active' : ''}`}
                                        onClick={() => setCustomizerTab('agar')}
                                    >
                                        Agar Skin
                                    </button>
                                    <button
                                        type="button"
                                        className={`seg-btn ${customizerTab === 'surviv' ? 'active' : ''}`}
                                        onClick={() => setCustomizerTab('surviv')}
                                    >
                                        Surviv Skin
                                    </button>
                                </div>
                            </div>

                            <div className="customizer-modal-body">
                                <div className="customizer-preview-stage">
                                    {!isRandomSelection && (
                                        <button className="chroma-arrow left" onClick={() => cycleChroma(-1)}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                        </button>
                                    )}

                                    <div className="preview-canvas-container">
                                        {customizerTab === 'slither' ? (
                                            <SnakeSkinPreview color={selectedSkin} isLarge={true} />
                                        ) : customizerTab === 'surviv' ? (
                                            <SurvivSkinPreview color={selectedSkinSurviv} isLarge={true} nickname={nickname} />
                                        ) : (
                                            <AgarBlobPreview color={selectedSkinAgar} isLarge={true} nickname={nickname} hideName />
                                        )}
                                    </div>

                                    {!isRandomSelection && (
                                        <button className="chroma-arrow right" onClick={() => cycleChroma(1)}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                        </button>
                                    )}

                                    <div className="customizer-preview-glow" style={{
                                        backgroundColor: displayChroma
                                    }}></div>

                                    <div className="chroma-name-badge" style={
                                        isRainbow
                                            ? { backgroundImage: 'linear-gradient(90deg, #ff4040, #ffa060, #eeee70, #80ff80, #80d0d0, #9099ff, #c080ff)' }
                                            : specialSkin
                                                ? { backgroundImage: specialSkin.badgeGradient }
                                            : isRandomSelection
                                                ? { backgroundImage: 'linear-gradient(135deg, #80d0d0, #c080ff, #ffa060)' }
                                                : { backgroundColor: currentChroma }
                                    }>
                                        {getChromaName(currentChroma)}
                                    </div>
                                </div>

                                <div className="customizer-selection-area">
                                    <span className="customizer-section-title">Skin Options</span>

                                    <div className="skin-cards-grid">
                                        <button
                                            type="button"
                                            className={`skin-card ${(!isRainbow && !isRandomColor && !isFlag && !isSpecialSkin) ? 'active' : ''}`}
                                            onClick={() => setSkinStyle('classic')}
                                        >
                                            <div className="skin-card-icon grid-icon">
                                                <div style={{ backgroundColor: '#c080ff' }}></div>
                                                <div style={{ backgroundColor: '#80d0d0' }}></div>
                                                <div style={{ backgroundColor: '#eeee70' }}></div>
                                                <div style={{ backgroundColor: '#ff4040' }}></div>
                                            </div>
                                            <span>Classic</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`skin-card ${isRandomColor ? 'active' : ''}`}
                                            onClick={() => setSkinStyle('random_color')}
                                        >
                                            <div className="skin-card-icon surviv-random-icon"></div>
                                            <span>Random</span>
                                        </button>

                                        {customizerTab !== 'surviv' && ownsRainbow && (
                                            <button
                                                type="button"
                                                className={`skin-card ${isRainbow ? 'active' : ''}`}
                                                style={{ position: 'relative' }}
                                                onClick={() => {
                                                    setSkinStyle('rainbow');
                                                    if (!hasSeenRainbow) setHasSeenRainbow(true);
                                                }}
                                            >
                                                {!hasSeenRainbow && ownsRainbow && <div className="notify-dot"></div>}
                                                <div className="skin-card-icon rainbow-icon"></div>
                                                <span>Rainbow</span>
                                            </button>
                                        )}

                                        {customizerTab === 'slither' && SLITHER_SPECIAL_SKINS.filter((skin) => ownedSpecialSkinIds.has(skin.id)).map((skin) => (
                                            <button
                                                key={skin.id}
                                                type="button"
                                                className={`skin-card ${specialSkin?.id === skin.id ? 'active' : ''}`}
                                                onClick={() => setSkinStyle(skin.id)}
                                            >
                                                <div className={`skin-card-icon slither-special-icon slither-special-icon--${skin.id}`} style={{ backgroundImage: skin.badgeGradient }}>
                                                    <span>{skin.id === 'aurora' ? '✦' : '☾'}</span>
                                                </div>
                                                <span>{skin.name}</span>
                                            </button>
                                        ))}
                                        {customizerTab !== 'surviv' && ownsFlagPack && (
                                            <button
                                                type="button"
                                                className={`skin-card ${isFlag ? 'active' : ''}`}
                                                onClick={() => setSkinStyle('flags')}
                                            >
                                                <div className="skin-card-icon flag-pack-icon">{getFlagSkin(activeFlagCode || DEFAULT_FLAG_CODE).emoji}</div>
                                                <span>Flag Pack</span>
                                            </button>
                                        )}
                                    </div>


                                    {isFlag && ownsFlagPack && (
                                        <label className="flag-skin-picker">
                                            <span>Choose flag</span>
                                            <select
                                                value={activeFlagCode || DEFAULT_FLAG_CODE}
                                                onChange={(event) => {
                                                    const value = flagSkinValue(event.target.value);
                                                    if (customizerTab === 'slither') setSelectedSkin(value);
                                                    else setSelectedSkinAgar(value);
                                                }}
                                            >
                                                {FLAG_SKINS.map((flag) => (
                                                    <option key={flag.code} value={flag.code}>{flag.emoji} {flag.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    <button
                                        className="btn-primary customizer-done-btn"
                                        onClick={() => setShowCustomizer(false)}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

const RANDOM_PREVIEW_DURATION_MS = 4500;
const RANDOM_PREVIEW_KEYFRAMES = Object.freeze([
    [128, 208, 208],
    [192, 128, 255],
    [255, 160, 96],
]);

function getRandomPreviewRgb(timeMs) {
    const phase = ((timeMs % RANDOM_PREVIEW_DURATION_MS) / RANDOM_PREVIEW_DURATION_MS) * RANDOM_PREVIEW_KEYFRAMES.length;
    const fromIndex = Math.floor(phase) % RANDOM_PREVIEW_KEYFRAMES.length;
    const toIndex = (fromIndex + 1) % RANDOM_PREVIEW_KEYFRAMES.length;
    const progress = phase - Math.floor(phase);
    const eased = progress * progress * (3 - 2 * progress);
    return RANDOM_PREVIEW_KEYFRAMES[fromIndex].map((channel, index) => (
        Math.round(channel + (RANDOM_PREVIEW_KEYFRAMES[toIndex][index] - channel) * eased)
    ));
}

function randomPreviewColor(timeMs, brightness = 1) {
    const [r, g, b] = getRandomPreviewRgb(timeMs).map((channel) => Math.round(channel * brightness));
    return `rgb(${r}, ${g}, ${b})`;
}

const RANDOM_PREVIEW_SNAKE_COLORS = Object.freeze(Array.from({ length: 48 }, (_, index) => (
    randomPreviewColor((index / 48) * RANDOM_PREVIEW_DURATION_MS)
)));
function SurvivSkinPreview({ color, isLarge, nickname }) {
    const canvasRef = useRef(null);
    const isRandom = color === 'random' || color === 'random_color';
    const displayColor = isRandom ? '#80d0d0' : color;
    const displayName = (nickname || 'SURVIV').slice(0, 10).toUpperCase();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        let cancelled = false;
        let animationFrameId = 0;
        let resizeObserver = null;

        const paint = (time = performance.now()) => {
            if (cancelled) return;
            const bounds = canvas.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const pixelWidth = Math.max(1, Math.round(bounds.width * dpr));
            const pixelHeight = Math.max(1, Math.round(bounds.height * dpr));
            if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, bounds.width, bounds.height);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            drawSurvivPlayerPreview(ctx, {
                x: bounds.width * 0.43,
                y: bounds.height * (isLarge ? 0.47 : 0.5),
                angle: -0.18,
                color: isRandom ? randomPreviewColor(time) : displayColor,
                weapon: 'm416',
                scale: isLarge ? 2.75 : 1.65,
            });

            if (isRandom) animationFrameId = requestAnimationFrame(paint);
        };

        paint();
        resizeObserver = new ResizeObserver(() => paint());
        resizeObserver.observe(canvas);

        return () => {
            cancelled = true;
            cancelAnimationFrame(animationFrameId);
            resizeObserver?.disconnect();
        };
    }, [displayColor, isLarge, isRandom]);

    return (
        <div
            className={`surviv-skin-preview ${isLarge ? 'large' : 'small'} ${isRandom ? 'is-random' : ''}`}
            style={{ '--surviv-skin-color': displayColor }}
        >
            <canvas ref={canvasRef} className="surviv-preview-canvas" aria-label="Surviv skin preview" />
            {isLarge && <div className="surviv-preview-name">{displayName}</div>}
        </div>
    );
}

/* ── SnakeSkinPreview ── */
export function SnakeSkinPreview({ color, isLarge, active = true }) {
    const canvasRef = useRef(null);
    const colorRef = useRef(color);

    useEffect(() => {
        colorRef.current = color;
    }, [color]);

    useEffect(() => {
        if (!active) return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';

        let animationFrameId = 0;
        let lastPaint = 0;
        const segmentsCount = isLarge ? 32 : 24;
        const radius = isLarge ? 13 : 13.5;
        const spacing = 6;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const totalLength = segmentsCount * spacing;
        const headX = centerX + totalLength / 2 - radius * 1.2;
        const amp = isLarge ? 20 : 9;
        const phaseSpeed = isLarge ? 0.00335 : 0.00405;
        const rainbowColors = [
            '#c080ff', '#9099ff', '#80d0d0', '#80ff80',
            '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0',
        ];
        const pointX = new Float64Array(segmentsCount);
        const pointY = new Float64Array(segmentsCount);
        const shadowCanvas = getSnakeShadowCanvas(radius);
        const rainbowCanvases = rainbowColors.map(snakeColor => getSnakeSegmentCanvas(radius, snakeColor));
        const specialSkinCanvases = new Map(SLITHER_SPECIAL_SKINS.map((skin) => [
            skin.id,
            getSnakeSegmentCanvas(radius, skin.baseColor),
        ]));
        const detailPoints = Array.from({ length: segmentsCount }, () => ({ x: 0, y: 0 }));
        const randomColorCanvases = RANDOM_PREVIEW_SNAKE_COLORS.map(snakeColor => getSnakeSegmentCanvas(radius, snakeColor));
        const shadowHalf = shadowCanvas.width / 2;
        let fixedColor = null;
        let fixedSegmentCanvas = null;
        let fixedFlagCode = null;
        let flagCanvases = [];

        const render = (now) => {
            animationFrameId = requestAnimationFrame(render);
            if (now - lastPaint < 12) return;
            lastPaint = now;
            const phase = now * phaseSpeed;
            const currentColor = colorRef.current;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < segmentsCount; i++) {
                pointX[i] = headX - i * spacing;
                pointY[i] = centerY + Math.sin(phase - i * 0.35) * amp;
                detailPoints[i].x = pointX[i];
                detailPoints[i].y = pointY[i];
            }

            // Same shadow sprites and placement as the original preview,
            // drawn in one pass without nested save/restore calls.
            ctx.globalAlpha = 0.5;
            for (let i = segmentsCount - 1; i >= 0; i -= 2) {
                ctx.setTransform(1, 0, 0, 0.75, pointX[i], pointY[i] + radius * 0.12);
                ctx.drawImage(shadowCanvas, -shadowHalf, -shadowHalf);
            }

            ctx.globalAlpha = 1;
            const flagCode = parseFlagSkin(currentColor);
            const currentSpecialSkin = getSlitherSpecialSkin(currentColor);
            if (flagCode && flagCode !== fixedFlagCode) {
                fixedFlagCode = flagCode;
                flagCanvases = getFlagSegmentColors(flagCode).map((flagColor) => getSnakeSegmentCanvas(radius, flagColor));
            }
            if (currentColor !== 'random' && currentColor !== 'random_color' && !currentSpecialSkin && !flagCode && currentColor !== fixedColor) {
                fixedColor = currentColor;
                fixedSegmentCanvas = getSnakeSegmentCanvas(radius, currentColor);
            }

            // Same cached in-game segment sprites as before. The only change is
            // using direct transforms instead of allocating objects each frame.
            for (let i = segmentsCount - 1; i >= 0; i--) {
                const adjacent = i > 0 ? i - 1 : 1;
                const segmentAngle = i > 0
                    ? Math.atan2(pointY[adjacent] - pointY[i], pointX[adjacent] - pointX[i])
                    : Math.atan2(pointY[i] - pointY[adjacent], pointX[i] - pointX[adjacent]);
                const cos = Math.cos(segmentAngle);
                const sin = Math.sin(segmentAngle);
                const segmentCanvas = currentColor === 'random'
                    ? rainbowCanvases[Math.floor((now * 0.0012 + i * 0.15) % rainbowCanvases.length)]
                    : currentColor === 'random_color'
                        ? randomColorCanvases[Math.floor((now % RANDOM_PREVIEW_DURATION_MS) / RANDOM_PREVIEW_DURATION_MS * randomColorCanvases.length)]
                        : currentSpecialSkin
                            ? specialSkinCanvases.get(currentSpecialSkin.id)
                        : flagCode
                            ? flagCanvases[Math.floor(i * 0.28) % flagCanvases.length]
                            : fixedSegmentCanvas;
                const segmentHalf = segmentCanvas.width / 2;
                ctx.setTransform(cos, sin, -sin, cos, pointX[i], pointY[i]);
                ctx.drawImage(segmentCanvas, -segmentHalf, -segmentHalf);
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            if (currentSpecialSkin) {
                drawSlitherSpecialBody(ctx, currentSpecialSkin.id, detailPoints, radius, now * 0.0042);
                drawSlitherSpecialDetails(ctx, currentSpecialSkin.id, detailPoints, radius, now * 0.0042);
            }

            // Original eye proportions and placement.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const headAngle = Math.atan2(pointY[0] - pointY[1], pointX[0] - pointX[1]);
            const perpX = Math.sin(headAngle);
            const perpY = -Math.cos(headAngle);
            const fwdX = Math.cos(headAngle);
            const fwdY = Math.sin(headAngle);
            const eyeSide = radius * 0.39;
            const eyeFwd = radius * 0.31;
            const eyeR = Math.max(2.5, radius * 0.43);
            const pupilR = eyeR * 0.48;

            for (const side of [-1, 1]) {
                const ex = pointX[0] + fwdX * eyeFwd + perpX * eyeSide * side;
                const ey = pointY[0] + fwdY * eyeFwd + perpY * eyeSide * side;
                ctx.beginPath();
                ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(ex + fwdX * eyeR * 0.4, ey + fwdY * eyeR * 0.4, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = '#000000';
                ctx.fill();
            }

        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isLarge, active]);

    return (
        <div className="snake-preview-wrapper" style={{ width: '100%', height: isLarge ? '200px' : '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <canvas
                ref={canvasRef}
                width={isLarge ? 450 : 250}
                height={isLarge ? 200 : 100}
                style={{ height: '100%', width: '100%', objectFit: 'contain', display: 'block', background: 'transparent' }}
            />
        </div>
    );
}

export function AgarBlobPreview({ color, isLarge, nickname, hideName = false }) {
    const canvasRef = useRef(null);
    const tRef = useRef(0);
    const colorRef = useRef(color);

    useEffect(() => {
        colorRef.current = color;
    }, [color]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let animationFrameId;

        const render = (now = performance.now()) => {
            tRef.current += 1;
            const t = tRef.current;
            const currentColor = colorRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Generate fill and border colors identical to the in-game rendering logic
            let fillStyle = currentColor;
            let strokeStyle = '#000000';

            const flagCode = parseFlagSkin(currentColor);
            const currentSpecialSkin = getSlitherSpecialSkin(currentColor);
            if (flagCode) {
                fillStyle = '#ffffff';
                strokeStyle = getFlagBorderColor(flagCode);
            } else if (currentColor === 'random') {
                const hue = (t * 0.14) % 360;
                fillStyle = `hsl(${hue}, 100%, 55%)`;
                strokeStyle = `hsl(${hue}, 100%, 42%)`;
            } else if (currentColor === 'random_color') {
                fillStyle = randomPreviewColor(now);
                strokeStyle = randomPreviewColor(now, 0.72);
            } else {
                const h = currentColor.replace('#', '');
                let r = 120, g = 120, b = 120;
                if (h.length === 3) {
                    r = parseInt(h[0] + h[0], 16);
                    g = parseInt(h[1] + h[1], 16);
                    b = parseInt(h[2] + h[2], 16);
                } else if (h.length >= 6) {
                    r = parseInt(h.slice(0, 2), 16);
                    g = parseInt(h.slice(2, 4), 16);
                    b = parseInt(h.slice(4, 6), 16);
                }
                const br = Math.max(0, r - 32);
                const bg = Math.max(0, g - 32);
                const bb = Math.max(0, b - 32);
                fillStyle = currentColor;
                strokeStyle = '#' + ((1 << 24) + (br << 16) + (bg << 8) + bb).toString(16).slice(1);
            }

            const cells = [];
            if (isLarge) {
                // One big blob for customizing preview modal
                cells.push({
                    radius: 65,
                    cx: centerX + Math.sin(t * 0.015) * 12,
                    cy: centerY + Math.cos(t * 0.02) * 6,
                    drawName: true
                });
            } else {
                // Split cells for the small lobby preview box (1 large, 2 small floating around)
                cells.push({
                    radius: 30,
                    cx: centerX - 12 + Math.sin(t * 0.01) * 8,
                    cy: centerY - 5 + Math.cos(t * 0.015) * 5,
                    drawName: true
                });
                cells.push({
                    radius: 15,
                    cx: centerX + 24 + Math.sin(t * 0.012 + 1.5) * 6,
                    cy: centerY + 12 + Math.cos(t * 0.008 + 1.5) * 5,
                    drawName: false
                });
                cells.push({
                    radius: 11,
                    cx: centerX - 26 + Math.sin(t * 0.015 + 3.0) * 5,
                    cy: centerY + 24 + Math.cos(t * 0.013 + 3.0) * 4,
                    drawName: false
                });
            }

            cells.forEach(cell => {
                const { radius, cx, cy, drawName } = cell;

                // Draw organic wiggling cell identical to drawOrganicCell in render.js
                const pointCount = Math.min(Math.max(~~radius, 24), 60);
                const points = [];
                const time = Date.now() * 0.002;
                const FULL_ANGLE = 2 * Math.PI;

                for (let i = 0; i < pointCount; i++) {
                    const theta = (i / pointCount) * FULL_ANGLE;
                    const wobble = Math.sin(time + theta * 5) * (radius * 0.02);
                    points.push({
                        x: cx + Math.cos(theta) * (radius + wobble),
                        y: cy + Math.sin(theta) * (radius + wobble)
                    });
                }

                // Draw body path
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();

                // Set styles & render
                ctx.fillStyle = fillStyle;
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = isLarge ? 6 : 3;
                ctx.shadowBlur = 0; // No drop shadow glow, identical to game

                if (flagCode) {
                    ctx.clip();
                    drawFlag(ctx, flagCode, cx, cy, radius * 2.15, radius * 2.15);
                    ctx.restore();
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
                    ctx.closePath();
                    ctx.stroke();
                } else {
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();

                if (drawName && !hideName) {
                    // Draw nickname identical to in-game text formatting
                    let fontSize = radius / 1.8;
                    const nameStr = (nickname || 'GUEST').toUpperCase();
                    if (nameStr.length > 3) fontSize *= 0.7;
                    fontSize = Math.max(fontSize, isLarge ? 14 : 9);

                    ctx.save();
                    ctx.font = 'bold ' + fontSize + 'px sans-serif';
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 3;
                    ctx.miterLimit = 1;
                    ctx.lineJoin = 'round';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    ctx.strokeText(nameStr, cx, cy);
                    ctx.fillText(nameStr, cx, cy);
                    ctx.restore();
                }
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [hideName, isLarge, nickname]);

    return (
        <div className="agar-preview-wrapper" style={{ width: '100%', height: isLarge ? '200px' : '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <canvas
                ref={canvasRef}
                width={isLarge ? 450 : 250}
                height={isLarge ? 200 : 100}
                style={{ height: '100%', width: '100%', objectFit: 'contain', display: 'block' }}
            />
        </div>
    );
}
