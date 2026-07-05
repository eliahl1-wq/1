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
                <section className="tournament-hero">
                    <div>
                        <p className="tournament-kicker">Live competition</p>
                        <h1 className="tournament-title">Tournaments</h1>
                        <p className="tournament-subtitle">
                            Five $1 attempts. Cash out to bank each run, build your tournament balance,
                            and finish in the top three to share the complete entry pot.
                        </p>
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
                            <div className="tournament-status-row">
                                <span className={`tournament-status tournament-status--${tournament.status}`}>
                                    <span className="tournament-status-dot" />
                                    {tournament.status === 'live' ? 'Live now' : tournament.status === 'ended' ? 'Tournament ended' : 'Scheduled'}
                                </span>
                                <span className="tournament-countdown">
                                    {tournament.status === 'scheduled' && `Starts in ${formatCountdown(tournament.startAt, now)}`}
                                    {tournament.status === 'live' && `${formatCountdown(tournament.endAt, now)} left`}
                                    {tournament.status === 'ended' && 'Results final'}
                                </span>
                            </div>
                            <h2>{tournament.name}</h2>
                            <div className="tournament-mode-label">Balance Grab · Slither</div>
                            <p className="tournament-card-copy">
                                Bank as much balance as possible across five runs. Death banks $0;
                                every successful cashout is added to your tournament total.
                            </p>
                            <div className="tournament-stat-row"><span>Prize pot</span><strong>${tournament.prizePotUsd.toFixed(2)}</strong></div>
                            <div className="tournament-stat-row"><span>Entry per run</span><strong>$1.00 · max 5</strong></div>
                            <div className="tournament-stat-row"><span>Players / entries</span><strong>{tournament.participantCount} / {tournament.totalAttempts}</strong></div>
                            <div className="tournament-card-actions">
                                <button className="tournament-primary-btn" onClick={() => enter(tournament)}>
                                    {tournament.status === 'ended'
                                        ? tournament.me?.winningsUsd > 0 ? 'Claim in Rewards' : 'View results'
                                        : 'Enter tournament'}
                                </button>
                            </div>
                        </article>
                    ))}
                </section>
            </main>
            <AppFooter />
        </div>
    );
}
