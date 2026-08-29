import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { hasUnseenActiveTournament, TOURNAMENT_SEEN_EVENT } from '../utils/tournamentNotifications';
import useBalanceCurrency from '../hooks/useBalanceCurrency';
import CurrencySwitchButton from './CurrencySwitchButton';
import BrandLogo from './BrandLogo';

const DISCORD_URL = import.meta.env.VITE_DISCORD_URL?.trim() || 'https://discord.gg/m5mWMu8aF';

export default function AppTopbar({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [balanceCurrency, setBalanceCurrency] = useBalanceCurrency();
    const [menuOpen, setMenuOpen] = useState(false);
    const [hasTournamentNotification, setHasTournamentNotification] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);


    useEffect(() => {
        let active = true;
        const loadTournamentNotification = async () => {
            try {
                const response = await fetch(API_URL + '/api/tournaments?t=' + Date.now(), {
                    headers: { 'Cache-Control': 'no-cache' },
                });
                if (!response.ok) return;
                const data = await response.json();
                if (active) setHasTournamentNotification(hasUnseenActiveTournament(data.tournaments || []));
            } catch {
                // Keep navigation usable if tournament status cannot be loaded.
            }
        };
        const handleSeen = () => setHasTournamentNotification(false);
        loadTournamentNotification();
        const poll = setInterval(loadTournamentNotification, 60_000);
        window.addEventListener(TOURNAMENT_SEEN_EVENT, handleSeen);
        return () => {
            active = false;
            clearInterval(poll);
            window.removeEventListener(TOURNAMENT_SEEN_EVENT, handleSeen);
        };
    }, []);
    const isPathActive = (path) => {
        if (path === '/pre-game') {
            return ['/pre-game', '/agar', '/slither', '/surviv'].includes(location.pathname);
        }
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
    };
    const linkClass = (path) => (
        `gm-nav-link${isPathActive(path) ? ' gm-nav-link--active' : ''}`
    );
    const currentPage = (path) => (isPathActive(path) ? 'page' : undefined);
    const hasRewardNotification = !!user && (
        user.affiliateRewardsAvailable
        || Number(user.permanentRewards?.balanceUsd) > 0
        || Number(user.tournamentRewardsBalance) > 0
        || (user.sponsoredRewardsCompleted && user.sponsoredRewardsUnlocked && Number(user.sponsoredRewardsBalance) > 0)
        || (user.hasFreeTicket && !user.freeTicketUsed)
    );

    const navItems = (
        <>
            <button type="button" className={linkClass('/pre-game')} aria-current={currentPage('/pre-game')} onClick={() => navigate('/pre-game')}>
                Play
            </button>
            <button type="button" className={linkClass('/gamemodes')} aria-current={currentPage('/gamemodes')} onClick={() => navigate('/gamemodes')}>
                Modes
            </button>
            <button type="button" className={linkClass('/tournaments') + ' gm-nav-link--notification'} aria-current={currentPage('/tournaments')} onClick={() => navigate('/tournaments')}>
                <span>Tournaments</span>
                {hasTournamentNotification && <span className="gm-nav-notification-dot" aria-label="New tournament" />}
            </button>
            {user && (
                <button type="button" className={linkClass('/shop')} aria-current={currentPage('/shop')} onClick={() => navigate('/shop')}>
                    Shop
                </button>
            )}
            {user && (
                <button type="button" className={linkClass('/rewards') + ' gm-nav-link--notification'} aria-current={currentPage('/rewards')} onClick={() => navigate('/rewards')}>
                    <span>Rewards</span>
                    {hasRewardNotification && <span className="gm-nav-notification-dot" aria-label="Rewards available" />}
                </button>
            )}

            {user && (
                <button type="button" className={linkClass('/profile')} aria-current={currentPage('/profile')} onClick={() => navigate('/profile')}>
                    Performance
                </button>
            )}
            {user?.isAdmin && (
                <button type="button" className={linkClass('/admin')} aria-current={currentPage('/admin')} onClick={() => navigate('/admin')}>
                    Admin
                </button>
            )}
            <a
                className="gm-nav-link gm-nav-link--discord"
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join Arenifi on Discord"
                title="Discord"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        fill="currentColor"
                        d="M19.5 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.02a15.1 15.1 0 0 0-5.87 0L8.56 4A16.5 16.5 0 0 0 4.5 5.35C1.93 9.15 1.23 12.85 1.58 16.5a16.6 16.6 0 0 0 4.98 2.52l1.2-1.65a10.6 10.6 0 0 1-1.89-.91l.46-.36c3.64 1.69 7.6 1.69 11.2 0l.47.36c-.6.36-1.24.67-1.9.91l1.2 1.65a16.5 16.5 0 0 0 4.98-2.52c.42-4.23-.72-7.9-2.78-11.16ZM8.52 14.3c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27c1.13 0 2.02 1.03 2 2.27 0 1.25-.88 2.27-2 2.27Zm6.96 0c-1.1 0-2-1.02-2-2.27s.88-2.27 2-2.27c1.13 0 2.02 1.03 2 2.27 0 1.25-.87 2.27-2 2.27Z"
                    />
                </svg>
                <span className="gm-nav-discord-label">Discord</span>
            </a>
        </>
    );

    return (
        <>
            <nav className="topbar">
                <div className="topbar-left">
                    <button
                        type="button"
                        className="topbar-menu-btn"
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(v => !v)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            {menuOpen ? (
                                <>
                                    <path d="M6 6l12 12M18 6L6 18" />
                                </>
                            ) : (
                                <>
                                    <path d="M4 7h16M4 12h16M4 17h16" />
                                </>
                            )}
                        </svg>
                    </button>

                    <button type="button" className="logo" aria-label="Arenifi home" onClick={() => navigate('/pre-game')}>
                        <BrandLogo responsive />
                    </button>

                    <div className="topbar-nav topbar-nav--desktop">
                        {navItems}
                    </div>
                </div>

                <div className="topbar-right">
                    <div className="topbar-currency-switch" aria-label="Balance display currency">
                        <CurrencySwitchButton
                            value={balanceCurrency}
                            onChange={setBalanceCurrency}
                            className="currency-switch-button--topbar"
                        />
                    </div>
                    {children || (!user && (
                            <button type="button" className="nav-deposit-btn" onClick={() => navigate('/login')}>
                                Login
                            </button>
                    ))}
                </div>
            </nav>

            {menuOpen && (
                <div className="topbar-mobile-menu">
                    {navItems}
                </div>
            )}
        </>
    );
}
