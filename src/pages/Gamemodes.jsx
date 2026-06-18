import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import GamemodePreview from '../components/GamemodePreview';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';
import { useAuth } from '../context/AuthContext';
import { isBattleRoyaleAvailable, isBattleRoyaleMode, normalizeGamemodeForLobby } from '../constants/features';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

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
    });

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
        // Apply incoming navigation state once, then clear it so it doesn't
        // force the tab back on subsequent interactions.
        if (location.state?.selectedMode && location.state.selectedMode !== activeTab) {
            setActiveTab(location.state.selectedMode);
            // clear the state so user can change tabs freely
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
    const isAgarTab = activeTab === 'agar' || (brAvailable && activeTab === 'br-agar');

    useEffect(() => {
        setPageSeo(isSlitherTab ? SEO.gamemodesSlither : SEO.gamemodesAgar);
    }, [isSlitherTab]);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />

            <AppTopbar />

            <div className="page-content">
                {/* Header */}
                <div style={{ marginBottom: '36px' }}>
                    <h1 className="gm-heading">Select Gamemode</h1>
                    <p className="gm-sub">Choose your arena and start competing for real rewards.</p>
                </div>

                {/* Tabs */}
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
                </div>

                {/* Mode cards */}
                <div className="gm-grid">
                    {isAgarTab ? (
                        <>
                            <ModeCard
                                mode="agar"
                                title="Agar Normal"
                                desc="The classic high-stakes Agar experience. Grow, absorb, dominate. Choose $5, $10, or $20 entry in the lobby."
                                playing={playersByGamemode.agar}
                                onPlay={() => navigate('/pre-game', { state: { selectedMode: 'agar' } })}
                            />
                            {brAvailable && (
                                <ModeCard
                                    mode="br-agar"
                                    title="Agar Battle Royale"
                                    desc="5–10 players, shrinking zone, last one standing wins the pool. $5 or $10 entry, no cash-out."
                                    playing={playersByGamemode.brAgar}
                                    onPlay={() => {
                                        localStorage.setItem('selected_gamemode', 'br-agar');
                                        navigate('/pre-game', { state: { selectedMode: 'br-agar' } });
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <ModeCard
                                mode="slither"
                                title="Slither Normal"
                                desc="Classic high-stakes snake arena. Outmaneuver enemies, grow longer. $5 / $10 / $20 entry."
                                playing={playersByGamemode.slither}
                                onPlay={() => navigate('/pre-game', { state: { selectedMode: 'slither' } })}
                            />
                            <ModeCard
                                mode="competitive-slither"
                                title="Slither Arena"
                                desc="$2 or $5 entry — separate pools, real players only. Circular arena, shrinking zone before reset. Cash out your dollar balance anytime."
                                playing={playersByGamemode.competitiveSlither}
                                onPlay={() => {
                                    localStorage.setItem('selected_gamemode', 'competitive-slither');
                                    navigate('/pre-game', { state: { selectedMode: 'competitive-slither' } });
                                }}
                            />
                            {brAvailable && (
                                <ModeCard
                                    mode="br-slither"
                                    title="Slither Battle Royale"
                                    desc="5–10 snakes, deadly zone closes in, winner takes all. $5 or $10 entry, no cash-out."
                                    playing={playersByGamemode.brSlither}
                                    onPlay={() => {
                                        localStorage.setItem('selected_gamemode', 'br-slither');
                                        navigate('/pre-game', { state: { selectedMode: 'br-slither' } });
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ModeCard({ mode, title, desc, playing, onPlay }) {
    const isDisabled = !onPlay;

    return (
        <div className={`gm-card ${isDisabled ? 'gm-card--disabled' : 'gm-card--active'}`}>
            <div className="gm-card-body">
                <div className="gm-card-left">
                    <div className="gm-card-title" title={title}>{title}</div>
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
