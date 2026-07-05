import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createQR } from '@solana/pay';
import '../styles/ui.css';
import '../styles/tournaments.css';
import CustomDropdown from '../components/CustomDropdown';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import GuestWelcomeBanner from '../components/GuestWelcomeBanner';
import GamemodeDiscoveryPrompt from '../components/GamemodeDiscoveryPrompt';
import RewardsWidget from '../components/RewardsWidget';
import GamemodePreview from '../components/GamemodePreview';
import { markGamemodePlayed, shouldShowDiscoveryPrompt } from '../constants/gamemodes';
import { ENTRY_TIERS, BR_ENTRY_TIERS, COMPETITIVE_ENTRY_TIERS, SURVIV_ENTRY_TIERS, DEFAULT_ENTRY_FEE, DEFAULT_BR_ENTRY_FEE, DEFAULT_COMPETITIVE_ENTRY_FEE, DEFAULT_SURVIV_ENTRY_FEE, tierEconomy, competitiveTierEconomy, survivTierEconomy, formatUsd } from '../constants/economy';
import { setPageSeo, SEO } from '../utils/seo';
import { trackMixpanelEvent } from '../utils/mixpanel';
import { isBattleRoyaleAvailable, isBattleRoyaleMode as isBRGamemode, normalizeGamemodeForLobby } from '../constants/features';
import { buildPresenceHeaders } from '../utils/sitePresence';
import { getSnakeSegmentCanvas, getSnakeShadowCanvas } from '../utils/snakeRender';
import { API_URL } from '../utils/apiBase';
import { clearAllPendingResults } from '../utils/gamePendingResult';

/* ── Solana logo icon ── */
const SolLogo = ({ size = 13, style }) => (
    <img
        src="/solana-sol-logo.png"
        alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0, ...style }}
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
const CUR_OPTIONS = [
    { label: 'USD', value: 'USD' },
    { label: 'SOL', value: 'SOL' },
];

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
    const raw = stored || locationStateMode || 'agar';
    return normalizeGamemodeForLobby(raw, isAdmin);
}

