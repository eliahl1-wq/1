import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';
import '../styles/ui.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

export default function Gamemodes() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(
        () => location.state?.selectedMode || localStorage.getItem('selected_gamemode') || 'agar'
    );
    const [playersByGamemode, setPlayersByGamemode] = useState({
        agar: 0,
        slither: 0,
        brAgar: 0,
        brSlither: 0,
    });

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

    return (
        <div style={{ width: '100vw', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflowX: 'hidden' }}>
            <Background />

            {/* ── Top Bar ── */}
            <nav className="topbar">
                <div className="topbar-left">
                    <div className="logo" onClick={() => navigate('/pre-game')}>
                        <div className="logo-dot" />
                        <span>
                            AGAR<span className="logo-accent">STAKE</span>
                        </span>
                    </div>

                    <button
                        className="gm-nav-link gm-nav-link--active"
                        onClick={() => navigate('/gamemodes')}
                    >
                        Gamemode
                    </button>
                </div>
            </nav>

            {/* ── Content ── */}
            <div style={{ zIndex: 1, width: '100%', maxWidth: '1100px', padding: '100px 32px 60px', boxSizing: 'border-box' }}>

                {/* Header */}
                <div style={{ marginBottom: '36px' }}>
                    <h1 className="gm-heading">Select Gamemode</h1>
                    <p className="gm-sub">Choose your arena and start competing for real rewards.</p>
                </div>

                {/* Tabs */}
                <div className="gm-tabs">
                    <button
                        className={`gm-tab${activeTab === 'agar' ? ' gm-tab--active' : ''}`}
                        onClick={() => handleTabChange('agar')}
                    >
                        Agar
                    </button>
                    <button
                        className={`gm-tab${activeTab === 'slither' ? ' gm-tab--active' : ''}`}
                        onClick={() => handleTabChange('slither')}
                    >
                        Slither
                    </button>
                </div>

                {/* Mode cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {activeTab === 'agar' ? (
                        <>
                            <ModeCard
                                title="Agar Normal"
                                desc="The classic high-stakes Agar experience. Grow, absorb, dominate. Choose $5, $10, or $20 entry in the lobby."
                                playing={playersByGamemode.agar}
                                badge={null}
                                onPlay={() => navigate('/pre-game', { state: { selectedMode: 'agar' } })}
                            />
                            <ModeCard
                                title="Agar Battle Royale"
                                desc="4–16 players, shrinking zone, last one standing wins the pool. $5 or $10 entry, no cash-out."
                                playing={playersByGamemode.brAgar}
                                badge="NEW"
                                badgeAccent
                                onPlay={() => {
                                    localStorage.setItem('selected_gamemode', 'br-agar');
                                    navigate('/pre-game', { state: { selectedMode: 'br-agar' } });
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <ModeCard
                                title="Slither Normal"
                                desc="Classic high-stakes snake arena. Outmaneuver enemies, grow longer. $5 / $10 / $20 entry."
                                playing={playersByGamemode.slither}
                                badge={null}
                                onPlay={() => navigate('/pre-game', { state: { selectedMode: 'slither' } })}
                            />
                            <ModeCard
                                title="Slither Battle Royale"
                                desc="4–16 snakes, deadly zone closes in, winner takes all. $5 or $10 entry, no cash-out."
                                playing={playersByGamemode.brSlither}
                                badge="NEW"
                                badgeAccent
                                onPlay={() => {
                                    localStorage.setItem('selected_gamemode', 'br-slither');
                                    navigate('/pre-game', { state: { selectedMode: 'br-slither' } });
                                }}
                            />
                        </>
                    )}
                </div>
            </div>

            <style>{`
                /* ── Nav link ── */
                .gm-nav-link {
                    background: none;
                    border: none;
                    font-family: var(--sans);
                    font-size: 1.05rem;
                    font-weight: 800;
                    color: var(--text-2);
                    cursor: pointer;
                    padding: 0;
                    transition: color 0.15s;
                    letter-spacing: -0.01em;
                }
                .gm-nav-link:hover { color: #fff; }
                .gm-nav-link--active { color: #fff; }

                /* ── Page heading ── */
                .gm-heading {
                    margin: 0 0 6px 0;
                    font-family: var(--sans);
                    font-size: clamp(2rem, 5vw, 3rem);
                    font-weight: 900;
                    letter-spacing: -2px;
                    color: var(--text-h);
                    line-height: 1.05;
                }
                .gm-sub {
                    margin: 0;
                    font-family: var(--sans);
                    font-size: 0.85rem;
                    color: var(--text-3);
                    font-weight: 500;
                }

                /* ── Tab bar (underline style) ── */
                .gm-tabs {
                    display: flex;
                    gap: 0;
                    margin-bottom: 28px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .gm-tab {
                    background: none;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    padding: 0 4px 14px 4px;
                    margin-right: 28px;
                    font-family: var(--sans);
                    font-size: 0.85rem;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                    color: var(--text-3);
                    cursor: pointer;
                    transition: color 0.15s, border-color 0.15s;
                }
                .gm-tab:hover { color: var(--text); }
                .gm-tab--active {
                    color: #fff;
                    border-bottom-color: var(--accent);
                }

                /* ── Mode cards ── */
                .gm-card {
                    background: var(--bg-1);
                    border: 1px solid var(--border);
                    border-radius: var(--r-2xl);
                    padding: 28px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-shadow: var(--shadow-lg);
                }
                .gm-card--active {
                    border-color: rgba(124,58,255,0.25);
                    background: linear-gradient(135deg, #0d0e16 0%, #13151f 100%);
                }
                .gm-card--active:hover {
                    border-color: rgba(124,58,255,0.45);
                    box-shadow: var(--shadow-xl), 0 0 0 1px rgba(124,58,255,0.1);
                }
                .gm-card--disabled {
                    opacity: 0.5;
                    background: var(--bg-1);
                }
                .gm-card-title {
                    font-family: var(--sans);
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #fff;
                    letter-spacing: -0.02em;
                    margin-bottom: 6px;
                }
                .gm-card--disabled .gm-card-title { color: var(--text-3); }
                .gm-card-desc {
                    font-family: var(--sans);
                    font-size: 0.8rem;
                    color: var(--text-3);
                    line-height: 1.5;
                    max-width: 280px;
                }
                .gm-card-playing {
                    font-family: var(--sans);
                    font-size: 0.72rem;
                    font-weight: 500;
                    color: var(--text-3);
                    margin-top: 8px;
                }
                .gm-badge {
                    font-family: var(--sans);
                    font-size: 0.6rem;
                    font-weight: 800;
                    letter-spacing: 0.07em;
                    text-transform: uppercase;
                    color: var(--text-3);
                    background: rgba(255,255,255,0.04);
                    border: 1px solid var(--border);
                    padding: 6px 12px;
                    border-radius: var(--r-full);
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .gm-play-btn {
                    font-family: var(--sans);
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    padding: 10px 22px;
                    border: none;
                    border-radius: var(--r-lg);
                    background: linear-gradient(135deg, #7C3AFF, #4D8CFF);
                    color: #fff;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    box-shadow: 0 4px 14px rgba(124,58,255,0.25);
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .gm-play-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(124,58,255,0.35);
                    filter: brightness(1.06);
                }
                .gm-play-btn:active { transform: scale(0.97); }
            `}</style>
        </div>
    );
}

function ModeCard({ title, desc, playing, badge, badgeAccent, onPlay }) {
    const isDisabled = !onPlay;
    return (
        <div className={`gm-card ${isDisabled ? 'gm-card--disabled' : 'gm-card--active'}`}>
            <div>
                <div className="gm-card-title">{title}</div>
                <div className="gm-card-desc">{desc}</div>
                {playing != null && (
                    <div className="gm-card-playing">{playing} playing</div>
                )}
            </div>
            {isDisabled
                ? <span className="gm-badge">{badge}</span>
                : badge
                    ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <span className="gm-badge" style={badgeAccent ? { color: '#14F195', borderColor: 'rgba(20,241,149,0.3)', background: 'rgba(20,241,149,0.08)' } : undefined}>{badge}</span>
                        <button className="gm-play-btn" onClick={onPlay}>Select</button>
                      </div>
                    : <button className="gm-play-btn" onClick={onPlay}>Select</button>
            }
        </div>
    );
}
