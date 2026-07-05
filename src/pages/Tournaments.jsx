import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import Background from '../components/Background';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import '../styles/ui.css';
import '../styles/tournaments.css';

function formatCountdown(target, now) {
    const ms = Math.max(0, new Date(target).getTime() - now);
    const total = Math.ceil(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function Tournaments() {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());
    const [selectedRulesTournament, setSelectedRulesTournament] = useState(null);

    useEffect(() => {
        document.title = 'AgarStake | Tournaments';
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`${API_URL}/api/tournaments?t=${Date.now()}`, {
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        'Cache-Control': 'no-cache',
                    },
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not load tournaments');
                if (active) {
                    setTournaments(data.tournaments || []);
                    setError('');
                }
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        const poll = setInterval(load, 5000);
        return () => { active = false; clearInterval(poll); };
    }, [token]);

    const ordered = useMemo(() => [...tournaments].sort((a, b) => {
        const order = { live: 0, scheduled: 1, ended: 2 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
            || new Date(a.startAt) - new Date(b.startAt);
    }), [tournaments]);

    const enter = (tournament) => {
        if (!user) {
            navigate('/login');
            return;
        }
        navigate(`/tournaments/${tournament.id}/lobby`);
    };

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />
            <main className="page-content tournament-page" style={{ maxWidth: 1160 }}>
                <section className="tournament-hero" style={{ marginBottom: 36 }}>
                    <div>
                        <p className="tournament-kicker">Live competition</p>
                        <h1 className="tournament-title">Tournaments</h1>
                    </div>
                    <button className="tournament-secondary-btn" onClick={() => navigate('/rewards')}>
                        View rewards
                    </button>
                </section>

                {error && <div className="tournament-ended-callout" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#fecaca' }}>{error}</div>}

                <section className="tournament-list">
                    {loading && <div className="tournament-empty">Loading tournaments…</div>}
                    {!loading && ordered.length === 0 && (
                        <div className="tournament-empty">
                            <strong style={{ display: 'block', color: 'var(--text-h)', marginBottom: 8 }}>No tournament scheduled</strong>
                            The next Balance Grab will appear here as soon as it is booked.
                        </div>
                    )}
                    {ordered.map(tournament => (
                        <article key={tournament.id} className={`tournament-card tournament-card--${tournament.status}`}>
                            <div className="tournament-card-media">
                                <img
                                    src="/normal slither.png"
                                    alt="Slither Normal"
                                    className="tournament-card-img"
                                    draggable={false}
                                />
                                <div className="tournament-status-badge">
                                    <span className={`tournament-status tournament-status--${tournament.status}`}>
                                        <span className="tournament-status-dot" />
                                        {tournament.status === 'live' ? 'Live' : tournament.status === 'ended' ? 'Ended' : 'Scheduled'}
                                    </span>
                                </div>
                                <div className="tournament-time-badge">
                                    {tournament.status === 'scheduled' && formatCountdown(tournament.startAt, now)}
                                    {tournament.status === 'live' && `${formatCountdown(tournament.endAt, now)} left`}
                                    {tournament.status === 'ended' && 'Ended'}
                                </div>
                            </div>
                            <div className="tournament-card-content">
                                <div className="tournament-mode-label">Balance Grab · Slither</div>
                                <h2>{tournament.name}</h2>

                                <div className={`tournament-prize-hero-box ${tournament.status === 'live' ? 'tournament-prize-hero-box--live' : ''}`}>
                                    <span className="prize-hero-label">
                                        {tournament.status === 'live' ? (
                                            <span className="live-prize-pulse-container">
                                                <span className="live-prize-pulse-dot" /> LIVE Prize Pool
                                            </span>
                                        ) : 'Prize Pool'}
                                    </span>
                                    <strong className="prize-hero-amount">${tournament.prizePotUsd.toFixed(2)}</strong>
                                </div>
                                
                                <div className="tournament-details-grid">
                                    <div className="tournament-detail-item">
                                        <span className="label">Entry fee</span>
                                        <strong>$1.00</strong>
                                    </div>
                                    <div className="tournament-detail-item">
                                        <span className="label">Players</span>
                                        <strong>{tournament.participantCount}</strong>
                                    </div>
                                    <div className="tournament-detail-item" style={{ gridColumn: 'span 2' }}>
                                        <span className="label">Total Attempts</span>
                                        <strong>{tournament.totalAttempts}</strong>
                                    </div>
                                </div>

                                <div className="tournament-card-actions">
                                    <button className="tournament-primary-btn" onClick={() => enter(tournament)}>
                                        {tournament.status === 'ended'
                                            ? tournament.me?.winningsUsd > 0 ? 'Claim Winnings' : 'View results'
                                            : 'Enter tournament'}
                                    </button>
                                    <button
                                        type="button"
                                        className="tournament-secondary-btn"
                                        style={{ padding: '12px 14px', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => setSelectedRulesTournament(tournament)}
                                        title="Tournament Rules"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M12 16v-4"/>
                                            <path d="M12 8h.01"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            </main>

            {/* Rules Info Modal */}
            {selectedRulesTournament && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 9999, padding: '20px', GxBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)'
                }} onClick={() => setSelectedRulesTournament(null)}>
                    <div className="panel" style={{
                        maxWidth: '480px', width: '100%', padding: '30px',
                        border: '1px solid var(--border)', background: 'var(--bg-2)', borderRadius: 'var(--r-xl)',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedRulesTournament(null)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '1.2rem', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                        
                        <h3 style={{ margin: '0 0 8px', color: 'var(--text-h)', fontSize: '1.4rem', fontWeight: 800 }}>
                            {selectedRulesTournament.name}
                        </h3>
                        <p style={{ color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 20px' }}>
                            Balance Grab Rules & Info
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-2)', fontSize: '0.92rem', lineHeight: '1.6' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                                <span>Start fee is <strong>$1.00</strong> per attempt. You can play a maximum of <strong>5 attempts</strong>.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                                <span>Each run starts at a $1.00 stake. You can cash out at any point to save your current balance to the tournament leaderboard.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                                <span>If you die during a run, you bank <strong>$0.00</strong> for that attempt.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                                <span>Your total score is the sum of all your banked cashouts across the 5 runs.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                                <span>The <strong>top 3 players</strong> on the leaderboard at the end of the tournament split the entire prize pot:
                                    <br />
                                    - 1st Place: <strong>60%</strong>
                                    <br />
                                    - 2nd Place: <strong>30%</strong>
                                    <br />
                                    - 3rd Place: <strong>10%</strong>
                                </span>
                            </div>
                        </div>

                        <button
                            className="btn btn-green"
                            onClick={() => setSelectedRulesTournament(null)}
                            style={{ width: '100%', marginTop: '30px', padding: '12px', fontSize: '0.92rem', fontWeight: 700 }}
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            <AppFooter />
        </div>
    );
}
