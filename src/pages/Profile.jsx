import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import CustomDropdown from '../components/CustomDropdown';
import '../styles/ui.css';
import { setPageSeo, SEO } from '../utils/seo';

const SolLogo = ({ size = 13, style }) => (
    <img
        src="/solana-sol-logo.png"
        alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0, ...style }}
    />
);

const getGamemodeLabel = (log) => {
    const reason = log.meta?.reason || '';
    const mode = log.meta?.mode;
    const variant = log.meta?.variant;

    const isBR = reason.includes('BR') || log.meta?.event?.includes('br') || (variant && (reason.includes('Victory') || reason.includes('Eliminated') || reason.includes('Refund')));
    const rawMode = mode || variant || 'agar';

    if (isBR) {
        return rawMode.toLowerCase().includes('slither') ? 'Battle Royale Slither' : 'Battle Royale Agar';
    }

    if (rawMode === 'competitive-slither') return 'Arena Slither';
    if (rawMode === 'slither') return 'Classic Slither';
    if (rawMode === 'agar') return 'Classic Agar';

    // Fallbacks
    if (rawMode.toLowerCase().includes('slither')) return 'Slither';
    return 'Agar';
};

export default function Profile() {
    const { user, token, refreshUser, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'stats');
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [gameLogs, setGameLogs] = useState([]);
    const [displayCur, setDisplayCur] = useState(() => localStorage.getItem('balance_currency') || 'USD');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [displayCur]);
    const [usernameInput, setUsernameInput] = useState(user?.username || '');
    const [walletInput, setWalletInput] = useState(user?.walletAddress || '');
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [usernameMsg, setUsernameMsg] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateMsg, setUpdateMsg] = useState('');

    useEffect(() => {
        setUsernameInput(user?.username || '');
        setWalletInput(user?.walletAddress || '');
    }, [user?.username, user?.walletAddress]);

    useEffect(() => {
        setPageSeo(SEO.profile);
        const fetchLogs = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setGameLogs(data.filter(tx => {
                    const reason = tx.meta?.reason || '';
                    return (tx.type === 'withdraw' && (reason.includes('Arena Cashout') || reason.includes('BR Victory')))
                        || (tx.type === 'game' && (reason === 'Arena Death' || reason === 'BR Eliminated'));
                }));
            } catch { }
        };
        fetchLogs();
        refreshUser();
    }, [token, refreshUser]);

    // ── Currency Converter Helper ─────────────────────
    const solPrice = user?.solPrice || 70;
    const formatVal = (usdAmount, includeSign = false) => {
        if (displayCur === 'SOL') {
            const solAmt = usdAmount / solPrice;
            if (solAmt === 0) return '0.0000 SOL';
            const sign = solAmt > 0 ? (includeSign ? '+' : '') : '-';
            return `${sign}${Math.abs(solAmt).toFixed(4)} SOL`;
        } else {
            if (usdAmount === 0) return '$0.00';
            const sign = usdAmount > 0 ? (includeSign ? '+' : '') : '-';
            return `${sign}$${Math.abs(usdAmount).toFixed(2)}`;
        }
    };

    // ── Chart data ────────────────────────────────────
    const processedLogs = [...gameLogs].reverse().map(log => {
        const isCashout = log.type === 'withdraw' && ((log.meta?.reason || '').includes('Arena Cashout') || (log.meta?.reason || '').includes('BR Victory'));
        const amount = Number(log.amount) || 0;
        const entryCost = Number(log.meta?.entryFeeUsd) || 10;
        const netProfit = isCashout ? (amount - entryCost) : (0 - entryCost);
        return { ...log, netProfit: isNaN(netProfit) ? 0 : netProfit, grossAmount: amount, isCashout };
    });

    const totalPnL = processedLogs.reduce((acc, l) => acc + l.netProfit, 0);
    const winRate = processedLogs.length > 0
        ? Math.round((processedLogs.filter(l => l.netProfit > 0).length / processedLogs.length) * 100)
        : 0;

    // Advanced metrics (in USD, converted on render via formatVal)
    const avgPnL = processedLogs.length > 0 ? totalPnL / processedLogs.length : 0;
    const biggestCashout = processedLogs.length > 0
        ? Math.max(...processedLogs.map(l => l.isCashout ? l.grossAmount : 0))
        : 0;
    const totalWon = processedLogs.filter(l => l.netProfit > 0).reduce((acc, l) => acc + l.netProfit, 0);
    const totalLost = processedLogs.filter(l => l.netProfit < 0).reduce((acc, l) => acc + Math.abs(l.netProfit), 0);

    // Cumulative points in selected currency
    const pnlConversion = displayCur === 'SOL' ? (1 / solPrice) : 1;
    let cumulative = 0;
    const chartPts = [0, ...processedLogs.map(l => {
        cumulative += l.netProfit * pnlConversion;
        return cumulative;
    })];

    const minChartVal = Math.min(...chartPts);
    const maxChartVal = Math.max(...chartPts);
    const rawRange = maxChartVal - minChartVal;
    
    // Zoom out the chart by adding a 40% padding top and bottom, preventing lines from feeling super inzoomed/stretched
    const padding = rawRange === 0 ? (displayCur === 'SOL' ? 0.2 : 10) : rawRange * 0.40;
    const minVal = minChartVal - padding;
    const maxVal = maxChartVal + padding;
    const pnlRange = (maxVal - minVal) || 1;

    const toXY = (val, i) => ({
        x: (i / Math.max(chartPts.length - 1, 1)) * 100,
        y: 95 - ((val - minVal) / pnlRange) * 90,
    });

    const xyPts = chartPts.map((v, i) => toXY(v, i));

    // Clean straight lines for the graph (polyline)
    const getStraightPath = (points) => {
        if (points.length < 1) return '';
        return 'M ' + points.map(p => `${p.x} ${p.y}`).join(' L ');
    };

    const linePath = getStraightPath(xyPts);

    const zeroY = 95 - ((0 - minVal) / pnlRange) * 90;
    const zeroPercent = Math.max(0, Math.min(100, zeroY));

    // Area fill anchored to the zero baseline
    const fillPath = xyPts.length > 0
        ? `M ${xyPts[0].x} ${zeroY} ` + xyPts.map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${xyPts[xyPts.length - 1].x} ${zeroY} Z`
        : '';

    // Use the correct brand colors (green = #14F195, red = #FF3B30)
    const C_GREEN = '#14F195';
    const C_RED = '#FF3B30';
    const chartColor = totalPnL >= 0 ? C_GREEN : C_RED;

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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/update-profile`, {
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
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-xl)' }}>

                    {/* ── Tab bar ── */}
                    <div className="profile-tabs">
                        {[
                            { id: 'stats', label: 'Performance' },
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
                                    overflow: 'visible',
                                }}>
                                    {/* Decorative background glow wrapper */}
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: 'var(--r-xl)',
                                        overflow: 'hidden',
                                        pointerEvents: 'none',
                                        zIndex: 0
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '-50%',
                                            right: '-10%',
                                            width: '180px',
                                            height: '180px',
                                            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%)',
                                        }} />
                                    </div>

                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span className="label" style={{ fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Available Balance</span>
                                            <CustomDropdown
                                                options={[
                                                    { label: 'SOL', value: 'SOL' },
                                                    { label: 'USD', value: 'USD' }
                                                ]}
                                                value={displayCur}
                                                onChange={val => {
                                                    setDisplayCur(val);
                                                    localStorage.setItem('balance_currency', val);
                                                }}
                                                renderValue={v => (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {v === 'SOL' ? <><SolLogo size={10} /> SOL</> : '$ USD'}
                                                    </span>
                                                )}
                                                renderOption={opt => (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {opt.value === 'SOL' ? <><SolLogo size={11} /> SOL</> : '$ USD'}
                                                    </span>
                                                )}
                                            />
                                        </div>

                                        {displayCur === 'SOL' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <SolLogo size={24} style={{ marginRight: '2px' }} />
                                                    <span className="mono" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-h)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                                                        {(user?.balance || 0).toFixed(4)}
                                                    </span>
                                                    <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>SOL</span>
                                                </div>
                                                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-3)', paddingLeft: '28px' }}>
                                                    ≈ ${((user?.balance || 0) * (user?.solPrice || 0)).toFixed(2)} USD
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className="mono" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-h)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                                                        ${((user?.balance || 0) * (user?.solPrice || 0)).toFixed(2)}
                                                    </span>
                                                    <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>USD</span>
                                                </div>
                                                <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    ≈ <SolLogo size={12} /> {(user?.balance || 0).toFixed(4)} SOL
                                                </div>
                                            </div>
                                        )}
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

                                {/* Main Stat cards */}
                                <div className="profile-stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                    {[
                                        {
                                            label: 'Total P&L',
                                            value: formatVal(totalPnL, true),
                                            color: totalPnL >= 0 ? 'var(--green)' : 'var(--red)',
                                        },
                                        {
                                            label: 'Win Rate',
                                            value: `${winRate}%`,
                                            color: winRate >= 50 ? 'var(--green)' : 'var(--text-h)',
                                        },
                                        {
                                            label: 'Biggest Cashout',
                                            value: formatVal(biggestCashout),
                                            color: biggestCashout > 0 ? 'var(--green)' : 'var(--text-h)',
                                        },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
                                            <div className="label" style={{ marginBottom: '8px' }}>{s.label}</div>
                                            <div className="mono" style={{ fontSize: '1.45rem', fontWeight: 900, color: s.color, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                                                {s.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Secondary stats (smaller & less prominent) */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginTop: '-8px', gap: '16px', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Sessions', value: processedLogs.length },
                                        { label: 'Avg P&L', value: formatVal(avgPnL, true), color: avgPnL >= 0 ? 'var(--green)' : 'var(--red)' },
                                        { label: 'Total Won / Lost', value: `${formatVal(totalWon)} / ${formatVal(totalLost)}` }
                                    ].map(s => (
                                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}:</span>
                                            <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: s.color || 'var(--text-2)' }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Equity chart */}
                                <div style={{
                                    position: 'relative',
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--r-lg)',
                                    padding: '20px 20px 14px 20px',
                                    overflow: 'hidden',
                                }}>
                                    {/* Background glow matching the current curve color */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: '60%',
                                        height: '70%',
                                        background: `radial-gradient(ellipse at bottom right, ${totalPnL >= 0 ? 'rgba(20,241,149,0.04)' : 'rgba(255,59,48,0.06)'} 0%, transparent 70%)`,
                                        pointerEvents: 'none',
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', position: 'relative', zIndex: 1 }}>
                                        <span className="label">Equity Curve</span>
                                        {hoveredPoint && (
                                            <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: hoveredPoint.cumVal >= 0 ? C_GREEN : C_RED }}>
                                                {formatVal(hoveredPoint.cumVal, true)}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                                        <svg
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none"
                                            style={{ width: '100%', height: '100%', display: 'block' }}
                                            onMouseMove={e => {
                                                if (chartPts.length < 2) return;
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
                                                const idx = Math.max(0, Math.min(
                                                    Math.round((mouseX / 100) * (chartPts.length - 1)),
                                                    chartPts.length - 1
                                                ));
                                                const log = idx > 0 ? processedLogs[idx - 1] : null;
                                                const ptVal = chartPts[idx];
                                                const p = toXY(ptVal, idx);
                                                let formattedDate = 'Initial Session';
                                                if (log) {
                                                    const d = new Date(log.createdAt);
                                                    formattedDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                                                        + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                }
                                                setHoveredPoint({
                                                    index: idx,
                                                    cumVal: ptVal,
                                                    x: p.x,
                                                    y: p.y,
                                                    clientCoords: {
                                                        x: (idx / Math.max(chartPts.length - 1, 1)) * rect.width,
                                                        y: (p.y / 100) * rect.height
                                                    },
                                                    containerWidth: rect.width,
                                                    date: formattedDate,
                                                    netProfit: log ? log.netProfit : null,
                                                    gameLabel: log ? getGamemodeLabel(log) : null
                                                });
                                            }}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                        >
                                            <defs>
                                                {/* Line gradient: green above zero → red below */}
                                                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                                                    <stop offset="0%" stopColor={C_GREEN} />
                                                    <stop offset={`${zeroPercent}%`} stopColor={C_GREEN} />
                                                    <stop offset={`${zeroPercent}%`} stopColor={C_RED} />
                                                    <stop offset="100%" stopColor={C_RED} />
                                                </linearGradient>

                                                {/* Area fill gradient anchored at zero */}
                                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                                                    <stop offset="0%" stopColor={C_GREEN} stopOpacity="0.18" />
                                                    <stop offset={`${Math.max(0, zeroPercent - 1)}%`} stopColor={C_GREEN} stopOpacity="0.03" />
                                                    <stop offset={`${Math.min(100, zeroPercent + 1)}%`} stopColor={C_RED} stopOpacity="0.03" />
                                                    <stop offset="100%" stopColor={C_RED} stopOpacity="0.2" />
                                                </linearGradient>

                                                {/* Glow filter for the line */}
                                                <filter id="lineGlow" x="-10%" y="-80%" width="120%" height="260%">
                                                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                                                    <feMerge>
                                                        <feMergeNode in="blur" />
                                                        <feMergeNode in="SourceGraphic" />
                                                    </feMerge>
                                                </filter>
                                            </defs>

                                            {/* Subtle horizontal grid lines */}
                                            {[20, 40, 60, 80].map(y => (
                                                <line key={y} x1="0" y1={y} x2="100" y2={y}
                                                    stroke="rgba(255,255,255,0.04)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                            ))}

                                            {/* Zero / break-even baseline */}
                                            <line x1="0" y1={zeroY} x2="100" y2={zeroY}
                                                stroke="rgba(255,255,255,0.1)" strokeWidth="1" vectorEffect="non-scaling-stroke"
                                                strokeDasharray="4,4" />

                                            {/* Area fill */}
                                            <path d={fillPath} fill="url(#areaGrad)" />

                                            {/* Main crisp line */}
                                            <path
                                                d={linePath}
                                                fill="none"
                                                stroke="url(#lineGrad)"
                                                strokeWidth="1.2"
                                                vectorEffect="non-scaling-stroke"
                                                strokeLinejoin="round"
                                                strokeLinecap="round"
                                            />
                                        </svg>

                                        {/* HTML/CSS Vertical cursor line */}
                                        {hoveredPoint && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${hoveredPoint.clientCoords.x}px`,
                                                top: '0px',
                                                bottom: '0px',
                                                width: '1px',
                                                borderLeft: '1px dashed rgba(255, 255, 255, 0.25)',
                                                pointerEvents: 'none',
                                                zIndex: 10,
                                            }} />
                                        )}

                                        {/* HTML/CSS Dot at hovered point */}
                                        {hoveredPoint && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${hoveredPoint.clientCoords.x}px`,
                                                top: `${hoveredPoint.clientCoords.y}px`,
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: hoveredPoint.cumVal >= 0 ? C_GREEN : C_RED,
                                                boxShadow: `0 0 0 4px ${hoveredPoint.cumVal >= 0 ? 'rgba(20,241,149,0.25)' : 'rgba(255,59,48,0.25)'}`,
                                                transform: 'translate(-50%, -50%)',
                                                pointerEvents: 'none',
                                                zIndex: 11,
                                            }} />
                                        )}

                                        {/* Floating tooltip */}
                                        {hoveredPoint && (() => {
                                            const tooltipLeft = Math.max(80, Math.min(hoveredPoint.clientCoords.x, hoveredPoint.containerWidth - 80));
                                            return (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${tooltipLeft}px`,
                                                    top: `${hoveredPoint.clientCoords.y - 12}px`,
                                                    transform: 'translate(-50%, -100%)',
                                                    background: '#131722',
                                                    border: `1px solid rgba(255, 255, 255, 0.12)`,
                                                    borderRadius: '6px',
                                                    padding: '10px 14px',
                                                    pointerEvents: 'none',
                                                    boxShadow: `0 4px 16px rgba(0,0,0,0.5)`,
                                                    zIndex: 20,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    alignItems: 'flex-start',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {hoveredPoint.gameLabel || 'Initial Balance'}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>
                                                            {formatVal(hoveredPoint.cumVal, true)}
                                                        </span>
                                                        {hoveredPoint.netProfit !== null && (
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: hoveredPoint.netProfit >= 0 ? C_GREEN : C_RED, fontFamily: 'var(--mono)' }}>
                                                                ({formatVal(hoveredPoint.netProfit, true)})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '0.62rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>
                                                        {hoveredPoint.date}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', position: 'relative', zIndex: 1 }}>
                                        <span>Start</span>
                                        <span>{processedLogs.length} sessions</span>
                                    </div>
                                    })()}
                                </div>

                                {/* Session log */}
                                <div>
                                    <div className="label" style={{ marginBottom: '10px' }}>Session History</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {processedLogs.length === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.78rem', fontWeight: 600 }}>
                                                No sessions yet
                                            </div>
                                        ) : (() => {
                                            const reversedLogs = [...processedLogs].reverse();
                                            const totalPages = Math.ceil(reversedLogs.length / 15) || 1;
                                            const startIndex = (currentPage - 1) * 15;
                                            const paginatedLogs = reversedLogs.slice(startIndex, startIndex + 15);

                                            return (
                                                <>
                                                    {paginatedLogs.map(log => {
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
                                                                                ? ` · Collected ${formatVal(log.grossAmount)}`
                                                                                : ` · Lost ${formatVal(Math.abs(log.netProfit))}`}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: win ? 'var(--green)' : 'var(--red)' }}>
                                                                    {formatVal(log.netProfit, true)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Pagination Controls */}
                                                    {totalPages > 1 && (
                                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                                                            <button
                                                                className="btn btn-ghost"
                                                                disabled={currentPage === 1}
                                                                onClick={() => {
                                                                    setCurrentPage(p => Math.max(1, p - 1));
                                                                    // Scroll up to session history header when page changes
                                                                    const el = document.getElementById('session-history-hdr');
                                                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                                }}
                                                                style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: 'var(--r-md)' }}
                                                            >
                                                                Previous
                                                            </button>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)' }}>
                                                                Page {currentPage} of {totalPages}
                                                            </span>
                                                            <button
                                                                className="btn btn-ghost"
                                                                disabled={currentPage === totalPages}
                                                                onClick={() => {
                                                                    setCurrentPage(p => Math.min(totalPages, p + 1));
                                                                    // Scroll up to session history header when page changes
                                                                    const el = document.getElementById('session-history-hdr');
                                                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                                }}
                                                                style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: 'var(--r-md)' }}
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
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