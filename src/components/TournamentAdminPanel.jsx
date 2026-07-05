import React, { useCallback, useEffect, useState } from 'react';

function defaultLocalTime() {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function TournamentAdminPanel({ fetchAdmin, setActionMsg }) {
    const [name, setName] = useState('Balance Grab');
    const [startAt, setStartAt] = useState(defaultLocalTime);
    const [tournaments, setTournaments] = useState([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await fetchAdmin('/api/admin/tournaments');
            setTournaments(data.tournaments || []);
        } finally {
            setLoading(false);
        }
    }, [fetchAdmin]);

    useEffect(() => {
        load();
        const timer = setInterval(load, 5000);
        return () => clearInterval(timer);
    }, [load]);

    const schedule = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            await fetchAdmin('/api/admin/tournaments', {
                method: 'POST',
                body: JSON.stringify({ name, startAt: new Date(startAt).toISOString() }),
            });
            setActionMsg('✅ Tournament scheduled');
            setStartAt(defaultLocalTime());
            await load();
        } catch (err) {
            setActionMsg(`❌ ${err.message}`);
        } finally {
            setBusy(false);
        }
    };

    const action = async (tournament, type) => {
        const verb = type === 'start' ? 'start this tournament now' : 'cancel this scheduled tournament';
        if (!window.confirm(`Are you sure you want to ${verb}?`)) return;
        setBusy(true);
        try {
            await fetchAdmin(`/api/admin/tournaments/${tournament.id}/${type}`, { method: 'POST' });
            setActionMsg(`✅ Tournament ${type === 'start' ? 'started' : 'cancelled'}`);
            await load();
        } catch (err) {
            setActionMsg(`❌ ${err.message}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <section className="admin-panel" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl)', overflow: 'hidden' }}>
                <div className="admin-panel-head" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <h3>Schedule Balance Grab</h3>
                        <p>Slither only · 30 minutes · $1 per attempt · maximum 5 attempts</p>
                    </div>
                </div>
                <form onSubmit={schedule} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1fr) auto', gap: 12, padding: 18, alignItems: 'end' }}>
                    <label className="admin-filter-field">
                        <span className="admin-filter-label">Tournament name</span>
                        <input className="admin-filter-input" value={name} minLength={3} maxLength={60} required onChange={event => setName(event.target.value)} />
                    </label>
                    <label className="admin-filter-field">
                        <span className="admin-filter-label">Start time</span>
                        <input className="admin-filter-input" type="datetime-local" value={startAt} required onChange={event => setStartAt(event.target.value)} />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={busy} style={{ padding: '10px 18px' }}>
                        {busy ? 'Saving…' : 'Schedule tournament'}
                    </button>
                </form>
            </section>

            <section className="admin-panel" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl)', overflow: 'hidden' }}>
                <div className="admin-panel-head" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                        <h3>Tournaments</h3>
                        <p>Scheduled tournaments start automatically. You can also start one immediately.</p>
                    </div>
                    <button className="btn btn-ghost" onClick={load} disabled={loading || busy}>Refresh</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
                                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Name</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Starts</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Pot</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Entries</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tournaments.map(tournament => (
                                <tr key={tournament.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '14px 16px', color: 'var(--text-h)', fontWeight: 700 }}>{tournament.name}</td>
                                    <td style={{ padding: '14px 16px', textTransform: 'capitalize' }}>{tournament.status}</td>
                                    <td style={{ padding: '14px 16px' }}>{formatDate(tournament.startAt)}</td>
                                    <td style={{ padding: '14px 16px' }}>${tournament.prizePotUsd.toFixed(2)}</td>
                                    <td style={{ padding: '14px 16px' }}>{tournament.totalAttempts}</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        {tournament.status === 'scheduled' && (
                                            <div style={{ display: 'inline-flex', gap: 8 }}>
                                                <button className="btn btn-primary" disabled={busy} onClick={() => action(tournament, 'start')} style={{ padding: '7px 12px', fontSize: '.72rem' }}>Start now</button>
                                                <button className="btn btn-ghost" disabled={busy} onClick={() => action(tournament, 'cancel')} style={{ padding: '7px 12px', fontSize: '.72rem' }}>Cancel</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!loading && tournaments.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: 40, color: 'var(--text-2)', textAlign: 'center' }}>No tournaments created yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
