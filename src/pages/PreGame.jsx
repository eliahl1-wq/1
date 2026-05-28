import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [walletTab, setWalletTab] = useState('deposit'); // 'deposit' | 'withdraw'
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

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#050505',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui',
            overflow: 'hidden',
            position: 'relative'
        }}>
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.4; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    background: #34C759;
                    border-radius: 50%;
                    display: inline-block;
                    animation: pulse 2s infinite;
                }
                button { transition: all 0.2s ease !important; }
                button:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.1); }
                button:active { transform: scale(0.98); }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .mono { font-family: ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; }
            `}</style>

            {/* Background Map/Grid Effect */}
            <div style={backgroundStyle} />

            {activeModal && <Modal type={activeModal} />}

            {/* Top Bar */}
            <div style={topBarStyle}>
                <h2 style={logoStyle}>AGAR<span style={{ color: '#007AFF' }}>STAKE</span></h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: '600' }}>
                        <div className="pulse-dot" />
                        ${user?.balance?.toFixed(2) || '0.00'}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <div ref={userPillRef} onClick={() => setShowUserMenu(!showUserMenu)} style={avatarPillStyle}>
                            <span style={{ fontWeight: '600', fontSize: '0.85rem', opacity: 0.8 }}>{user?.username}</span>
                            <div style={avatarCircleStyle}>{user?.username?.charAt(0).toUpperCase()}</div>
                        </div>
                    {showUserMenu && (
                        <div ref={userMenuRef} style={userMenuContainerStyle}>
                            <button style={userMenuItemStyle}>Settings</button>
                            <button style={userMenuItemStyle}>Transaction History</button>
                            <button onClick={logout} style={{ ...userMenuItemStyle, color: '#FF3B30', borderTop: '1px solid rgba(255,255,255,0.03)' }}>Log Out</button>
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* CENTER CARD — Join Game */}
            <div style={centerCardStyle}>
                <label style={inputLabelStyle}>Enter nickname</label>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value.substring(0, 15))}
                    placeholder="Your name..."
                    style={nicknameInputStyle}
                />
                
                <div style={dividerStyle} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.4, fontWeight: '600' }}>Entry fee:</span>
                    <span className="mono" style={{ fontSize: '0.85rem', fontWeight: '700' }}>$10.00</span>
                </div>

                <button 
                    onClick={handleStartMatch} 
                    disabled={!canJoin}
                    style={{ 
                        ...playBtnStyle, 
                        background: canJoin ? '#007AFF' : '#252529',
                        color: canJoin ? 'white' : '#5a5a5e',
                        cursor: canJoin ? 'pointer' : 'not-allowed'
                    }}
                >
                    {canJoin ? `Play — $${entryFee.toFixed(2)}` : 'Insufficient balance'}
                </button>

                <div style={howItWorksContainerStyle}>
                    <div onClick={() => setShowHowItWorks(!showHowItWorks)} style={howItWorksToggleStyle}>
                        <span>ℹ How it works</span>
                        <span style={{ transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s' }}>▾</span>
                    </div>
                    {showHowItWorks && (
                        <p style={howItWorksTextStyle}>
                            Your $10 entry is distributed: $1.00 starting stake, $7.00 added to the food pool ($0.01/blob), and $2.00 house fee. 
                            Grow by consuming food or absorbing 100% of other players' balance. Cash out at any time.
                        </p>
                    )}
                </div>
            </div>

            {/* BOTTOM LEFT CARD — Wallet */}
            <div style={bottomLeftCardStyle}>
                <label style={cardSmallLabelStyle}>Wallet</label>
                <h3 className="mono" style={walletBalanceStyle}>${user?.balance?.toFixed(2) || '0.00'}</h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => setActiveModal('deposit')} style={walletBtnSmallStyle}>+ Deposit</button>
                    <button onClick={() => setActiveModal('withdraw')} style={walletBtnGhostStyle}>↑ Withdraw</button>
                </div>
            </div>

            {/* BOTTOM RIGHT CARD — Live Stats */}
            <div style={bottomRightCardStyle}>
                <div style={statItemStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="pulse-dot" /> Players online
                    </span>
                    <span className="mono">142</span>
                </div>
                <div style={statItemStyle}>
                    <span>⚔️ Active games</span>
                    <span className="mono">8</span>
                </div>
                <div style={statItemStyle}>
                    <span>💰 Biggest cash out today</span>
                    <span className="mono">$84.20</span>
                </div>
            </div>

            {/* Footer Links */}
            <div style={footerContainerStyle}>
                <span>Terms of Service</span>
                <span>·</span>
                <span>Provably Fair</span>
                <span>·</span>
                <span>Support</span>
            </div>
        </div>
    );
}

// --- Styles ---
const containerStyle = { width: '100vw', height: '100vh', background: '#020203', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', overflow: 'hidden', position: 'relative', letterSpacing: '-0.01em' };
const backgroundStyle = { position: 'fixed', inset: 0, zIndex: -1, background: '#020203', backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)`, backgroundSize: '64px 64px' };
const topBarStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', zIndex: 1000, background: 'rgba(10, 10, 12, 0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' };
const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', fontSize: '1rem' };
const depositWithdrawBtnStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' };
const avatarPillStyle = { width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.15)', padding: '2px' };
const avatarCircleStyle = { width: '100%', height: '100%', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.65rem' };
const walletExpandPanelStyle = { position: 'absolute', top: '56px', left: '50%', transform: 'translateX(-50%)', width: '280px', padding: '16px', borderRadius: '16px', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 1100 };
const walletCloseX = { position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'white', opacity: 0.3, padding: '4px' };
const walletPanelHeader = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' };
const walletPanelBalance = { fontSize: '1.25rem', fontWeight: '800' };
const walletTabContainer = { display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '10px' };
const walletTabBtn = { flex: 1, padding: '6px', border: 'none', background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: '700', borderRadius: '8px' };
const walletTabActive = { background: 'rgba(255,255,255,0.08)', color: 'white' };
const walletInputArea = { position: 'relative', display: 'flex', alignItems: 'center' };
const walletInputPrefix = { position: 'absolute', left: '12px', fontSize: '0.85rem', opacity: 0.2, fontWeight: '800' };
const walletInput = { width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px 10px 10px 24px', color: 'white', fontWeight: '700', fontSize: '0.9rem', outline: 'none' };
const walletMaxBtn = { position: 'absolute', right: '8px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '800' };
const walletConfirmBtn = { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#007AFF', color: 'white', fontWeight: '800', fontSize: '0.8rem' };
const walletPanelFooter = { textAlign: 'center', fontSize: '0.6rem', opacity: 0.2, fontWeight: '700', marginTop: '4px' };
const userMenuContainerStyle = { position: 'absolute', top: '40px', right: 0, width: '160px', background: '#1c1c1e', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' };
const userMenuHeader = { padding: '10px 14px', fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const userMenuItemStyle = { width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'white', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600' };
const centerCardStyle = { width: '320px', borderRadius: '20px', padding: '24px', zIndex: 10 };
const inputLabelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: '800', opacity: 0.2, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '8px' };
const nicknameInputStyle = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '0.95rem', fontWeight: '700', outline: 'none', padding: '12px 16px', borderRadius: '12px', boxSizing: 'border-box', marginBottom: '24px' };
const dividerStyle = { height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '0 0 24px 0' };
const playBtnStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '0.9rem', fontWeight: '900', letterSpacing: '0.01em', boxShadow: '0 8px 16px rgba(0, 122, 255, 0.25)' };
const howItWorksContainerStyle = { marginTop: '16px' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.2, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' };
const howItWorksTextStyle = { fontSize: '0.7rem', lineHeight: '1.5', opacity: 0.25, marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontWeight: '600' };
const bottomLeftCardStyle = { position: 'fixed', bottom: '24px', left: '24px', width: '180px', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' };
const cardSmallLabelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', opacity: 0.2, textTransform: 'uppercase', marginBottom: '4px' };
const walletBalanceStyle = { fontSize: '1.15rem', fontWeight: '800' };
const bottomRightCardStyle = { position: 'fixed', bottom: '24px', right: '24px', width: '200px', borderRadius: '16px', padding: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '12px' };
const statItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: '600', opacity: 0.5 };
const footerContainerStyle = { position: 'fixed', bottom: '12px', left: '24px', right: '24px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.6rem', opacity: 0.2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' };