import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Background from '../components/Background';

export default function Profile() {
    const { user, token, refreshUser } = useAuth(); // Hämta refreshUser från useAuth-hooken
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'stats');
    const [gameLogs, setGameLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setGameLogs(data.filter(tx => tx.type === 'withdraw' && tx.meta?.reason === 'Arena Cashout'));
            } catch (e) {}
        };
        fetchLogs();
        refreshUser();
    }, [token, refreshUser]);

    // Mockdata för diagrammet (PnL över tid)
    const chartData = [10, 15, 8, 25, 22, 45, 38, 60];
    const points = chartData.map((val, i) => `${(i / (chartData.length - 1)) * 100},${90 - (val / 70) * 80}`).join(' ');

    const formatPlaytime = (ms) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${mins}m`;
    };

    const totalPnL = gameLogs.reduce((acc, log) => acc + log.amount, 0);

    return (
        <div style={containerStyle}>
            <Background />
            
            <div style={contentWrapper}>
                <div style={headerStyle}>
                    <h1 style={titleStyle}>Account</h1>
                    <button onClick={() => navigate(-1)} style={backBtn}>Back</button>
                </div>

                <div className="glass" style={tabContainer}>
                    <div style={tabSwitcher}>
                        <button 
                            onClick={() => setActiveTab('stats')} 
                            style={{...tabBtn, ...(activeTab === 'stats' ? activeTabStyle : {})}}
                        >
                            Performance
                        </button>
                        <button 
                            onClick={() => setActiveTab('profile')} 
                            style={{...tabBtn, ...(activeTab === 'profile' ? activeTabStyle : {})}}
                        >
                            Profile Settings
                        </button>
                    </div>

                    <div style={tabContent}>
                        {activeTab === 'stats' ? (
                            <div style={statsView}>
                                <div style={statsGrid}>
                                    <div style={statCard}>
                                        <div style={statLabel}>Total Earnings</div>
                                        <div style={{...statValue, color: '#14F195'}}>+${totalPnL.toFixed(2)}</div>
                                    </div>
                                    <div style={statCard}>
                                        <div style={statLabel}>Win Rate</div>
                                        <div style={statValue}>68%</div>
                                    </div>
                                    <div style={statCard}>
                                        <div style={statLabel}>Playtime</div>
                                        <div style={statValue}>{formatPlaytime(user?.playtime || 0)}</div>
                                    </div>
                                </div>

                                <div style={chartWrapper}>
                                    <div style={chartHeader}>Equity Curve</div>
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={svgStyle}>
                                        <defs>
                                            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#007AFF" stopOpacity="0.5" />
                                                <stop offset="100%" stopColor="#007AFF" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path d={`M 0,100 L ${points} L 100,100 Z`} fill="url(#lineGradient)" />
                                        <polyline
                                            fill="none"
                                            stroke="#007AFF"
                                            strokeWidth="1.5"
                                            points={points}
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <div style={chartLabels}>
                                        <span>Last 30 Days</span>
                                        <span className="mono" style={{color: '#007AFF'}}>All Sessions</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <div style={statLabel}>Session History</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                                        {gameLogs.slice(0, 5).map(log => (
                                            <div key={log._id} className="glass" style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                    <div style={{ color: '#14F195', fontWeight: '800' }}>SUCCESS</div>
                                                    <div style={{ opacity: 0.4, fontSize: '0.8rem' }}>{new Date(log.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                <div style={{ fontWeight: '800' }}>+${log.amount.toFixed(2)}</div>
                                            </div>
                                        ))}
                                        {gameLogs.length === 0 && <div style={{ opacity: 0.2, textAlign: 'center', padding: '20px' }}>No session data found</div>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={settingsView}>
                                <div style={inputGroup}>
                                    <label style={labelStyle}>Username</label>
                                    <div className="glass" style={inputStatic}>{user?.username}</div>
                                </div>
                                <div style={inputGroup}>
                                    <label style={labelStyle}>Wallet Address</label>
                                    <div className="glass" style={inputStatic}>
                                        {user?.walletAddress || 'Not linked'}
                                    </div>
                                </div>
                                <div style={{marginTop: '40px', opacity: 0.3, fontSize: '0.8rem', textAlign: 'center'}}>
                                    Profile customization features coming soon.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .mono { font-family: ui-monospace, monospace; }
                .glass { 
                    background: rgba(15, 15, 18, 0.6); 
                    backdrop-filter: blur(40px); 
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 24px;
                }
            `}</style>
        </div>
    );
}

const containerStyle = { width: '100vw', minHeight: '100vh', background: '#050505', color: 'white', display: 'flex', justifyContent: 'center', padding: '100px 20px', boxSizing: 'border-box' };
const contentWrapper = { width: '100%', maxWidth: '800px' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const titleStyle = { fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1.5px', margin: 0 };
const backBtn = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 20px', borderRadius: '100px', cursor: 'pointer', fontWeight: '700' };

const tabContainer = { padding: '32px' };
const tabSwitcher = { display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '100px', width: 'fit-content', marginBottom: '40px' };
const tabBtn = { padding: '10px 24px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', borderRadius: '100px', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', transition: '0.2s' };
const activeTabStyle = { background: 'rgba(255,255,255,0.08)', color: 'white' };

const tabContent = { animation: 'fadeIn 0.3s ease-out' };
const statsView = { display: 'flex', flexDirection: 'column', gap: '30px' };
const statsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' };
const statCard = { background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' };
const statLabel = { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.3, marginBottom: '8px', fontWeight: '800' };
const statValue = { fontSize: '1.5rem', fontWeight: '900', fontFamily: 'ui-monospace, monospace' };

const chartWrapper = { 
    background: 'rgba(0,0,0,0.2)', 
    borderRadius: '20px', 
    padding: '24px', 
    height: '250px', 
    display: 'flex', 
    flexDirection: 'column',
    border: '1px solid rgba(255,255,255,0.02)'
};
const chartHeader = { fontSize: '0.8rem', fontWeight: '800', opacity: 0.2, marginBottom: '20px', textTransform: 'uppercase' };
const svgStyle = { width: '100%', flex: 1, overflow: 'visible' };
const chartLabels = { display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '0.7rem', fontWeight: '800', opacity: 0.2 };

const settingsView = { maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '10px' };
const labelStyle = { fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '800', opacity: 0.3, letterSpacing: '1px' };
const inputStatic = { padding: '16px', borderRadius: '14px', fontSize: '1rem', fontWeight: '600', color: 'rgba(255,255,255,0.8)' };