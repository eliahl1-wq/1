import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { createQR } from '@solana/pay';
import '../styles/ui.css';
import CustomDropdown from '../components/CustomDropdown';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import { MIN_ENTRY_FEE } from '../constants/economy';
import { setPageSeo, SEO } from '../utils/seo';
import { API_URL } from '../utils/apiBase';
import { hasUnlockedFreeTicket } from '../utils/freeTicket';

const SolLogo = ({ size = 13, style }) => (
    <img src="/solana-sol-logo.png" alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0, ...style }} />
);

const CUR_OPTIONS = [
    { label: 'USD', value: 'USD' },
    { label: 'SOL', value: 'SOL' },
];

export default function Lobby() {
    const { user, logout, token, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [arenaError, setArenaError] = useState('');
    const [isAlreadyInGame, setIsAlreadyInGame] = useState(false);
    const [isCurSOL, setIsCurSOL] = useState(() => localStorage.getItem('balance_currency') === 'SOL');
    const solPrice = user?.solPrice || 64;

    useEffect(() => {
        localStorage.setItem('balance_currency', isCurSOL ? 'SOL' : 'USD');
    }, [isCurSOL]);

    const qrRef = useRef(null);
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);

    const depositAddress = user?.depositAddress;

    const statusClass = statusMsg.startsWith('✅') || statusMsg.includes('copied')
        ? 'success' : (statusMsg.includes('failed') || statusMsg.includes('Error') || statusMsg.startsWith('❌'))
            ? 'error' : 'info';


    // Click outside user menu
    const handleClickOutside = useCallback((e) => {
        if (userMenuRef.current && !userMenuRef.current.contains(e.target) &&
            userPillRef.current && !userPillRef.current.contains(e.target)) {
            setShowUserMenu(false);
        }
    }, []);

    useEffect(() => {
        if (showUserMenu) document.addEventListener('mousedown', handleClickOutside);
        else document.removeEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUserMenu, handleClickOutside]);

    useEffect(() => {
        setPageSeo(SEO.lobby);
    }, []);

    useEffect(() => {
        if (token) {
            refreshUser();
            let alive = true;
            const check = async () => {
                try {
                                        const r = await fetch(`${apiUrl}/api/game-status?t=${Date.now()}`, {
                        headers: { Authorization: `Bearer ${token}`, 'bypass-tunnel-reminders': 'true', 'Cache-Control': 'no-cache' }
                    });
                    if (r.ok && alive) {
                        const d = await r.json();
                        setIsAlreadyInGame(!!d.inGame);
                    }
                } catch { }
            };
            check();
            const statusId = setInterval(check, 10000);

            return () => { alive = false; clearInterval(statusId); };
        }
    }, [token, refreshUser]);

    // Always show the account's deposit QR code. External wallet connections are disabled.
    useEffect(() => {
        if (qrRef.current && depositAddress) {
            qrRef.current.innerHTML = '';
            try {
                const qr = createQR(`solana:${depositAddress}?amount=0&label=AgarStake&message=Deposit`, 190, 'white', 'black');
                qr.append(qrRef.current);
            } catch { }
        }
        return () => { if (qrRef.current) qrRef.current.innerHTML = ''; };
    }, [depositAddress]);

    // A free ticket normally skips the deposit lobby. When the player arrived
    // via "Deposit to play", the selected game cannot use that ticket, so stay
    // here until the wallet is actually funded.
    useEffect(() => {
        const balanceUsd = user?.balanceUsd ?? ((user?.balanceSol || 0) * (user?.solPrice || solPrice));
        const hasFreeTicket = hasUnlockedFreeTicket(user);
        const depositIntent = location.state?.depositIntent === true;
        const requiredBalanceUsd = Number(location.state?.requiredBalanceUsd) || MIN_ENTRY_FEE;
        if (user?.freePlay || balanceUsd >= requiredBalanceUsd || (hasFreeTicket && !depositIntent)) {
            navigate('/pre-game', { state: { selectedMode: location.state?.selectedMode } });
        }
    }, [user?.freePlay, user?.hasFreeTicket, user?.freeTicketUsed, user?.freeTicketChallengeCompleted, user?.rewardsDisabled, user?.balanceUsd, user?.balanceSol, user?.solPrice, location.state, navigate, solPrice]);

    const currentBalanceSol = user?.balanceSol || 0;
    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />

            <AppTopbar>
                {user && (
                    <div className="topbar-right">
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                                ref={userPillRef}
                                className={`user-pill${showUserMenu ? ' active' : ''}`}
                                onClick={() => setShowUserMenu(v => !v)}
                            >
                                <div className="avatar">
                                    {user.username?.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <span className="topbar-user-name" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
                                {user.username}
                            </span>
                            <span className="topbar-user-balance-inline mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isCurSOL
                                    ? <><SolLogo size={12} /> {currentBalanceSol.toFixed(4)}</>
                                    : `$${(currentBalanceSol * solPrice).toFixed(2)}`}
                            </span>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                                style={{ opacity: 0.35, transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                                <path d="M6 9l6 6 6-6" />
                            </svg>

                            {showUserMenu && (
                                <div ref={userMenuRef} className="user-menu">
                                    {/* Currency toggle in menu */}
                                    <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                                        <span className="label">Currency</span>
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
                                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/transactions'); }}>Transaction History</button>
                                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/profile'); }}>My Profile</button>
                                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/rewards#affiliate-rewards'); }}>Refer & Earn</button>
                                    <button className="user-menu-item danger" onClick={logout}>Log Out</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </AppTopbar>

            {/* ── Center Content ── */}
            <div style={{ zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '72px 16px 40px', width: '100%', maxWidth: '440px', boxSizing: 'border-box' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                    <h1 style={{ margin: '0 0 6px 0', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-h)', lineHeight: 1.05 }}>
                        Fund Your Arena
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.85rem', fontWeight: 500 }}>
                        {hasUnlockedFreeTicket(user) ? (
                            <span style={{ color: 'var(--green)', fontWeight: 700 }}>✨ Free Ticket available! Enter the arena below.</span>
                        ) : (
                            `Deposit $${MIN_ENTRY_FEE} minimum to enter the arena.`
                        )}
                    </p>
                </div>

                {/* Deposit Card */}
                <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-2xl)',
                    padding: '22px',
                    width: '100%',
                    boxSizing: 'border-box',
                    boxShadow: 'var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span className="label">Deposit</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="live-dot" />
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>ARENA STAKE</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                        <div ref={qrRef} className="qr-container" />
                        <div style={{ width: '100%' }}>
                            <div className="label" style={{ marginBottom: '4px' }}>Deposit Address</div>
                            <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--green)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                                {depositAddress || 'Generating…'}
                            </div>
                            <button
                                onClick={() => { if (depositAddress) navigator.clipboard.writeText(depositAddress); setStatusMsg('✅ Address copied!'); }}
                                style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', color: 'var(--blue)', fontSize: '0.67rem', fontWeight: 700, borderRadius: 'var(--r-md)', cursor: 'pointer', letterSpacing: '0.04em' }}
                            >
                                COPY ADDRESS
                            </button>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.68rem', lineHeight: 1.5, textAlign: 'center' }}>
                            Send SOL to this address from any Solana wallet. Your balance updates automatically after confirmation.
                        </p>
                    </div>

                    {statusMsg && (
                        <div className={`status-msg ${statusClass}`} style={{ marginTop: '10px' }}>
                            {statusMsg}
                        </div>
                    )}
                </div>

                {/* Enter game button */}
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '0.9rem', borderRadius: 'var(--r-lg)', letterSpacing: '0.01em' }}
                    onClick={() => {
                        const balanceUsd = user?.balanceUsd ?? ((user?.balanceSol || 0) * (user?.solPrice || solPrice));
                        const hasFreeTicket = hasUnlockedFreeTicket(user);
                        if (!isAlreadyInGame && !hasFreeTicket && balanceUsd < MIN_ENTRY_FEE) {
                            setArenaError(`Deposit at least $${MIN_ENTRY_FEE} to enter.`); return;
                        }
                        setArenaError('');
                        navigate('/pre-game');
                    }}
                >
                    {isAlreadyInGame ? 'Rejoin Arena' : 'Enter Arena'}
                </button>

                {arenaError && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>
                        {arenaError}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <AppFooter />
        </div>
    );
}
