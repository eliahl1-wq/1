import React, { useCallback, useEffect, useState } from 'react';
import '../styles/affiliate.css';

const usd = value => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = value => value ? new Date(value).toLocaleString() : '—';

export default function AffiliateAdminPanel({ fetchAdmin }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await fetchAdmin('/api/admin/affiliates'));
            setMessage('');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }, [fetchAdmin]);

    useEffect(() => { load(); }, [load]);

    const mutate = async (path, options) => {
        try {
            await fetchAdmin(path, options);
            await load();
        } catch (error) {
            setMessage(error.message);
        }
    };

    const updateAffiliate = (affiliate, changes) => mutate(`/api/admin/affiliates/${affiliate.id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
    });

    const factoryResetAffiliatePool = async () => {
        const confirmation = window.prompt(
            'DANGER: This permanently removes every affiliate profile, referral, click, risk flag, and unpaid commission from the active program. Unpaid affiliate funds are swept to the owner vault. Completed payout and commission audit history is preserved.\n\nActive payout requests must be resolved first.\n\nType RESET AFFILIATE POOL to continue.'
        );
        if (confirmation == null) return;
        if (confirmation !== 'RESET AFFILIATE POOL') {
            setMessage('Reset cancelled: confirmation phrase did not match.');
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            const result = await fetchAdmin('/api/admin/affiliate-pool/factory-reset', {
                method: 'POST',
                body: JSON.stringify({ confirmation }),
            });
            await load();
            setMessage(result.message);
        } catch (error) {
            setMessage(error.message);
            setLoading(false);
        }
    };
    if (loading && !data) return <div className="affiliate-loading"><span className="spinner" /> Loading affiliates…</div>;
    if (!data) return <div className="affiliate-notice">{message || 'Could not load affiliates.'}</div>;
    const owedAffiliates = data.affiliates
        .filter(row => Number(row.pendingCommissionUsd) + Number(row.availableCommissionUsd) > 0)
        .sort((a, b) => (Number(b.pendingCommissionUsd) + Number(b.availableCommissionUsd)) - (Number(a.pendingCommissionUsd) + Number(a.availableCommissionUsd)));
    const activePayoutByProfile = new Map(data.payouts
        .filter(payout => ['requested', 'processing'].includes(payout.status))
        .map(payout => [String(payout.affiliateProfileId), payout]));
    const orderedPayouts = [...data.payouts].sort((a, b) => {
        const active = status => ['requested', 'processing'].includes(status) ? 1 : 0;
        return active(b.status) - active(a.status)
            || new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime();
    });

    return (
        <div className="affiliate-admin-stack">
            {message && <div className="affiliate-notice">{message}</div>}
            <section className="affiliate-stat-grid">
                <article><span>Affiliates</span><strong>{data.affiliates.length}</strong></article>
                <article><span>Total owed</span><strong>{usd(data.totals?.outstandingCommissionUsd)}</strong></article>
                <article><span>Pending hold</span><strong>{usd(data.totals?.pendingCommissionUsd)}</strong></article>
                <article><span>Available</span><strong>{usd(data.totals?.availableCommissionUsd)}</strong></article>
                <article><span>Payout requests</span><strong>{data.payouts.filter(p => ['requested', 'processing'].includes(p.status)).length}</strong></article>
                <article><span>Open risk flags</span><strong>{data.riskFlags.length}</strong></article>
                <article><span>Paid all time</span><strong>{usd(data.totals?.paidCommissionUsd)}</strong></article>
            </section>

            <section className="affiliate-table-panel">
                <div className="affiliate-section-heading">
                    <div>
                        <span className="affiliate-kicker">Affiliate liability</span>
                        <h2>Affiliate rewards owed</h2>
                        <small>Pending amounts are in the 7-day hold. Approved payouts are sent from the Reward Wallet to the affiliate's saved address.</small>
                    </div>
                    <strong className="affiliate-liability-total">{usd(data.totals?.outstandingCommissionUsd)}</strong>
                </div>
                <div className="affiliate-table-scroll">
                    <table className="affiliate-table">
                        <thead><tr><th>User</th><th>Pending</th><th>Available</th><th>Active payout</th><th>Total owed</th><th>Reason</th></tr></thead>
                        <tbody>{owedAffiliates.length === 0 ? <tr><td colSpan="6" className="affiliate-empty">No affiliate rewards are currently owed.</td></tr> : owedAffiliates.map(row => {
                            const activePayout = activePayoutByProfile.get(String(row.id));
                            const totalOwed = Number(row.pendingCommissionUsd) + Number(row.availableCommissionUsd);
                            return (
                                <tr key={`owed-${row.id}`}>
                                    <td><strong>{row.username}</strong><small>{row.email || row.referralCode}</small></td>
                                    <td>{usd(row.pendingCommissionUsd)}<small>7-day hold</small></td>
                                    <td>{usd(row.availableCommissionUsd)}<small>{row.suspended ? 'Affiliate suspended' : 'Ready to request'}</small></td>
                                    <td>{activePayout ? <><strong>{usd(activePayout.amountUsd)}</strong><small>{activePayout.status}</small></> : '—'}</td>
                                    <td><strong>{usd(totalOwed)}</strong></td>
                                    <td><small>{row.referralCount} referrals · commission from real referred-player cashout fees</small></td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                </div>
            </section>

            <section className="affiliate-table-panel">
                <div className="affiliate-section-heading">
                    <div>
                        <span className="affiliate-kicker">Pool maintenance</span>
                        <h2>Affiliate factory reset</h2>
                        <small>Clears the active affiliate program and sweeps all unpaid affiliate rewards. Financial audit history remains.</small>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={loading}
                        onClick={factoryResetAffiliatePool}
                        style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.45)' }}
                    >
                        FACTORY RESET AFFILIATE POOL
                    </button>
                </div>
            </section>

            <section className="affiliate-table-panel">
                <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Management</span><h2>Affiliates</h2></div></div>
                <div className="affiliate-table-scroll">
                    <table className="affiliate-table">
                        <thead><tr><th>User</th><th>Code</th><th>Referrals</th><th>Volume</th><th>Pending</th><th>Available</th><th>Paid</th><th>Tier</th><th>Risk</th><th>Actions</th></tr></thead>
                        <tbody>{data.affiliates.map(row => (
                            <tr key={row.id}>
                                <td><strong>{row.username}</strong><small>{row.email}</small></td>
                                <td className="mono">{row.referralCode}</td><td>{row.referralCount}</td><td>{usd(row.referredCashoutVolumeUsd)}</td>
                                <td>{usd(row.pendingCommissionUsd)}</td><td>{usd(row.availableCommissionUsd)}</td><td>{usd(row.paidCommissionUsd)}</td>
                                <td>
                                    <select value={row.tierKey} onChange={event => updateAffiliate(row, { tierKey: event.target.value })}>
                                        {data.tiers.map(tier => <option key={tier.key} value={tier.key}>{tier.name} ({tier.shareBps / 100}%)</option>)}
                                    </select>
                                </td>
                                <td>{row.openRiskFlags || 0}</td>
                                <td>
                                    <button className="btn btn-ghost" onClick={() => {
                                        if (row.suspended) updateAffiliate(row, { suspended: false });
                                        else {
                                            const reason = window.prompt('Suspension audit reason:');
                                            if (reason) updateAffiliate(row, { suspended: true, reason });
                                        }
                                    }}>{row.suspended ? 'Unsuspend' : 'Suspend'}</button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </section>

            <section className="affiliate-table-panel">
                <div className="affiliate-section-heading">
                    <div><span className="affiliate-kicker">Review queue</span><h2>Payout requests</h2></div>
                    <small>Approve sends SOL from the Reward Wallet to the saved payout address.</small>
                </div>
                {orderedPayouts.length === 0 ? (
                    <div className="affiliate-empty">No payout requests.</div>
                ) : (
                    <div className="affiliate-payout-queue">
                        {orderedPayouts.map(row => {
                            const actionable = ['requested', 'processing'].includes(row.status);
                            return (
                                <article className={`affiliate-payout-request${actionable ? ' is-actionable' : ''}`} key={row.id}>
                                    <div className="affiliate-payout-request__main">
                                        <div>
                                            <span className="affiliate-payout-request__user">{row.affiliateUsername || 'Affiliate payout'}</span>
                                            <strong>{usd(row.amountUsd)}</strong>
                                            <small>{when(row.requestedAt)}</small>
                                        </div>
                                        <span className={`affiliate-status affiliate-status--${row.status}`}>{row.status}</span>
                                    </div>
                                    <div className="affiliate-payout-request__wallet">
                                        <span>Destination</span>
                                        <code title={row.destinationWallet}>{row.destinationWallet}</code>
                                    </div>
                                    {actionable && (
                                        <div className="affiliate-payout-request__actions">
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => mutate(`/api/admin/affiliate-payouts/${row.id}/action`, {
                                                    method: 'POST',
                                                    body: JSON.stringify({ action: 'approve' }),
                                                })}
                                            >
                                                {row.status === 'processing' ? 'Resume payout' : 'Approve payout'}
                                            </button>
                                            {row.status === 'requested' && (
                                                <button type="button" className="btn btn-ghost" onClick={() => {
                                                    const reason = window.prompt('Rejection reason:');
                                                    if (reason) mutate(`/api/admin/affiliate-payouts/${row.id}/action`, {
                                                        method: 'POST',
                                                        body: JSON.stringify({ action: 'reject', reason }),
                                                    });
                                                }}>Reject</button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="affiliate-table-panel">
                <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Audit</span><h2>Recent commissions</h2></div></div>
                <div className="affiliate-table-scroll">
                    <table className="affiliate-table">
                        <thead><tr><th>Date</th><th>Affiliate</th><th>Referred</th><th>Mode</th><th>Gross</th><th>Fee</th><th>Commission</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>{data.commissions.map(row => (
                            <tr key={row.id}>
                                <td>{when(row.date)}</td><td>{row.affiliateUsername}</td><td>{row.referredUsername}</td><td>{row.gameMode}</td>
                                <td>{usd(row.grossCashoutUsd)}</td><td>{usd(row.platformFeeUsd)}</td><td>{usd(row.commissionUsd)}</td><td>{row.status}</td>
                                <td>{row.status !== 'reversed' && <button className="btn btn-ghost" onClick={() => {
                                    const reason = window.prompt('Commission reversal audit reason:');
                                    if (reason) mutate(`/api/admin/affiliate-commissions/${row.id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) });
                                }}>Reverse</button>}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </section>

            <section className="affiliate-table-panel">
                <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Anti-abuse</span><h2>Open risk flags</h2></div></div>
                <div className="affiliate-table-scroll">
                    <table className="affiliate-table">
                        <thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Evidence</th><th>Actions</th></tr></thead>
                        <tbody>{data.riskFlags.length === 0 ? <tr><td colSpan="5" className="affiliate-empty">No open flags.</td></tr> : data.riskFlags.map(row => (
                            <tr key={row._id}>
                                <td>{when(row.createdAt)}</td><td>{row.type}</td><td>{row.severity}</td><td className="mono">{JSON.stringify(row.evidence || {})}</td>
                                <td>
                                    <button className="btn btn-primary" onClick={() => mutate(`/api/admin/affiliate-risk-flags/${row._id}/resolve`, { method: 'POST', body: JSON.stringify({ status: 'resolved', notes: 'Reviewed by admin' }) })}>Resolve</button>
                                    <button className="btn btn-ghost" onClick={() => mutate(`/api/admin/affiliate-risk-flags/${row._id}/resolve`, { method: 'POST', body: JSON.stringify({ status: 'dismissed', notes: 'Dismissed by admin' }) })}>Dismiss</button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
