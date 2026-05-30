import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [isWalletExpanded, setIsWalletExpanded] = useState(false);
    const [walletTab, setWalletTab] = useState('deposit'); // 'deposit' | 'withdraw'
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const walletDropdownRef = useRef(null);
    const walletExpandRef = useRef(null);
    
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
        if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target) && 
            !event.target.closest('#wallet-trigger')) {
            setIsWalletOpen(false);
        }
        if (walletExpandRef.current && !walletExpandRef.current.contains(event.target)) {
            setIsWalletExpanded(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    return (
        <div style={{...containerStyle, background: '#0f1118'}}>
            <style>{`
                @keyframes pulse-live {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.95); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translate(-50%, -10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                .live-indicator { width: 5px; height: 5px; background: #34C759; border-radius: 50%; animation: pulse-live 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                button { transition: all 0.2s ease !important; cursor: pointer; border: none; outline: none; }
                button:hover:not(:disabled) { filter: brightness(1.15); }
                button:active { transform: scale(0.98); }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .mono { 
                    font-family: ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .glass {
                    background: rgba(20, 20, 22, 0.85);
                    backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
            `}</style>

            <div style={backgroundStyle} />

            <div style={topBarStyle}>
                <h2 style={logoStyle}>AGAR<span style={{ color: '#007AFF' }}>STAKE</span></h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Wallet Balance (removed) */}

                    {/* Wallet Balance Pill */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            id="wallet-trigger"
                            onClick={() => setIsWalletOpen(!isWalletOpen)}
                            style={walletPillButtonStyle}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px', opacity: 0.7}}><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 00-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                            <span className="mono" style={{fontWeight: '700'}}>${user?.balance?.toFixed(3) || '0.000'}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{marginLeft: '8px', opacity: 0.5}}><path d="M6 9l6 6 6-6"/></svg>
                        </button>

                        {isWalletOpen && (
                            <div ref={walletDropdownRef} className="glass" style={walletDropdownCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Value</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="pill-tab active">Balance</button>
                                        <button className="pill-tab">History</button>
                                    </div>
                                </div>
                                
                                <div className="mono" style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px' }}>
                                    ${user?.balance?.toFixed(2) || '0.00'}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                    <button className="pill-tab active" style={{fontSize: '10px', padding: '4px 10px'}}>USD</button>
                                </div>

                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 -24px 16px -24px' }} />

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="mono" style={{ fontSize: '13px', opacity: 0.8 }}>${user?.balance?.toFixed(2)}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{opacity: 0.4}}><path d="M20 11a8.1 8.1 0 00-15.5-2m-.5 5v5h5m10-1a8.1 8.1 0 01-15.5 2m.5-5h5"/></svg>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(true); setWalletTab('deposit'); }} style={dropdownPrimaryBtn}>Deposit</button>
                                    <button onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(true); setWalletTab('withdraw'); }} style={dropdownSecondaryBtn}>Withdraw</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => setIsDepositModalOpen(true)}
                        style={standaloneDepositButtonStyle}
                    >
                        Deposit
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
            </div>

            {isWalletExpanded && (
                <div ref={walletExpandRef} className="glass" style={walletExpandPanelStyle}>
                    <button style={walletCloseX} onClick={() => setIsWalletExpanded(false)}>✕</button>
                    <div style={walletPanelHeader}>
                        <div className="mono" style={walletPanelBalance}>${user?.balance?.toFixed(2) || '0.00'}</div>
                        <div className="live-indicator" />
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

            {/* Standalone Deposit Modal */}
            {isDepositModalOpen && (
                <div style={modalOverlayStyle}>
                    <div className="glass" style={depositModalCardStyle}>
                        <button style={modalCloseXStyle} onClick={() => setIsDepositModalOpen(false)}>✕</button>
                        
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', padding: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '100px', width: 'fit-content' }}>
                            <button onClick={() => setWalletTab('deposit')} className={`pill-tab ${walletTab === 'deposit' ? 'active' : ''}`}>Deposit</button>
                            <button onClick={() => setWalletTab('withdraw')} className={`pill-tab ${walletTab === 'withdraw' ? 'active' : ''}`}>Withdraw</button>
                        </div>

                        <div style={modalInputContainer}>
                            <span className="mono" style={modalInputPrefix}>$</span>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)} 
                                style={modalInputField} 
                            />
                        </div>

                        <button style={modalConfirmButtonStyle}>
                            Confirm {walletTab === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </button>

                        <div style={modalFooterTextStyle}>
                            Network: Solana Devnet • {user?.username}
                        </div>
                    </div>
                </div>
            )}

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
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.35, fontWeight: '600' }}>Entry Fee</span>
                    <span className="mono" style={{ fontSize: '0.75rem', fontWeight: '700' }}>$10.00</span>
                </div>

                <button 
                    onClick={handleStartMatch} 
                    disabled={!canJoin || isMatchmaking}
                    style={{ 
                        ...playBtnStyle, 
                        background: canJoin ? '#34C759' : '#252529',
                        color: canJoin ? 'white' : 'rgba(255,255,255,0.2)',
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
                        <div style={howItWorksTextStyle}>
                            <div>• Entry Fee: $10.00</div>
                            <div>• Starting Balance: $1.00</div>
                            <div>• Grow by eating food and other players</div>
                            <div>• Cash out your balance anytime</div>
                            <div style={{ marginTop: '8px', opacity: 0.5 }}>Leaderboard Rewards:</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1st Place Bonus</span><span>$20.00</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2nd & 3rd Place Bonus</span><span>$10.00</span></div>
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
                    <span className="mono">142</span>
                </div>
                <div style={statItemStyle}>
                    <span>Biggest payout today</span>
                    <span className="mono">$84.20</span>
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
const containerStyle = { width: '100vw', height: '100vh', background: '#020203', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', overflow: 'hidden', position: 'relative', letterSpacing: '-0.01em' };
const backgroundStyle = { position: 'fixed', inset: 0, zIndex: -1, background: '#020203', backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)`, backgroundSize: '64px 64px' };
const topBarStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', zIndex: 1000, background: 'rgba(10, 11, 16, 0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' };
const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', fontSize: '1rem' };

const walletPillButtonStyle = { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 16px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer' };
const standaloneDepositButtonStyle = { background: 'linear-gradient(to right, #4052ee, #a13bf7)', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '100px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(64, 82, 238, 0.3)' };
const depositWithdrawBtnStyle = walletPillButtonStyle;

const walletDropdownCardStyle = { position: 'absolute', top: '48px', left: '50%', transform: 'translateX(-50%)', width: '380px', padding: '24px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 1100, animation: 'slideDown 0.2s ease-out' };
const dropdownPrimaryBtn = { flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: 'linear-gradient(to right, #4052ee, #a13bf7)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
const dropdownSecondaryBtn = { flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const depositModalCardStyle = { width: '400px', padding: '40px', borderRadius: '28px', position: 'relative' };
const modalCloseXStyle = { position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'white', opacity: 0.3, cursor: 'pointer', fontSize: '18px' };
const modalInputContainer = { position: 'relative', marginBottom: '32px' };
const modalInputPrefix = { position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', fontSize: '32px', fontWeight: '600', opacity: 0.2 };
const modalInputField = { width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '48px', fontWeight: '800', outline: 'none', padding: '8px 0 8px 32px' };
const modalConfirmButtonStyle = { width: '100%', padding: '18px', borderRadius: '100px', border: 'none', background: 'linear-gradient(to right, #4052ee, #a13bf7)', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(64, 82, 238, 0.4)' };
const modalFooterTextStyle = { textAlign: 'center', marginTop: '24px', fontSize: '11px', opacity: 0.3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' };

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
const playBtnStyle = { width: '100%', padding: '10px', borderRadius: '12px', border: 'none', fontSize: '0.9rem', fontWeight: '900', letterSpacing: '0.01em', boxShadow: '0 8px 16px rgba(52, 199, 89, 0.25)' };
const howItWorksContainerStyle = { marginTop: '16px' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.2, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' };
const howItWorksTextStyle = { fontSize: '0.7rem', lineHeight: '1.5', opacity: 0.25, marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontWeight: '600' };
const bottomLeftCardStyle = { position: 'fixed', bottom: '24px', left: '24px', width: '180px', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' };
const cardSmallLabelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', opacity: 0.2, textTransform: 'uppercase', marginBottom: '4px' };
const walletBalanceStyle = { fontSize: '1.15rem', fontWeight: '800' };
const bottomRightCardStyle = { position: 'fixed', bottom: '24px', right: '24px', width: '200px', borderRadius: '16px', padding: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '12px' };
const statItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: '600', opacity: 0.5 };
const footerContainerStyle = { position: 'fixed', bottom: '12px', left: '24px', right: '24px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.6rem', opacity: 0.2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' };