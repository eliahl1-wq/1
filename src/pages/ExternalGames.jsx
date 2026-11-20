import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import ProductPageHeader from '../components/ProductPageHeader';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { formatBalanceAmount, getStoredBalanceCurrency } from '../utils/displayCurrency';
import '../styles/externalGames.css';

const labels = { ready: 'Ready check', baseline: 'Preparing match', battle: 'Battle window', completed: 'Verified', disputed: 'Needs review', cancelled: 'Cancelled', expired: 'Expired' };
const seconds = (date, now) => Math.max(0, Math.ceil((new Date(date).getTime() - now) / 1000));
const minutes = duration => `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

function Player({ profile, status }) {
    return <div className="external-player">
        <span className="external-avatar" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{profile.name}</strong><small>{profile.tag} · {profile.trophies.toLocaleString()} trophies</small>{profile.clan && <small>{profile.clan}</small>}</div>
        {status && <span className="external-chip">{status}</span>}
    </div>;
}

function LinkDialog({ call, onClose, onLinked }) {
    const dialog = useRef(null);
    const [tag, setTag] = useState(''), [profile, setProfile] = useState(null), [token, setToken] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { dialog.current.showModal(); }, []);
    async function submit(event) {
        event.preventDefault();
        setBusy(true); setError('');
        try {
            if (!profile) setProfile(await call('/profile', 'POST', { tag }));
            else {
                await call('/link', 'POST', { tag: profile.tag, token });
                setToken('');
                await onLinked(); onClose();
            }
        } catch (err) { setError(err.message); setToken(''); }
        finally { setBusy(false); }
    }
    return <dialog ref={dialog} className="external-dialog" aria-labelledby="external-link-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
        <form onSubmit={submit}>
            <span className="external-kicker">Account security</span><h2 id="external-link-title">Connect Clash Royale</h2>
            {!profile ? <label>Player tag<input className="input" required value={tag} maxLength={16} onChange={e => setTag(e.target.value)} placeholder="#PLAYER" autoComplete="off" /></label>
                : <><Player profile={profile} /><p>Copy the API token from Clash Royale’s in-game settings. Never enter your Supercell ID password or recovery code. Your player tag stays assigned to this Arenifi account even if you disconnect it.</p>
                    <label>In-game API token<input type="password" className="input" required value={token} maxLength={64} onChange={e => setToken(e.target.value)} autoComplete="off" /></label></>}
            {error && <p className="external-error" role="alert">{error}</p>}
            <div className="external-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : profile ? 'Verify & connect' : 'Look up profile'}</button></div>
        </form>
    </dialog>;
}

function Room({ match, self, now, busy, act }) {
    const host = match.hostId === self;
    const accepted = match.ready.includes(self);
    const verifies = match.state === 'battle' && now >= +new Date(match.battleUntil);
    const startsIn = match.opensAt ? seconds(match.opensAt, now) : 0;
    return <section className="external-panel external-room" aria-live="polite">
        <header className="external-section-header"><div><span className="external-kicker">Triple Draft · 1v1 · Free Play</span><h2>{verifies ? 'Verifying match result…' : labels[match.state]}</h2></div>
            {['ready', 'battle'].includes(match.state) && <span className="external-clock">{verifies ? 'Checking logs' : minutes(seconds(match.deadline, now))}</span>}</header>
        <div className="external-versus">{match.players.map(player => <Player key={player.id} profile={player} status={match.state === 'ready' ? match.ready.includes(player.id) ? 'Ready' : 'Waiting' : player.id === match.hostId ? 'Host' : 'Challenger'} />)}</div>
        {match.state === 'ready' && <><p>{accepted ? 'Accepted. Waiting for your opponent.' : 'Both players must accept to open the match.'}</p>
            <div className="external-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => act(`/matches/${match.id}/ready`, 'POST', { accept: false })}>Decline</button>
                <button className="btn btn-primary" disabled={accepted || busy || !seconds(match.deadline, now)} onClick={() => act(`/matches/${match.id}/ready`, 'POST', { accept: true })}>Accept match</button></div></>}
        {match.state === 'baseline' && <p>Reading both official battle logs. Do not start a battle yet.</p>}
        {match.state === 'battle' && (verifies ? <p>Arenifi is comparing official battle logs from both accounts. The result is independent of whether this page stays open.</p>
            : startsIn > 0 ? <p>Wait {startsIn} seconds before starting.</p>
            : <><p>{host ? 'Open Clash Royale and invite the challenger to a Triple Draft Friendly Battle using the in-game Social menu.' : 'Open Clash Royale and accept the host’s Triple Draft Friendly Battle.'} Add each other through the official in-game friend flow if needed.</p>
                <p className="external-tip">Start and finish exactly one native Triple Draft battle before {time(match.battleUntil)}. If the mode isn’t available in the app, don’t play another mode. There is no verified Quickplay deep link in this build.</p></>)}
    </section>;
}

function MatchResult({ match, self }) {
    const opponent = match.players.find(player => player.id !== self);
    const score = match.result?.scores;
    return <li className="external-result">
        <span><strong>{match.result ? match.result.winnerId == null ? 'Draw' : match.result.winnerId === self ? 'Victory' : 'Defeat' : labels[match.state]}</strong><small>vs {opponent?.name || 'Unknown'} · Triple Draft</small></span>
        <span>{score ? `${score[self]}–${score[opponent?.id]}` : null}<small>{new Date(match.createdAt).toLocaleDateString()}</small></span>
    </li>;
}

function AdminReview({ call }) {
    const [filter, setFilter] = useState('');
    const [userId, setUserId] = useState('');
    const [data, setData] = useState(null), [error, setError] = useState(''), [samples, setSamples] = useState(null), [busy, setBusy] = useState(false);
    async function run(action = 'load') {
        setError(''); setBusy(true);
        try {
            if (action === 'sample') setSamples(await call('/admin/own-battles'));
            else {
                if (action === 'toggle') await call('/admin/pause', 'POST', { paused: !data.paused });
                setData(await call(`/admin?${new URLSearchParams({ state: filter, userId: userId.trim() })}`));
            }
        } catch (error) { setError(error.message); } finally { setBusy(false); }
    }
    return <details className="external-panel external-review"><summary>Internal operations</summary>
        <form className="external-tools" onSubmit={e => { e.preventDefault(); run(); }}><label>Match state<select className="input" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All states</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
            <label>Arenifi account ID<input className="input" value={userId} onChange={e => setUserId(e.target.value)} pattern="[a-fA-F0-9]{24}" placeholder="Optional" /></label>
            <button className="btn btn-ghost" disabled={busy}>Load review</button></form>
        {error && <p role="alert" className="external-error">{error}</p>}
        {data && <><p>Provider: {data.provider.status} · {data.provider.at ? time(data.provider.at) : 'not checked'} · Matchmaking: {data.paused ? 'paused' : 'open subject to configuration'}. Real stakes are disabled.</p>
            <div className="external-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => run('sample')}>Inspect own battle modes</button><button className="btn btn-ghost" disabled={busy} onClick={() => run('toggle')}>{data.paused ? 'Resume matchmaking' : 'Pause matchmaking'}</button></div>
            {samples && <details open><summary>Own official battle metadata</summary><pre>{JSON.stringify(samples, null, 2)}</pre></details>}
            {Object.entries({ Matches: data.matches, 'Queue entries': data.queued, 'Account links': data.links, 'Administrative audit': data.audit }).map(([label, rows]) => <details key={label}><summary>{label} ({rows.length}, latest 40)</summary>
                {rows.map((row, index) => <details key={row._id || index}><summary>{row.profile?.name || row.players?.map(p => p.name).join(' vs ') || row.event || row._id} {row.state && `· ${labels[row.state] || row.state}`}</summary><pre>{JSON.stringify(row, null, 2)}</pre></details>)}</details>)}
        </>}
    </details>;
}

export default function ExternalGames() {
    const { user, token } = useAuth();
    const [data, setData] = useState(null), [closed, setClosed] = useState(false), [error, setError] = useState(''), [linking, setLinking] = useState(false);
    const [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now()), [currency, setCurrency] = useState(getStoredBalanceCurrency);
    const [opponentTag, setOpponentTag] = useState('');
    const sequence = useRef(0), mutation = useRef(false);
    async function call(path, method = 'GET', body) {
        const response = await fetch(`${API_URL}/api/external-games${path}`, { method, cache: 'no-store', signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${token}`, ...(body != null ? { 'Content-Type': 'application/json' } : {}) },
            ...(body != null ? { body: JSON.stringify(body) } : {}) });
        const info = await response.json().catch(() => null);
        if (!response.ok) throw Object.assign(new Error(`${info?.message || 'Private matchmaking is unavailable.'}${info?.code?.startsWith('PROVIDER_') || info?.code?.startsWith('VERIFY_TOKEN_') ? ` (${info.code})` : ''}`), { status: response.status });
        return info;
    }
    async function refresh() {
        const id = ++sequence.current;
        try {
            const next = await call('/state');
            if (sequence.current === id) { setData(next); setError(''); }
        } catch (error) {
            if (sequence.current !== id) return;
            if ([401, 403, 404].includes(error.status)) { setData(null); setClosed(true); }
            else setError(error.message);
        }
    }
    useEffect(() => {
        refresh();
        const polling = setInterval(() => { if (!document.hidden && !mutation.current) refresh(); }, 3000);
        const timer = setInterval(() => { setNow(Date.now()); setCurrency(getStoredBalanceCurrency()); }, 1000);
        return () => { sequence.current++; clearInterval(polling); clearInterval(timer); };
    }, [token]);
    async function act(path, method, body) {
        if (mutation.current) return;
        mutation.current = true;
        sequence.current++;
        setBusy(true); setError('');
        try { await call(path, method, body); await refresh(); }
        catch (error) { setError(error.message); }
        finally { mutation.current = false; setBusy(false); }
    }
    if (closed) return <Navigate replace to="/" />;
    if (!data) return <div className="page-shell page-shell--with-topbar"><AppTopbar /><main className="page-content">
        <p role={error ? 'alert' : 'status'}>{error || 'Checking access…'}</p>
    </main></div>;
    const profile = data.profile;
    const verifyExpired = profile && now - +new Date(profile.verifiedAt) > 30 * 86_400_000;
    return <div className="page-shell page-shell--with-topbar page-shell--scroll"><Background /><AppTopbar />
        <main className="page-content external-page">
            <ProductPageHeader eyebrow="Private testing" title="External Games" description="Find an opponent here. Play native Triple Draft in the official Clash Royale app." />
            <div className="external-test-note"><span className="external-chip">Invite only</span> Independent Arenifi feature. Not affiliated with or endorsed by Supercell.</div>
            {error && <p role="alert" className="external-error">{error}</p>}
            <>
                <div className="external-grid"><section className="external-panel external-hero"><span className="external-kicker">Clash Royale</span><h2>Triple Draft</h2><p>1v1 Friendly Battle · Play in the official app</p>
                    <div className="external-formats"><div><strong>Free Play</strong><small>No entry fee or prize</small></div></div>
                    {!data.canQueue && <p className="external-tip">{data.paused ? 'New matches are paused. Existing battles can still be verified.' : !data.configured ? 'Setup required: add a Clash Royale Developer API key to the backend.' : !data.tokenVerification ? 'Setup required: enable authorized in-game API token verification.' : 'Setup required: confirm a native Triple Draft Friendly Battle in the official logs.'}</p>}
                    {!data.match && !data.queue && data.matchmaking && <button className="btn btn-primary" disabled={busy || !profile || verifyExpired || !data.canQueue} onClick={() => act('/queue', 'POST', { entry: 'free' })}>Find Free Play match</button>}
                    {!data.match && !data.queue && data.admin && <form className="external-practice" onSubmit={event => { event.preventDefault(); act('/practice', 'POST', { opponentTag }); }}>
                        <label>Opponent’s Clash Royale player tag<input className="input" required maxLength={16} placeholder="#PLAYER" autoComplete="off" value={opponentTag} onChange={event => setOpponentTag(event.target.value)} /></label>
                        <button className="btn btn-primary" disabled={busy || !profile || verifyExpired || !data.canQueue || !opponentTag.trim()}>Start private practice</button>
                        <small>Agree on a match with your opponent first. They don’t need an Arenifi account.</small>
                    </form>}
                    {data.queue && <div className="external-search"><span className="external-search-dot" aria-hidden="true" /><span role="status">Searching · {minutes(Math.max(0, Math.floor((now - +new Date(data.queue.joinedAt)) / 1000)))}</span><button className="btn btn-ghost" disabled={busy} onClick={() => act('/queue', 'DELETE')}>Cancel</button></div>}
                </section><section className="external-panel"><span className="external-kicker">Your account</span><h2>{formatBalanceAmount(user?.balanceUsd, user?.solPrice, currency)}</h2><p className="external-muted">Arenifi balance · Free Play never uses it</p>
                    {profile ? <Player profile={profile} status={verifyExpired ? 'Reverify' : 'Verified'} /> : <p>No verified Clash Royale account.</p>}
                    <div className="external-actions"><button className="btn btn-ghost" disabled={busy || !!data.match || !!data.queue || !data.configured || !data.tokenVerification} onClick={() => setLinking(true)}>{profile ? 'Reverify' : 'Connect account'}</button>
                        {profile && <button className="btn btn-ghost" disabled={busy || !!data.match || !!data.queue} onClick={() => act('/unlink', 'POST')}>Disconnect</button>}</div>
                </section></div>
                {data.match && <Room match={data.match} self={data.self} now={now} busy={busy} act={act} />}
                <section className="external-panel"><header className="external-section-header"><h2>Match history</h2><span className="external-muted">{data.stats.wins} wins · {data.stats.losses} losses · {data.stats.draws} draws · {data.stats.winRate ?? '—'}{data.stats.winRate == null ? '' : '%'} win rate</span></header>
                    {data.history.length ? <ul className="external-history">{data.history.map(match => <MatchResult key={match.id} match={match} self={data.self} />)}</ul> : <p className="external-muted">No matches yet.</p>}
                </section>
                {data.admin && <AdminReview call={call} />}
                {linking && <LinkDialog call={call} onClose={() => setLinking(false)} onLinked={refresh} />}
            </>
        </main>
    </div>;
}
