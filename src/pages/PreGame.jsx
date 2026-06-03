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

/* ── Solana logo icon ── */
const SolLogo = ({ size = 13, style }) => (
    <img
        src="/solana-sol-logo.png"
        alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0, ...style }}
    />
);

/* ── Currency toggle options ── */
const CUR_OPTIONS = [
    { label: 'USD', value: 'USD' },
    { label: 'SOL', value: 'SOL' },
];

export default function PreGame() {
    const { user, logout, token, login, refreshUser, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    // ── State ──────────────────────────────────────────
    const [solPrice] = useState(150);
    const [showUserMenu, setShowUserMenu]       = useState(false);
    const [isWalletOpen, setIsWalletOpen]       = useState(false);
    const [isWalletExpanded, setIsWalletExpanded]   = useState(false);
    const [isWithdrawExpanded, setIsWithdrawExpanded] = useState(false);
    const [depositMethod, setDepositMethod]     = useState('wallet');
    const [amount, setAmount]                   = useState('');
    const [withdrawAmount, setWithdrawAmount]   = useState('');
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [isValidWithdrawAddress, setIsValidWithdrawAddress] = useState(true);
    const [displayFullAddress, setDisplayFullAddress] = useState(false);
    const [isCurSOL, setIsCurSOL]               = useState(false);
    const [statusMsg, setStatusMsg]             = useState('');
    const [isMatchmaking, setIsMatchmaking]     = useState(false);
    const [isAlreadyInGame, setIsAlreadyInGame] = useState(false);
    const [liveStats, setLiveStats]             = useState({ playersOnline: 0, biggestPayout: 0, topPlayer: null });
    const [showHowItWorks, setShowHowItWorks]   = useState(false);
    const [leaderboardTab, setLeaderboardTab]   = useState('alltime');
    const [leaderboardData, setLeaderboardData] = useState({ alltime: [], week: [] });
    const [nickname, setNickname]               = useState(
        () => localStorage.getItem('match_nickname') || user?.username || ''
    );
    const [selectedMode] = useState(location.state?.selectedMode || 'agar');

    // Panel drag
    const [panelPos, setPanelPos]       = useState({ x: null, y: 60 });
    const [isDragging, setIsDragging]   = useState(false);
    const [walletModalActive, setWalletModalActive] = useState(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // Refs
    const userMenuRef       = useRef(null);
    const userPillRef       = useRef(null);
    const walletDropRef     = useRef(null);
    const walletExpandRef   = useRef(null);
    const withdrawExpandRef = useRef(null);
    const qrRef             = useRef(null);

    const depositAddress    = user?.depositAddress;
    const SOL_ADDR_REGEX    = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const ENTRY_FEE         = 10.00;
    const canJoin           = (user?.balance || 0) >= ENTRY_FEE;

    // ── Format helpers ─────────────────────────────────
    const fmt = (v) => {
        const n = Number(v || 0);
        if (!isFinite(n)) return '0';
        if (n >= 10000) return Math.round(n).toString();
        if (n >= 1000)  return n.toFixed(1);
        if (n >= 1)     return n.toFixed(2);
        if (n > 0)      return n.toFixed(4);
        return '0';
    };

    const shortAddr = (addr, chars = 5) =>
        addr && addr.length > chars * 2 + 3
            ? `${addr.slice(0, chars)}…${addr.slice(-chars)}`
            : addr;

    const statusClass = statusMsg.startsWith('✅') || statusMsg.includes('copied')
        ? 'success' : statusMsg.startsWith('❌') ? 'error' : 'info';

    // ── Effects ────────────────────────────────────────
    useEffect(() => { document.title = 'AgarStake | Arena'; }, []);

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
            } catch (e) {}
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

    // Live stats poll
    useEffect(() => {
        let alive = true;
        const fetchStats = async () => {
            try {
                const r = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/stats?t=${Date.now()}`, {
                    headers: { 'bypass-tunnel-reminders': 'true', 'Cache-Control': 'no-cache' }
                });
                if (r.ok && alive) setLiveStats(await r.json());
            } catch {}
        };
        fetchStats();
        const id = setInterval(fetchStats, 5000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    // Leaderboard poll
    useEffect(() => {
        let alive = true;
        const fetchLeaderboard = async () => {
            try {
                const r = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/leaderboard?t=${Date.now()}`, {
                    headers: { 'bypass-tunnel-reminders': 'true', 'Cache-Control': 'no-cache' }
                });
                if (r.ok && alive) {
                    const d = await r.json();
                    setLeaderboardData({
                        alltime: d.alltime || [],
                        week: d.week || []
                    });
                }
            } catch {}
        };
        fetchLeaderboard();
        const id = setInterval(fetchLeaderboard, 15000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    // Balance poll
    useEffect(() => {
        refreshUser();
        const id = setInterval(refreshUser, 5000);
        return () => clearInterval(id);
    }, [refreshUser]);

    // Game status check
    useEffect(() => {
        if (!token) return;
        (async () => {
            try {
                const r = await fetch(`${import.meta.env.VITE_API_URL}/api/game-status`, {
                    headers: { Authorization: `Bearer ${token}`, 'bypass-tunnel-reminders': 'true' }
                });
                if (r.ok) {
                    const d = await r.json();
                    setIsAlreadyInGame(d.inGame);
                }
            } catch {}
        })();
    }, [token]);

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
        
        // Om man försöker joina slither men redan är i ett agar game (eller vice versa)
        if (isAlreadyInGame && !canRejoinThisMode) return;

        if (!canJoin && !isAlreadyInGame) { navigate('/lobby'); return; }
        setIsMatchmaking(true);
        refreshUser();
        localStorage.setItem('match_nickname', nickname);
        const targetPath = selectedMode === 'slither' ? '/slither-game' : '/game';
        setTimeout(() => navigate(targetPath, { state: { nickname, selectedMode } }), 1200);
    };

    // Enkel kontroll om vi kan rejoina (Placeholder tills API returnerar mode)
    // Om vi antar att "isAlreadyInGame" alltid är Agar just nu om man byter till Slither
    const canRejoinThisMode = isAlreadyInGame && selectedMode === 'agar';

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
            const vr = await fetch(`${import.meta.env.VITE_API_URL}/api/deposit-verify`, {
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
                const mr = await fetch(`${import.meta.env.VITE_API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
                if (mr.ok) login(await mr.json(), token);
            }
            setStatusMsg(`✅ ${solAmt.toFixed(4)} SOL deposited!`);
            setAmount('');
        } catch (err) {
            const m = err.message || '';
            if (m.includes('User rejected'))      setStatusMsg('❌ Cancelled in wallet.');
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
            const r = await fetch(`${import.meta.env.VITE_API_URL}/api/withdraw`, {
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
        left:      panelPos.x !== null ? panelPos.x : '50%',
        top:       panelPos.y,
        transform: panelPos.x !== null ? 'none' : 'translateX(-50%)',
        cursor:    isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : undefined,
    };

    // ── Play button variant ─────────────────────────────
    const playBtnClass = !isAuthenticated ? 'play-btn play-btn-login'
        : (isAlreadyInGame && canRejoinThisMode) ? 'play-btn play-btn-rejoin'
        : (isAlreadyInGame && !canRejoinThisMode) ? 'play-btn play-btn-disabled'
        : canJoin ? 'play-btn play-btn-ready'
        : 'play-btn play-btn-disabled';

    const playBtnLabel = isMatchmaking
        ? <><span className="spinner" /> Joining…</>
        : !isAuthenticated ? 'Play Now'
        : (isAlreadyInGame && canRejoinThisMode) ? 'Rejoin Arena'
        : (isAlreadyInGame && !canRejoinThisMode) ? 'Already in Arena'
        : canJoin          ? 'Enter Arena'
        : 'Deposit to Play';

    // ── Render ─────────────────────────────────────────
    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <Background />

            {/* ── Top Bar ── */}
            <nav className="topbar">
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/pre-game')}>
                        <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent)' }} />
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>
                            AGAR<span style={{ color: 'var(--accent)' }}>STAKE</span>
                        </span>
                    </div>

                    <button 
                        onClick={() => navigate('/gamemodes')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.target.style.color = '#fff'}
                        onMouseLeave={e => e.target.style.color = 'var(--text-2)'}
                    >
                        GAME MODE
                    </button>
                </div>

                {/* Nav right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                        {isCurSOL ? (
                                            <SolLogo size={12} />
                                        ) : (
                                            <span style={{ opacity: 0.45, fontSize: '0.7rem', fontFamily: 'var(--sans)' }}>USD</span>
                                        )}
                                        <span style={{ color: 'var(--text-bright)', fontSize: '0.82rem' }}>
                                            {isCurSOL
                                                ? (user.balance / solPrice).toFixed(2)
                                                : `$${fmt(user.balance)}`}
                                        </span>
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
                                                    ? (user.balance / solPrice).toFixed(2)
                                                    : fmt(user.balance)}
                                                </span>
                                            </div>
                                            <div className="wallet-card-sub">
                                                {isCurSOL
                                                    ? `≈ $${fmt(user.balance)} USD`
                                                    : `≈ ${(user.balance / solPrice).toFixed(2)} SOL`}
                                            </div>

                                            {/* Action buttons */}
                                            <div className="wallet-card-actions">
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => { setIsWalletOpen(false); setIsWithdrawExpanded(false); setIsWalletExpanded(true); setDepositMethod('wallet'); }}
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
                                className="nav-deposit-btn"
                                onClick={() => {
                                    if ((user?.balance || 0) === 0) navigate('/lobby');
                                    else { setIsWalletOpen(false); setIsWalletExpanded(true); }
                                }}
                            >
                                {(user?.balance || 0) === 0 ? '+ Add funds' : 'Deposit'}
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
            </nav>

            {/* ── Deposit Float Panel ── */}
            {isWalletExpanded && (
                <div ref={walletExpandRef} className="float-panel" style={panelStyle}>
                    <div
                        className="float-panel-header"
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
                        className="float-panel-header"
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
                                    readOnly
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
                                    onClick={() => setWithdrawAmount(user?.balance?.toFixed(2))}
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

            {/* ── Center Card ── */}
            <div className="game-card" style={{ maxWidth: '480px', padding: '40px' }}>
                {/* Mode info */}
                <div 
                    onClick={() => navigate('/gamemodes')}
                    style={{ 
                        marginBottom: '18px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', 
                        borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', 
                        justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Mode</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {selectedMode === 'slither' ? 'Slither Normal' : 'Agar Normal'}
                    </span>
                </div>

                {/* Nickname field */}
                <div style={{ marginBottom: '14px' }}>
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

                {/* Divider */}
                <div className="divider" style={{ marginBottom: '14px' }} />

                {/* Entry fee row */}
                <div className="entry-row" style={{ marginBottom: '12px' }}>
                    <span className="label">Entry Fee</span>
                    <span className="mono" style={{ color: 'var(--text-h)', fontSize: '0.85rem', fontWeight: 700 }}>
                        $10.00
                    </span>
                </div>

                {/* Play button */}
                <button
                    className={playBtnClass}
                    onClick={handleStartMatch}
                    disabled={isMatchmaking}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    {playBtnLabel}
                </button>

                {/* How it works */}
                <div style={{ marginTop: '14px' }}>
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
                    {showHowItWorks && (
                        <div className="hiw-content">
                            <div className="stat-row" style={{ marginBottom: '3px' }}>
                                <span>Entry fee</span>
                                <span className="mono">$10.00</span>
                            </div>
                            <div className="stat-row" style={{ marginBottom: '3px' }}>
                                <span>Starting balance</span>
                                <span className="mono">$1.00</span>
                            </div>
                            <div style={{ marginTop: '8px', marginBottom: '4px', opacity: 0.5, fontSize: '0.6rem' }}>
                                Eat food & other players. Cash out anytime.
                            </div>
                            <div className="divider" style={{ margin: '6px 0' }} />
                            <div className="stat-row" style={{ marginBottom: '2px' }}>
                                <span>1st place bonus</span>
                                <span className="mono text-green">$20.00</span>
                            </div>
                            <div className="stat-row">
                                <span>2nd–3rd place</span>
                                <span className="mono text-green">$10.00</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Live Stats Card ── */}
            <div className="stats-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="label">Live</span>
                    <div className="live-dot" />
                </div>
                <div className="stat-row" style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>Players online</span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-h)', fontWeight: 700 }}>
                        {liveStats.playersOnline ?? 0}
                    </span>
                </div>
                <div className="stat-row">
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>Top player</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-h)', fontWeight: 700 }}>
                        {liveStats.topPlayer ?? '—'}
                    </span>
                </div>
            </div>

            {/* ── Leaderboard Card ── */}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                width: '200px',
                background: 'rgba(8,9,13,0.9)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '10px 12px',
                backdropFilter: 'blur(20px)',
                zIndex: 10
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leaderboard</span>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '8px' }}>
                    {[{ id: 'alltime', label: 'All Time' }, { id: 'week', label: 'This Week' }].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setLeaderboardTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: '4px 0',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                fontFamily: 'var(--sans)',
                                background: leaderboardTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                                color: leaderboardTab === tab.id ? '#fff' : 'var(--text-2)'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(leaderboardTab === 'alltime' ? leaderboardData.alltime : leaderboardData.week).length === 0 ? (
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textAlign: 'center', padding: '6px 0' }}>No data yet</div>
                    ) : (
                        (leaderboardTab === 'alltime' ? leaderboardData.alltime : leaderboardData.week).slice(0, 5).map((entry, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                                <span style={{ color: i === 0 ? '#FFD700' : 'var(--text-bright)', fontWeight: i === 0 ? 700 : 400 }}>
                                    {i + 1}. {entry.username}
                                </span>
                                <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--green)' }}>
                                    ${Number(entry.amount || entry.balance || 0).toFixed(2)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="footer-links">
                <span>Terms</span>
                <span>Provably Fair</span>
                <span>Support</span>
                <span style={{ opacity: 0.5 }}>EU-West · Online</span>
            </div>
        </div>
    );
}