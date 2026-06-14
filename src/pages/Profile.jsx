import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import '../styles/ui.css';

export default function Profile() {
    const { user, token, refreshUser, login } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();
    const [activeTab, setActiveTab]     = useState(location.state?.tab || 'stats');
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [gameLogs, setGameLogs]       = useState([]);
    const [usernameInput, setUsernameInput] = useState(user?.username || '');
    const [walletInput, setWalletInput] = useState(user?.walletAddress || '');
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [usernameMsg, setUsernameMsg] = useState('');
    const [isUpdating, setIsUpdating]   = useState(false);
    const [updateMsg, setUpdateMsg]     = useState('');

    useEffect(() => {
        setUsernameInput(user?.username || '');
        setWalletInput(user?.walletAddress || '');
    }, [user?.username, user?.walletAddress]);

    useEffect(() => {
        document.title = 'AgarStake | Profile';
        const fetchLogs = async () => {
            try {
                const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setGameLogs(data.filter(tx => {
                    const reason = tx.meta?.reason || '';
                    return (tx.type === 'withdraw' && (reason.includes('Arena Cashout') || reason.includes('BR Victory')))
                        || (tx.type === 'game' && (reason === 'Arena Death' || reason === 'BR Eliminated'));
                }));
            } catch {}
        };
        fetchLogs();
        refreshUser();
    }, [token, refreshUser]);

    // ── Chart data ────────────────────────────────────
    const processedLogs = [...gameLogs].reverse().map(log => {
        const isCashout = log.type === 'withdraw' && ((log.meta?.reason || '').includes('Arena Cashout') || (log.meta?.reason || '').includes('BR Victory'));
        const amount    = Number(log.amount) || 0;
        const entryCost = Number(log.meta?.entryFeeUsd) || 10;
        const netProfit = isCashout ? (amount - entryCost) : (0 - entryCost);
        return { ...log, netProfit: isNaN(netProfit) ? 0 : netProfit, grossAmount: amount, isCashout };
    });

    const totalPnL = processedLogs.reduce((acc, l) => acc + l.netProfit, 0);
    const winRate  = processedLogs.length > 0
        ? Math.round((processedLogs.filter(l => l.netProfit > 0).length / processedLogs.length) * 100)
        : 0;

    let cumulative = 0;
    const chartPts = [0, ...processedLogs.map(l => { cumulative += l.netProfit; return cumulative; })];
    const minVal   = Math.min(...chartPts, -10);
    const maxVal   = Math.max(...chartPts, 10);
    const pnlRange = (maxVal - minVal) || 1;

    const toXY = (val, i) => ({
        x: (i / Math.max(chartPts.length - 1, 1)) * 100,
        y: 95 - ((val - minVal) / pnlRange) * 90,
    });

    const polyline = chartPts.map((v, i) => { const p = toXY(v, i); return `${p.x},${p.y}`; }).join(' ');
    const areaPath = chartPts.map((v, i) => { const p = toXY(v, i); return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`; }).join(' ');

    const chartColor = totalPnL >= 0 ? 'var(--green)' : 'var(--red)';

    const handleUpdateUsername = async () => {
        const trimmed = usernameInput.trim();
        if (!trimmed || trimmed === user?.username) return;
        setIsUpdatingUsername(true);
        setUsernameMsg('');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ username: trimmed }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.user) {
                login(data.user, token);
                const prevNick = localStorage.getItem('match_nickname');
                if (!prevNick || prevNick === user?.username) {
                    localStorage.setItem('match_nickname', data.user.username);
                }
                setUsernameMsg('success');
            } else {
                setUsernameMsg(data.message || 'error');
            }
        } catch {
            setUsernameMsg('error');
        }
        setIsUpdatingUsername(false);
    };

    const handleUpdateWallet = async () => {
        if (!walletInput || walletInput === user?.walletAddress) return;
        setIsUpdating(true);
        setUpdateMsg('');
        try {
            const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ walletAddress: walletInput })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.user) {
                login(data.user, token);
                setUpdateMsg('success');
            } else {
                setUpdateMsg(data.message || 'error');
            }
        } catch { setUpdateMsg('error'); }
        setIsUpdating(false);
    };

    // ── Render ─────────────────────────────────────────
    return (
        <div style={{ width: '100vw', minHeight: '100vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px 60px', boxSizing: 'border-box' }}>
            <Background />
            <AppTopbar />

            <div style={{ width: '100%', maxWidth: '780px', position: 'relative', zIndex: 1 }}>

                {/* ── Page header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
                    <div>
                        <p className="label" style={{ marginBottom: '6px' }}>AgarStake</p>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text-h)', lineHeight: 1 }}>
                            Account
                        </h1>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={() => navigate(-1)}
                        style={{ padding: '9px 18px', fontSize: '0.78rem', borderRadius: 'var(--r-full)' }}
                    >
                        ← Back
                    </button>
                </div>

                {/* ── Main card ── */}
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}>

                    {/* ── Tab bar ── */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 4px' }}>
                        {[
                            { id: 'stats',   label: 'Performance' },
                            { id: 'profile', label: 'Settings' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '14px 20px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
                                    color: activeTab === tab.id ? 'var(--text-h)' : 'var(--text-2)',
                                    fontWeight: activeTab === tab.id ? 600 : 500,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s ease, border-color 0.2s ease',
                                    fontFamily: 'var(--ui)',
                                    marginBottom: '-1px',
                                    letterSpacing: '0.01em',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '24px' }}>
                        {activeTab === 'stats' ? (

                            /* ══ Stats view ══ */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* Stat cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    {[
                                        {
                                            label: 'Total P&L',
                                            value: `${totalPnL >= 0 ? '+' : ''}$${Math.abs(totalPnL).toFixed(2)}`,
                                            color: totalPnL >= 0 ? 'var(--green)' : 'var(--red)',
                                        },
                                        {
                                            label: 'Win Rate',
                                            value: `${winRate}%`,
                                            color: winRate >= 50 ? 'var(--green)' : 'var(--text-h)',
                                        },
                                        {
                                            label: 'Sessions',
                                            value: processedLogs.length,
                                            color: 'var(--text-h)',
                                        },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
                                            <div className="label" style={{ marginBottom: '8px' }}>{s.label}</div>
                                            <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>
                                                {s.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Equity chart */}
                                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <span className="label">Equity Curve</span>
                                        {hoveredPoint && (
                                            <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: chartColor }}>
                                                {hoveredPoint.label}
                                            </span>
                                        )}
                                    </div>

                                    <svg
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                        style={{ width: '100%', height: '160px', display: 'block', overflow: 'hidden' }}
                                        onMouseMove={e => {
                                            if (chartPts.length < 2) return;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
                                            const idx    = Math.max(0, Math.min(
                                                Math.round((mouseX / 100) * (chartPts.length - 1)),
                                                chartPts.length - 1
                                            ));
                                            const log    = idx > 0 ? processedLogs[idx - 1] : null;
                                            const label  = idx === 0
                                                ? 'START $0'
                                                : `${log?.netProfit >= 0 ? 'PROFIT' : 'LOSS'} $${Math.abs(log?.netProfit || 0).toFixed(2)}`;
                                            setHoveredPoint({ index: idx, label });
                                        }}
                                        onMouseLeave={() => setHoveredPoint(null)}
                                    >
                                        <defs>
                                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={chartColor} stopOpacity="0.15" />
                                                <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        {/* Area fill */}
                                        <path d={`${areaPath} L 100 100 L 0 100 Z`} fill="url(#chartGrad)" />
                                        {/* Line */}
                                        <polyline
                                            fill="none"
                                            stroke={chartColor}
                                            strokeWidth="1.5"
                                            points={polyline}
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />
                                        {/* Hover crosshair */}
                                        {hoveredPoint && chartPts.length > 1 && (() => {
                                            const p = toXY(chartPts[hoveredPoint.index], hoveredPoint.index);
                                            return (
                                                <>
                                                    <line x1={p.x} y1="0" x2={p.x} y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                                                    <circle cx={p.x} cy={p.y} r="1.8" fill="white" />
                                                </>
                                            );
                                        })()}
                                    </svg>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        <span>Start</span>
                                        <span>{processedLogs.length} sessions</span>
                                    </div>
                                </div>

                                {/* Session log */}
                                <div>
                                    <div className="label" style={{ marginBottom: '10px' }}>Session History</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {processedLogs.length === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.78rem', fontWeight: 600 }}>
                                                No sessions yet
                                            </div>
                                        ) : (
                                            [...processedLogs].reverse().map(log => {
                                                const win = log.netProfit >= 0;
                                                return (
                                                    <div
                                                        key={log._id}
                                                        style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '10px 14px',
                                                            borderRadius: 'var(--r-md)',
                                                            background: 'rgba(255,255,255,0.02)',
                                                            border: '1px solid var(--border)',
                                                            transition: 'background 0.1s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: 26, height: 26,
                                                                borderRadius: 'var(--r-sm)',
                                                                background: win ? 'var(--green-dim)' : 'var(--red-dim)',
                                                                border: `1px solid ${win ? 'var(--green-border)' : 'rgba(255,59,48,0.2)'}`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.7rem',
                                                                color: win ? 'var(--green)' : 'var(--red)',
                                                            }}>
                                                                {win ? '↑' : '↓'}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: win ? 'var(--green)' : 'var(--red)' }}>
                                                                    {log.type === 'withdraw' ? 'Cashout' : 'Eliminated'}
                                                                </div>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '1px' }}>
                                                                    {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                    {log.type === 'withdraw'
                                                                        ? ` · Collected $${log.grossAmount.toFixed(2)}`
                                                                        : ` · Lost $${Math.abs(log.netProfit).toFixed(2)}`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: win ? 'var(--green)' : 'var(--red)' }}>
                                                            {win ? '+' : '-'}${Math.abs(log.netProfit).toFixed(2)}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                        ) : (

                            /* ══ Settings view ══ */
                            <div style={{ maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                                {/* Username */}
                                <div>
                                    <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Username</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            value={usernameInput}
                                            onChange={e => {
                                                setUsernameInput(e.target.value);
                                                setUsernameMsg('');
                                            }}
                                            placeholder="Choose a username"
                                            className="input"
                                            maxLength={20}
                                            autoComplete="username"
                                            style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, boxSizing: 'border-box' }}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleUpdateUsername}
                                            disabled={isUpdatingUsername || !usernameInput.trim() || usernameInput.trim() === user?.username}
                                            style={{ padding: '0 18px', fontSize: '0.75rem', flexShrink: 0, borderRadius: 'var(--r-md)' }}
                                        >
                                            {isUpdatingUsername ? <span className="spinner" /> : 'Save'}
                                        </button>
                                    </div>
                                    {usernameMsg && (
                                        <div className={`status-msg ${usernameMsg === 'success' ? 'success' : 'error'}`} style={{ marginTop: '8px' }}>
                                            {usernameMsg === 'success'
                                                ? '✅ Username updated.'
                                                : usernameMsg === 'error'
                                                    ? '❌ Failed to update username.'
                                                    : `❌ ${usernameMsg}`}
                                        </div>
                                    )}
                                    <p style={{ margin: '8px 0 0', fontSize: '0.67rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
                                        3–20 characters · letters, numbers, and underscores only
                                    </p>
                                </div>

                                {/* Email (read-only) */}
                                {user?.email && (
                                    <div>
                                        <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Email</label>
                                        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-2)' }}>
                                            {user.email}
                                        </div>
                                    </div>
                                )}

                                {/* Wallet link */}
                                <div>
                                    <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Linked Wallet Address</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            value={walletInput}
                                            onChange={e => setWalletInput(e.target.value)}
                                            placeholder="Paste Solana address…"
                                            className="input"
                                            style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: '0.78rem', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleUpdateWallet}
                                            disabled={isUpdating || walletInput === user?.walletAddress || !walletInput}
                                            style={{ padding: '0 18px', fontSize: '0.75rem', flexShrink: 0, borderRadius: 'var(--r-md)' }}
                                        >
                                            {isUpdating ? <span className="spinner" /> : 'Link'}
                                        </button>
                                    </div>
                                    {updateMsg && (
                                        <div className={`status-msg ${updateMsg === 'success' ? 'success' : 'error'}`} style={{ marginTop: '8px' }}>
                                            {updateMsg === 'success'
                                                ? '✅ Wallet linked! Manual deposits will be tracked.'
                                                : updateMsg === 'error'
                                                    ? '❌ Failed to link. Check address format.'
                                                    : `❌ ${updateMsg}`}
                                        </div>
                                    )}
                                    <p style={{ margin: '8px 0 0', fontSize: '0.67rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
                                        Link the wallet you intend to deposit from. This helps us auto-identify your manual deposits.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}