import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createQR } from '@solana/pay';
import '../styles/ui.css';
import CustomDropdown from '../components/CustomDropdown';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import GuestWelcomeBanner from '../components/GuestWelcomeBanner';
import GamemodeDiscoveryPrompt from '../components/GamemodeDiscoveryPrompt';
import { markGamemodePlayed, shouldShowDiscoveryPrompt } from '../constants/gamemodes';
import { ENTRY_TIERS, BR_ENTRY_TIERS, COMPETITIVE_ENTRY_TIERS, DEFAULT_ENTRY_FEE, DEFAULT_BR_ENTRY_FEE, DEFAULT_COMPETITIVE_ENTRY_FEE, tierEconomy, competitiveTierEconomy, formatUsd } from '../constants/economy';
import { setPageSeo, SEO } from '../utils/seo';
import { trackMixpanelEvent } from '../utils/mixpanel';
import { isBattleRoyaleAvailable, isBattleRoyaleMode as isBRGamemode, normalizeGamemodeForLobby } from '../constants/features';

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

const getOrCreatePresenceId = () => {
    const key = 'site_presence_id';
    let id = localStorage.getItem(key);
    if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(key, id);
    }
    return id;
};

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
    const raw = stored || locationStateMode || 'agar';
    return normalizeGamemodeForLobby(raw, isAdmin);
}

export default function PreGame() {
    const { user, logout, token, login, refreshUser, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    // ── State ──────────────────────────────────────────
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
    const [isCurSOL, setIsCurSOL] = useState(false);
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

    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');
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
    const economy = isCompetitiveSlitherMode
        ? competitiveTierEconomy(entryFeeForSession)
        : tierEconomy(entryFeeForSession);
    const brVariant = isBattleRoyaleMode ? selectedMode.replace(/^br-/, '') : null;
    const tierOptions = isCompetitiveSlitherMode
        ? COMPETITIVE_ENTRY_TIERS
        : (isBattleRoyaleMode ? BR_ENTRY_TIERS : ENTRY_TIERS);

    useEffect(() => {
        if (isCompetitiveSlitherMode && !COMPETITIVE_ENTRY_TIERS.includes(selectedEntryFee)) {
            setSelectedEntryFee(DEFAULT_COMPETITIVE_ENTRY_FEE);
        }
        if (isBattleRoyaleMode && !BR_ENTRY_TIERS.includes(selectedEntryFee)) {
            setSelectedEntryFee(DEFAULT_BR_ENTRY_FEE);
        }
    }, [selectedMode, isBattleRoyaleMode, isCompetitiveSlitherMode, selectedEntryFee]);

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


    const siteUsersOnline = liveStats.siteUsersOnline ?? liveStats.totalPlayersOnline ?? 0;
    const globalCashoutTotalUsd =
        liveStats.globalPlayerEarningsUsd
        ?? liveStats.totalUserBalanceUsd
        ?? leaderboardData.globalEarningsUsd
        ?? 0;

    const balanceSol = user?.balanceSol || 0;
    const balanceUsd = user?.balanceUsd ?? (balanceSol * solPrice);
    const freePlay = !!user?.freePlay;

    const canJoin = freePlay || balanceUsd >= entryFeeForSession;

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
        if (qrRef.current && depositAddress && depositMethod === 'manual') {
            qrRef.current.innerHTML = '';
            try {
                const qr = createQR(
                    `solana:${depositAddress}?amount=0&label=AgarStake&message=Deposit`,
                    190, 'white', 'black'
                );
                qr.append(qrRef.current);
            } catch (e) { }
        }
    }, [depositAddress, depositMethod]);

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
        const presenceId = getOrCreatePresenceId();
        const fetchStats = async () => {
            try {
                const r = await fetch(`${API_URL}/api/stats?t=${Date.now()}`, {
                    headers: {
                        'bypass-tunnel-reminders': 'true',
                        'Cache-Control': 'no-cache',
                        'X-Presence-Id': presenceId,
                    },
                });
                if (r.ok && alive) setLiveStats(await r.json());
            } catch { }
        };
        fetchStats();
        const id = setInterval(fetchStats, 5000);
        return () => { alive = false; clearInterval(id); };
    }, [API_URL]);

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

        const targetPath = (activeMode === 'slither' || activeMode === 'competitive-slither') ? '/slither-game' : '/game';
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
            if (token) {
                const mr = await fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
                if (mr.ok) login(await mr.json(), token);
            }
            setStatusMsg(`✅ ${solAmt.toFixed(4)} SOL deposited!`);
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

    const isSlitherFamily = selectedMode === 'slither'
        || selectedMode === 'competitive-slither'
        || (isBattleRoyaleMode && brVariant === 'slither');
    const modeCardTitle = isSlitherFamily ? 'Slither' : 'Agar';
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
                    ? `In ${currentGameMode?.startsWith('br-') ? 'BR' : (currentGameMode === 'slither' ? 'Slither' : 'Agar')} — switch mode`
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

            <div className="pre-game-grid">
                <div className="mode-card">
                    <span className="mode-card-label">Gamemode</span>
                    <div className="mode-card-title mode-card-title--stacked">
                        {modeCardTitle.toUpperCase()}
                    </div>
                    <div className="mode-card-subtitle">{modeSubtitle}</div>
                    <button
                        type="button"
                        className="mode-card-action"
                        onClick={() => navigate('/gamemodes', { state: { selectedMode: isBattleRoyaleMode ? brVariant : selectedMode } })}
                    >
                        Change
                    </button>

                    <div className="mode-card-stake">
                        <span className="label" style={{ display: 'block', marginBottom: '8px' }}>
                            {isBattleRoyaleMode ? 'Entry fee' : 'Entry stake'}
                        </span>
                        <div className="entry-tier-row">
                            {tierOptions.map(tier => {
                                const locked = isAlreadyInGame && activeEntryFee != null && tier !== activeEntryFee;
                                const active = entryFeeForSession === tier;
                                return (
                                    <button
                                        key={tier}
                                        type="button"
                                        className={`entry-tier-btn${active ? ' entry-tier-btn--active' : ''}${locked ? ' entry-tier-btn--locked' : ''}`}
                                        disabled={locked || isMatchmaking}
                                        onClick={() => !isAlreadyInGame && setSelectedEntryFee(tier)}
                                    >
                                        {freePlay ? 'FREE' : `$${tier}`}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mode-playing-count">
                            <span className="live-dot" aria-hidden="true" />
                            <span>
                                Playing: <span className="mono">{siteUsersOnline}</span>
                            </span>
                        </div>
                    </div>
                </div>

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

                    <div className="entry-row" style={{ marginBottom: '18px' }}>
                        <span className="label">Entry Fee</span>
                        <span className="mono" style={{ color: 'var(--text-h)', fontSize: '0.85rem', fontWeight: 700 }}>
                            {freePlay ? 'FREE (Test)' : formatUsd(entryFeeForSession)}
                        </span>
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
                                {isCompetitiveSlitherMode ? (
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

                <div className="right-panel-stack">
                    <div className="leaderboard-card">
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

            {/* SOL price + footer */}
            <div className="pregame-bottom-bar">
                <div className="sol-price-pill">
                    <SolLogo size={14} />
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 700 }}>
                        ${solPrice.toFixed(2)}
                    </span>
                </div>
                <AppFooter />
            </div>
        </div>
    );
}