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

    if (loading && !data) return <div className="affiliate-loading"><span className="spinner" /> Loading affiliates…</div>;
    if (!data) return <div className="affiliate-notice">{message || 'Could not load affiliates.'}</div>;

    return (
        <div className="affiliate-admin-stack">
            {message && <div className="affiliate-notice">{message}</div>}
            <section className="affiliate-stat-grid">
                <article><span>Affiliates</span><strong>{data.affiliates.length}</strong></article>
                <article><span>Payout requests</span><strong>{data.payouts.filter(p => ['requested', 'processing'].includes(p.status)).length}</strong></article>
                <article><span>Open risk flags</span><strong>{data.riskFlags.length}</strong></article>
                <article><span>Recent commissions</span><strong>{data.commissions.length}</strong></article>
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
                <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Review queue</span><h2>Payout requests</h2></div></div>
                <div className="affiliate-table-scroll">
                    <table className="affiliate-table">
                        <thead><tr><th>Requested</th><th>Amount</th><th>Wallet</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{data.payouts.length === 0 ? <tr><td colSpan="5" className="affiliate-empty">No payout requests.</td></tr> : data.payouts.map(row => (
                            <tr key={row.id}>
                                <td>{when(row.requestedAt)}</td><td>{usd(row.amountUsd)}</td><td className="mono">{row.destinationWallet}</td><td>{row.status}</td>
                                <td>
                                    {['requested', 'processing'].includes(row.status) && <>
                                        <button className="btn btn-primary" onClick={() => mutate(`/api/admin/affiliate-payouts/${row.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) })}>{row.status === 'processing' ? 'Resume' : 'Approve'}</button>
                                        {row.status === 'requested' && <button className="btn btn-ghost" onClick={() => {
                                            const reason = window.prompt('Rejection reason:');
                                            if (reason) mutate(`/api/admin/affiliate-payouts/${row.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'reject', reason }) });
                                        }}>Reject</button>}
                                    </>}
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
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
