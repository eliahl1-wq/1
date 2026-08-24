import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
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

export default function AffiliateRewardsPanel({ onDataChange }) {
    const { user, token, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [copyLabel, setCopyLabel] = useState('Copy link');

    const eligible = !!user && !user.isAdmin && !user.personalFreePlay && !user.isOwnerAccount;

    const load = useCallback(async () => {
        if (!eligible || !token) {
            setData(null);
            onDataChange?.(null);
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/affiliate/dashboard`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Could not load affiliate rewards');
            setData(payload);
            onDataChange?.(payload);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }, [eligible, onDataChange, token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (window.location.hash !== '#affiliate-rewards' || !data) return;
        document.getElementById('affiliate-rewards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [data]);

    if (!eligible) {
        return (
            <section id="affiliate-rewards" className="affiliate-rewards-embedded">
                <div className="affiliate-section-heading">
                    <div>
                        <span className="affiliate-kicker">Refer & Earn</span>
                        <h2>Affiliate Rewards</h2>
                    </div>
                </div>
                <div className="affiliate-link-card">
                    <div>
                        <span className="label">Affiliate access unavailable</span>
                        <strong>Use a normal player account to join the affiliate program</strong>
                        <small>Admin, owner, test, and personal free-play accounts are excluded from affiliate commission by the anti-abuse rules.</small>
                    </div>
                    <button className="btn btn-green" disabled>Become Affiliate</button>
                </div>
            </section>
        );
    }

    const activate = async () => {
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API_URL}/api/affiliate/enable`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Could not activate affiliate account');
            await refreshUser();
            await load();
            setMessage('Your affiliate account is active. Your referral link is ready.');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(data.profile.referralLink);
        setCopyLabel('Copied');
        setTimeout(() => setCopyLabel('Copy link'), 1600);
    };

    const requestPayout = async () => {
        setLoading(true);
        setMessage('');
        try {
            const response = await fetch(`${API_URL}/api/affiliate/payouts`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Affiliate payout request failed');
            setMessage('Payout requested. An admin will review and send it to your saved payout address.');
            await Promise.all([load(), refreshUser()]);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const metrics = data?.metrics || {};
    const minimum = Number(data?.config?.minimumPayoutUsd || 2);
    const available = Number(metrics.availableCommissionUsd || 0);
    const activePayout = !!data?.payouts?.some(item => ['requested', 'processing'].includes(item.status));
    const hasWallet = !!data?.profile?.payoutWallet;
    const payoutProgress = minimum > 0 ? Math.min(100, (available / minimum) * 100) : 100;

    return (
        <section id="affiliate-rewards" className="affiliate-rewards-embedded">
            <div className="affiliate-section-heading">
                <div>
                    <span className="affiliate-kicker">Refer & Earn</span>
                    <h2>Affiliate Rewards</h2>
                </div>
            </div>

            {message && <div className="affiliate-notice">{message}</div>}
            {loading && !data ? <div className="affiliate-loading"><span className="spinner" /> Loading affiliate rewards…</div> : null}

            {data && !data.profile.active && (
                <div className="affiliate-link-card">
                    <div>
                        <span className="label">Become an affiliate</span>
                        <strong>Earn 30% of AgarArena's eligible 5% cashout fee</strong>
                        <small>Activate once to receive your permanent referral link. No guaranteed earnings; affiliate terms and anti-abuse rules apply.</small>
                    </div>
                    <button className="btn btn-green" onClick={activate} disabled={loading}>
                        {loading ? 'Activating…' : 'Become Affiliate'}
                    </button>
                </div>
            )}

            {data?.profile.active && (
                <div className="affiliate-admin-stack">
                    <div className="affiliate-link-card">
                        <div>
                            <span className="label">Your referral link</span>
                            <strong>{data.profile.referralLink}</strong>
                            <small>Code: <b>{data.profile.referralCode}</b> · 60-day first-touch attribution</small>
                        </div>
                        <button className="btn affiliate-copy-button" onClick={copyLink}>{copyLabel}</button>
                    </div>

                    <div className="affiliate-stat-grid">
                        <article><span>Referred users</span><strong>{metrics.totalReferredUsers || 0}</strong><small>{metrics.activeReferredUsers || 0} active in 30 days</small></article>
                        <article><span>Cashout volume</span><strong>{money(metrics.totalReferredCashoutVolumeUsd)}</strong><small>Eligible completed cashouts</small></article>
                        <article><span>Conversion</span><strong>{metrics.conversionRate == null ? '—' : `${(metrics.conversionRate * 100).toFixed(1)}%`}</strong><small>{metrics.referralClicks || 0} tracked clicks</small></article>
                    </div>
                    <div className="affiliate-payout-card affiliate-payout-challenge">
                        <div className="affiliate-payout-header">
                            <div>
                                <span className="label">Payout progress</span>
                                <h4>Unlock affiliate payout</h4>
                            </div>
                            <div className="affiliate-payout-amount">
                                <span>Available</span>
                                <strong>{money(available)}</strong>
                            </div>
                        </div>

                        <div className="affiliate-payout-requirement">
                            <span className={available >= minimum ? 'is-complete' : ''}>
                                {available >= minimum ? '✓ ' : ''}Reach the minimum payout
                            </span>
                            <strong>{money(available)} / {money(minimum)}</strong>
                        </div>
                        <div
                            className="affiliate-payout-progress"
                            role="progressbar"
                            aria-label="Affiliate payout minimum progress"
                            aria-valuemin="0"
                            aria-valuemax={minimum}
                            aria-valuenow={Math.min(available, minimum)}
                        >
                            <div style={{ width: `${payoutProgress}%` }} />
                        </div>

                        <div className="affiliate-payout-meta">
                            <span>{money(metrics.pendingCommissionUsd)} pending for {data.config.holdingPeriodDays} days</span>
                            <span>{hasWallet ? `Wallet: ${shortWallet(data.profile.payoutWallet)}` : 'Payout address missing'}</span>
                        </div>

                        {!hasWallet ? (
                            <button className="btn btn-primary" onClick={() => navigate('/profile')}>Add payout address</button>
                        ) : (
                            <button
                                className="btn btn-green"
                                onClick={requestPayout}
                                disabled={loading || activePayout || available < minimum}
                            >
                                {activePayout ? 'PAYOUT UNDER REVIEW' : loading ? 'REQUESTING…' : available < minimum ? `REACH ${money(minimum)} TO CLAIM` : 'CLAIM AFFILIATE PAYOUT'}
                            </button>
                        )}
                    </div>
                    <div className="affiliate-table-panel">
                        <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Ledger</span><h2>Recent commissions</h2></div></div>
                        <div className="affiliate-table-scroll">
                            <table className="affiliate-table">
                                <thead><tr><th>Date</th><th>Referred user</th><th>Mode</th><th>Gross</th><th>Fee</th><th>Commission</th><th>Status</th></tr></thead>
                                <tbody>{data.commissions.length === 0 ? (
                                    <tr><td colSpan="7" className="affiliate-empty">No commission transactions yet.</td></tr>
                                ) : data.commissions.map(row => (
                                    <tr key={row.id}>
                                        <td>{date(row.date)}</td><td>{row.referredUser}</td><td>{row.gameMode}</td>
                                        <td>{money(row.grossCashoutUsd)}</td><td>{money(row.platformFeeUsd)}</td>
                                        <td className="affiliate-green">{money(row.commissionUsd)}</td><td><Status value={row.status} /></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </div>

                    <div className="affiliate-table-panel">
                        <div className="affiliate-section-heading"><div><span className="affiliate-kicker">Withdrawals</span><h2>Payout history</h2></div></div>
                        <div className="affiliate-table-scroll">
                            <table className="affiliate-table">
                                <thead><tr><th>Requested</th><th>Amount</th><th>Wallet</th><th>Status</th><th>Transaction</th></tr></thead>
                                <tbody>{data.payouts.length === 0 ? (
                                    <tr><td colSpan="5" className="affiliate-empty">No payout requests yet.</td></tr>
                                ) : data.payouts.map(row => (
                                    <tr key={row.id}>
                                        <td>{date(row.requestedAt)}</td><td>{money(row.amountUsd)}</td>
                                        <td className="mono">{shortWallet(row.destinationWallet)}</td><td><Status value={row.status} /></td>
                                        <td>{row.signature ? <a href={`https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer">View ↗</a> : '—'}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
