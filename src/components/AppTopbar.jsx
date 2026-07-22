import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { hasUnseenActiveTournament, TOURNAMENT_SEEN_EVENT } from '../utils/tournamentNotifications';

export default function AppTopbar({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
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
    const linkClass = (path) => (
        `gm-nav-link${location.pathname === path ? ' gm-nav-link--active' : ''}`
    );

    const navItems = (
        <>
            <button type="button" className={linkClass('/pre-game')} onClick={() => navigate('/pre-game')}>
                Play
            </button>
            <button type="button" className={linkClass('/gamemodes')} onClick={() => navigate('/gamemodes')}>
                Modes
            </button>
            <button type="button" className={linkClass('/tournaments') + ' gm-nav-link--notification'} onClick={() => navigate('/tournaments')}>
                <span>Tournaments</span>
                {hasTournamentNotification && <span className="gm-nav-notification-dot" aria-label="New tournament" />}
            </button>
            {user && (
                <button type="button" className={linkClass('/rewards')} onClick={() => navigate('/rewards')}>
                    Rewards
                </button>
            )}

            {user && (
                <button type="button" className={linkClass('/profile')} onClick={() => navigate('/profile')}>
                    Performance
                </button>
            )}
            {user?.isAdmin && (
                <button type="button" className={linkClass('/admin')} onClick={() => navigate('/admin')}>
                    Admin
                </button>
            )}
            {!user && (
                <button type="button" className={linkClass('/login')} onClick={() => navigate('/login')}>
                    Login
                </button>
            )}
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

                    <div className="logo" onClick={() => navigate('/pre-game')}>
                        <div className="logo-dot" />
                        <span>
                            AGAR<span className="logo-accent">STAKE</span>
                        </span>
                    </div>

                    <div className="topbar-nav topbar-nav--desktop">
                        {navItems}
                    </div>
                </div>

                {children && (
                    <div className="topbar-right">
                        {children}
                    </div>
                )}
            </nav>

            {menuOpen && (
                <div className="topbar-mobile-menu">
                    {navItems}
                </div>
            )}
        </>
    );
}
