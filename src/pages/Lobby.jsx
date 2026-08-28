import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { createQR } from '@solana/pay';
import '../styles/ui.css';
import CurrencySwitchButton from '../components/CurrencySwitchButton';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import { MIN_ENTRY_FEE } from '../constants/economy';
import { setPageSeo, SEO } from '../utils/seo';
import { API_URL } from '../utils/apiBase';
import { hasUnlockedFreeTicket } from '../utils/freeTicket';
import useBalanceCurrency from '../hooks/useBalanceCurrency';

const SolLogo = ({ size = 13, style }) => (
    <img src="/solana-sol-logo.png" alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} />
);

export default function Lobby() {
    const { user, logout, token, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [arenaError, setArenaError] = useState('');
    const [isAlreadyInGame, setIsAlreadyInGame] = useState(false);
    const [balanceCurrency, setBalanceCurrency] = useBalanceCurrency();
    const isCurSOL = balanceCurrency === 'SOL';
    const setIsCurSOL = useCallback(value => setBalanceCurrency(value ? 'SOL' : 'USD'), [setBalanceCurrency]);
    const solPrice = user?.solPrice || 64;

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
                                        const r = await fetch(`${API_URL}/api/game-status?t=${Date.now()}`, {
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
                                        <CurrencySwitchButton
                                            value={isCurSOL ? 'SOL' : 'USD'}
                                            onChange={v => setIsCurSOL(v === 'SOL')}
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
            <main className="deposit-page">

                {/* Header */}
                <header className="deposit-hero">
                    <h1>
                        Fund Your Arena
                    </h1>
                    <p>
                        {hasUnlockedFreeTicket(user) ? (
                            <span className="deposit-ticket-note">✨ Free Ticket available! Enter the arena below.</span>
                        ) : (
                            `Deposit $${MIN_ENTRY_FEE} minimum to enter the arena.`
                        )}
                    </p>
                </header>

                {/* Deposit Card */}
                <section className="product-surface deposit-card">
                    <div className="deposit-card__header">
                        <span className="label">Deposit</span>
                        <div className="deposit-card__status">
                            <div className="live-dot" />
                            <span>ARENA STAKE</span>
                        </div>
                    </div>

                    <div className="deposit-card__body">
                        <div ref={qrRef} className="qr-container" />
                        <div className="deposit-address-field">
                            <div className="label">Deposit Address</div>
                            <div className="mono deposit-address-value">
                                {depositAddress || 'Generating…'}
                            </div>
                            <button
                                onClick={() => { if (depositAddress) navigator.clipboard.writeText(depositAddress); setStatusMsg('✅ Address copied!'); }}
                                className="btn btn-ghost deposit-copy-button"
                            >
                                COPY ADDRESS
                            </button>
                        </div>
                        <p className="deposit-card__help">
                            Send SOL to this address from any Solana wallet. Your balance updates automatically after confirmation.
                        </p>
                    </div>

                    {statusMsg && (
                        <div className={`status-msg deposit-card__message ${statusClass}`}>
                            {statusMsg}
                        </div>
                    )}
                </section>

                {/* Enter game button */}
                <button
                    className="btn btn-primary deposit-enter-button"
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
                    <div className="deposit-error" role="alert">
                        {arenaError}
                    </div>
                )}
            </main>

            {/* Footer */}
            <AppFooter />
        </div>
    );
}
