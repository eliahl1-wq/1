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
        excluded: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
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
        <div className="admin-stat-card">
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
        <div className="admin-panel" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl)', overflow: 'hidden' }}>
            {(title || sub) && (
                <div className="admin-panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
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
    const [showExcluded, setShowExcluded] = useState(false);
    const [showExcludedUsers, setShowExcludedUsers] = useState(false);
    const [selectedTxIds, setSelectedTxIds] = useState(new Set());
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());

    const fetchAdmin = useCallback(async (path, options = {}) => {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
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

    const loadData = useCallback(async (userId = filterUserId, includeExcluded = showExcluded, includeExcludedUsers = showExcludedUsers) => {
        setLoading(true);
        setError('');
        try {
            const txParams = new URLSearchParams();
            if (userId) txParams.set('userId', userId);
            if (includeExcluded) txParams.set('showExcluded', 'true');
            const gameParams = new URLSearchParams();
            if (userId) gameParams.set('userId', userId);
            const userParams = new URLSearchParams();
            if (includeExcludedUsers) userParams.set('showExcluded', 'true');
            const txQuery = txParams.toString() ? `?${txParams}` : '';
            const gameQuery = gameParams.toString() ? `?${gameParams}` : '';
            const userQuery = userParams.toString() ? `?${userParams}` : '';
            const [ov, au, us, wal, sw, tx, gh] = await Promise.all([
                fetchAdmin('/api/admin/dashboard/overview'),
                fetchAdmin('/api/admin/dashboard/active-users'),
                fetchAdmin(`/api/admin/dashboard/users${userQuery}`),
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
            setSelectedTxIds(new Set());
            setSelectedUserIds(new Set());
        } catch (err) {
            setError(err.message || 'Could not load dashboard');
        } finally {
            setLoading(false);
        }
    }, [fetchAdmin, filterUserId, showExcluded, showExcludedUsers]);

    useEffect(() => {
        document.title = 'AgarStake | Admin';
        loadData();
    }, [loadData]);

    useEffect(() => {
        fetchServerStatus();
        const id = setInterval(fetchServerStatus, 1000);
        return () => clearInterval(id);
    }, [fetchServerStatus]);

    const runAdminAction = async (path, confirmText, body) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setActionLoading(true);
        setActionMsg('');
        try {
            const result = await fetchAdmin(path, {
                method: 'POST',
                body: body ? JSON.stringify(body) : undefined,
            });
            setActionMsg(`✅ ${result.message || 'Done'}`);
            await Promise.all([loadData(), fetchServerStatus()]);
        } catch (err) {
            setActionMsg(`❌ ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const toggleTxSelection = (id) => {
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            const key = String(id);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAllTx = () => {
        if (selectedTxIds.size === transactions.length) {
            setSelectedTxIds(new Set());
        } else {
            setSelectedTxIds(new Set(transactions.map(t => String(t.id))));
        }
    };

    const bulkExcludeTx = () => {
        const ids = [...selectedTxIds];
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/transactions/exclude',
            `Exclude ${ids.length} transaction(s) from reports?\n\nThey stay in the database but won't count toward profit/deposits/lists.`,
            { ids },
        );
    };

    const bulkRestoreTx = () => {
        const ids = [...selectedTxIds];
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/transactions/restore',
            `Restore ${ids.length} transaction(s) to reports?`,
            { ids },
        );
    };

    const toggleUserSelection = (id) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            const key = String(id);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAllUsers = () => {
        if (selectedUserIds.size === users.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(users.map(u => String(u.id))));
        }
    };

    const bulkExcludeUsers = () => {
        const ids = [...selectedUserIds];
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/users/exclude',
            `Exclude ${ids.length} account(s) from reports?\n\nAll their transactions will be hidden from profit/deposits/stats. Nothing is deleted.`,
            { ids },
        );
    };

    const bulkRestoreUsers = () => {
        const ids = [...selectedUserIds];
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/users/restore',
            `Restore ${ids.length} account(s) to reports?`,
            { ids },
        );
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
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />

            <div className="page-content" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div className="page-header-row">
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

                <div className="admin-tabs">
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
                        {(overview?.excludedTxCount ?? 0) > 0 && (
                            <StatCard label="Excluded txs" value={overview.excludedTxCount} sub="Hidden individually — not deleted" />
                        )}
                        {(overview?.excludedUsersCount ?? 0) > 0 && (
                            <StatCard label="Excluded accounts" value={overview.excludedUsersCount} sub="All their txs hidden from stats" />
                        )}
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
                    <Panel
                        title={`${users.length} registered accounts`}
                        sub="Exclude a whole account (e.g. your test user) to hide all their transactions from stats without deleting anything."
                    >
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-2)', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={showExcludedUsers}
                                    onChange={e => {
                                        setShowExcludedUsers(e.target.checked);
                                        loadData(filterUserId, showExcluded, e.target.checked);
                                    }}
                                />
                                Include excluded accounts (to restore)
                            </label>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                                {selectedUserIds.size} selected
                            </span>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                disabled={actionLoading || selectedUserIds.size === 0}
                                onClick={bulkExcludeUsers}
                            >
                                Exclude selected
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                disabled={actionLoading || selectedUserIds.size === 0}
                                onClick={bulkRestoreUsers}
                            >
                                Restore selected
                            </button>
                        </div>
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>
                                <span className="spinner" style={{ marginRight: '8px' }} />
                                Loading…
                            </div>
                        ) : users.length === 0 ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>No users found</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px 16px', width: 40 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={users.length > 0 && selectedUserIds.size === users.length}
                                                    onChange={toggleSelectAllUsers}
                                                />
                                            </th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Username</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Deposit wallet</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Withdraw addr</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Balance</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Total deposited</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Deposits</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Status</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => {
                                            const id = String(u.id);
                                            const isExcluded = u.excludedFromReports;
                                            return (
                                                <tr
                                                    key={id}
                                                    style={{
                                                        borderBottom: '1px solid var(--border)',
                                                        opacity: isExcluded ? 0.55 : 1,
                                                        background: isExcluded ? 'rgba(148,163,184,0.06)' : 'transparent',
                                                    }}
                                                >
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUserIds.has(id)}
                                                            onChange={() => toggleUserSelection(id)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-h)' }}>{u.username}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span className="mono" style={{ fontSize: '0.72rem' }} title={u.depositAddress}>{truncateAddr(u.depositAddress)}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span className="mono" style={{ fontSize: '0.72rem' }} title={u.wallet}>{truncateAddr(u.wallet)}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>{formatUsd(u.balanceUsd)} ({formatSol(u.balanceSol)})</td>
                                                    <td style={{ padding: '12px 16px' }}>{formatUsd(u.totalDepositedUsd)}</td>
                                                    <td style={{ padding: '12px 16px' }}>{u.depositCount}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        {isExcluded ? <OutcomeBadge outcome="excluded" /> : 'Active'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost"
                                                            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                                            onClick={() => { setFilterUserId(u.id); setTab('transactions'); loadData(u.id); }}
                                                        >
                                                            View txs
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                )}

                {tab === 'transactions' && (
                    <Panel
                        title="All transactions"
                        sub="Exclude test/fake rows from stats without deleting them. Use bulk select for many at once."
                    >
                        {userFilterBar}
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-2)', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={showExcluded}
                                    onChange={e => {
                                        setShowExcluded(e.target.checked);
                                        loadData(filterUserId, e.target.checked);
                                    }}
                                />
                                Include excluded (to restore)
                            </label>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                                {selectedTxIds.size} selected
                            </span>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                disabled={actionLoading || selectedTxIds.size === 0}
                                onClick={bulkExcludeTx}
                            >
                                Exclude selected
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                disabled={actionLoading || selectedTxIds.size === 0}
                                onClick={bulkRestoreTx}
                            >
                                Restore selected
                            </button>
                        </div>
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>
                                <span className="spinner" style={{ marginRight: '8px' }} />
                                Loading…
                            </div>
                        ) : transactions.length === 0 ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>No transactions</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px 16px', width: 40 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={transactions.length > 0 && selectedTxIds.size === transactions.length}
                                                    onChange={toggleSelectAllTx}
                                                />
                                            </th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Date</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>User</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Type</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Amount</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Status</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(tx => {
                                            const id = String(tx.id);
                                            const isExcluded = tx.excludedFromReports;
                                            const m = tx.meta || {};
                                            const detail = m.reason || m.event || m.signature || '—';
                                            return (
                                                <tr
                                                    key={id}
                                                    style={{
                                                        borderBottom: '1px solid var(--border)',
                                                        opacity: isExcluded ? 0.55 : 1,
                                                        background: isExcluded ? 'rgba(255,255,255,0.02)' : undefined,
                                                    }}
                                                >
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTxIds.has(id)}
                                                            onChange={() => toggleTxSelection(id)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>{formatDate(tx.createdAt)}</td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>{tx.username}</td>
                                                    <td style={{ padding: '12px 16px' }}><TypeBadge type={tx.type} /></td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>{formatUsd(tx.amountUsd)}</td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                                                        {isExcluded ? <OutcomeBadge outcome="excluded" /> : tx.status}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                                                        <span className="mono" style={{ fontSize: '0.72rem' }} title={detail}>{truncateAddr(detail)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
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
