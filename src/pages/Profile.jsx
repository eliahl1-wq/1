import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';

const getGamemodeLabel = (log) => {
    const reason = log.meta?.reason || '';
    const mode = log.meta?.mode;
    const variant = log.meta?.variant;
    
    const isBR = reason.includes('BR') || log.meta?.event?.includes('br') || (variant && (reason.includes('Victory') || reason.includes('Eliminated') || reason.includes('Refund')));
    const rawMode = mode || variant || 'agar';
    
    if (isBR) {
        return rawMode.toLowerCase().includes('slither') ? 'Battle Royale Slither' : 'Battle Royale Agar';
    }
    
    if (rawMode === 'competitive-slither') return 'Competitive Slither';
    if (rawMode === 'slither') return 'Classic Slither';
    if (rawMode === 'agar') return 'Classic Agar';
    
    // Fallbacks
    if (rawMode.toLowerCase().includes('slither')) return 'Slither';
    return 'Agar';
};

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
        setPageSeo(SEO.profile);
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

    // Advanced metrics
    const avgPnL = processedLogs.length > 0 ? totalPnL / processedLogs.length : 0;
    const bestSession = processedLogs.length > 0 ? Math.max(...processedLogs.map(l => l.netProfit)) : 0;
    const totalWon = processedLogs.filter(l => l.netProfit > 0).reduce((acc, l) => acc + l.netProfit, 0);
    const totalLost = processedLogs.filter(l => l.netProfit < 0).reduce((acc, l) => acc + Math.abs(l.netProfit), 0);

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
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />

            <div className="page-content" style={{ maxWidth: '780px' }}>

                {/* ── Page header ── */}
                <div className="page-header-row">
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
                    <div className="profile-tabs">
                        {[
                            { id: 'stats',   label: 'Performance' },
                            { id: 'profile', label: 'Settings' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`profile-tab-btn${activeTab === tab.id ? ' profile-tab-btn--active' : ''}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '24px' }}>
                        {activeTab === 'stats' ? (

                            /* ══ Stats view ══ */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {/* Account Balance Banner */}
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--r-xl)',
                                    padding: '20px 24px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: '-50%',
                                        right: '-10%',
                                        width: '180px',
                                        height: '180px',
                                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%)',
                                        pointerEvents: 'none',
                                        zIndex: 0
                                    }} />
                                    
                                    <div style={{ zIndex: 1 }}>
                                        <div className="label" style={{ marginBottom: '6px', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Available Balance</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <span className="mono" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-h)', letterSpacing: '-0.03em' }}>
                                                {(user?.balance || 0).toFixed(4)}
                                            </span>
                                            <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-3)' }}>SOL</span>
                                            <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--green)', marginLeft: '12px' }}>
                                                ${((user?.balance || 0) * (user?.solPrice || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: 'var(--r-full)', padding: '4px 10px' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'livePulse 2s ease-in-out infinite' }} />
                                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Account</span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '8px', fontFamily: 'var(--mono)' }}>
                                            {user?.depositAddress ? `${user.depositAddress.slice(0, 4)}...${user.depositAddress.slice(-4)}` : 'No wallet linked'}
                                        </div>
                                    </div>
                                </div>

                                {/* Stat cards */}
                                <div className="profile-stat-grid">
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
                                        {
                                            label: 'Avg P&L',
                                            value: `${avgPnL >= 0 ? '+' : ''}$${Math.abs(avgPnL).toFixed(2)}`,
                                            color: avgPnL >= 0 ? 'var(--green)' : 'var(--red)',
                                        },
                                        {
                                            label: 'Best Session',
                                            value: `${bestSession >= 0 ? '+' : ''}$${Math.abs(bestSession).toFixed(2)}`,
                                            color: bestSession > 0 ? 'var(--green)' : bestSession < 0 ? 'var(--red)' : 'var(--text-h)',
                                        },
                                        {
                                            label: 'Won / Lost',
                                            value: `+$${totalWon.toFixed(2)} / -$${totalLost.toFixed(2)}`,
                                            color: 'var(--text-h)',
                                            isMono: true
                                        },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
                                            <div className="label" style={{ marginBottom: '8px' }}>{s.label}</div>
                                            <div className="mono" style={{ fontSize: s.isMono ? '0.95rem' : '1.4rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                                                {s.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Equity chart */}
                                <div style={{ position: 'relative', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px 18px 12px 18px', overflow: 'hidden' }}>
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
                                                ? 'START $0.00'
                                                : `${log?.netProfit >= 0 ? 'PROFIT' : 'LOSS'} $${Math.abs(log?.netProfit || 0).toFixed(2)}`;
                                            
                                            const ptVal = chartPts[idx];
                                            const p = toXY(ptVal, idx);
                                            setHoveredPoint({
                                                index: idx,
                                                label,
                                                cumVal: ptVal,
                                                x: p.x,
                                                y: p.y,
                                                clientCoords: {
                                                    x: (idx / Math.max(chartPts.length - 1, 1)) * rect.width,
                                                    y: (p.y / 100) * rect.height
                                                },
                                                date: log ? new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Initial'
                                            });
                                        }}
                                        onMouseLeave={() => setHoveredPoint(null)}
                                    >
                                        <defs>
                                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={chartColor} stopOpacity="0.12" />
                                                <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                                            </linearGradient>
                                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                                <feGaussianBlur stdDeviation="0.6" result="blur" />
                                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                            </filter>
                                        </defs>

                                        {/* Horizontal grid lines */}
                                        <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="2,4" />
                                        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="2,4" />
                                        <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="2,4" />

                                        {/* Break-even line */}
                                        {(() => {
                                            const zeroY = 95 - ((0 - minVal) / pnlRange) * 90;
                                            return (
                                                <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" strokeDasharray="3,3" />
                                            );
                                        })()}

                                        {/* Area fill */}
                                        <path d={`${areaPath} L 100 100 L 0 100 Z`} fill="url(#chartGrad)" />

                                        {/* Glow line shadow */}
                                        <path
                                            d={areaPath}
                                            fill="none"
                                            stroke={chartColor}
                                            strokeWidth="2.5"
                                            opacity="0.3"
                                            filter="url(#glow)"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />

                                        {/* Foreground line */}
                                        <path
                                            d={areaPath}
                                            fill="none"
                                            stroke={chartColor}
                                            strokeWidth="1.5"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />

                                        {/* Interactive dots */}
                                        {chartPts.map((v, i) => {
                                            const p = toXY(v, i);
                                            const isHovered = hoveredPoint && hoveredPoint.index === i;
                                            return (
                                                <circle
                                                    key={i}
                                                    cx={p.x}
                                                    cy={p.y}
                                                    r={isHovered ? 2.2 : 0.8}
                                                    fill={isHovered ? 'white' : chartColor}
                                                    stroke={isHovered ? chartColor : 'none'}
                                                    strokeWidth={isHovered ? 0.6 : 0}
                                                    style={{ transition: 'r 0.15s, fill 0.15s' }}
                                                />
                                            );
                                        })}

                                        {/* Hover crosshair line */}
                                        {hoveredPoint && chartPts.length > 1 && (() => {
                                            return (
                                                <line x1={hoveredPoint.x} y1="0" x2={hoveredPoint.x} y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                                            );
                                        })()}
                                    </svg>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        <span>Start</span>
                                        <span>{processedLogs.length} sessions</span>
                                    </div>

                                    {/* Tooltip Overlay */}
                                    {hoveredPoint && (
                                        <div style={{
                                            position: 'absolute',
                                            left: `${hoveredPoint.clientCoords.x + 18}px`,
                                            top: `${hoveredPoint.clientCoords.y + 18}px`,
                                            transform: 'translate(-50%, -120%)',
                                            background: 'rgba(10, 10, 12, 0.95)',
                                            backdropFilter: 'blur(8px)',
                                            border: `1px solid ${hoveredPoint.cumVal >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,59,48,0.25)'}`,
                                            borderRadius: 'var(--r-md)',
                                            padding: '8px 12px',
                                            pointerEvents: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                            zIndex: 10,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {hoveredPoint.date}
                                            </span>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: hoveredPoint.cumVal >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>
                                                Equity: {hoveredPoint.cumVal >= 0 ? '+' : ''}${hoveredPoint.cumVal.toFixed(2)}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-2)' }}>
                                                {hoveredPoint.label}
                                            </span>
                                        </div>
                                    )}
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
                                                                    {log.type === 'withdraw' ? 'Cashout' : 'Eliminated'} · <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{getGamemodeLabel(log)}</span>
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