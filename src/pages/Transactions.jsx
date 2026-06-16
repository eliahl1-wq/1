import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';

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
                const res  = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setTxs(data.filter(tx => tx.type !== 'game' && tx.meta?.reason !== 'Arena Cashout'));
            } catch {
                setTxs([]);
            } finally {
                setLoading(false);
            }
        };
        fetch_();
    }, [token]);

    return (
        <div className="page-shell page-shell--scroll">
            <Background />

            <div className="page-content" style={{ maxWidth: '860px' }}>

                {/* ── Header ── */}
                <div className="page-header-row">
                    <div>
                        <p className="label" style={{ marginBottom: '6px' }}>AgarStake</p>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text-h)', lineHeight: 1 }}>
                            Transaction History
                        </h1>
                        <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                            Deposits and withdrawals
                        </p>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={() => navigate(-1)}
                        style={{ padding: '9px 18px', fontSize: '0.78rem', borderRadius: 'var(--r-full)' }}
                    >
                        ← Back
                    </button>
                </div>

                {/* ── Table card ── */}
                <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-2xl)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-lg)',
                }}>
                    {loading ? (
                        <div style={{ padding: '80px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-2)' }}>
                            <span className="spinner" style={{ width: 14, height: 14 }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Syncing with blockchain…</span>
                        </div>
                    ) : txs.length === 0 ? (
                        <div style={{ padding: '80px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.2 }}>⬡</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', fontWeight: 600 }}>No transactions yet.</div>
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
                                    const color  = TYPE_COLOR[tx.type] || 'var(--text)';
                                    const icon   = TYPE_ICON[tx.type]  || '·';
                                    const isDeposit = tx.type === 'deposit';
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
                                                        {tx.type}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td style={{ padding: '14px 16px' }}>
                                                <span className="mono" style={{ fontWeight: 700, fontSize: '0.85rem', color: isDeposit ? 'var(--green)' : 'var(--text-h)' }}>
                                                    {isDeposit ? '+' : ''} ${tx.amount.toFixed(2)}
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
                                const color = TYPE_COLOR[tx.type] || 'var(--text)';
                                const icon = TYPE_ICON[tx.type] || '·';
                                const isDeposit = tx.type === 'deposit';
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
                                                {tx.type}
                                            </span>
                                        </div>
                                        <div className="tx-card-row">
                                            <span className="tx-card-label">Amount</span>
                                            <span className="mono" style={{ fontWeight: 700, color: isDeposit ? 'var(--green)' : 'var(--text-h)' }}>
                                                {isDeposit ? '+' : ''} ${tx.amount.toFixed(2)}
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
                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.58rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Secure Terminal · AgarStake
                </div>
            </div>
        </div>
    );
}
