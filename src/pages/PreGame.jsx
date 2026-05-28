import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [walletTab, setWalletTab] = useState('deposit'); // 'deposit' | 'withdraw'
    const [stats, setStats] = useState({ playersOnline: 0, biggestPayout: 0 });
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const walletPanelRef = useRef(null);
    
    const [nickname, setNickname] = useState(localStorage.getItem('match_nickname') || user?.username || '');
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [amount, setAmount] = useState('');
    const [isMatchmaking, setIsMatchmaking] = useState(false);

    const entryFee = 10.00;
    const canJoin = (user?.balance || 0) >= entryFee;

    const handleStartMatch = () => {
        if (!canJoin) return;
        setIsMatchmaking(true);
        localStorage.setItem('match_nickname', nickname);
        setTimeout(() => {
            navigate('/game', { state: { nickname } });
        }, 1200);
    };

    const handleClickOutside = useCallback((event) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target) &&
            userPillRef.current && !userPillRef.current.contains(event.target)) {
            setShowUserMenu(false);
        }
        if (walletPanelRef.current && !walletPanelRef.current.contains(event.target) && 
            !event.target.closest('#wallet-trigger')) {
            setIsWalletOpen(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    useEffect(() => {
        let mounted = true;
        const loadStats = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/stats`);
                if (!res.ok) throw new Error('Stats fetch failed');
                const data = await res.json();
                if (!mounted) return;
                setStats({
                    playersOnline: data.playersOnline ?? 0,
                    biggestPayout: data.biggestPayout ?? 0
                });
            } catch (err) {
                console.warn('Failed to load stats', err);
            }
        };
        loadStats();
        const interval = setInterval(loadStats, 20000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <div style={containerStyle}>
            <style>{`
                @keyframes pulse-live {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.95); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes float-in {
                    from { opacity: 0; transform: translateY(10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .live-indicator { width: 6px; height: 6px; background: #34C759; border-radius: 50%; animation: pulse-live 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                .surface {
                    background: rgba(10, 10, 15, 0.88);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
                    animation: float-in 0.35s ease;
                }
                button {
                    transition: transform 0.24s ease, filter 0.24s ease, box-shadow 0.24s ease;
                    cursor: pointer;
                    border: none;
                    outline: none;
                }
                button:hover:not(:disabled) {
                    transform: translateY(-1px);
                    filter: brightness(1.08);
                }
                button:active:not(:disabled) {
                    transform: translateY(0);
                }
                input {
                    transition: border-color 0.24s ease, background 0.24s ease;
                }
                input:focus {
                    border-color: rgba(0, 122, 255, 0.5);
                }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .mono {
                    font-family: ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .dropdown-anim {
                    animation: float-in 0.28s ease;
                }
            `}</style>

            <div style={backgroundStyle} />
            <div style={gameBlurStyle} />
            <div style={backgroundOverlayStyle} />
            <div style={vignetteStyle} />

            <div style={topBarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <h2 style={logoStyle}>AGAR<span style={{ color: '#007AFF' }}>STAKE</span></h2>
                    <div style={walletSummaryStyle}>
                        <span style={walletSummaryLabelStyle}>Wallet balance</span>
                        <span className="mono" style={walletSummaryValueStyle}>${user?.balance?.toFixed(2) || '0.00'}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => { setWalletTab('deposit'); setIsWalletOpen(true); }}
                        style={depositWithdrawBtnStyle}
                    >
                        Deposit / Withdraw
                    </button>

                    <div style={{ position: 'relative' }}>
                        <div ref={userPillRef} onClick={() => setShowUserMenu(!showUserMenu)} style={avatarPillStyle}>
                            <div style={avatarCircleStyle}>{user?.username?.charAt(0).toUpperCase()}</div>
                        </div>
                    {showUserMenu && (
                        <div ref={userMenuRef} style={userMenuContainerStyle}>
                            <div style={userMenuHeader}>{user?.username}</div>
                            <button style={userMenuItemStyle}>Settings</button>
                            <button style={userMenuItemStyle}>History</button>
                            <button onClick={logout} style={{ ...userMenuItemStyle, color: '#FF3B30' }}>Log Out</button>
                        </div>
                    )}
                    </div>
                </div>

                {isWalletOpen && (
                    <div ref={walletPanelRef} className="glass dropdown-anim" style={walletExpandPanelStyle}>
                        <button style={walletCloseX} onClick={() => setIsWalletOpen(false)}>✕</button>
                        <div style={walletPanelHeader}>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.55, marginBottom: '4px' }}>Wallet balance</div>
                                <div className="mono" style={walletPanelBalance}>${user?.balance?.toFixed(2) || '0.00'}</div>
                            </div>
                        </div>
                        <div style={walletTabContainer}>
                            <button onClick={() => setWalletTab('deposit')} style={{...walletTabBtn, ...(walletTab === 'deposit' ? walletTabActive : {})}}>Deposit</button>
                            <button onClick={() => setWalletTab('withdraw')} style={{...walletTabBtn, ...(walletTab === 'withdraw' ? walletTabActive : {})}}>Withdraw</button>
                        </div>
                        <div style={walletInputArea}>
                            <div style={walletInputPrefix}>$</div>
                            <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={walletInput} />
                            <button style={walletMaxBtn} onClick={() => setAmount(walletTab === 'withdraw' ? user?.balance?.toFixed(2) : '100')}>MAX</button>
                        </div>
                        <button style={walletConfirmBtn}>Confirm {walletTab === 'deposit' ? 'Deposit' : 'Withdrawal'}</button>
                        <div style={walletPanelFooter}>Solana Devnet · Secure Processing</div>
                    </div>
                )}
            </div>

            <div className="glass" style={centerCardStyle}>
                <label style={inputLabelStyle}>Nickname</label>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value.substring(0, 20))}
                    placeholder="Your name..."
                    style={nicknameInputStyle}
                />
                
                <div style={dividerStyle} />
                
                <div style={entryFeeRowStyle}>
                    <span>Entry fee</span>
                    <span className="mono">${entryFee.toFixed(0)}</span>
                </div>

                <button 
                    onClick={handleStartMatch} 
                    disabled={!canJoin || isMatchmaking}
                    style={{ 
                        ...playBtnStyle, 
                        background: canJoin ? 'linear-gradient(135deg, #22C55E, #10B981)' : 'rgba(255,255,255,0.06)',
                        color: canJoin ? 'white' : 'rgba(255,255,255,0.45)',
                        cursor: canJoin ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isMatchmaking ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            Joining...
                        </div>
                    ) : (canJoin ? 'Play' : 'Insufficient Balance')}
                </button>

                <div style={howItWorksContainerStyle}>
                    <div onClick={() => setShowHowItWorks(!showHowItWorks)} style={howItWorksToggleStyle}>
                        <span>How it works</span>
                        <span style={{ transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s' }}>▼</span>
                    </div>
                    {showHowItWorks && (
                        <div className="dropdown-anim" style={howItWorksTextStyle}>
                            <div>• Entry fee is $10.00</div>
                            <div>• Grow by eating food and players</div>
                            <div>• Cash out your balance anytime</div>
                            <div style={{ marginTop: '8px', opacity: 0.5 }}>Top 3 Rewards: $20, $10, $10</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass" style={bottomRightCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, textTransform: 'uppercase' }}>Live Stats</div>
                    <div className="live-indicator" />
                </div>
                <div style={statItemStyle}>
                    <span>Players online</span>
                    <span className="mono">{stats.playersOnline.toLocaleString()}</span>
                </div>
                <div style={statItemStyle}>
                    <span>Biggest payout today</span>
                    <span className="mono">${stats.biggestPayout.toFixed(2)}</span>
                </div>
            </div>

            <div style={footerContainerStyle}>
                <span>Terms of Service</span>
                <span>Provably Fair</span>
                <span>Support</span>
                <span style={{ opacity: 0.4 }}>EU-West · Stable</span>
            </div>
        </div>
    );
}
// --- Styles ---
const containerStyle = { width: '100vw', minHeight: '100vh', background: '#050507', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative', letterSpacing: '-0.01em', paddingTop: '56px' };
const backgroundStyle = { position: 'fixed', inset: 0, zIndex: -3, background: '#050507', backgroundImage: `radial-gradient(circle at 20% 15%, rgba(0,122,255,0.12) 0%, transparent 16%), radial-gradient(circle at 80% 20%, rgba(52,199,89,0.08) 0%, transparent 15%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.04) 0%, transparent 24%)`, opacity: 1 };
const gameBlurStyle = { position: 'fixed', inset: 0, zIndex: -4, backgroundImage: `radial-gradient(circle at 18% 18%, rgba(255,255,255,0.12) 0%, transparent 14%), radial-gradient(circle at 82% 22%, rgba(0,122,255,0.10) 0%, transparent 16%), radial-gradient(circle at 42% 72%, rgba(52,199,89,0.08) 0%, transparent 14%), radial-gradient(circle at 66% 78%, rgba(255,255,255,0.06) 0%, transparent 18%)`, filter: 'blur(24px)', opacity: 0.92 };
const backgroundOverlayStyle = { position: 'fixed', inset: 0, zIndex: -2, background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.82) 100%)' };
const vignetteStyle = { position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.65) 100%)' };
const topBarStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', zIndex: 1000, background: 'rgba(8, 8, 12, 0.88)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' };
const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-0.04em', fontSize: '1.05rem' };
const walletSummaryStyle = { display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 14px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '170px', gap: '4px', boxShadow: '0 14px 32px rgba(0,0,0,0.22)' };
const walletSummaryLabelStyle = { fontSize: '0.7rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' };
const walletSummaryValueStyle = { fontSize: '1rem', fontWeight: '900', letterSpacing: '0.02em' };
const walletActionBtnStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '11px 18px', borderRadius: '14px', fontSize: '0.76rem', fontWeight: '800', minWidth: '100px', boxShadow: '0 14px 30px rgba(0,0,0,0.20)' };
const walletActionPrimaryStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' };
const depositWithdrawBtnStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '12px 18px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: '800', boxShadow: '0 16px 34px rgba(0,0,0,0.20)', minWidth: '140px' };
const avatarPillStyle = { width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.18)', padding: '3px', background: 'rgba(255,255,255,0.04)' };
const avatarCircleStyle = { width: '100%', height: '100%', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.75rem', letterSpacing: '0.02em' };
const walletExpandPanelStyle = { position: 'absolute', top: '62px', left: '50%', transform: 'translateX(-50%)', width: '320px', minWidth: '280px', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '14px', zIndex: 1100, background: 'rgba(12, 12, 16, 0.92)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 36px 80px rgba(0,0,0,0.32)' };
const walletCloseX = { position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', color: 'white', opacity: 0.35, padding: '6px', cursor: 'pointer' };
const walletPanelHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' };
const walletPanelBalance = { fontSize: '1.35rem', fontWeight: '900', letterSpacing: '0.02em' };
const walletTabContainer = { display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '14px' };
const walletTabBtn = { flex: 1, padding: '8px 10px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: '800', borderRadius: '12px' };
const walletTabActive = { background: 'rgba(255,255,255,0.08)', color: 'white', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' };
const walletInputArea = { position: 'relative', display: 'flex', alignItems: 'center' };
const walletInputPrefix = { position: 'absolute', left: '14px', fontSize: '0.85rem', opacity: 0.35, fontWeight: '800' };
const walletInput = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 14px 14px 38px', color: 'white', fontWeight: '700', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' };
const walletMaxBtn = { position: 'absolute', right: '10px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '6px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800' };
const walletConfirmBtn = { width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #007AFF, #4D9CFF)', color: 'white', fontWeight: '800', fontSize: '0.9rem', boxShadow: '0 14px 28px rgba(0,122,255,0.22)' };
const walletPanelFooter = { textAlign: 'center', fontSize: '0.7rem', opacity: 0.36, fontWeight: '600', marginTop: '4px' };
const userMenuContainerStyle = { position: 'absolute', top: '46px', right: 0, width: '180px', background: 'rgba(10, 10, 15, 0.98)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' };
const userMenuHeader = { padding: '14px 16px', fontSize: '0.68rem', fontWeight: '800', opacity: 0.35, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const userMenuItemStyle = { width: '100%', padding: '14px 16px', background: 'none', border: 'none', color: 'white', textAlign: 'left', fontSize: '0.78rem', fontWeight: '700', opacity: 0.92 };
const centerCardStyle = { width: '360px', maxWidth: '92vw', borderRadius: '24px', padding: '30px', zIndex: 10, background: 'rgba(10, 10, 16, 0.92)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 32px 70px rgba(0,0,0,0.28)' };
const inputLabelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: '800', opacity: 0.3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' };
const nicknameInputStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '0.95rem', fontWeight: '700', outline: 'none', padding: '16px 18px', borderRadius: '16px', boxSizing: 'border-box', marginBottom: '24px' };
const dividerStyle = { height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '0 0 26px 0' };
const entryFeeRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'rgba(255,255,255,0.78)', fontSize: '0.82rem', fontWeight: '700' };
const playBtnStyle = { width: '100%', padding: '14px 0', borderRadius: '20px', border: 'none', fontSize: '0.92rem', fontWeight: '900', letterSpacing: '0.02em', boxShadow: '0 20px 38px rgba(16, 185, 129, 0.24)', display: 'block', maxWidth: '280px', margin: '0 auto' };
const howItWorksContainerStyle = { marginTop: '20px' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.35, fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' };
const howItWorksTextStyle = { fontSize: '0.78rem', lineHeight: '1.6', opacity: 0.38, marginTop: '14px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', fontWeight: '600', border: '1px solid rgba(255,255,255,0.05)' };
const bottomLeftCardStyle = { position: 'fixed', bottom: '32px', left: '28px', width: '210px', borderRadius: '20px', padding: '18px 20px', boxShadow: '0 28px 60px rgba(0,0,0,0.32)', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(12,12,17,0.94)' };
const cardSmallLabelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: '800', opacity: 0.38, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.08em' };
const walletBalanceStyle = { fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.02em' };
const bottomRightCardStyle = { position: 'fixed', bottom: '32px', right: '28px', width: '230px', borderRadius: '20px', padding: '20px', boxShadow: '0 28px 60px rgba(0,0,0,0.32)', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(12,12,17,0.94)' };
const statItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', opacity: 0.65, gap: '14px' };
const footerContainerStyle = { position: 'fixed', bottom: '16px', left: '24px', right: '24px', display: 'flex', justifyContent: 'center', gap: '18px', fontSize: '0.68rem', opacity: 0.28, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' };