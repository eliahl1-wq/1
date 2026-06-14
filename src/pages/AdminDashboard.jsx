import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import '../styles/ui.css';

const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000')).replace(/\/$/, '');

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'controls', label: 'Server & Controls' },
    { id: 'wallets', label: 'Wallets' },
    { id: 'sweeps', label: 'Sweeps' },
    { id: 'users', label: 'Users' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'game', label: 'Game History' },
    { id: 'active', label: 'Active Now' },
];

function formatUsd(n) {
    return `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSol(n) {
    if (n == null) return '—';
    return `${Number(n).toFixed(4)} SOL`;
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString();
}

function formatCountdown(ms) {
    if (ms == null || ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function formatDuration(ms) {
    if (!ms) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
}

function truncateAddr(addr) {
    if (!addr || addr === '—') return '—';
    return addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}

function OutcomeBadge({ outcome }) {
    const colors = {
        Win: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)' },
        Loss: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
        'Break-even': { bg: 'rgba(234,179,8,0.12)', color: 'var(--yellow)' },
    };
    const style = colors[outcome] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-2)' };
    return (
        <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 'var(--r-full)',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: style.bg,
            color: style.color,
        }}>
            {outcome}
        </span>
    );
}

function TypeBadge({ type }) {
    const colors = { deposit: 'var(--green)', withdraw: 'var(--blue)', game: 'var(--yellow)' };
    return (
        <span style={{ fontWeight: 700, fontSize: '0.72rem', color: colors[type] || 'var(--text)' }}>
            {type}
        </span>
    );
}

function StatCard({ label, value, sub }) {
    return (
        <div style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '20px 24px',
            flex: '1 1 200px',
            minWidth: '180px',
        }}>
            <p className="label" style={{ marginBottom: '8px' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-h)', letterSpacing: '-1px' }}>
                {value}
            </p>
            {sub && <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-2)' }}>{sub}</p>}
        </div>
    );
}

function DataTable({ columns, rows, loading, emptyMessage }) {
    if (loading) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>
                <span className="spinner" style={{ marginRight: '8px' }} />
                Loading…
            </div>
        );
    }
    if (!rows?.length) {
        return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>{emptyMessage}</div>;
    }
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {columns.map(col => (
                            <th key={col.key} style={{
                                textAlign: 'left',
                                padding: '12px 16px',
                                color: 'var(--text-2)',
                                fontWeight: 600,
                                fontSize: '0.72rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                            }}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={row.id ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                            {columns.map(col => (
                                <td key={col.key} style={{ padding: '12px 16px', color: 'var(--text)' }}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Panel({ title, sub, children }) {
    return (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl)', overflow: 'hidden' }}>
            {(title || sub) && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    {title && <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-h)' }}>{title}</p>}
                    {sub && <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-2)' }}>{sub}</p>}
                </div>
            )}
            {children}
        </div>
    );
}

export default function AdminDashboard() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [overview, setOverview] = useState(null);
    const [activeUsers, setActiveUsers] = useState(null);
    const [users, setUsers] = useState([]);
    const [wallets, setWallets] = useState(null);
    const [sweeps, setSweeps] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [gameHistory, setGameHistory] = useState([]);
    const [filterUserId, setFilterUserId] = useState('');
    const [serverStatus, setServerStatus] = useState(null);
    const [actionMsg, setActionMsg] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const fetchAdmin = useCallback(async (path, options = {}) => {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });
        if (res.status === 403) throw new Error('Admin access required');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
        return data;
    }, [token]);

    const fetchServerStatus = useCallback(async () => {
        try {
            const status = await fetchAdmin('/api/admin/dashboard/server-status');
            setServerStatus(status);
        } catch {
            /* keep last known status */
        }
    }, [fetchAdmin]);

    const loadData = useCallback(async (userId = filterUserId) => {
        setLoading(true);
        setError('');
        try {
            const txQuery = userId ? `?userId=${userId}` : '';
            const gameQuery = userId ? `?userId=${userId}` : '';
            const [ov, au, us, wal, sw, tx, gh] = await Promise.all([
                fetchAdmin('/api/admin/dashboard/overview'),
                fetchAdmin('/api/admin/dashboard/active-users'),
                fetchAdmin('/api/admin/dashboard/users'),
                fetchAdmin('/api/admin/dashboard/wallets'),
                fetchAdmin('/api/admin/dashboard/sweeps'),
                fetchAdmin(`/api/admin/dashboard/transactions${txQuery}`),
                fetchAdmin(`/api/admin/dashboard/game-history${gameQuery}`),
            ]);
            setOverview(ov);
            setActiveUsers(au);
            setUsers(us.users ?? []);
            setWallets(wal);
            setSweeps(sw.sweeps ?? []);
            setTransactions(tx.transactions ?? []);
            setGameHistory(gh.history ?? []);
        } catch (err) {
            setError(err.message || 'Could not load dashboard');
        } finally {
            setLoading(false);
        }
    }, [fetchAdmin, filterUserId]);

    useEffect(() => {
        document.title = 'AgarStake | Admin';
        loadData();
    }, [loadData]);

    useEffect(() => {
        fetchServerStatus();
        const id = setInterval(fetchServerStatus, 1000);
        return () => clearInterval(id);
    }, [fetchServerStatus]);

    const runAdminAction = async (path, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setActionLoading(true);
        setActionMsg('');
        try {
            const result = await fetchAdmin(path, { method: 'POST' });
            setActionMsg(`✅ ${result.message || 'Done'}`);
            await Promise.all([loadData(), fetchServerStatus()]);
        } catch (err) {
            setActionMsg(`❌ ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const onFilterUser = (userId) => {
        setFilterUserId(userId);
        loadData(userId);
    };

    const userFilterBar = (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Filter by user:</span>
            <select
                value={filterUserId}
                onChange={e => onFilterUser(e.target.value)}
                style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--text-h)',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                }}
            >
                <option value="">All users</option>
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                ))}
            </select>
        </div>
    );

    return (
        <div style={{ width: '100vw', minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', paddingBottom: '40px' }}>
            <Background />
            <AppTopbar />

            <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '80px 20px 0', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <p className="label" style={{ marginBottom: '6px' }}>Admin</p>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text-h)' }}>
                            Dashboard
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost" onClick={() => loadData()} disabled={loading} style={{ padding: '9px 18px', fontSize: '0.78rem' }}>
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => navigate('/pre-game')} style={{ padding: '9px 18px', fontSize: '0.78rem' }}>
                            ← Back
                        </button>
                    </div>
                </div>

                {actionMsg && (
                    <div style={{
                        background: actionMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${actionMsg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        borderRadius: 'var(--r-lg)',
                        padding: '14px 18px',
                        marginBottom: '20px',
                        color: actionMsg.startsWith('✅') ? 'var(--green)' : '#ef4444',
                        fontSize: '0.85rem',
                    }}>
                        {actionMsg}
                    </div>
                )}

                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 'var(--r-lg)',
                        padding: '14px 18px',
                        marginBottom: '20px',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            className={`tab-btn${tab === t.id ? ' active' : ''}`}
                            onClick={() => setTab(t.id)}
                            style={{ padding: '8px 14px', fontSize: '0.78rem' }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'overview' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                        <StatCard
                            label="Arena Reset Timer"
                            value={serverStatus?.isResetting ? 'Resetting…' : formatCountdown(serverStatus?.msUntilReset)}
                            sub={serverStatus ? `Cycle: ${formatDuration(serverStatus.arenaDurationMs)} · ${serverStatus.isResetting ? 'In progress' : `Next reset ${formatDate(serverStatus.arenaResetAt)}`}` : ''}
                        />
                        <StatCard label="Total Deposits" value={formatUsd(overview?.totalDepositsUsd)} sub={overview ? `${overview.totalDepositsSol?.toFixed(4)} SOL · ${overview.depositCount} txs` : ''} />
                        <StatCard label="Total Withdrawals" value={formatUsd(overview?.totalWithdrawalsUsd)} sub={overview ? `${overview.withdrawalCount} txs` : ''} />
                        <StatCard label="Net Gaming Revenue" value={formatUsd(overview?.netGamingRevenue)} sub={overview?.netGamingRevenue >= 0 ? 'Platform profit' : 'Platform loss'} />
                        <StatCard label="Currently In Game" value={activeUsers?.currentlyInGame ?? '—'} sub={`${activeUsers?.activeLast24h ?? 0} active in last 24h`} />
                        <StatCard label="Main House Wallet" value={wallets?.mainHouse ? formatSol(wallets.mainHouse.balanceSol) : '—'} sub={wallets?.mainHouse ? formatUsd(wallets.mainHouse.balanceUsd) : 'Not configured'} />
                        <StatCard label="Owner Vault" value={wallets?.ownerVault ? formatSol(wallets.ownerVault.balanceSol) : '—'} sub="Sweep destination after reset" />
                    </div>
                )}

                {tab === 'controls' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <StatCard
                                label="Time Until Arena Reset"
                                value={serverStatus?.isResetting ? 'Resetting…' : formatCountdown(serverStatus?.msUntilReset)}
                                sub={serverStatus ? `Elapsed: ${formatCountdown(serverStatus.msElapsed)} / ${formatCountdown(serverStatus.arenaDurationMs)}` : 'Loading…'}
                            />
                            <StatCard
                                label="Arena Cycle Length"
                                value={formatDuration(serverStatus?.arenaDurationMs)}
                                sub={serverStatus?.devFreePlay ? 'DEV_FREE_PLAY on' : 'Production mode'}
                            />
                            <StatCard
                                label="Active BR Matches"
                                value={serverStatus?.battleRoyale?.activeMatchCount ?? '—'}
                                sub={`${serverStatus?.battleRoyale?.queuedPlayers ?? 0} players in BR queue · unaffected by arena reset`}
                            />
                            <StatCard
                                label="Arena Status"
                                value={serverStatus?.isResetting ? 'Resetting' : 'Live'}
                                sub={serverStatus?.brUntouchedOnArenaReset ? 'BR wallets never swept on arena reset' : ''}
                            />
                        </div>

                        <Panel
                            title="Arena reset timer"
                            sub={serverStatus ? `Started ${formatDate(serverStatus.arenaStartedAt)} · Resets ${formatDate(serverStatus.arenaResetAt)}` : ''}
                        >
                            <div style={{ padding: '20px' }}>
                                <div style={{
                                    height: '8px',
                                    borderRadius: 'var(--r-full)',
                                    background: 'rgba(255,255,255,0.06)',
                                    overflow: 'hidden',
                                    marginBottom: '12px',
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: serverStatus?.arenaDurationMs
                                            ? `${Math.min(100, ((serverStatus.msElapsed || 0) / serverStatus.arenaDurationMs) * 100)}%`
                                            : '0%',
                                        background: serverStatus?.isResetting ? 'var(--yellow)' : 'var(--accent)',
                                        transition: 'width 1s linear',
                                    }} />
                                </div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                    Automatic reset sweeps <strong style={{ color: 'var(--text-h)' }}>main house wallet only</strong> → owner vault.
                                    BR house wallets and ongoing BR matches are on a separate system and are not touched.
                                </p>
                            </div>
                        </Panel>

                        <Panel title="Admin actions" sub="No terminal commands needed">
                            <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={actionLoading || serverStatus?.isResetting}
                                    onClick={() => runAdminAction(
                                        '/api/admin/trigger-reset',
                                        'Trigger global arena reset?\n\n• All arena players will be cashed out\n• Main house wallet will be swept to owner vault\n• BR matches and BR wallets are NOT affected'
                                    )}
                                    style={{ padding: '12px 20px', fontSize: '0.82rem' }}
                                >
                                    {actionLoading ? 'Working…' : 'Trigger Arena Reset + Sweep'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    disabled={actionLoading || serverStatus?.isResetting}
                                    onClick={() => runAdminAction(
                                        '/api/admin/trigger-sweep',
                                        'Sweep main house wallet to owner vault now?\n\nBR house wallets will NOT be touched.'
                                    )}
                                    style={{ padding: '12px 20px', fontSize: '0.82rem' }}
                                >
                                    Sweep Main House Only
                                </button>
                            </div>
                        </Panel>

                        {serverStatus?.battleRoyale?.matches?.length > 0 && (
                            <Panel title="Active BR matches (unaffected by arena reset)" sub="These run on separate BR house wallets">
                                <DataTable
                                    columns={[
                                        { key: 'id', label: 'Match', render: r => <span className="mono" style={{ fontSize: '0.72rem' }}>{r.id?.slice(-10)}</span> },
                                        { key: 'variant', label: 'Variant' },
                                        { key: 'entryFeeUsd', label: 'Entry', render: r => formatUsd(r.entryFeeUsd) },
                                        { key: 'status', label: 'Status' },
                                        { key: 'playerCount', label: 'Players' },
                                        { key: 'prizePool', label: 'Prize pool', render: r => formatUsd(r.prizePool) },
                                    ]}
                                    rows={serverStatus.battleRoyale.matches}
                                    loading={false}
                                    emptyMessage="No active BR matches"
                                />
                            </Panel>
                        )}

                        {serverStatus?.arenaRooms?.length > 0 && (
                            <Panel title="Arena rooms (reset together)" sub="Normal Agar/Slither stake tiers">
                                <DataTable
                                    columns={[
                                        { key: 'entryFeeUsd', label: 'Tier', render: r => formatUsd(r.entryFeeUsd) },
                                        { key: 'playerCount', label: 'Players' },
                                        { key: 'foodPoolBalance', label: 'Food pool', render: r => formatUsd(r.foodPoolBalance) },
                                        { key: 'isResetting', label: 'Status', render: r => r.isResetting ? 'Resetting' : 'Live' },
                                    ]}
                                    rows={serverStatus.arenaRooms}
                                    loading={false}
                                    emptyMessage="No arena rooms"
                                />
                            </Panel>
                        )}
                    </div>
                )}

                {tab === 'wallets' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <Panel title="On-chain wallets" sub={`Live Solana balances · SOL @ $${wallets?.solPrice?.toFixed(2) ?? '—'}`}>
                            <DataTable
                                columns={[
                                    { key: 'label', label: 'Wallet', render: r => <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{r.label}</span> },
                                    { key: 'address', label: 'Address', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.address}>{truncateAddr(r.address)}</span> },
                                    { key: 'balanceSol', label: 'Balance', render: r => formatSol(r.balanceSol) },
                                    { key: 'balanceUsd', label: 'USD', render: r => formatUsd(r.balanceUsd) },
                                    { key: 'sweptOnReset', label: 'Owner sweep', render: r => r.sweptOnReset === false ? '2.5% after match' : r.sweptOnReset ? 'On arena reset' : '—' },
                                ]}
                                rows={[
                                    ...(wallets?.mainHouse ? [wallets.mainHouse] : []),
                                    ...(wallets?.brWallets ?? []),
                                    ...(wallets?.ownerVault ? [wallets.ownerVault] : []),
                                ]}
                                loading={loading}
                                emptyMessage="No wallets configured"
                            />
                        </Panel>
                        <Panel title="In-memory arena pools" sub="Per entry tier — reset when arena resets">
                            <DataTable
                                columns={[
                                    { key: 'entryFeeUsd', label: 'Tier', render: r => formatUsd(r.entryFeeUsd) },
                                    { key: 'foodPoolBalance', label: 'Food Pool', render: r => formatUsd(r.foodPoolBalance) },
                                    { key: 'aiBudgetBalance', label: 'AI Budget', render: r => formatUsd(r.aiBudgetBalance) },
                                    { key: 'ownerBalance', label: 'Owner Cut', render: r => formatUsd(r.ownerBalance) },
                                    { key: 'playersInRoom', label: 'Players' },
                                ]}
                                rows={wallets?.roomPools ?? []}
                                loading={loading}
                                emptyMessage="No active rooms"
                            />
                        </Panel>
                    </div>
                )}

                {tab === 'sweeps' && (
                    <Panel
                        title="House wallet sweeps & arena resets"
                        sub="Main arena → owner vault on reset. BR → 2.5% owner cut swept after each match winner is paid."
                    >
                        <DataTable
                            columns={[
                                { key: 'kind', label: 'Event', render: r => <OutcomeBadge outcome={r.kind.replace('_', ' ')} /> },
                                { key: 'solAmount', label: 'SOL swept', render: r => r.solAmount != null ? formatSol(r.solAmount) : '—' },
                                { key: 'usdAmount', label: 'USD', render: r => r.usdAmount != null ? formatUsd(r.usdAmount) : '—' },
                                { key: 'from', label: 'From', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.from}>{truncateAddr(r.from)}</span> },
                                { key: 'destination', label: 'To (Owner Vault)', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.destination}>{truncateAddr(r.destination)}</span> },
                                { key: 'signature', label: 'Tx Sig', render: r => r.signature ? (
                                    <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>
                                        {truncateAddr(r.signature)}
                                    </a>
                                ) : '—' },
                                { key: 'createdAt', label: 'Date', render: r => formatDate(r.createdAt) },
                            ]}
                            rows={sweeps}
                            loading={loading}
                            emptyMessage="No sweeps recorded yet (happens after arena reset)"
                        />
                    </Panel>
                )}

                {tab === 'users' && (
                    <Panel title={`${users.length} registered accounts`} sub="Balance = on-chain deposit wallet (SOL). Click user filter in Transactions/Game tabs.">
                        <DataTable
                            columns={[
                                { key: 'username', label: 'Username', render: r => <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{r.username}</span> },
                                { key: 'depositAddress', label: 'Deposit wallet', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.depositAddress}>{truncateAddr(r.depositAddress)}</span> },
                                { key: 'wallet', label: 'Withdraw addr', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.wallet}>{truncateAddr(r.wallet)}</span> },
                                { key: 'balanceUsd', label: 'Balance', render: r => `${formatUsd(r.balanceUsd)} (${formatSol(r.balanceSol)})` },
                                { key: 'totalDepositedUsd', label: 'Total deposited', render: r => formatUsd(r.totalDepositedUsd) },
                                { key: 'depositCount', label: 'Deposits' },
                                { key: 'id', label: 'Actions', render: r => (
                                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => { setFilterUserId(r.id); setTab('transactions'); loadData(r.id); }}>
                                        View txs
                                    </button>
                                )},
                            ]}
                            rows={users}
                            loading={loading}
                            emptyMessage="No users found"
                        />
                    </Panel>
                )}

                {tab === 'transactions' && (
                    <Panel title="All transactions" sub="Deposits, withdrawals, and system events (last 200)">
                        {userFilterBar}
                        <DataTable
                            columns={[
                                { key: 'createdAt', label: 'Date', render: r => formatDate(r.createdAt) },
                                { key: 'username', label: 'User', render: r => r.username },
                                { key: 'type', label: 'Type', render: r => <TypeBadge type={r.type} /> },
                                { key: 'amountUsd', label: 'Amount (USD)', render: r => formatUsd(r.amountUsd) },
                                { key: 'status', label: 'Status' },
                                { key: 'meta', label: 'Details', render: r => {
                                    const m = r.meta || {};
                                    return m.reason || m.event || m.signature ? truncateAddr(m.reason || m.event || m.signature) : '—';
                                }},
                            ]}
                            rows={transactions}
                            loading={loading}
                            emptyMessage="No transactions"
                        />
                    </Panel>
                )}

                {tab === 'game' && (
                    <Panel title="In-game history" sub="Joins, deaths, cashouts, reset payouts">
                        {userFilterBar}
                        <DataTable
                            columns={[
                                { key: 'createdAt', label: 'Date', render: r => formatDate(r.createdAt) },
                                { key: 'username', label: 'User', render: r => r.username },
                                { key: 'eventType', label: 'Event', render: r => <OutcomeBadge outcome={r.eventType} /> },
                                { key: 'game', label: 'Game', render: r => String(r.game).charAt(0).toUpperCase() + String(r.game).slice(1) },
                                { key: 'entryFeeUsd', label: 'Entry', render: r => r.entryFeeUsd != null ? formatUsd(r.entryFeeUsd) : '—' },
                                { key: 'amountUsd', label: 'Amount', render: r => formatUsd(r.amountUsd) },
                            ]}
                            rows={gameHistory}
                            loading={loading}
                            emptyMessage="No game history yet"
                        />
                    </Panel>
                )}

                {tab === 'active' && (
                    <Panel
                        title={`${activeUsers?.currentlyInGame ?? 0} players in arena now`}
                        sub={`${activeUsers?.activeLast24h ?? 0} unique users with activity in the last 24 hours`}
                    >
                        <DataTable
                            columns={[
                                { key: 'username', label: 'Player' },
                                { key: 'mode', label: 'Mode', render: r => r.mode?.charAt(0).toUpperCase() + r.mode?.slice(1) },
                                { key: 'entryFeeUsd', label: 'Entry', render: r => formatUsd(r.entryFeeUsd) },
                            ]}
                            rows={activeUsers?.inGamePlayers ?? []}
                            loading={loading}
                            emptyMessage="No players currently in game"
                        />
                    </Panel>
                )}
            </div>
        </div>
    );
}