const getChromaName = (color) => {
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
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

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
                    document.title = `AgarStake | ${data.tournament.name}`;
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
    const [leaderboardHeight, setLeaderboardHeight] = useState('auto');

    useEffect(() => {
        if (!modeCardRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setLeaderboardHeight(entry.target.offsetHeight);
            }
        });
        observer.observe(modeCardRef.current);
        return () => observer.disconnect();
    }, []);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [isWalletExpanded, setIsWalletExpanded] = useState(false);
    const [isWithdrawExpanded, setIsWithdrawExpanded] = useState(false);
    const [depositMethod, setDepositMethod] = useState('manual');
    const [amount, setAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [isValidWithdrawAddress, setIsValidWithdrawAddress] = useState(true);
    const [displayFullAddress, setDisplayFullAddress] = useState(false);
    const [isCurSOL, setIsCurSOL] = useState(() => localStorage.getItem('balance_currency') === 'SOL');
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
        playersByGamemode: { agar: 0, slither: 0, brAgar: 0, brSlither: 0, competitiveSlither: 0 },
        siteUsersOnline: 0,
    });
    const solPrice = liveStats?.solPrice || user?.solPrice || 64;
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [showDiscovery, setShowDiscovery] = useState(false);
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

    const SKIN_COLORS = [
        'random',
        '#c080ff', // lavender-purple
        '#9099ff', // indigo-blue
        '#80d0d0', // turquoise-cyan
        '#80ff80', // lime-green
        '#eeee70', // tinted-yellow
        '#ffa060', // orange
        '#ff9050', // pink-red
        '#ff4040', // dark-red
        '#e030e0', // magenta
    ];

    const [selectedSkin, setSelectedSkin] = useState(
        () => localStorage.getItem('selected_skin') || '#c080ff'
    );
    const [selectedSkinAgar, setSelectedSkinAgar] = useState(
        () => localStorage.getItem('selected_skin_agar') || '#c080ff'
    );
    const [selectedSkinSurviv, setSelectedSkinSurviv] = useState(
        () => localStorage.getItem('selected_skin_surviv') || 'random'
    );

    const [showCustomizer, setShowCustomizer] = useState(false);

    useEffect(() => {
        localStorage.setItem('selected_skin', selectedSkin);
    }, [selectedSkin]);

    useEffect(() => {
        localStorage.setItem('selected_skin_agar', selectedSkinAgar);
    }, [selectedSkinAgar]);

    useEffect(() => {
        localStorage.setItem('selected_skin_surviv', selectedSkinSurviv);
    }, [selectedSkinSurviv]);

    useEffect(() => {
        localStorage.setItem('balance_currency', isCurSOL ? 'SOL' : 'USD');
    }, [isCurSOL]);

    const [selectedMode, setSelectedMode] = useState(
        () => resolvePreGameMode(location.pathname, location.state?.selectedMode)
    );
    const [selectedEntryFee, setSelectedEntryFee] = useState(
        () => Number(localStorage.getItem('selected_entry_fee')) || DEFAULT_ENTRY_FEE
    );
    const [activeEntryFee, setActiveEntryFee] = useState(null);
    const [currentGameMode, setCurrentGameMode] = useState(
        () => localStorage.getItem('current_game_mode') || null
    );

    useEffect(() => {
        localStorage.setItem('selected_gamemode', selectedMode);
    }, [selectedMode]);

    useEffect(() => {
        localStorage.setItem('selected_entry_fee', String(selectedEntryFee));
    }, [selectedEntryFee]);

    useEffect(() => {
        if (location.pathname === '/slither') {
            setSelectedMode(resolvePreGameMode('/slither', location.state?.selectedMode, !!user?.isAdmin));
        } else if (location.pathname === '/agar') {
            setSelectedMode('agar');
        } else if (location.state?.selectedMode && location.state.selectedMode !== selectedMode) {
            setSelectedMode(normalizeGamemodeForLobby(location.state.selectedMode, !!user?.isAdmin));
        }
    }, [location.pathname, location.state?.selectedMode, selectedMode, user?.isAdmin]);

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
    const [walletModalActive, setWalletModalActive] = useState(false);
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
    const economy = isSurvivMode
        ? survivTierEconomy(entryFeeForSession)
        : isCompetitiveSlitherMode
            ? competitiveTierEconomy(entryFeeForSession)
            : tierEconomy(entryFeeForSession);
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

    useEffect(() => {
        if (isSurvivMode && !SURVIV_ENTRY_TIERS.includes(selectedEntryFee)) {
            setSelectedEntryFee(DEFAULT_SURVIV_ENTRY_FEE);
        }
        if (isCompetitiveSlitherMode && !COMPETITIVE_ENTRY_TIERS.includes(selectedEntryFee)) {
            setSelectedEntryFee(DEFAULT_COMPETITIVE_ENTRY_FEE);
        }
        if (isBattleRoyaleMode && !BR_ENTRY_TIERS.includes(selectedEntryFee)) {
            setSelectedEntryFee(DEFAULT_BR_ENTRY_FEE);
        }
    }, [selectedMode, isBattleRoyaleMode, isCompetitiveSlitherMode, isSurvivMode, selectedEntryFee]);

    useEffect(() => {
        setShowDiscovery(isAuthenticated && shouldShowDiscoveryPrompt(selectedMode, brAvailable));
    }, [selectedMode, brAvailable, isAuthenticated]);

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


    const siteUsersOnline = (liveStats.siteUsersOnline ?? liveStats.totalPlayersOnline ?? 0) + (liveStats.totalBotsOnline ?? 0);
    const globalCashoutTotalUsd =
        liveStats.globalPlayerEarningsUsd
        ?? liveStats.totalUserBalanceUsd
        ?? leaderboardData.globalEarningsUsd
        ?? 0;

    const balanceSol = user?.balanceSol || 0;
    const balanceUsd = user?.balanceUsd ?? (balanceSol * solPrice);
    const freePlay = !!user?.freePlay;

    const isNormal5 = entryFeeForSession === 5 && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode;
    const hasFreeTicket = user?.hasFreeTicket && !user?.freeTicketUsed;
    const canJoin = freePlay || (isNormal5 && hasFreeTicket) || balanceUsd >= entryFeeForSession;

    // ── Format helpers ─────────────────────────────────
    const fmt = (v) => {
        const n = Number(v || 0);
        if (!isFinite(n)) return '0';
        if (n >= 10000) return Math.round(n).toString();
        if (n >= 1000) return n.toFixed(1);
        if (n >= 1) return n.toFixed(2);
        if (n > 0) return n.toFixed(4);
        return '0';
    };

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
        if (publicKey && !withdrawAddress) setWithdrawAddress(publicKey.toBase58());
    }, [publicKey]);

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
        if (qrRef.current && depositAddress && depositMethod === 'manual' && isWalletExpanded) {
            qrRef.current.innerHTML = '';
            try {
                const qr = createQR(
                    `solana:${depositAddress}?amount=0&label=AgarStake&message=Deposit`,
                    190, 'white', 'black'
                );
                qr.append(qrRef.current);
            } catch (e) { }
        }
    }, [depositAddress, depositMethod, isWalletExpanded]);

    useEffect(() => {
        if ((depositMethod !== 'manual' || !isWalletExpanded) && qrRef.current) {
            qrRef.current.innerHTML = '';
        }
    }, [depositMethod, isWalletExpanded]);

    useEffect(() => {
        const obs = new MutationObserver(() => {
            setWalletModalActive(!!document.querySelector('.wallet-adapter-modal, wcm-modal'));
        });
        obs.observe(document.body, { childList: true, subtree: true });
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (walletModalActive && isWalletExpanded) {
            setPanelPos(p => ({ x: 40, y: p.y ?? 60 }));
        }
    }, [walletModalActive, isWalletExpanded]);

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
                const r = await fetch(`${API_URL}/api/stats?t=${Date.now()}`, {
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

    // Balance poll
    useEffect(() => {
        refreshUser();
        const id = setInterval(refreshUser, 20000); // Minska polling till var 20:e sekund
        return () => clearInterval(id);
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
                    setActiveGameBalance(d.balance ?? null);
                    if (d.entryFeeUsd) {
                        setActiveEntryFee(d.entryFeeUsd);
                        setSelectedEntryFee(d.entryFeeUsd);
                    }
                    localStorage.setItem('current_game_mode', d.mode);
                    localStorage.setItem('selected_gamemode', d.mode);
                    if (d.entryFeeUsd) localStorage.setItem('selected_entry_fee', String(d.entryFeeUsd));
                } else if (r.ok) {
                    // Only clear active session — keep selected_gamemode so lobby shows the last mode played
                    setCurrentGameMode(null);
                    setActiveGameBalance(null);
                    setActiveEntryFee(null);
                    localStorage.removeItem('current_game_mode');
                    const savedMode = localStorage.getItem('selected_gamemode');
                    if (savedMode) setSelectedMode(normalizeGamemodeForLobby(savedMode, !!user?.isAdmin));
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
    const attemptsRemaining = tournament?.me?.attemptsRemaining ?? 5;
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

        if (isAlreadyInGame && !canRejoinThisMode) return;

        if (!canJoin && !isAlreadyInGame) { navigate('/lobby'); return; }

        trackMixpanelEvent('game_started', {
            mode: selectedMode,
            entry_fee_usd: entryFeeForSession,
            is_battle_royale: isBattleRoyaleMode,
            is_rejoin: isAlreadyInGame && canRejoinThisMode,
            platform: 'web',
        });

        setIsMatchmaking(true);
        refreshUser();
        localStorage.setItem('match_nickname', nickname);
        localStorage.setItem('selected_entry_fee', String(entryFeeForSession));

        // Use Free Ticket check
        const isNormal5 = entryFeeForSession === 5 && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode;
        const hasFreeTicket = user?.hasFreeTicket && !user?.freeTicketUsed;
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
            },
        }), 1200);
    };

    const normalizeMode = (mode) => (mode || '').replace(/^br-/, '');
    const canRejoinThisMode = isAlreadyInGame && currentGameMode
        && normalizeMode(selectedMode) === normalizeMode(currentGameMode)
        && (activeEntryFee == null || activeEntryFee === entryFeeForSession);

    const handleDeposit = async () => {
        if (!publicKey || !connected) { setStatusMsg('Connect wallet first.'); return; }
        if (!depositAddress) { setStatusMsg('❌ No deposit address. Contact support.'); return; }
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) { setStatusMsg('❌ Enter a valid amount.'); return; }
        setStatusMsg('Waiting for wallet approval…');

        const solAmt = isCurSOL ? parsed : parsed / solPrice;
        const usdAmt = isCurSOL ? parsed * solPrice : parsed;

        try {
            const lamports = Math.round(solAmt * LAMPORTS_PER_SOL);
            const tx = new Transaction().add(
                SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(depositAddress), lamports })
            );
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;
            const sig = await sendTransaction(tx, connection);
            setStatusMsg('Confirming on-chain…');
            const conf = await connection.confirmTransaction(sig, 'confirmed');
            if (conf.value.err) throw new Error('Transaction failed on-chain.');
            setStatusMsg('Verifying with backend…');
            const vr = await fetch(`${API_URL}/api/deposit-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'bypass-tunnel-reminders': 'true' },
                body: JSON.stringify({ signature: sig, amountUSD: usdAmt, solAmount: solAmt, walletAddress: publicKey.toString() })
            });
            if (!vr.ok) {
                const ct = vr.headers.get('content-type');
                const err = ct?.includes('application/json') ? (await vr.json()).message : await vr.text();
                throw new Error(err || 'Backend verification failed.');
            }
            const verification = await vr.json();
            if (token) {
                const mr = await fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
                if (mr.ok) login(await mr.json(), token);
            }
            setStatusMsg(verification.rewardsReview
                ? 'Deposit confirmed. Rewards are under linked-wallet review.'
                : `✅ ${solAmt.toFixed(4)} SOL deposited!`);
            setAmount('');
        } catch (err) {
            const m = err.message || '';
            if (m.includes('User rejected')) setStatusMsg('❌ Cancelled in wallet.');
            else if (m.toLowerCase().includes('insufficient')) setStatusMsg('❌ Insufficient funds.');
            else setStatusMsg('❌ Deposit failed. Try again.');
        }
    };

    const handleWithdraw = async () => {
        if (!token) return;
        if (!withdrawAddress || !isValidWithdrawAddress) { setStatusMsg('❌ Invalid Solana address.'); return; }
        const parsed = parseFloat(withdrawAmount);
        if (isNaN(parsed) || parsed < 1) { setStatusMsg('❌ Minimum withdrawal is $1.00'); return; }
        setStatusMsg('⏳ Processing withdrawal…');
        try {
            const usdAmt = isCurSOL ? parsed * solPrice : parsed;
            const r = await fetch(`${API_URL}/api/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ amountUSD: usdAmt, destinationAddress: withdrawAddress })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.message || 'Withdrawal failed');
            await refreshUser();
            setStatusMsg('✅ Funds sent to your wallet!');
            setWithdrawAmount('');
        } catch (e) { setStatusMsg(`❌ ${e.message}`); }
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
                    : canJoin ? (isBattleRoyaleMode ? 'Find Match' : 'Play')
                        : 'Deposit to Play';

    const panelOpen = isWalletExpanded || isWithdrawExpanded;

    // ── Render ─────────────────────────────────────────
    return (
        <div className="page-shell page-shell--pregame">
            <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                <h1>AgarStake — {modeBaseName} with Real Money</h1>
                <p>Play {modeBaseName}.io with real money on AgarStake. Deposit Solana, compete in the arena, and cash out crypto instantly.</p>
            </div>
            <Background />

            <AppTopbar>
                {/* Nav right */}
                <div className="topbar-right">
                    {isAuthenticated ? (
                        <>
                            {/* Balance pill */}
                            {(user?.balance || 0) > 0 && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        id="balance-pill"
                                        className="balance-pill mono"
                                        onClick={() => { setIsWalletOpen(v => !v); setStatusMsg(''); }}
                                        style={isWalletOpen ? { borderColor: 'var(--accent)', boxShadow: '0 0 10px rgba(124, 58, 255, 0.15)' } : {}}
                                    >
                                        <WalletIcon size={14} />
                                        {isCurSOL ? (
                                            <>
                                                <SolLogo size={12} />
                                                <span style={{ color: 'var(--text-bright)', fontSize: '0.82rem' }}>
                                                    {fmt(balanceSol)}
                                                </span>
                                            </>
                                        ) : (
                                            <span style={{ color: 'var(--text-bright)', fontSize: '0.82rem' }}>
                                                ${fmt(balanceUsd)}
                                            </span>
                                        )}
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.35, marginLeft: 2 }}>
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </button>

                                    {isWalletOpen && (
                                        <div ref={walletDropRef} className="wallet-card">
                                            {/* Header row */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <button
                                                    onClick={() => { setIsWalletOpen(false); navigate('/transactions'); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.1s' }}
                                                    onMouseEnter={e => e.target.style.color = 'var(--text-h)'}
                                                    onMouseLeave={e => e.target.style.color = 'var(--text-2)'}
                                                >
                                                    History
                                                </button>
                                                <CustomDropdown
                                                    options={CUR_OPTIONS}
                                                    value={isCurSOL ? 'SOL' : 'USD'}
                                                    onChange={v => setIsCurSOL(v === 'SOL')}
                                                    renderValue={v => (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {v === 'SOL' ? <><SolLogo size={10} /> Solana</> : '$USD'}
                                                        </span>
                                                    )}
                                                    renderOption={opt => (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {opt.value === 'SOL' ? <><SolLogo size={12} /> Solana</> : '$ USD'}
                                                        </span>
                                                    )}
                                                />
                                            </div>

                                            {/* Balance */}
                                            <div className="wallet-card-balance" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {isCurSOL ? (
                                                    <SolLogo size={28} />
                                                ) : (
                                                    <span style={{ fontSize: '0.9rem', opacity: 0.4, fontFamily: 'var(--sans)', fontWeight: 400 }}>$</span>
                                                )}
                                                <span style={{ marginLeft: isCurSOL ? '10px' : '0' }}>
                                                    {isCurSOL
                                                        ? fmt(balanceSol)
                                                        : fmt(balanceUsd)}
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
                                                    className="btn btn-primary"
                                                    onClick={() => {
                                                        trackMixpanelEvent('deposit_clicked', { source: 'wallet_menu', platform: 'web' });
                                                        setIsWalletOpen(false); setIsWithdrawExpanded(false); setIsWalletExpanded(true); setDepositMethod('manual');
                                                    }}
                                                >
                                                    Deposit
                                                </button>
                                                <button
                                                    className="btn btn-ghost"
                                                    onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(false); setIsWithdrawExpanded(true); }}
                                                >
                                                    Withdraw
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Deposit button */}
                            <button
                                className="nav-deposit-btn nav-deposit-btn--compact"
                                onClick={() => {
                                    trackMixpanelEvent('deposit_clicked', { source: 'nav_button', platform: 'web' });
                                    setIsWalletOpen(false);
                                    setIsWithdrawExpanded(false);
                                    setIsWalletExpanded(true);
                                    setDepositMethod('manual');
                                }}
                            >
                                <span className="nav-deposit-btn-text">{(user?.balance || 0) === 0 ? '+ Add funds' : 'Deposit'}</span>
                            </button>

                            {/* User avatar pill */}
                            <div style={{ position: 'relative' }}>
                                <div
                                    ref={userPillRef}
                                    className={`user-pill${showUserMenu ? ' active' : ''}`}
                                    onClick={() => setShowUserMenu(v => !v)}
                                >
                                    <div className="avatar">
                                        {user?.username?.charAt(0).toUpperCase()}
                                    </div>
                                </div>

                                {showUserMenu && (
                                    <div ref={userMenuRef} className="user-menu">
                                        <div className="user-menu-header">{user?.username}</div>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/profile', { state: { tab: 'profile' } }); }}>Profile</button>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/profile', { state: { tab: 'stats' } }); }}>Stats</button>
                                        <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/transactions'); }}>Transactions</button>
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

                    {/* Tab bar */}
                    <div className="tab-bar">
                        <button className={`tab-btn${depositMethod === 'wallet' ? ' active' : ''}`} onClick={() => setDepositMethod('wallet')}>
                            Wallet
                        </button>
                        <button className={`tab-btn${depositMethod === 'manual' ? ' active' : ''}`} onClick={() => setDepositMethod('manual')}>
                            QR / Address
                        </button>
                    </div>

                    {depositMethod === 'wallet' ? (
                        <>
                            {/* Wallet connect */}
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <WalletMultiButton />
                            </div>

                            {/* Amount row */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span className="label">Amount</span>
                                    <CustomDropdown
                                        options={CUR_OPTIONS}
                                        value={isCurSOL ? 'SOL' : 'USD'}
                                        onChange={v => setIsCurSOL(v === 'SOL')}
                                        renderValue={v => (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {v === 'SOL' ? <><SolLogo size={10} /> Solana</> : '$USD'}
                                            </span>
                                        )}
                                        renderOption={opt => (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {opt.value === 'SOL' ? <><SolLogo size={12} /> Solana</> : '$ USD'}
                                            </span>
                                        )}
                                    />
                                </div>
                                <div className="amount-field">
                                    <span className="amount-prefix">
                                        {isCurSOL ? <SolLogo size={13} /> : <span>$</span>}
                                    </span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="amount-input"
                                    />
                                </div>
                                {amount && (
                                    <div className="amount-hint">
                                        {isCurSOL
                                            ? `≈ $${(parseFloat(amount) * solPrice).toFixed(2)}`
                                            : `≈ ${(parseFloat(amount) / solPrice).toFixed(4)} SOL`}
                                    </div>
                                )}
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', padding: '11px' }} onClick={handleDeposit}>
                                Deposit SOL
                            </button>
                        </>
                    ) : (
                        /* QR / Address tab */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div ref={qrRef} className="qr-container" />
                            <div style={{ width: '100%' }}>
                                <div className="label" style={{ marginBottom: '4px' }}>Deposit Address</div>
                                <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--green)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                    {depositAddress || 'Generating…'}
                                </div>
                                <button
                                    onClick={() => { if (depositAddress) navigator.clipboard.writeText(depositAddress); setStatusMsg('✅ Address copied!'); }}
                                    style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', color: 'var(--blue)', fontSize: '0.67rem', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', letterSpacing: '0.04em' }}
                                >
                                    COPY ADDRESS
                                </button>
                            </div>
                        </div>
                    )}

                    {statusMsg && <div className={`status-msg ${statusClass}`}>{statusMsg}</div>}
                    <div style={{ textAlign: 'center', fontSize: '0.58rem', color: 'var(--text-3)', fontWeight: 600 }}>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Address */}
                        <div>
                            <div className="label" style={{ marginBottom: '5px' }}>Destination Address</div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Paste Solana address"
                                    value={displayFullAddress ? withdrawAddress : shortAddr(withdrawAddress)}
                                    onChange={e => setWithdrawAddress(e.target.value)}
                                    onFocus={() => setDisplayFullAddress(true)}
                                    onBlur={() => setDisplayFullAddress(false)}
                                    className="amount-input"
                                    style={{
                                        paddingLeft: '12px',
                                        paddingRight: '32px',
                                        width: '100%',
                                        fontFamily: 'var(--mono)',
                                        fontSize: '0.75rem',
                                        borderColor: !isValidWithdrawAddress ? 'rgba(255,59,48,0.4)' : undefined,
                                    }}
                                />
                                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                    <SolLogo size={11} />
                                </div>
                            </div>
                            {!isValidWithdrawAddress && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--red)', marginTop: '3px' }}>
                                    Invalid Solana address
                                </div>
                            )}
                        </div>

                        {/* Amount */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <span className="label">Amount</span>
                                <CustomDropdown
                                    options={CUR_OPTIONS}
                                    value={isCurSOL ? 'SOL' : 'USD'}
                                    onChange={v => setIsCurSOL(v === 'SOL')}
                                    renderValue={v => (
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {v === 'SOL' ? <><SolLogo size={10} /> Solana</> : '$USD'}
                                        </span>
                                    )}
                                    renderOption={opt => (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {opt.value === 'SOL' ? <><SolLogo size={12} /> Solana</> : '$ USD'}
                                        </span>
                                    )}
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
                                    onChange={e => setWithdrawAmount(e.target.value)}
                                    className="amount-input"
                                    style={{ paddingRight: '52px' }}
                                />
                                <button
                                    style={{ position: 'absolute', right: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700', cursor: 'pointer' }}
                                    onClick={() => setWithdrawAmount(isCurSOL ? balanceSol.toFixed(4) : balanceUsd.toFixed(2))}
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

                        <button className="btn btn-primary" style={{ width: '100%', padding: '11px' }} onClick={handleWithdraw}>
                            Withdraw
                        </button>
                    </div>

                    {statusMsg && <div className={`status-msg ${statusClass}`}>{statusMsg}</div>}
                    <div style={{ textAlign: 'center', fontSize: '0.58rem', color: 'var(--text-3)', fontWeight: 600 }}>
                        Custodial · Secure Transfer
                    </div>
                </div>
            )}

            {/* ── Main layout ── */}
            {freePlay && (
                <div className="test-mode-banner">
                    TEST MODE — Free play, no real SOL used
                </div>
            )}

            {!isAuthenticated && <GuestWelcomeBanner />}

            {isAuthenticated && showDiscovery && (
                <GamemodeDiscoveryPrompt
                    currentMode={selectedMode}
                    brAvailable={brAvailable}
                    playersByGamemode={liveStats.playersByGamemode}
                    onSelectMode={(modeId) => {
                        setSelectedMode(normalizeGamemodeForLobby(modeId, !!user?.isAdmin));
                        setShowDiscovery(false);
                    }}
                    onDismiss={() => setShowDiscovery(false)}
                />
            )}

            {tournamentId ? (
                tournamentLoading ? (
                    <div className="tournament-empty" style={{ margin: '15vh auto', maxWidth: 520, textAlign: 'center', color: 'var(--text-2)' }}>
                        <span className="spinner" style={{ marginRight: 8 }} />
                        Loading tournament lobby…
                    </div>
                ) : (
                    <main className="tournament-page" style={{ width: '100%', maxWidth: 1180, margin: '20px auto 0', padding: '0 16px', boxSizing: 'border-box' }}>
                        <div className="tournament-lobby-header">
                            <div>
                                <p className="tournament-kicker">Tournament · Balance Grab</p>
                                <h1 className="tournament-title" style={{ fontSize: 'clamp(1.9rem, 5vw, 3.35rem)', margin: '4px 0 8px' }}>{tournament?.name || 'Tournament'}</h1>
                                <p className="tournament-subtitle" style={{ margin: 0 }}>{tournamentStatusText}</p>
                            </div>
                            <button className="tournament-secondary-btn" onClick={() => navigate('/tournaments')}>← All tournaments</button>
                        </div>

                        {tournamentError && <div className="tournament-ended-callout" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#fecaca', margin: '20px 0' }}>{tournamentError}</div>}

                        {tournament?.status === 'ended' && (
                            <div className="tournament-ended-callout" style={{ margin: '20px 0' }}>
                                <strong>Tournament ended.</strong>{' '}
                                {tournament.me?.winningsUsd > 0
                                    ? `You placed #${tournament.me.placement} and have $${tournament.me.winningsUsd.toFixed(2)} ready in Rewards.`
                                    : `Your final tournament balance was $${tournament.me?.balanceUsd?.toFixed(2) || '0.00'}.`}
                                {tournament.me?.winningsUsd > 0 && (
                                    <button className="tournament-secondary-btn" style={{ marginLeft: 14 }} onClick={() => navigate('/rewards')}>
                                        Claim in Rewards
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="tournament-balance-banner" style={{ margin: '20px 0' }}>
                            <div>
                                <span>Your tournament balance</span>
                                <div style={{ marginTop: 4, color: 'var(--text-2)', fontSize: '.78rem' }}>
                                    All successful cashouts across this tournament
                                </div>
                            </div>
                            <strong>${(tournament?.me?.balanceUsd || 0).toFixed(2)}</strong>
                        </div>

                        <div className="tournament-lobby-grid">
                            <section className="tournament-panel tournament-play-card">
                                <div className="tournament-preview">
                                    <GamemodePreview mode="slither" fit />
                                </div>
                                <div className="tournament-play-copy">
                                    <span className="tournament-panel-label">Tournament mode</span>
                                    <h2>Balance Grab</h2>
                                    <p>
                                        Every run starts at $1 in-game balance with the $10 Slither food economy.
                                        Food and bots are score only—your $1 entry goes entirely into the prize pot.
                                    </p>
                                    <div className="tournament-attempts" aria-label={`${attemptsUsed} of 5 attempts used`}>
                                        {[0, 1, 2, 3, 4].map(index => (
                                            <span key={index} className={`tournament-attempt-dot${index < attemptsUsed ? ' tournament-attempt-dot--used' : ''}`} />
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: 'var(--text-2)', fontSize: '.78rem' }}>
                                        <span>{attemptsRemaining} attempts left</span>
                                        <strong style={{ color: 'var(--text-h)' }}>$1.00 per run</strong>
                                    </div>
                                    <button className="tournament-primary-btn tournament-play-btn" disabled={!canPlayTournament} onClick={playTournament}>
                                        {tournament?.status === 'scheduled'
                                            ? `Starts in ${formatCountdown(tournament.startAt, tournamentNow)}`
                                            : tournament?.status === 'ended'
                                                ? 'Tournament ended'
                                                : attemptsRemaining <= 0 ? 'All 5 attempts used' : `Play attempt ${attemptsUsed + 1} · $1`}
                                    </button>
                                </div>
                            </section>

                            <aside className="tournament-panel">
                                <span className="tournament-panel-label">Live tournament</span>
                                <h2>Prize pot</h2>
                                <div className="tournament-prize-amount">${(tournament?.prizePotUsd || 0).toFixed(2)}</div>
                                <div className="tournament-splits">
                                    <div className="tournament-split">1st<strong>60%</strong></div>
                                    <div className="tournament-split">2nd<strong>30%</strong></div>
                                    <div className="tournament-split">3rd<strong>10%</strong></div>
                                </div>
                                <span className="tournament-panel-label">Leaderboard</span>
                                <div className="tournament-leaderboard" style={{ marginTop: 8 }}>
                                    {(tournament?.leaderboard || []).length === 0 && (
                                        <div style={{ color: 'var(--text-3)', fontSize: '.78rem', padding: '18px 8px' }}>No banked cashouts yet.</div>
                                    )}
                                    {(tournament?.leaderboard || []).map((entry, index) => (
                                        <div key={`${entry.username}-${index}`} className="tournament-leaderboard-row">
                                            <span>#{entry.rank || index + 1}</span>
                                            <span>{entry.username}</span>
                                            <strong>${entry.balanceUsd.toFixed(2)}</strong>
                                        </div>
                                    ))}
                                </div>
                            </aside>
                        </div>
                    </main>
                )
            ) : (
                <div className="pre-game-grid">
                <div className="mode-card" ref={modeCardRef}>
                    <GamemodePreview mode={selectedMode} className="mode-card-preview" />
                    <div className="mode-card-overlay">
                        <div className="mode-card-header">
                            <span className="mode-card-label">Gamemode</span>
                            <div className="mode-card-title mode-card-title--stacked">
                                {modeCardTitle.toUpperCase()}
                            </div>
                            <div className="mode-card-subtitle">{modeSubtitle}</div>
                        </div>

                        <div className="mode-card-footer">
                            <div className="mode-playing-count">
                                <span className="live-dot" aria-hidden="true" />
                                <span>
                                    Playing: <span className="mono">{siteUsersOnline}</span>
                                </span>
                            </div>
                            <button
                                type="button"
                                className="mode-card-action"
                                onClick={() => navigate('/gamemodes', { state: { selectedMode: isBattleRoyaleMode ? brVariant : selectedMode } })}
                            >
                                Change
                            </button>
                        </div>
                    </div>
                </div>

                <div className="center-panel-stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                    <div className="game-card main-card">
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
                        </div>

                        <div className="divider" style={{ marginBottom: '14px' }} />

                        <div className="entry-row" style={{ marginBottom: '14px' }}>
                            <span className="label">Entry Fee</span>
                            <span className="mono" style={{ color: 'var(--text-h)', fontSize: '0.85rem', fontWeight: 700 }}>
                                {freePlay ? 'FREE (Test)' : formatUsd(entryFeeForSession)}
                            </span>
                        </div>

                        {/* Stake Selection Selector */}
                        <div className="lobby-stake-selection" style={{ marginBottom: '18px' }}>
                            <label className="label" style={{ display: 'block', marginBottom: '8px' }}>
                                {isBattleRoyaleMode ? 'Select Entry Fee' : 'Select Entry Stake'}
                            </label>
                            <div className="lobby-tier-row">
                                {tierOptions.map(tier => {
                                    const locked = isAlreadyInGame && activeEntryFee != null && tier !== activeEntryFee;
                                    const active = entryFeeForSession === tier;
                                    const isNormal5 = tier === 5 && !isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode;
                                    const hasFreeTicket = user?.hasFreeTicket && !user?.freeTicketUsed;
                                    const isFreeTicketButton = isNormal5 && hasFreeTicket;

                                    return (
                                        <button
                                            key={tier}
                                            type="button"
                                            className={`lobby-tier-btn${active ? ' lobby-tier-btn--active' : ''}${locked ? ' lobby-tier-btn--locked' : ''}`}
                                            disabled={locked || isMatchmaking}
                                            onClick={() => !isAlreadyInGame && setSelectedEntryFee(tier)}
                                        >
                                            {freePlay ? 'FREE' : (isFreeTicketButton ? 'Free Ticket' : `$${tier}`)}
                                        </button>
                                    );
                                })}
                            </div>
                            {(!isBattleRoyaleMode && !isCompetitiveSlitherMode && !isSurvivMode && user?.hasFreeTicket && !user?.freeTicketUsed) && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginTop: '8px', textAlign: 'center', fontWeight: 600 }}>
                                    ✨ free ticket available
                                </div>
                            )}
                        </div>

                        <button
                            className={playBtnClass}
                            onClick={handleStartMatch}
                            disabled={isMatchmaking || (isAlreadyInGame && !canRejoinThisMode)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {playBtnLabel}
                        </button>

                        {isAlreadyInGame && currentGameMode && (
                            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--accent)', textAlign: 'center', fontWeight: 600 }}>
                                Active session: {currentGameMode.startsWith('br-') ? 'Battle Royale' : (currentGameMode === 'slither' ? 'Slither' : 'Agar')}
                                {activeEntryFee != null && !freePlay && ` · ${formatUsd(activeEntryFee)} entry`}
                                {activeGameBalance != null && !currentGameMode.startsWith('br-') && ` · $${Number(activeGameBalance).toFixed(2)} in arena`}
                            </div>
                        )}

                        <div className="hiw-wrap">
                            <div
                                className="hiw-toggle"
                                onClick={() => setShowHowItWorks(v => !v)}
                            >
                                <span>How it works</span>
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
                                                <span className="mono">{formatUsd(entryFeeForSession)}</span>
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
                                                <span className="mono">{formatUsd(entryFeeForSession)}</span>
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
                                                Real players only — ${entryFeeForSession} matches are a separate pool from other stakes.
                                                Your entry becomes your starting dollar balance. Snake size (mass) is separate from dollars.
                                                Kill snakes to pick up their dropped dollar loot. Cash out your dollar balance anytime after a short timer.
                                                Die and your dollars drop on the map for others. The circular arena shrinks before each reset.
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="stat-row" style={{ marginBottom: '3px' }}>
                                                <span>Entry fee</span>
                                                <span className="mono">{formatUsd(entryFeeForSession)}</span>
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
                                    <SnakeSkinPreview color={selectedSkin} isLarge={false} />
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
            </div>
            )}

            {/* SOL price + footer */}
            <div className="pregame-bottom-bar">
                <AppFooter />
            </div>

            {/* Customizer Modal Overlay */}
            {showCustomizer && (() => {
                const getChromaName = (color) => {
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
                const isRandomSelection = currentChroma === 'random';
                const isRainbow = customizerTab !== 'surviv' && isRandomSelection;
                const displayChroma = isRandomSelection ? '#80d0d0' : currentChroma;

                const cycleChroma = (direction) => {
                    if (isRandomSelection) return;

                    const chromas = [
                        '#c080ff', '#9099ff', '#80d0d0', '#80ff80',
                        '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0'
                    ];
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
                    if (style === 'rainbow' || style === 'random') {
                        if (customizerTab === 'slither') setSelectedSkin('random');
                        else if (customizerTab === 'surviv') setSelectedSkinSurviv('random');
                        else setSelectedSkinAgar('random');
                    } else {
                        if (customizerTab === 'slither') setSelectedSkin('#c080ff');
                        else if (customizerTab === 'surviv') setSelectedSkinSurviv('#c080ff');
                        else setSelectedSkinAgar('#c080ff');
                    }
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
                                            <AgarBlobPreview color={selectedSkinAgar} isLarge={true} nickname={nickname} />
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
                                            className={`skin-card ${!isRandomSelection ? 'active' : ''}`}
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
                                            className={`skin-card ${isRandomSelection ? 'active' : ''}`}
                                            onClick={() => setSkinStyle(customizerTab === 'surviv' ? 'random' : 'rainbow')}
                                        >
                                            <div className={`skin-card-icon ${customizerTab === 'surviv' ? 'surviv-random-icon' : 'rainbow-icon'}`}></div>
                                            <span>{customizerTab === 'surviv' ? 'Random' : 'Rainbow'}</span>
                                        </button>
                                    </div>

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

            <RewardsWidget />
        </div>
    );
}

function SurvivSkinPreview({ color, isLarge, nickname }) {
    const isRandom = color === 'random';
    const displayColor = isRandom ? '#80d0d0' : color;
    const displayName = (nickname || 'SURVIV').slice(0, 10).toUpperCase();

    return (
        <div
            className={`surviv-skin-preview ${isLarge ? 'large' : 'small'} ${isRandom ? 'is-random' : ''}`}
            style={{ '--surviv-skin-color': displayColor }}
        >
            <div className="surviv-preview-grid" aria-hidden="true"></div>
            <div className="surviv-preview-shadow" aria-hidden="true"></div>
            <div className="surviv-preview-player">
                <div className="surviv-preview-arm left" aria-hidden="true"></div>
                <div className="surviv-preview-arm right" aria-hidden="true"></div>
                <div className="surviv-preview-body">
                    <div className="surviv-preview-vest" aria-hidden="true"></div>
                    <div className="surviv-preview-head" aria-hidden="true"></div>
                </div>
                <div className="surviv-preview-weapon" aria-hidden="true"></div>
            </div>
            {isLarge && <div className="surviv-preview-name">{displayName}</div>}
        </div>
    );
}

/* ── SnakeSkinPreview ── */
function SnakeSkinPreview({ color, isLarge }) {
    const canvasRef = useRef(null);
    const tRef = useRef(0);
    const colorRef = useRef(color);

    // Keep colorRef updated without re-triggering the main animation effect
    useEffect(() => {
        colorRef.current = color;
    }, [color]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let animationFrameId;
        const segmentsCount = isLarge ? 32 : 24;
        const radius = isLarge ? 13 : 13.5;
        const spacing = isLarge ? 6 : 6;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const totalLength = segmentsCount * spacing;
        const headX = centerX + (totalLength / 2) - radius * 1.2;

        const amp = isLarge ? 20 : 9;
        const wiggleSpeed = isLarge ? 0.045 : 0.055;

        const render = () => {
            tRef.current += 1;
            const t = tRef.current;
            const currentColor = colorRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Compute points directly using sine wave to eliminate memory shifting and distance search CPU overhead
            const points = [];
            for (let i = 0; i < segmentsCount; i++) {
                const x = headX - i * spacing;
                const y = centerY + Math.sin(t * wiggleSpeed - i * 0.35) * amp;
                points.push({ x, y });
            }

            // Draw shadow & body segments from tail to head
            for (let i = points.length - 1; i >= 0; i--) {
                const pt = points[i];
                let segColorHex = currentColor;
                if (currentColor === 'random') {
                    const colors = [
                        '#c080ff', '#9099ff', '#80d0d0', '#80ff80',
                        '#eeee70', '#ffa060', '#ff9050', '#ff4040', '#e030e0'
                    ];
                    const colorIndex = Math.floor((t * 0.15 + i * 0.45) % colors.length);
                    segColorHex = colors[colorIndex];
                }

                let segmentAngle = 0;
                if (i > 0) {
                    segmentAngle = Math.atan2(points[i - 1].y - pt.y, points[i - 1].x - pt.x);
                } else if (points[i + 1]) {
                    segmentAngle = Math.atan2(pt.y - points[i + 1].y, pt.x - points[i + 1].x);
                }

                const segmentCanvas = getSnakeSegmentCanvas(radius, segColorHex);
                const shadowCanvas = getSnakeShadowCanvas(radius);

                ctx.save();
                ctx.translate(pt.x, pt.y);

                // Draw drop shadow
                ctx.save();
                ctx.translate(0, radius * 0.12);
                ctx.scale(1, 0.75);
                ctx.globalAlpha = 0.5;
                const shadowHalf = shadowCanvas.width / 2;
                ctx.drawImage(shadowCanvas, -shadowHalf, -shadowHalf);
                ctx.restore();

                // Draw segment
                ctx.rotate(segmentAngle);
                const segHalf = segmentCanvas.width / 2;
                ctx.drawImage(segmentCanvas, -segHalf, -segHalf);

                ctx.restore();
            }

            // Draw eyes on the head segment
            const head = points[0];
            const next = points[1];
            if (head && next) {
                const headAngle = Math.atan2(head.y - next.y, head.x - next.x);
                const perpX = Math.sin(headAngle);
                const perpY = -Math.cos(headAngle);
                const fwdX = Math.cos(headAngle);
                const fwdY = Math.sin(headAngle);

                const eyeSide = radius * 0.39;
                const eyeFwd = radius * 0.31;
                const eyeR = Math.max(2.5, radius * 0.43);
                const pupilR = eyeR * 0.48;

                for (const side of [-1, 1]) {
                    const ex = head.x + fwdX * eyeFwd + perpX * eyeSide * side;
                    const ey = head.y + fwdY * eyeFwd + perpY * eyeSide * side;

                    ctx.beginPath();
                    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();

                    const px = ex + fwdX * eyeR * 0.4;
                    const py = ey + fwdY * eyeR * 0.4;
                    ctx.beginPath();
                    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
                    ctx.fillStyle = '#000000';
                    ctx.fill();
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isLarge]);

    return (
        <div className="snake-preview-wrapper" style={{ width: '100%', height: isLarge ? '200px' : '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <canvas
                ref={canvasRef}
                width={isLarge ? 450 : 250}
                height={isLarge ? 200 : 100}
                style={{ height: '100%', width: '100%', objectFit: 'contain', display: 'block' }}
            />
        </div>
    );
}

/* ── AgarBlobPreview ── */
function AgarBlobPreview({ color, isLarge, nickname }) {
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

        const render = () => {
            tRef.current += 1;
            const t = tRef.current;
            const currentColor = colorRef.current;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Generate fill and border colors identical to the in-game rendering logic
            let fillStyle = currentColor;
            let strokeStyle = '#000000';

            if (currentColor === 'random') {
                const hue = (t * 0.35) % 360;
                fillStyle = `hsl(${hue}, 100%, 55%)`;
                strokeStyle = `hsl(${hue}, 100%, 42%)`;
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

                ctx.fill();
                ctx.stroke();
                ctx.restore();

                if (drawName) {
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
    }, [isLarge, nickname]);

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

