import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import { API_URL } from '../utils/apiBase';
import '../styles/ui.css';
import '../styles/affiliate.css';

const money = value => `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;
const date = value => value ? new Date(value).toLocaleString() : '—';
const shortWallet = value => value ? `${value.slice(0, 6)}…${value.slice(-5)}` : 'Not connected';

function Status({ value }) {
    return <span className={`affiliate-status affiliate-status--${value}`}>{value}</span>;
}

export default function AffiliateDashboard() {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [copyLabel, setCopyLabel] = useState('Copy link');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/affiliate/dashboard`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Could not load affiliate dashboard');
            setData(payload);
            setMessage('');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        document.title = 'AgarArena | Affiliate';
        load();
    }, [load]);

    const copyLink = async () => {
        await navigator.clipboard.writeText(data.profile.referralLink);
        setCopyLabel('Copied');
        setTimeout(() => setCopyLabel('Copy link'), 1600);
    };

    const requestPayout = async () => {
        if (!window.confirm(`Request your full available balance of ${money(data.metrics.availableCommissionUsd)}?`)) return;
        setMessage('');
        try {
            const response = await fetch(`${API_URL}/api/affiliate/payouts`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Payout request failed');
            setMessage('Payout request submitted for admin review.');
            await load();
        } catch (error) {
            setMessage(error.message);
        }
    };

    const metrics = data?.metrics || {};
    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll affiliate-page">
            <Background />
            <AppTopbar />
            <main className="page-content affiliate-dashboard">
                <header className="affiliate-dashboard-header">
                    <div>
                        <span className="affiliate-kicker">Refer & Earn</span>
                        <h1>Affiliate dashboard</h1>
                        <p>Track eligible referrals, held commission, and wallet payouts.</p>
                    </div>
                    {data?.profile && (
                        <div className="affiliate-tier-chip">
                            {data.profile.tierName} · {(data.profile.commissionShareBps / 100).toFixed(0)}% of fee
                        </div>
                    )}
                </header>

                {message && <div className="affiliate-notice">{message}</div>}
                {loading && !data ? (
                    <div className="affiliate-loading"><span className="spinner" /> Loading affiliate data…</div>
                ) : data && (
                    <>
                        <section className="affiliate-link-card">
                            <div>
                                <span className="label">Your permanent referral link</span>
                                <strong>{data.profile.referralLink}</strong>
                                <small>Referral code: <b>{data.profile.referralCode}</b> · 60-day first-touch attribution</small>
                            </div>
                            <button className="btn btn-primary" onClick={copyLink}>{copyLabel}</button>
                        </section>

                        <section className="affiliate-stat-grid">
                            <article><span>Referred users</span><strong>{metrics.totalReferredUsers || 0}</strong><small>{metrics.activeReferredUsers || 0} active in 30 days</small></article>
                            <article><span>Cashout volume</span><strong>{money(metrics.totalReferredCashoutVolumeUsd)}</strong><small>Eligible completed cashouts</small></article>
                            <article><span>Pending</span><strong>{money(metrics.pendingCommissionUsd)}</strong><small>{data.config.holdingPeriodDays}-day holding period</small></article>
                            <article><span>Available</span><strong className="affiliate-green">{money(metrics.availableCommissionUsd)}</strong><small>Unreserved commission</small></article>
                            <article><span>Total paid</span><strong>{money(metrics.totalPaidCommissionUsd)}</strong><small>Completed payouts</small></article>
                            <article><span>Conversion</span><strong>{metrics.conversionRate == null ? '—' : `${(metrics.conversionRate * 100).toFixed(1)}%`}</strong><small>{metrics.referralClicks || 0} tracked clicks</small></article>
                        </section>

                        <section className="affiliate-payout-card">
                            <div>
                                <span className="label">Payout wallet</span>
                                <strong>{shortWallet(data.profile.payoutWallet)}</strong>
                                <small>Minimum payout: {money(data.config.minimumPayoutUsd)}. Update the connected wallet in Profile.</small>
                            </div>
                            <button
                                className="btn btn-primary"
                                disabled={!data.profile.payoutWallet || metrics.availableCommissionUsd < data.config.minimumPayoutUsd}
                                onClick={requestPayout}
                            >
                                Request payout
                            </button>
                        </section>

                        <section className="affiliate-table-panel">
                            <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Ledger</span><h2>Recent commissions</h2></div></div>
                            <div className="affiliate-table-scroll">
                                <table className="affiliate-table">
                                    <thead><tr><th>Date</th><th>Referred user</th><th>Mode</th><th>Gross</th><th>Fee</th><th>Commission</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {data.commissions.length === 0 ? (
                                            <tr><td colSpan="7" className="affiliate-empty">No commission transactions yet.</td></tr>
                                        ) : data.commissions.map(row => (
                                            <tr key={row.id}>
                                                <td>{date(row.date)}</td><td>{row.referredUser}</td><td>{row.gameMode}</td>
                                                <td>{money(row.grossCashoutUsd)}</td><td>{money(row.platformFeeUsd)}</td>
                                                <td className="affiliate-green">{money(row.commissionUsd)}</td><td><Status value={row.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="affiliate-table-panel">
                            <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Withdrawals</span><h2>Payout history</h2></div></div>
                            <div className="affiliate-table-scroll">
                                <table className="affiliate-table">
                                    <thead><tr><th>Requested</th><th>Amount</th><th>Wallet</th><th>Status</th><th>Transaction</th></tr></thead>
                                    <tbody>
                                        {data.payouts.length === 0 ? (
                                            <tr><td colSpan="5" className="affiliate-empty">No payout requests yet.</td></tr>
                                        ) : data.payouts.map(row => (
                                            <tr key={row.id}>
                                                <td>{date(row.requestedAt)}</td><td>{money(row.amountUsd)}</td>
                                                <td className="mono">{shortWallet(row.destinationWallet)}</td><td><Status value={row.status} /></td>
                                                <td>{row.signature ? <a href={`https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer">View ↗</a> : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
