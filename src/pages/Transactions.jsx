import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import ProductPageHeader from '../components/ProductPageHeader';
import AppFooter from '../components/AppFooter';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';
import { API_URL } from '../utils/apiBase';

const TYPE_COLOR = {
    deposit:  'var(--green)',
    withdraw: 'var(--blue)',
    game:     'var(--yellow)',
};

const TYPE_ICON = {
    deposit:  '↓',
    withdraw: '↑',
    game:     '⚔',
};

const REWARD_CLAIM_EVENTS = new Set(['sponsored_rewards_claim', 'tournament_reward_claim']);

function getTransactionPresentation(tx) {
    if (tx.meta?.event === 'sponsored_rewards_claim') {
        return { label: 'Reward Claim', color: 'var(--green)', icon: 'R', isPositive: true };
    }
    if (tx.meta?.event === 'tournament_reward_claim') {
        return { label: 'Tournament Reward Claim', color: 'var(--green)', icon: 'T', isPositive: true };
    }
    if (tx.type === 'deposit') {
        return { label: 'Deposit', color: TYPE_COLOR.deposit, icon: TYPE_ICON.deposit, isPositive: true };
    }
    return { label: 'Withdrawal', color: TYPE_COLOR.withdraw, icon: TYPE_ICON.withdraw, isPositive: false };
}

function getTransactionAmountUsd(tx) {
    const amount = Number(tx.meta?.amountUsd ?? tx.amount);
    return Number.isFinite(amount) ? amount : 0;
}

export default function Transactions() {
    const { token } = useAuth();
    const navigate  = useNavigate();
    const [txs, setTxs]         = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setPageSeo(SEO.transactions);
        const fetch_ = async () => {
            setLoading(true);
            try {
                const res  = await fetch(`${API_URL}/api/transactions?filter=external`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                
                // Fallback client-side safety filtering
                const filtered = data.filter(tx => {
                    if (tx.type === 'deposit') {
                        if (tx.meta?.entryFor === 'arena-entry' || tx.meta?.isEntryPayment) return false;
                        return true;
                    }
                    if (tx.type === 'withdraw') {
                        const reason = tx.meta?.reason || '';
                        const event = tx.meta?.event || '';
                        const isGameWithdrawal =
                            /Arena Cashout|Admin Forced Cashout|Auto Room Reset|BR Victory|BR Refund/i.test(reason) ||
                            ['pool_sweep', 'br_owner_sweep', 'reward_owner_surplus_sweep', 'reward_pool_factory_reset', 'affiliate_pool_factory_reset'].includes(event);
                        if (isGameWithdrawal) return false;
                        return !!tx.meta?.destination;
                    }
                    if (tx.type === 'game') {
                        return REWARD_CLAIM_EVENTS.has(tx.meta?.event);
                    }
                    return false;
                });
                setTxs(filtered);
            } catch {
                setTxs([]);
            } finally {
                setLoading(false);
            }
        };
        fetch_();
    }, [token]);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />

            <div className="page-content product-page--transactions">

                {/* ── Header ── */}
                <ProductPageHeader
                    title="Transaction History"
                    description="Personal deposits, withdrawals, and reward claims."
                    onBack={() => navigate(-1)}
                />

                {/* Transaction ledger */}
                <div className="product-surface transaction-ledger">
                    {loading ? (
                        <div className="product-empty-state transaction-ledger__loading">
                            <span className="spinner" style={{ width: 14, height: 14 }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Syncing with blockchain…</span>
                        </div>
                    ) : txs.length === 0 ? (
                        <div className="product-empty-state">
                            <svg className="product-empty-state__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg><p className="product-empty-state__title">No transactions yet.</p>
                        </div>
                    ) : (
                        <>
                        <div className="tx-table-wrap">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '640px' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                                    {['Event', 'Amount', 'Date', 'Status', 'Signature'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {txs.map((tx, i) => {
                                    const { color, icon, label, isPositive } = getTransactionPresentation(tx);
                                    const amountUsd = getTransactionAmountUsd(tx);
                                    return (
                                        <tr
                                            key={tx._id}
                                            style={{
                                                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {/* Event */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: 28, height: 28,
                                                        borderRadius: 'var(--r-sm)',
                                                        background: `${color}18`,
                                                        border: `1px solid ${color}30`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.8rem',
                                                        color,
                                                        flexShrink: 0,
                                                    }}>
                                                        {icon}
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-h)', textTransform: 'capitalize' }}>
                                                        {label}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <span className="mono" style={{ fontWeight: 700, fontSize: '0.85rem', color: isPositive ? 'var(--green)' : 'var(--text-h)' }}>
                                                    {isPositive ? '+' : '-'}${amountUsd.toFixed(2)}
                                                </span>
                                            </td>

                                            {/* Date */}
                                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
                                                    {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                                <br />
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 500 }}>
                                                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '3px 8px', borderRadius: 'var(--r-sm)',
                                                    background: 'var(--green-dim)',
                                                    border: '1px solid var(--green-border)',
                                                    color: 'var(--green)',
                                                    fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'
                                                }}>
                                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                                                    {tx.status || 'confirmed'}
                                                </span>
                                            </td>

                                            {/* Signature */}
                                            <td style={{ padding: '14px 16px', maxWidth: 140 }}>
                                                <span
                                                    className="mono"
                                                    title={tx.meta?.signature}
                                                    style={{ fontSize: '0.68rem', color: 'var(--text-3)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: tx.meta?.signature ? 'pointer' : 'default' }}
                                                    onClick={() => tx.meta?.signature && navigator.clipboard.writeText(tx.meta.signature)}
                                                >
                                                    {tx.meta?.signature
                                                        ? `${tx.meta.signature.slice(0, 8)}…${tx.meta.signature.slice(-6)}`
                                                        : tx.meta?.reason || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                        <div className="tx-card-list">
                            {txs.map((tx) => {
                                const { color, icon, label, isPositive } = getTransactionPresentation(tx);
                                const amountUsd = getTransactionAmountUsd(tx);
                                return (
                                    <div key={tx._id} className="tx-card">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: 28, height: 28,
                                                borderRadius: 'var(--r-sm)',
                                                background: `${color}18`,
                                                border: `1px solid ${color}30`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', color, flexShrink: 0,
                                            }}>
                                                {icon}
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-h)', textTransform: 'capitalize' }}>
                                                {label}
                                            </span>
                                        </div>
                                        <div className="tx-card-row">
                                            <span className="tx-card-label">Amount</span>
                                            <span className="mono" style={{ fontWeight: 700, color: isPositive ? 'var(--green)' : 'var(--text-h)' }}>
                                                {isPositive ? '+' : '-'}${amountUsd.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="tx-card-row">
                                            <span className="tx-card-label">Date</span>
                                            <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                                                {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                {' · '}
                                                {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="tx-card-row">
                                            <span className="tx-card-label">Status</span>
                                            <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                                {tx.status || 'confirmed'}
                                            </span>
                                        </div>
                                        {tx.meta?.signature && (
                                            <div className="tx-card-row">
                                                <span className="tx-card-label">Signature</span>
                                                <span
                                                    className="mono"
                                                    style={{ fontSize: '0.68rem', color: 'var(--text-3)', wordBreak: 'break-all', textAlign: 'right' }}
                                                    onClick={() => navigator.clipboard.writeText(tx.meta.signature)}
                                                >
                                                    {`${tx.meta.signature.slice(0, 8)}…${tx.meta.signature.slice(-6)}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="product-helper">
                    Secure Terminal · AgarStake
                </div>
            </div>

            <AppFooter showStatus={false} />
        </div>
    );
}

