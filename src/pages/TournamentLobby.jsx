import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppTopbar from '../components/AppTopbar';
import AppFooter from '../components/AppFooter';
import Background from '../components/Background';
import GamemodePreview from '../components/GamemodePreview';
import RewardsWidget from '../components/RewardsWidget';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { clearAllPendingResults } from '../utils/gamePendingResult';
import '../styles/ui.css';
import '../styles/tournaments.css';

function formatCountdown(target, now) {
    const total = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function TournamentLobby() {
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`${API_URL}/api/tournaments/${tournamentId}?t=${Date.now()}`, {
                    headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not load tournament');
                if (active) {
                    setTournament(data.tournament);
                    setError('');
                    document.title = `AgarStake | ${data.tournament.name}`;
                }
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        const poll = setInterval(load, 3000);
        return () => { active = false; clearInterval(poll); };
    }, [token, tournamentId]);

    const attemptsUsed = tournament?.me?.entries || 0;
    const attemptsRemaining = tournament?.me?.attemptsRemaining ?? 5;
    const canPlay = tournament?.status === 'live' && attemptsRemaining > 0;
    const statusText = useMemo(() => {
        if (!tournament) return '';
        if (tournament.status === 'scheduled') return `Tournament starting in ${formatCountdown(tournament.startAt, now)}`;
        if (tournament.status === 'live') return `Tournament ends in ${formatCountdown(tournament.endAt, now)}`;
        if (tournament.status === 'ended') return 'Tournament ended';
        return tournament.status;
    }, [tournament, now]);

    const play = () => {
        if (!canPlay) return;
        clearAllPendingResults();
        localStorage.setItem('current_game_mode', 'tournament-slither');
        localStorage.setItem('selected_gamemode', 'tournament-slither');
        localStorage.setItem('selected_entry_fee', '1');
        localStorage.setItem('current_tournament_id', tournament.id);
        navigate('/slither-game', {
            state: {
                selectedMode: 'tournament-slither',
                tournamentId: tournament.id,
                nickname: user?.username,
            },
        });
    };

    if (loading) {
        return <div className="page-shell"><Background /><div className="tournament-empty" style={{ margin: '20vh auto', maxWidth: 520 }}>Loading tournament lobby…</div></div>;
    }

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />
            <main className="page-content tournament-page" style={{ maxWidth: 1180 }}>
                <div className="tournament-lobby-header">
                    <div>
                        <p className="tournament-kicker">Tournament · Balance Grab</p>
                        <h1 className="tournament-title" style={{ fontSize: 'clamp(1.9rem, 5vw, 3.35rem)' }}>{tournament?.name || 'Tournament'}</h1>
                        <p className="tournament-subtitle">{statusText}</p>
                    </div>
                    <button className="tournament-secondary-btn" onClick={() => navigate('/tournaments')}>← All tournaments</button>
                </div>

                {error && <div className="tournament-ended-callout" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', color: '#fecaca' }}>{error}</div>}

                {tournament?.status === 'ended' && (
                    <div className="tournament-ended-callout">
                        <strong>Tournament ended.</strong>{' '}
                        {tournament.me?.winningsUsd > 0
                            ? `You placed #${tournament.me.placement} and have $${tournament.me.winningsUsd.toFixed(2)} ready in Rewards.`
                            : `Your final tournament balance was $${tournament.me?.balanceUsd?.toFixed(2) || '0.00'}.`}
                        {tournament.me?.winningsUsd > 0 && (
                            <button className="tournament-secondary-btn" style={{ marginLeft: 14 }} onClick={() => navigate('/rewards')}>
                                Claim in Rewards
                            </button>
                        )}
                    </div>
                )}

                <div className="tournament-balance-banner">
                    <div>
                        <span>Your tournament balance</span>
                        <div style={{ marginTop: 4, color: 'var(--text-2)', fontSize: '.78rem' }}>
                            All successful cashouts across this tournament
                        </div>
                    </div>
                    <strong>${(tournament?.me?.balanceUsd || 0).toFixed(2)}</strong>
                </div>

                <div className="tournament-lobby-grid">
                    <section className="tournament-panel tournament-play-card">
                        <div className="tournament-preview">
                            <GamemodePreview mode="slither" fit />
                        </div>
                        <div className="tournament-play-copy">
                            <span className="tournament-panel-label">Tournament mode</span>
                            <h2>Balance Grab</h2>
                            <p>
                                Every run starts at $1 in-game balance with the $10 Slither food economy.
                                Food and bots are score only—your $1 entry goes entirely into the prize pot.
                            </p>
                            <div className="tournament-attempts" aria-label={`${attemptsUsed} of 5 attempts used`}>
                                {[0, 1, 2, 3, 4].map(index => (
                                    <span key={index} className={`tournament-attempt-dot${index < attemptsUsed ? ' tournament-attempt-dot--used' : ''}`} />
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: 'var(--text-2)', fontSize: '.78rem' }}>
                                <span>{attemptsRemaining} attempts left</span>
                                <strong style={{ color: 'var(--text-h)' }}>$1.00 per run</strong>
                            </div>
                            <button className="tournament-primary-btn tournament-play-btn" disabled={!canPlay} onClick={play}>
                                {tournament?.status === 'scheduled'
                                    ? `Starts in ${formatCountdown(tournament.startAt, now)}`
                                    : tournament?.status === 'ended'
                                        ? 'Tournament ended'
                                        : attemptsRemaining <= 0 ? 'All 5 attempts used' : `Play attempt ${attemptsUsed + 1} · $1`}
                            </button>
                        </div>
                    </section>

                    <aside className="tournament-panel">
                        <span className="tournament-panel-label">Live tournament</span>
                        <h2>Prize pot</h2>
                        <div className="tournament-prize-amount">${(tournament?.prizePotUsd || 0).toFixed(2)}</div>
                        <div className="tournament-splits">
                            <div className="tournament-split">1st<strong>60%</strong></div>
                            <div className="tournament-split">2nd<strong>30%</strong></div>
                            <div className="tournament-split">3rd<strong>10%</strong></div>
                        </div>
                        <span className="tournament-panel-label">Leaderboard</span>
                        <div className="tournament-leaderboard" style={{ marginTop: 8 }}>
                            {(tournament?.leaderboard || []).length === 0 && (
                                <div style={{ color: 'var(--text-3)', fontSize: '.78rem', padding: '18px 8px' }}>No banked cashouts yet.</div>
                            )}
                            {(tournament?.leaderboard || []).map((entry, index) => (
                                <div key={`${entry.username}-${index}`} className="tournament-leaderboard-row">
                                    <span>#{entry.rank || index + 1}</span>
                                    <span>{entry.username}</span>
                                    <strong>${entry.balanceUsd.toFixed(2)}</strong>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </main>
            <RewardsWidget />
            <AppFooter />
        </div>
    );
}
