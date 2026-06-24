import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import GamemodePreview from '../components/GamemodePreview';
import GamemodeBadge from '../components/GamemodeBadge';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';
import { useAuth } from '../context/AuthContext';
import { isBattleRoyaleAvailable, isBattleRoyaleMode, normalizeGamemodeForLobby } from '../constants/features';
import { getVisibleGamemodes } from '../constants/gamemodes';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

const PLAYING_KEY = {
    agar: 'agar',
    slither: 'slither',
    'competitive-slither': 'competitiveSlither',
    surviv: 'surviv',
    'br-agar': 'brAgar',
    'br-slither': 'brSlither',
};

export default function Gamemodes() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const brAvailable = isBattleRoyaleAvailable(!!user?.isAdmin);
    const [activeTab, setActiveTab] = useState(() => {
        const raw = location.state?.selectedMode || localStorage.getItem('selected_gamemode') || 'agar';
        return normalizeGamemodeForLobby(raw, false);
    });
    const [playersByGamemode, setPlayersByGamemode] = useState({
        agar: 0,
        slither: 0,
        brAgar: 0,
        brSlither: 0,
        competitiveSlither: 0,
        surviv: 0,
    });

    const catalog = useMemo(() => getVisibleGamemodes(brAvailable), [brAvailable]);
    const agarModes = catalog.filter((m) => m.tab === 'agar');
    const slitherModes = catalog.filter((m) => m.tab === 'slither');
    const survivModes = catalog.filter((m) => m.tab === 'surviv');

    useEffect(() => {
        if (user == null) return;
        const raw = location.state?.selectedMode || localStorage.getItem('selected_gamemode');
        if (raw && isBattleRoyaleMode(raw) && brAvailable) {
            setActiveTab(raw);
        }
    }, [user?.isAdmin, brAvailable, location.state?.selectedMode]);

    useEffect(() => {
        let alive = true;
        const fetchStats = async () => {
            try {
                const r = await fetch(`${API_URL}/api/stats?t=${Date.now()}`, {
                    headers: { 'bypass-tunnel-reminders': 'true', 'Cache-Control': 'no-cache' },
                });
                if (r.ok && alive) {
                    const d = await r.json();
                    setPlayersByGamemode(d.playersByGamemode || {});
                }
            } catch { /* ignore */ }
        };
        fetchStats();
        const id = setInterval(fetchStats, 5000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    useEffect(() => {
        if (location.state?.selectedMode && location.state.selectedMode !== activeTab) {
            setActiveTab(location.state.selectedMode);
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state?.selectedMode]);

    const handleTabChange = (mode) => {
        setActiveTab(mode);
        localStorage.setItem('selected_gamemode', mode);
    };

    const isSlitherTab = activeTab === 'slither' || activeTab === 'competitive-slither'
        || (brAvailable && activeTab === 'br-slither');
    const isSurvivTab = activeTab === 'surviv';
    const isAgarTab = activeTab === 'agar' || (brAvailable && activeTab === 'br-agar');

    useEffect(() => {
        if (isSurvivTab) setPageSeo(SEO.gamemodesSurviv ?? SEO.gamemodesAgar);
        else setPageSeo(isSlitherTab ? SEO.gamemodesSlither : SEO.gamemodesAgar);
    }, [isSlitherTab, isSurvivTab]);

    const handleSelectMode = (modeId) => {
        localStorage.setItem('selected_gamemode', modeId);
        navigate('/pre-game', { state: { selectedMode: modeId } });
    };

    const activeModes = isAgarTab ? agarModes : isSurvivTab ? survivModes : slitherModes;

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />

            <AppTopbar />

            <div className="page-content">
                <div style={{ marginBottom: '36px' }}>
                    <h1 className="gm-heading">Select Gamemode</h1>
                    <p className="gm-sub">
                        Choose your arena and start competing for real rewards.{' '}
                        <button type="button" className="gm-sub-link" onClick={() => navigate('/how-it-works')}>
                            How it works →
                        </button>
                    </p>
                </div>

                <div className="gm-tabs">
                    <button
                        className={`gm-tab${isAgarTab ? ' gm-tab--active' : ''}`}
                        onClick={() => handleTabChange('agar')}
                    >
                        Agar
                    </button>
                    <button
                        className={`gm-tab${isSlitherTab ? ' gm-tab--active' : ''}`}
                        onClick={() => handleTabChange('slither')}
                    >
                        Slither
                    </button>
                    <button
                        className={`gm-tab${isSurvivTab ? ' gm-tab--active' : ''}`}
                        onClick={() => handleTabChange('surviv')}
                    >
                        Surviv
                    </button>
                </div>

                <div className="gm-grid">
                    {activeModes.map((mode) => (
                        <ModeCard
                            key={mode.id}
                            mode={mode.id}
                            title={mode.title}
                            desc={mode.longDesc}
                            badge={mode.badge}
                            playing={playersByGamemode[PLAYING_KEY[mode.id]]}
                            onPlay={() => handleSelectMode(mode.id)}
                        />
                    ))}
                </div>
            </div>

            <AppFooter />
        </div>
    );
}

function ModeCard({ mode, title, desc, badge, playing, onPlay }) {
    const isDisabled = !onPlay;

    return (
        <div className={`gm-card ${isDisabled ? 'gm-card--disabled' : 'gm-card--active'}`}>
            <div className="gm-card-body">
                <div className="gm-card-left">
                    <div className="gm-card-title-row">
                        <div className="gm-card-title" title={title}>{title}</div>
                        {badge && <GamemodeBadge type={badge} />}
                    </div>
                    <div className="gm-card-desc">{desc}</div>
                    {playing != null && (
                        <div className="gm-card-playing">{playing} playing</div>
                    )}
                </div>
                <div className="gm-card-right">
                    {mode && (
                        <div className="gm-card-preview-wrap">
                            <GamemodePreview mode={mode} className="gm-card-preview" />
                        </div>
                    )}
                    {!isDisabled && (
                        <button className="gm-play-btn" onClick={onPlay}>Select</button>
                    )}
                </div>
            </div>
        </div>
    );
}
