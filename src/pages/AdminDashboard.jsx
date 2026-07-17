import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import TournamentAdminPanel from '../components/TournamentAdminPanel';
import '../styles/ui.css';
import { API_URL } from '../utils/apiBase';

const API_BASE = API_URL;

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'activity', label: 'Activity' },
    { id: 'tournaments', label: 'Tournaments' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'operations', label: 'Operations' },
];

const USER_SORT_OPTIONS = [
    { value: 'balance_desc', label: 'Highest balance' },
    { value: 'balance_asc', label: 'Lowest balance' },
    { value: 'deposits_desc', label: 'Most deposited' },
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'username_asc', label: 'Username A–Z' },
];

const TX_CATEGORY_OPTIONS = [
    { value: '', label: 'All categories' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdraw', label: 'Withdrawals' },
    { value: 'entry', label: 'Game entries' },
    { value: 'cashout', label: 'Cashouts' },
    { value: 'death', label: 'Deaths' },
    { value: 'sweep', label: 'Owner sweeps' },
];

const TX_TYPE_OPTIONS = [
    { value: '', label: 'All types' },
    { value: 'deposit', label: 'Deposit' },
    { value: 'withdraw', label: 'Withdraw' },
    { value: 'game', label: 'Game' },
];

const LIVE_CATEGORY_FILTERS = [
    { value: '', label: 'All activity' },
    { value: 'entry', label: 'Entries' },
    { value: 'cashout', label: 'Cashouts' },
    { value: 'death', label: 'Deaths' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdraw', label: 'Withdrawals' },
    { value: 'sweep', label: 'Sweeps' },
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

function formatRelativeTime(d) {
    if (!d) return '—';
    const ms = Date.now() - new Date(d).getTime();
    if (ms < 5000) return 'just now';
    if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return formatDate(d);
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

function classifyTxCategory(tx) {
    const m = tx.meta || {};
    if (tx.type === 'deposit') return 'deposit';
    if (['pool_sweep', 'br_owner_sweep', 'reward_owner_surplus_sweep', 'reward_pool_factory_reset'].includes(m.event)) return 'sweep';
    if (tx.type === 'game') {
        if (m.event === 'join' || m.event === 'br_join') return 'entry';
        if (m.reason === 'Arena Death' || m.reason === 'BR Eliminated') return 'death';
        if (m.event === 'br_refund') return 'refund';
        return 'game';
    }
    if (tx.type === 'withdraw') {
        if (/Arena Cashout|Admin Forced|Auto Room Reset|BR Victory/i.test(m.reason || '')) return 'cashout';
        return 'withdraw';
    }
    return 'other';
}

function txActivityLabelClient(tx) {
    const m = tx.meta || {};
    const cat = classifyTxCategory(tx);
    switch (cat) {
        case 'deposit': return 'Deposit';
        case 'withdraw': return 'Withdrawal';
        case 'entry':
            if (m.event === 'br_join') return `BR entry · $${m.entryFeeUsd ?? '?'}`;
            return `Arena entry · ${m.mode || 'agar'} · $${m.entryFeeUsd ?? '?'}`;
        case 'cashout': return m.reason || 'Cashout';
        case 'death': return m.reason || 'Eliminated';
        case 'refund': return 'BR refund';
        case 'sweep': return m.reason || 'Owner sweep';
        default: return m.reason || m.event || tx.type;
    }
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

const CATEGORY_STYLES = {
    deposit: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)' },
    withdraw: { bg: 'rgba(59,130,246,0.12)', color: 'var(--blue)' },
    entry: { bg: 'rgba(234,179,8,0.12)', color: 'var(--yellow)' },
    cashout: { bg: 'rgba(34,197,94,0.18)', color: '#22c55e' },
    death: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    sweep: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    refund: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    game: { bg: 'rgba(234,179,8,0.08)', color: 'var(--yellow)' },
    other: { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-2)' },
};

function CategoryBadge({ category }) {
    const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.other;
    const labels = {
        deposit: 'Deposit',
        withdraw: 'Withdrawal',
        entry: 'Entry',
        cashout: 'Cashout',
        death: 'Death',
        sweep: 'Sweep',
        refund: 'Refund',
        game: 'Game',
        other: 'Other',
    };
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
            {labels[category] || category}
        </span>
    );
}

function LiveIndicator({ active }) {
    if (!active) return null;
    return (
        <span className="admin-live-dot" title="Auto-refreshing">
            <span className="admin-live-dot-pulse" />
            LIVE
        </span>
    );
}

function FilterSelect({ label, value, onChange, options, style }) {
    return (
        <label className="admin-filter-field" style={style}>
            {label && <span className="admin-filter-label">{label}</span>}
            <select className="admin-filter-select" value={value} onChange={onChange}>
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </label>
    );
}

function AdminFilterBar({ children, right }) {
    return (
        <div className="admin-filter-bar">
            <div className="admin-filter-bar-left">{children}</div>
            {right && <div className="admin-filter-bar-right">{right}</div>}
        </div>
    );
}

function WalletCard({ title, label, address, sol, usd, themeColor }) {
    return (
        <div style={{
            background: `linear-gradient(145deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
            border: `1px solid ${themeColor}30`,
            borderRadius: 'var(--r-xl)',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 8px 32px -8px ${themeColor}20`
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
                {label && <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '12px', background: `${themeColor}20`, color: themeColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>}
            </div>
            {address && <p className="mono" style={{ margin: '0 0 20px', fontSize: '0.75rem', color: 'var(--text-3)', position: 'relative', zIndex: 2 }}>{truncateAddr(address)}</p>}
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', position: 'relative', zIndex: 2 }}>
                <p style={{ margin: 0, fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-h)', letterSpacing: '-1.5px', textShadow: `0 2px 10px ${themeColor}40` }}>{sol}</p>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-2)', position: 'relative', zIndex: 2 }}>{usd}</p>
            
            <div style={{
                position: 'absolute',
                right: '-40px',
                bottom: '-40px',
                width: '160px',
                height: '160px',
                background: themeColor,
                opacity: 0.15,
                filter: 'blur(40px)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 1
            }} />
        </div>
    );
}

function StatCard({ label, value, sub, accent }) {
    return (
        <div className="admin-stat-card" style={accent ? { background: accent.background, borderColor: accent.border, boxShadow: accent.shadow } : undefined}>
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

function UserDetailModal({ userId, fetchAdmin, onClose, onExclude, onRestore, actionLoading }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [subTab, setSubTab] = useState('overview');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const data = await fetchAdmin(`/api/admin/dashboard/users/${userId}`);
                if (!cancelled) setDetail(data);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Could not load user');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userId, fetchAdmin]);

    const u = detail?.user;
    const stats = detail?.stats;
    const rewards = detail?.rewards;

    return (
        <div className="admin-user-modal-backdrop" onClick={onClose}>
            <div className="admin-user-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-user-modal-header">
                    <div>
                        <p className="label" style={{ marginBottom: '4px' }}>Account</p>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-h)' }}>
                            {loading ? 'Loading…' : u?.username ?? 'Unknown'}
                        </h2>
                        {u?.createdAt && (
                            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                                Joined {formatDate(u.createdAt)}
                                {u.excludedFromReports && <> · <OutcomeBadge outcome="excluded" /></>}
                            </p>
                        )}
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '8px 14px' }}>Close</button>
                </div>

                {error && (
                    <div style={{ padding: '16px 20px', color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>
                )}

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>
                        <span className="spinner" style={{ marginRight: '8px' }} />
                        Loading account…
                    </div>
                ) : detail && (
                    <>
                        <div className="admin-user-modal-stats">
                            <StatCard label="Balance" value={formatUsd(u.balanceUsd)} sub={formatSol(u.balanceSol)} />
                            <StatCard label="Available rewards" value={formatUsd(rewards?.totalAvailableUsd)} sub={u.rewardsDisabled ? 'Rewards blocked' : 'Sponsored + retained + tournament'} />
                            <StatCard label="Playtime" value={formatDuration(u.playtime ?? 0)} sub={`Last active ${formatRelativeTime(u.latestActivityAt)}`} />
                            <StatCard label="Games played" value={stats.gamesPlayed} sub={`${stats.wins}W · ${stats.losses}L · ${stats.deaths} deaths`} />
                            <StatCard label="Deposited" value={formatUsd(stats.totalDepositedUsd)} sub={`${stats.depositCount} deposits`} />
                            <StatCard label="Withdrawn" value={formatUsd(stats.totalWithdrawnUsd)} sub={`${stats.withdrawalCount} withdrawals`} />
                        </div>
                        <div style={{ padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div className="admin-tabs" style={{ marginBottom: 0, flex: 1 }}>
                                {['overview', 'transactions', 'games'].map(id => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`tab-btn${subTab === id ? ' active' : ''}`}
                                        onClick={() => setSubTab(id)}
                                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                    >
                                        {id === 'overview' ? 'Overview' : id === 'transactions' ? 'Transactions' : 'Game activity'}
                                    </button>
                                ))}
                            </div>
                            {u.excludedFromReports ? (
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                    disabled={actionLoading}
                                    onClick={() => onRestore([String(u.id)])}
                                >
                                    Restore to reports
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                    disabled={actionLoading}
                                    onClick={() => onExclude([String(u.id)])}
                                >
                                    Exclude from reports
                                </button>
                            )}
                        </div>

                        <div className="admin-user-modal-body">
                            {subTab === 'overview' && (
                                <div style={{ display: 'grid', gap: '16px', fontSize: '0.82rem' }}>
                                    <section style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', background: 'rgba(255,255,255,0.02)' }}>
                                        <p className="label" style={{ marginBottom: '12px' }}>Account & access</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                                            <div><span style={{ color: 'var(--text-2)' }}>Email</span><br />{u.email || '—'}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Joined</span><br />{formatDate(u.createdAt)}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Last activity</span><br />{formatDate(u.latestActivityAt)}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Reporting</span><br />{u.excludedFromReports ? 'Excluded' : 'Included'}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Ownership</span><br />{u.isOwnerAccount ? 'Your account' : 'Player account'}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Deposit wallet</span><br /><span className="mono" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{u.depositAddress}</span></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Withdraw address</span><br /><span className="mono" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{u.wallet}</span></div>
                                        </div>
                                    </section>

                                    <section style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', background: 'rgba(255,255,255,0.02)' }}>
                                        <p className="label" style={{ marginBottom: '12px' }}>Rewards & tickets</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
                                            <div><span style={{ color: 'var(--text-2)' }}>Sponsored balance</span><br /><strong>{formatUsd(rewards?.sponsoredBalanceUsd)}</strong></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Retained winnings</span><br /><strong>{formatUsd(rewards?.retainedWinningsUsd)}</strong></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Tournament balance</span><br /><strong>{formatUsd(rewards?.tournamentBalanceUsd)}</strong></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Sponsored claimed</span><br /><strong>{formatUsd(rewards?.sponsoredClaimedUsd)}</strong></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Tournament earned</span><br /><strong>{formatUsd(rewards?.tournamentEarnedUsd)}</strong></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Tournament claimed</span><br /><strong>{formatUsd(rewards?.tournamentClaimedUsd)}</strong></div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Free ticket</span><br />{rewards?.hasFreeTicket && !rewards?.freeTicketUsed ? 'Available' : rewards?.freeTicketUsed ? 'Used' : 'None'}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>$5 challenge games</span><br />{rewards?.completedFiveDollarGames ?? 0}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>$10 challenge games</span><br />{rewards?.completedTenDollarGames ?? 0}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Challenge</span><br />{rewards?.challengeCompleted ? 'Completed' : rewards?.challengeUnlocked ? 'Unlocked' : 'In progress'}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Claim status</span><br />{rewards?.claimInProgress || rewards?.tournamentClaimInProgress ? 'Processing' : 'Idle'}</div>
                                            <div><span style={{ color: 'var(--text-2)' }}>Reward access</span><br />{u.rewardsDisabled ? `Blocked${u.rewardsDisabledReason ? ` · ${u.rewardsDisabledReason}` : ''}` : 'Enabled'}</div>
                                        </div>
                                    </section>

                                    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
                                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                                            <p className="label" style={{ margin: 0 }}>Played modes</p>
                                        </div>
                                        <DataTable
                                            columns={[
                                                { key: 'mode', label: 'Mode', render: r => String(r.mode).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
                                                { key: 'games', label: 'Entries' },
                                                { key: 'deaths', label: 'Deaths' },
                                                { key: 'cashouts', label: 'Cashouts' },
                                                { key: 'entryUsd', label: 'Entry value', render: r => formatUsd(r.entryUsd) },
                                                { key: 'payoutUsd', label: 'Payouts', render: r => formatUsd(r.payoutUsd) },
                                            ]}
                                            rows={stats.modeBreakdown || []}
                                            loading={false}
                                            emptyMessage="No recorded game modes"
                                        />
                                    </section>
                                </div>
                            )}
                            {subTab === 'transactions' && (
                                <DataTable
                                    columns={[
                                        { key: 'createdAt', label: 'Date', render: r => formatDate(r.createdAt) },
                                        { key: 'category', label: 'Category', render: r => <CategoryBadge category={r.category || classifyTxCategory(r)} /> },
                                        { key: 'label', label: 'Description', render: r => r.label || txActivityLabelClient(r) },
                                        { key: 'amountUsd', label: 'Amount', render: r => formatUsd(r.amountUsd) },
                                        { key: 'status', label: 'Status', render: r => r.excludedFromReports ? <OutcomeBadge outcome="excluded" /> : r.status },
                                    ]}
                                    rows={detail.transactions.map(t => ({ ...t, category: t.category || classifyTxCategory(t) }))}
                                    loading={false}
                                    emptyMessage="No transactions"
                                />
                            )}
                            {subTab === 'games' && (
                                <DataTable
                                    columns={[
                                        { key: 'createdAt', label: 'Date', render: r => formatDate(r.createdAt) },
                                        { key: 'game', label: 'Game', render: r => String(r.game).charAt(0).toUpperCase() + String(r.game).slice(1) },
                                        { key: 'entryFeeUsd', label: 'Entry', render: r => r.entryFeeUsd != null ? formatUsd(r.entryFeeUsd) : formatUsd(r.wagerUsd) },
                                        { key: 'payoutUsd', label: 'Payout', render: r => formatUsd(r.payoutUsd) },
                                        { key: 'outcome', label: 'Result', render: r => <OutcomeBadge outcome={r.outcome} /> },
                                    ]}
                                    rows={detail.gameHistory}
                                    loading={false}
                                    emptyMessage="No game activity yet"
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
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
    const [filterUserId, setFilterUserId] = useState('');
    const [txFilter, setTxFilter] = useState({ userId: '', category: '', type: '', search: '' });
    const txFilterRef = useRef(txFilter);
    txFilterRef.current = txFilter;
    const [liveFeed, setLiveFeed] = useState([]);
    const [livePlayers, setLivePlayers] = useState([]);
    const [liveCategoryFilter, setLiveCategoryFilter] = useState('');
    const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);
    const [liveRefreshing, setLiveRefreshing] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [serverStatus, setServerStatus] = useState(null);
    const [actionMsg, setActionMsg] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [showExcluded, setShowExcluded] = useState(false);
    const [showExcludedUsers, setShowExcludedUsers] = useState(false);
    const [selectedTxIds, setSelectedTxIds] = useState(new Set());
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [userSort, setUserSort] = useState('balance_desc');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [rewardAlerts, setRewardAlerts] = useState([]);
    const [pendingRewardClaims, setPendingRewardClaims] = useState([]);

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

    const fetchLiveFeed = useCallback(async (silent = true) => {
        if (!silent) setLiveRefreshing(true);
        try {
            const data = await fetchAdmin('/api/admin/dashboard/live-feed?limit=80');
            setLiveFeed(data.feed ?? []);
            setLivePlayers(data.inGamePlayers ?? []);
            setLiveUpdatedAt(data.serverTime ?? new Date().toISOString());
            setActiveUsers(prev => ({
                ...(prev || {}),
                currentlyInGame: data.currentlyInGame ?? 0,
                inGamePlayers: data.inGamePlayers ?? [],
            }));
        } catch {
            /* keep last feed */
        } finally {
            if (!silent) setLiveRefreshing(false);
        }
    }, [fetchAdmin]);

    const fetchTransactions = useCallback(async (filters = txFilter, includeExcluded = showExcluded) => {
        const params = new URLSearchParams();
        if (filters.userId) params.set('userId', filters.userId);
        if (filters.category) params.set('category', filters.category);
        if (filters.type) params.set('type', filters.type);
        if (filters.search?.trim()) params.set('search', filters.search.trim());
        if (includeExcluded) params.set('showExcluded', 'true');
        const q = params.toString() ? `?${params}` : '';
        const data = await fetchAdmin(`/api/admin/dashboard/transactions${q}`);
        setTransactions(data.transactions ?? []);
        return data;
    }, [fetchAdmin, txFilter, showExcluded]);

    const loadData = useCallback(async (userId = filterUserId, includeExcluded = showExcluded, includeExcludedUsers = showExcludedUsers, sort = userSort) => {
        setLoading(true);
        setError('');
        try {
            const userParams = new URLSearchParams();
            if (includeExcludedUsers) userParams.set('showExcluded', 'true');
            if (sort) userParams.set('sort', sort);
            const userQuery = userParams.toString() ? `?${userParams}` : '';
            const [ov, au, us, wal, sw, security] = await Promise.all([
                fetchAdmin('/api/admin/dashboard/overview'),
                fetchAdmin('/api/admin/dashboard/active-users'),
                fetchAdmin(`/api/admin/dashboard/users${userQuery}`),
                fetchAdmin('/api/admin/dashboard/wallets'),
                fetchAdmin('/api/admin/dashboard/sweeps'),
                fetchAdmin('/api/admin/reward-security-alerts'),
            ]);
            setOverview(ov);
            setActiveUsers(au);
            setUsers(us.users ?? []);
            setWallets(wal);
            setSweeps(sw.sweeps ?? []);
            setRewardAlerts(security.alerts ?? []);
            setPendingRewardClaims(security.pendingClaims ?? []);
            await Promise.all([
                fetchTransactions({ ...txFilterRef.current, userId: userId || txFilterRef.current.userId }, includeExcluded),
                fetchLiveFeed(true),
            ]);
            setSelectedTxIds(new Set());
            setSelectedUserIds(new Set());
        } catch (err) {
            setError(err.message || 'Could not load dashboard');
        } finally {
            setLoading(false);
        }
    }, [fetchAdmin, filterUserId, showExcluded, showExcludedUsers, userSort, fetchTransactions, fetchLiveFeed]);

    useEffect(() => {
        document.title = 'AgarStake | Admin';
        loadData();
    }, [loadData]);

    useEffect(() => {
        fetchServerStatus();
        const id = setInterval(fetchServerStatus, 1000);
        return () => clearInterval(id);
    }, [fetchServerStatus]);

    useEffect(() => {
        if (tab !== 'activity' && tab !== 'overview') return undefined;
        fetchLiveFeed(true);
        const id = setInterval(() => fetchLiveFeed(true), 3000);
        return () => clearInterval(id);
    }, [tab, fetchLiveFeed]);

    useEffect(() => {
        if (tab !== 'activity') return undefined;
        const id = setInterval(() => {
            fetchTransactions(txFilter, showExcluded).catch(() => {});
        }, 5000);
        return () => clearInterval(id);
    }, [tab, txFilter, showExcluded, fetchTransactions]);

    const resolveRewardAlert = async (alert, action) => {
        const verb = action === 'approve' ? 'allow rewards for' : 'keep rewards blocked for';
        if (!window.confirm(`${verb} all accounts linked to ${alert.sourceWallet}?`)) return;
        setActionLoading(true);
        setActionMsg('');
        try {
            await fetchAdmin(`/api/admin/reward-security-alerts/${alert._id}/resolve`, {
                method: 'POST',
                body: JSON.stringify({ action }),
            });
            const data = await fetchAdmin('/api/admin/reward-security-alerts');
            setRewardAlerts(data.alerts ?? []);
            setPendingRewardClaims(data.pendingClaims ?? []);
            setActionMsg(action === 'approve' ? '✅ Linked accounts approved and rewards restored.' : '✅ Reward block confirmed.');
        } catch (err) {
            setActionMsg(`❌ ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };
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

    const factoryResetRewardPool = async () => {
        const confirmation = window.prompt(
            'DANGER: This permanently deletes every account reward and retained winning, restores eligible accounts to an unused free ticket, resets all reward-pool accounting, and sweeps the reward wallet to the owner vault while leaving about $0.50.\n\nIt is blocked only by active blockchain claims, joins, or arena players. Transaction history is preserved.\n\nType RESET REWARD POOL to continue.'
        );
        if (confirmation == null) return;
        if (confirmation !== 'RESET REWARD POOL') {
            setActionMsg('❌ Reset cancelled: confirmation phrase did not match.');
            return;
        }
        setActionLoading(true);
        setActionMsg('');
        try {
            const result = await fetchAdmin('/api/admin/reward-pool/factory-reset', {
                method: 'POST',
                body: JSON.stringify({ confirmation }),
            });
            setActionMsg(`✅ ${result.message}`);
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

    const excludeUsersById = (ids) => {
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/users/exclude',
            `Exclude this account from reports?\n\nAll their transactions will be hidden from stats. Nothing is deleted.`,
            { ids },
        ).then(() => setSelectedUserId(null));
    };

    const restoreUsersById = (ids) => {
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/users/restore',
            `Restore this account to reports?`,
            { ids },
        ).then(() => setSelectedUserId(null));
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

    const setSelectedOwnerStatus = (isOwnerAccount) => {
        const ids = [...selectedUserIds];
        if (!ids.length) return;
        runAdminAction(
            '/api/admin/users/owner-status',
            isOwnerAccount
                ? `Mark ${ids.length} selected account(s) as yours?\n\nTheir balances will appear in Your accounts and they will be exempt from shared-wallet reward alerts.`
                : `Remove ${ids.length} selected account(s) from Your accounts?\n\nTheir deposit-wallet history will be checked against the normal reward alert rules.`,
            { ids, isOwnerAccount },
        );
    };
    const applyTxFilters = (patch) => {
        const next = { ...txFilterRef.current, ...patch };
        setTxFilter(next);
        setFilterUserId(next.userId || '');
        fetchTransactions(next, showExcluded).catch(err => setError(err.message));
    };

    const runTxSearch = () => {
        fetchTransactions(txFilterRef.current, showExcluded).catch(err => setError(err.message));
    };

    const clearTxFilters = () => {
        const next = { userId: '', category: '', type: '', search: '' };
        setFilterUserId('');
        setTxFilter(next);
        fetchTransactions(next, showExcluded).catch(err => setError(err.message));
    };

    const filteredUsers = userSearch.trim()
        ? users.filter(u => u.username.toLowerCase().includes(userSearch.trim().toLowerCase()))
        : users;

    const filteredLiveFeed = liveCategoryFilter
        ? liveFeed.filter(item => item.category === liveCategoryFilter)
        : liveFeed;

    const openUserFromFeed = (userId) => {
        if (userId) setSelectedUserId(String(userId));
    };

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />

            <div className="page-content" style={{ maxWidth: '1200px' }}>
                <div className="page-header-row">
                    <div>
                        <p className="label" style={{ marginBottom: '6px' }}>Admin</p>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text-h)' }}>
                            Dashboard
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <LiveIndicator active={tab === 'activity' || tab === 'overview'} />
                        <button className="btn btn-primary" onClick={() => navigate('/admin/sandbox')} style={{ padding: '9px 18px', fontSize: '0.78rem' }}>
                            Sandbox Studio
                        </button>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 16px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                🔗 Actual On-Chain Wallets
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                                <WalletCard 
                                    title="Main House" 
                                    label="Automated"
                                    address={wallets?.mainHouse?.address} 
                                    sol={wallets?.mainHouse ? formatSol(wallets.mainHouse.balanceSol) : '—'} 
                                    usd={wallets?.mainHouse ? formatUsd(wallets.mainHouse.balanceUsd) : '—'} 
                                    themeColor="#3b82f6"
                                />
                                <WalletCard 
                                    title="Reward Wallet" 
                                    label="Sponsors & Tourneys"
                                    address={wallets?.rewardWallet?.address} 
                                    sol={wallets?.rewardWallet ? formatSol(wallets.rewardWallet.balanceSol) : '—'} 
                                    usd={wallets?.rewardWallet ? formatUsd(wallets.rewardWallet.balanceUsd) : '—'} 
                                    themeColor="#a855f7"
                                />
                                <WalletCard 
                                    title="Tournament Wallet" 
                                    label="Entry Fees & Prizes"
                                    address={wallets?.tournamentWallet?.address} 
                                    sol={wallets?.tournamentWallet ? formatSol(wallets.tournamentWallet.balanceSol) : '—'} 
                                    usd={wallets?.tournamentWallet ? formatUsd(wallets.tournamentWallet.balanceUsd) : '—'} 
                                    themeColor="#ec4899"
                                />
                                <WalletCard 
                                    title="Owner Vault" 
                                    label="Profits"
                                    address={wallets?.ownerVault?.address} 
                                    sol={wallets?.ownerVault ? formatSol(wallets.ownerVault.balanceSol) : '—'} 
                                    usd={wallets?.ownerVault ? formatUsd(wallets.ownerVault.balanceUsd) : '—'} 
                                    themeColor="#22c55e"
                                />
                                <WalletCard 
                                    title="BR Wallets (Sum)" 
                                    label="Matches"
                                    address={wallets?.brWallets?.length ? `${wallets.brWallets.length} active wallets` : 'None active'}
                                    sol={wallets?.brWallets ? formatSol(wallets.brWallets.reduce((acc, w) => acc + w.balanceSol, 0)) : '0.0000 SOL'} 
                                    usd={wallets?.brWallets ? formatUsd(wallets.brWallets.reduce((acc, w) => acc + w.balanceUsd, 0)) : '$0.00'} 
                                    themeColor="#f59e0b"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 style={{ margin: '0 0 16px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                📊 Bookkeeping & Stats
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
                                <StatCard label="Online now" value={(activeUsers?.sitePresence?.length ?? 0) + (activeUsers?.currentlyInGame ?? 0)} sub={`${activeUsers?.currentlyInGame ?? 0} playing · ${activeUsers?.sitePresence?.length ?? 0} browsing`} />
                                <StatCard label="Registered users" value={overview?.totalAccounts ?? '—'} sub={`${formatUsd(overview?.totalUserBalanceUsd)} held in balances`} />
                                <StatCard label="Total deposits" value={formatUsd(overview?.totalDepositsUsd)} sub={`${overview?.depositCount ?? 0} deposits`} />
                                <StatCard label="Platform earnings" value={formatUsd(overview?.ownerEarningsUsd)} sub={`${overview?.ownerSweepCount ?? 0} completed sweeps`} />
                                <StatCard label="Rewards owed" value={formatUsd((overview?.totalSponsoredRewards ?? 0) + (overview?.totalRetainedWinnings ?? 0))} sub={`${overview?.activeSponsoredPlayers ?? 0} sponsored users`} />
                                <StatCard label="Needs attention" value={rewardAlerts.filter(alert => alert.status === 'pending').length + pendingRewardClaims.length} sub="Reward alerts and unsettled claims" />
                                <StatCard
                                    label="Your accounts"
                                    value={formatUsd(overview?.ownerAccountBalanceUsd)}
                                    sub={`${overview?.ownerAccountCount ?? 0} owned account(s) · ${formatSol(overview?.ownerAccountBalanceSol)}`}
                                    accent={{
                                        background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.12))',
                                        border: 'rgba(139,92,246,0.5)',
                                        shadow: '0 12px 30px rgba(76,29,149,0.14)',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'tournaments' && (
                    <TournamentAdminPanel
                        fetchAdmin={fetchAdmin}
                        setActionMsg={setActionMsg}
                    />
                )}

                {tab === 'activity' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            <StatCard
                                label="Website Visitors"
                                value={activeUsers?.sitePresence?.length ?? 0}
                                sub="Browsing or in lobbies"
                            />
                            <StatCard
                                label="Active Players"
                                value={activeUsers?.currentlyInGame ?? 0}
                                sub="Human players in matches"
                            />
                            <StatCard
                                label="Active Bots"
                                value={activeUsers?.currentlyBots ?? 0}
                                sub="Total bots simulated in arenas"
                            />
                            <StatCard
                                label="Active last 24h"
                                value={activeUsers?.activeLast24h ?? '—'}
                                sub="Unique users active today"
                            />
                        </div>

                        <Panel
                            title={`Players in arenas (${activeUsers?.currentlyInGame ?? 0} total)`}
                            sub={livePlayers.length ? 'Currently staking in arena tiers' : 'No human players in matches right now'}
                        >
                            <DataTable
                                columns={[
                                    { key: 'username', label: 'Player', render: r => (
                                        <button type="button" className="admin-link-btn" onClick={() => openUserFromFeed(r.id)}>{r.username}</button>
                                    )},
                                    { key: 'mode', label: 'Game', render: r => r.mode?.charAt(0).toUpperCase() + r.mode?.slice(1) },
                                    { key: 'entryFeeUsd', label: 'Entry stake', render: r => formatUsd(r.entryFeeUsd) },
                                ]}
                                rows={livePlayers}
                                loading={false}
                                emptyMessage="No players in arena"
                            />
                        </Panel>

                        <Panel
                            title={`Bots in arenas (${activeUsers?.currentlyBots ?? 0} total)`}
                            sub={activeUsers?.inGameBots?.length ? 'Currently simulated bots in arenas' : 'No bots in matches right now'}
                        >
                            <DataTable
                                columns={[
                                    { key: 'username', label: 'Bot Name' },
                                    { key: 'mode', label: 'Game Mode', render: r => r.mode?.charAt(0).toUpperCase() + r.mode?.slice(1) },
                                    { key: 'entryFeeUsd', label: 'Entry Tier', render: r => formatUsd(r.entryFeeUsd) },
                                ]}
                                rows={activeUsers?.inGameBots || []}
                                loading={false}
                                emptyMessage="No active bots"
                            />
                        </Panel>

                        <Panel
                            title={`Site Visitors (${activeUsers?.sitePresence?.length ?? 0} total)`}
                            sub={activeUsers?.sitePresence?.length ? 'Users currently active on the website' : 'No recent visitors'}
                        >
                            <DataTable
                                columns={[
                                    { key: 'ip', label: 'IP', render: r => <span className="mono">{r.ip}</span> },
                                    { key: 'country', label: 'Country', render: r => r.country },
                                    { key: 'page', label: 'Page', render: r => <span className="mono">{r.page}</span> },
                                    { key: 'gamemode', label: 'Game Mode', render: r => r.gamemode },
                                    { key: 'userAgent', label: 'Device / Browser', render: r => <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', display: 'block', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.userAgent}>{r.userAgent}</span> },
                                    { key: 'lastSeen', label: 'Last Seen', render: r => formatRelativeTime(r.lastSeen) },
                                ]}
                                rows={activeUsers?.sitePresence || []}
                                loading={false}
                                emptyMessage="No site visitors"
                            />
                        </Panel>

                        <Panel
                            title="Live activity feed"
                            sub="Deposits, entries, cashouts, deaths, withdrawals — newest first"
                        >
                            <AdminFilterBar right={
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }} onClick={() => fetchLiveFeed(false)} disabled={liveRefreshing}>
                                    {liveRefreshing ? 'Updating…' : 'Refresh now'}
                                </button>
                            }>
                                <FilterSelect
                                    label="Show"
                                    value={liveCategoryFilter}
                                    onChange={e => setLiveCategoryFilter(e.target.value)}
                                    options={LIVE_CATEGORY_FILTERS}
                                />
                            </AdminFilterBar>
                            <DataTable
                                columns={[
                                    { key: 'time', label: 'When', render: r => (
                                        <span title={formatDate(r.createdAt)}>{formatRelativeTime(r.createdAt)}</span>
                                    )},
                                    { key: 'category', label: 'Type', render: r => <CategoryBadge category={r.category} /> },
                                    { key: 'username', label: 'User', render: r => r.userId ? (
                                        <button type="button" className="admin-link-btn" onClick={() => openUserFromFeed(r.userId)}>{r.username}</button>
                                    ) : r.username },
                                    { key: 'label', label: 'What happened', render: r => <span style={{ color: 'var(--text-h)' }}>{r.label}</span> },
                                    { key: 'amountUsd', label: 'Amount', render: r => (
                                        <span style={{ fontWeight: 600, color: r.category === 'death' ? 'var(--text-2)' : 'var(--text-h)' }}>
                                            {r.amountUsd > 0 ? formatUsd(r.amountUsd) : '—'}
                                        </span>
                                    )},
                                ]}
                                rows={filteredLiveFeed}
                                loading={liveFeed.length === 0 && liveRefreshing}
                                emptyMessage="No recent activity"
                            />
                        </Panel>
                    </div>
                )}

                {tab === 'rewards' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <Panel
                            title={`Shared deposit-wallet alerts (${rewardAlerts.filter(alert => alert.status === 'pending').length} pending)`}
                            sub="Rewards are removed automatically until you allow the linked accounts or confirm the block."
                        >
                            {rewardAlerts.length === 0 ? (
                                <div style={{ padding: '24px', color: 'var(--text-2)', fontSize: '0.82rem' }}>No linked-wallet alerts.</div>
                            ) : rewardAlerts.map(alert => (
                                <div key={alert._id} style={{ padding: '18px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '7px' }}>
                                            <CategoryBadge category={alert.status === 'approved' ? 'deposit' : alert.status === 'denied' ? 'death' : 'withdraw'} />
                                            <strong style={{ color: 'var(--text-h)', textTransform: 'capitalize' }}>{alert.status}</strong>
                                        </div>
                                        <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-2)', wordBreak: 'break-all' }}>{alert.sourceWallet}</div>
                                        <div style={{ marginTop: '7px', fontSize: '0.78rem', color: 'var(--text-1)' }}>
                                            {(alert.userIds || []).map(user => user.username || user.email || user._id).join(' · ')}
                                        </div>
                                        <div style={{ marginTop: '4px', fontSize: '0.68rem', color: 'var(--text-3)' }}>{formatDate(alert.createdAt)}</div>
                                    </div>
                                    {alert.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={() => resolveRewardAlert(alert, 'approve')}>
                                                Allow linked accounts
                                            </button>
                                            <button type="button" className="btn btn-danger" disabled={actionLoading} onClick={() => resolveRewardAlert(alert, 'deny')}>
                                                Keep rewards blocked
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </Panel>
                        <Panel title={`Claims awaiting settlement (${pendingRewardClaims.length})`} sub="Broadcast claims reconcile automatically. Reserved claims stay locked for investigation rather than risking a double payment.">
                            <DataTable
                                columns={[
                                    { key: 'user', label: 'User', render: claim => claim.userId?.username || claim.userId?.email || 'Unknown' },
                                    { key: 'amount', label: 'Amount', render: claim => formatUsd(claim.amountUsd) },
                                    { key: 'status', label: 'Status', render: claim => <strong style={{ textTransform: 'capitalize' }}>{claim.status}</strong> },
                                    { key: 'signature', label: 'Signature', render: claim => claim.signature ? <span className="mono">{truncateAddr(claim.signature)}</span> : 'Not recorded' },
                                    { key: 'created', label: 'Created', render: claim => formatDate(claim.createdAt) },
                                ]}
                                rows={pendingRewardClaims}
                                loading={false}
                                emptyMessage="No unsettled reward claims"
                            />
                        </Panel>                    </div>
                )}
                {tab === 'operations' && (
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
                                        'Reset everything and sweep main house wallet now?\n\n- All arena players will be cashed out\n- Food, bots, loot and in-memory pools will be cleared\n- BR matches and BR wallets will NOT be touched'
                                    )}
                                    style={{ padding: '12px 20px', fontSize: '0.82rem' }}
                                >
                                    Full Reset + Sweep Wallet
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    disabled={actionLoading}
                                    onClick={() => runAdminAction(
                                        '/api/admin/tournaments/trigger-sweep',
                                        'Sweep Tournament Wallet to Owner Vault?\n\n- This will withdraw all accumulated SOL entry fees (retaining a minor rent exemption buffer) and send it directly to your OWNER_VAULT_ADDRESS on-chain.'
                                    )}
                                    style={{ padding: '12px 20px', fontSize: '0.82rem', borderColor: '#f97316', color: '#f97316' }}
                                >
                                    {actionLoading ? 'Working…' : 'Sweep Tournament Wallet'}
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

                {tab === 'operations' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <StatCard
                                label="Total earned (sweeps)"
                                value={formatUsd(overview?.ownerEarningsUsd)}
                                sub={`${overview?.ownerEarningsSol?.toFixed(4) ?? '0'} SOL → owner vault`}
                            />
                            <StatCard
                                label="Owner vault (on-chain)"
                                value={wallets?.ownerVault ? formatSol(wallets.ownerVault.balanceSol) : '—'}
                                sub={wallets?.ownerVault ? formatUsd(wallets.ownerVault.balanceUsd) : 'Not configured'}
                            />
                            <StatCard
                                label="Main house wallet"
                                value={wallets?.mainHouse ? formatSol(wallets.mainHouse.balanceSol) : '—'}
                                sub={wallets?.mainHouse ? formatUsd(wallets.mainHouse.balanceUsd) : 'Not configured'}
                            />
                        </div>
                        <Panel
                            title="Reward Pool Management"
                            sub="Factory reset clears all player reward balances and sweeps available funds."
                        >
                            <div style={{ padding: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    disabled={actionLoading}
                                    onClick={factoryResetRewardPool}
                                    style={{ padding: '11px 18px', fontSize: '0.8rem', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.45)' }}
                                >
                                    FACTORY RESET REWARD POOL
                                </button>
                            </div>
                        </Panel>
                        <Panel title="On-chain wallets" sub={`Live Solana balances · SOL @ $${wallets?.solPrice?.toFixed(2) ?? '—'}`}>
                            <DataTable
                                columns={[
                                    { key: 'label', label: 'Wallet', render: r => <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{r.label}</span> },
                                    { key: 'address', label: 'Address', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.address}>{truncateAddr(r.address)}</span> },
                                    { key: 'balanceSol', label: 'Balance', render: r => formatSol(r.balanceSol) },
                                    { key: 'balanceUsd', label: 'USD', render: r => formatUsd(r.balanceUsd) },
                                    { key: 'sweptOnReset', label: 'Sweep rule', render: r => typeof r.sweptOnReset === 'string' ? r.sweptOnReset : r.sweptOnReset === false ? '2.5% after BR match' : r.sweptOnReset ? 'On arena reset' : '—' },
                                ]}
                                rows={[
                                    ...(wallets?.mainHouse ? [wallets.mainHouse] : []),
                                    ...(wallets?.brWallets ?? []),
                                    ...(wallets?.rewardWallet ? [{ ...wallets.rewardWallet, sweptOnReset: 'Manual surplus only' }] : []),
                                    ...(wallets?.tournamentWallet ? [{ ...wallets.tournamentWallet, sweptOnReset: 'Manual tournament sweep' }] : []),
                                    ...(wallets?.ownerVault ? [wallets.ownerVault] : []),
                                ]}
                                loading={loading}
                                emptyMessage="No wallets configured"
                            />
                        </Panel>
                        <Panel title="Arena pools (in-memory)" sub="Per stake tier — resets with arena">
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
                        <Panel title="Sweep history" sub="House/reward wallets → owner vault">
                            <DataTable
                                columns={[
                                    { key: 'solAmount', label: 'SOL', render: r => r.solAmount != null ? formatSol(r.solAmount) : '—' },
                                    { key: 'usdAmount', label: 'USD', render: r => r.usdAmount != null ? formatUsd(r.usdAmount) : '—' },
                                    { key: 'from', label: 'From', render: r => <span className="mono" style={{ fontSize: '0.72rem' }} title={r.from}>{truncateAddr(r.from)}</span> },
                                    { key: 'signature', label: 'Tx', render: r => r.signature ? (
                                        <a href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>
                                            {truncateAddr(r.signature)}
                                        </a>
                                    ) : '—' },
                                    { key: 'createdAt', label: 'Date', render: r => formatDate(r.createdAt) },
                                ]}
                                rows={sweeps}
                                loading={loading}
                                emptyMessage="No sweeps yet"
                            />
                        </Panel>
                    </div>
                )}

                {tab === 'users' && (
                    <Panel
                        title={`${users.length} registered accounts`}
                        sub="Click a row to see full account details, transactions, and game history."
                    >
                        <AdminFilterBar right={
                            <>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{selectedUserIds.size} selected</span>
                                <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.72rem' }} disabled={actionLoading || selectedUserIds.size === 0} onClick={() => setSelectedOwnerStatus(true)}>Add to your accounts</button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }} disabled={actionLoading || selectedUserIds.size === 0} onClick={() => setSelectedOwnerStatus(false)}>Remove ownership</button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }} disabled={actionLoading || selectedUserIds.size === 0} onClick={bulkExcludeUsers}>Exclude</button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }} disabled={actionLoading || selectedUserIds.size === 0} onClick={bulkRestoreUsers}>Restore</button>
                            </>
                        }>
                            <FilterSelect label="Sort" value={userSort} onChange={e => { setUserSort(e.target.value); loadData(filterUserId, showExcluded, showExcludedUsers, e.target.value); }} options={USER_SORT_OPTIONS} />
                            <label className="admin-filter-field">
                                <span className="admin-filter-label">Search</span>
                                <input className="admin-filter-input" type="text" placeholder="Username…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-2)', cursor: 'pointer', alignSelf: 'flex-end', paddingBottom: '2px' }}>
                                <input type="checkbox" checked={showExcludedUsers} onChange={e => { setShowExcludedUsers(e.target.checked); loadData(filterUserId, showExcluded, e.target.checked); }} />
                                Show excluded
                            </label>
                        </AdminFilterBar>
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>
                                <span className="spinner" style={{ marginRight: '8px' }} />
                                Loading…
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>No users match your search</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px 16px', width: 40 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                                                    onChange={() => {
                                                        if (selectedUserIds.size === filteredUsers.length) setSelectedUserIds(new Set());
                                                        else setSelectedUserIds(new Set(filteredUsers.map(u => String(u.id))));
                                                    }}
                                                />
                                            </th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Username</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Joined</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Balance</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Rewards</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Playtime</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Deposited</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Status</th>                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(u => {
                                            const id = String(u.id);
                                            const isExcluded = u.excludedFromReports;
                                            return (
                                                <tr
                                                    key={id}
                                                    className="admin-user-row"
                                                    style={{
                                                        borderBottom: '1px solid var(--border)',
                                                        opacity: isExcluded ? 0.55 : 1,
                                                        background: isExcluded ? 'rgba(148,163,184,0.06)' : 'transparent',
                                                        cursor: 'pointer',
                                                    }}
                                                    onClick={() => setSelectedUserId(id)}
                                                >
                                                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUserIds.has(id)}
                                                            onChange={() => toggleUserSelection(id)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-h)' }}>
                                                        {u.username}
                                                        {u.email && <div style={{ marginTop: '3px', color: 'var(--text-3)', fontSize: '0.68rem', fontWeight: 400 }}>{u.email}</div>}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.78rem' }}>{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                                                    <td style={{ padding: '12px 16px' }}>{formatUsd(u.balanceUsd)}<div style={{ color: 'var(--text-3)', fontSize: '0.68rem' }}>{formatSol(u.balanceSol)}</div></td>
                                                    <td style={{ padding: '12px 16px' }}>{formatUsd(u.totalRewardsBalance)}{u.rewardsDisabled && <div style={{ color: '#ef4444', fontSize: '0.68rem' }}>Blocked</div>}</td>
                                                    <td style={{ padding: '12px 16px' }}>{formatDuration(u.playtime)}</td>
                                                    <td style={{ padding: '12px 16px' }}>{formatUsd(u.totalDepositedUsd)}<div style={{ color: 'var(--text-3)', fontSize: '0.68rem' }}>{u.depositCount} deposits</div></td>
                                                    <td style={{ padding: '12px 16px' }}>                                                        {isExcluded ? <OutcomeBadge outcome="excluded" /> : u.isOwnerAccount ? (
                                                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--r-full)', background: 'rgba(139,92,246,0.16)', color: '#a78bfa', fontSize: '0.72rem', fontWeight: 700 }}>Your account</span>
                                                        ) : 'Active'}
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

                {tab === 'activity' && (
                    <Panel
                        title={`${transactions.length} transactions`}
                        sub="Filter by category, user, or search · auto-refreshes every 5s on this tab"
                    >
                        <AdminFilterBar right={
                            <>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{selectedTxIds.size} selected</span>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-2)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={showExcluded} onChange={e => { setShowExcluded(e.target.checked); fetchTransactions(txFilter, e.target.checked); }} />
                                    Show excluded
                                </label>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }} disabled={actionLoading || selectedTxIds.size === 0} onClick={bulkExcludeTx}>Exclude</button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem' }} disabled={actionLoading || selectedTxIds.size === 0} onClick={bulkRestoreTx}>Restore</button>
                            </>
                        }>
                            <FilterSelect label="Category" value={txFilter.category} onChange={e => applyTxFilters({ category: e.target.value })} options={TX_CATEGORY_OPTIONS} />
                            <FilterSelect label="Type" value={txFilter.type} onChange={e => applyTxFilters({ type: e.target.value })} options={TX_TYPE_OPTIONS} />
                            <FilterSelect label="User" value={txFilter.userId} onChange={e => { setFilterUserId(e.target.value); applyTxFilters({ userId: e.target.value }); }} options={[{ value: '', label: 'All users' }, ...users.map(u => ({ value: String(u.id), label: u.username }))]} />
                            <label className="admin-filter-field">
                                <span className="admin-filter-label">Search user</span>
                                <input
                                    className="admin-filter-input"
                                    type="text"
                                    placeholder="Username…"
                                    value={txFilter.search}
                                    onChange={e => setTxFilter(prev => ({ ...prev, search: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') runTxSearch(); }}
                                />
                            </label>
                            <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem', alignSelf: 'flex-end' }} onClick={runTxSearch}>Apply</button>
                            {(txFilter.category || txFilter.type || txFilter.userId || txFilter.search) && (
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.72rem', alignSelf: 'flex-end' }} onClick={clearTxFilters}>Clear</button>
                            )}
                        </AdminFilterBar>
                        {transactions.length === 0 ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-2)' }}>No transactions match your filters</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px 16px', width: 40 }}>
                                                <input type="checkbox" checked={transactions.length > 0 && selectedTxIds.size === transactions.length} onChange={toggleSelectAllTx} />
                                            </th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>When</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Category</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>User</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Description</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Amount</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-2)', fontSize: '0.72rem' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(tx => {
                                            const id = String(tx.id);
                                            const isExcluded = tx.excludedFromReports;
                                            return (
                                                <tr key={id} style={{ borderBottom: '1px solid var(--border)', opacity: isExcluded ? 0.55 : 1 }}>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <input type="checkbox" checked={selectedTxIds.has(id)} onChange={() => toggleTxSelection(id)} />
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text)' }} title={formatDate(tx.createdAt)}>{formatRelativeTime(tx.createdAt)}</td>
                                                    <td style={{ padding: '12px 16px' }}><CategoryBadge category={tx.category} /></td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        {tx.userId ? (
                                                            <button type="button" className="admin-link-btn" onClick={() => openUserFromFeed(tx.userId)}>{tx.username}</button>
                                                        ) : tx.username}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text-h)' }}>{tx.label}</td>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{formatUsd(tx.amountUsd)}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        {isExcluded ? <OutcomeBadge outcome="excluded" /> : tx.status}
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
            </div>

            {selectedUserId && (
                <UserDetailModal
                    userId={selectedUserId}
                    fetchAdmin={fetchAdmin}
                    onClose={() => setSelectedUserId(null)}
                    onExclude={excludeUsersById}
                    onRestore={restoreUsersById}
                    actionLoading={actionLoading}
                />
            )}
        </div>
    );
}

