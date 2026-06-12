import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AppTopbar({ children }) {
    const navigate = useNavigate();
    const location = useLocation();

    const linkClass = (path) => (
        `gm-nav-link${location.pathname === path ? ' gm-nav-link--active' : ''}`
    );

    return (
        <nav className="topbar">
            <div className="topbar-left">
                <div className="logo" onClick={() => navigate('/pre-game')}>
                    <img src="/favicon.png" alt="" className="logo-icon" />
                    <span>
                        AGAR<span className="logo-accent">STAKE</span>
                    </span>
                </div>

                <button type="button" className={linkClass('/gamemodes')} onClick={() => navigate('/gamemodes')}>
                    Gamemode
                </button>
                <button type="button" className={linkClass('/profile')} onClick={() => navigate('/profile')}>
                    Profile
                </button>
            </div>
            {children}
        </nav>
    );
}
