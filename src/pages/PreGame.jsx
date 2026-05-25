import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    
    const [nickname, setNickname] = useState(localStorage.getItem('match_nickname') || user?.username || '');
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [activeModal, setActiveModal] = useState(null); // null, 'deposit', 'withdraw'
    const [amount, setAmount] = useState('');

    const entryFee = 10.00;
    const canJoin = (user?.balance || 0) >= entryFee;

    const handleStartMatch = () => {
        if (!canJoin) return;
        localStorage.setItem('match_nickname', nickname);
        navigate('/game', { state: { nickname } });
    };

    // Stäng menyn om man klickar utanför
    const handleClickOutside = useCallback((event) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target) &&
            userPillRef.current && !userPillRef.current.contains(event.target)) {
            setShowUserMenu(false);
        }
        if (event.target.id === 'modal-overlay') {
            setActiveModal(null);
            setAmount('');
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    const Modal = ({ type }) => (
        <div id="modal-overlay" style={modalOverlayStyle}>
            <div style={modalCardStyle}>
                <button onClick={() => setActiveModal(null)} style={closeBtnStyle}>✕</button>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: '800' }}>
                    {type === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
                </h3>
                <div style={inputWrapperStyle}>
                    <span style={currencyPrefixStyle}>$</span>
                    <input 
                        type="number" 
                        placeholder="0.00" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={modalInputStyle} 
                    />
                    <button 
                        style={maxBtnStyle}
                        onClick={() => setAmount(type === 'withdraw' ? user?.balance?.toFixed(2) : '100')}
                    >MAX</button>
                </div>
                <button style={modalConfirmBtnStyle} onClick={() => setActiveModal(null)}>
                    Confirm {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                </button>
                <p style={modalSubtextView}>
                    {type === 'deposit' ? 'Connected: Phantom Wallet (Devnet)' : 'Processing: 1-2 minutes to your wallet'}
                </p>
            </div>
        </div>
    );

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#050505',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            fontFamily: 'system-ui',
            overflowY: 'auto',
            padding: '120px 20px 60px 20px',
            boxSizing: 'border-box'
        }}>
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse-dot {
                    width: 8px;
                    height: 8px;
                    background: #34C759;
                    border-radius: 50%;
                    display: inline-block;
                    margin-right: 8px;
                    animation: pulse 2s infinite;
                }
                button { transition: all 0.2s ease !important; }
                button:hover { transform: scale(1.02); filter: brightness(1.2); }
                button:active { transform: scale(0.98); }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            `}</style>

            {activeModal && <Modal type={activeModal} />}

            {/* Top Bar */}
            <div style={topBarStyle}>
                <h2 style={logoStyle}>AGAR<span style={{ color: '#007AFF' }}>STAKE</span></h2>
                <div style={{ position: 'relative' }}>
                    <div ref={userPillRef} onClick={() => setShowUserMenu(!showUserMenu)} style={avatarPillStyle}>
                        <div style={avatarCircleStyle}>{user?.username?.charAt(0).toUpperCase()}</div>
                        <span style={{ fontWeight: '600' }}>{user?.username}</span>
                    </div>
                    {showUserMenu && (
                        <div ref={userMenuRef} style={userMenuContainerStyle}>
                            <button style={userMenuItemStyle}>Settings</button>
                            <button style={userMenuItemStyle}>Transaction History</button>
                            <button onClick={logout} style={{ ...userMenuItemStyle, color: '#FF3B30', borderTop: '1px solid rgba(255,255,255,0.05)' }}>Log Out</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Container */}
            <div style={mainContentStyle}>
                {/* Hero / Balance Section */}
                <div style={heroSectionStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <h1 style={balanceTextStyle}>${user?.balance?.toFixed(2) || '0.00'}</h1>
                        <div className="pulse-dot"></div>
                    </div>
                    <p style={balanceSubtextStyle}>Available balance</p>
                    
                    <div style={{ display: 'flex', gap: '12px', marginTop: '25px', width: '100%' }}>
                        <button onClick={() => setActiveModal('deposit')} style={depositPillStyle}>+ Deposit</button>
                        <button onClick={() => setActiveModal('withdraw')} style={withdrawPillStyle}>↑ Withdraw</button>
                    </div>
                </div>

                {/* Game Info Card */}
                <div style={gameCardStyle}>
                    <div style={entryFeeBoxStyle}>
                        <span style={entryFeeLabelStyle}>ENTRY FEE</span>
                        <h2 style={entryFeeValueStyle}>$10.00 <span style={{ fontSize: '1rem', opacity: 0.4 }}>to join</span></h2>
                    </div>

                    <div style={statsBoxStyle}>
                        <div style={statRowStyle}>
                            <span><span className="pulse-dot"></span> Players online</span>
                            <span style={monoStyle}>42</span>
                        </div>
                        <div style={statRowStyle}>
                            <span>⚔️ Active games</span>
                            <span style={monoStyle}>12</span>
                        </div>
                        <div style={statRowStyle}>
                            <span>💰 Biggest cash out today</span>
                            <span style={monoStyle}>$542.20</span>
                        </div>
                    </div>

                    <div style={howItWorksContainerStyle}>
                        <div onClick={() => setShowHowItWorks(!showHowItWorks)} style={howItWorksToggleStyle}>
                            <span>How it works</span>
                            <span style={{ transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s' }}>▼</span>
                        </div>
                        {showHowItWorks && (
                            <p style={howItWorksTextStyle}>
                                AgarStake is a growth-based economy arena. Your $10 entry is split: $4 platform fee, 
                                $1 starting cell size ($ balance), and $5 is distributed as food blobs ($0.01 each) 
                                across the map. Grow by eating food or absorbing 100% of other players' stakes. 
                                Cash out at any time to secure your current balance. Top 3 players receive 
                                additional payout bonuses.
                            </p>
                        )}
                    </div>
                </div>

                {/* Nickname Input */}
                <div style={{ width: '100%', marginBottom: '20px' }}>
                    <label style={inputLabelStyle}>MATCH NICKNAME</label>
                    <input 
                        type="text" 
                        value={nickname} 
                        onChange={(e) => setNickname(e.target.value.substring(0, 15))}
                        placeholder="The Great Blob"
                        style={nicknameInputStyle}
                    />
                </div>

                {/* Join Button */}
                <button 
                    onClick={handleStartMatch} 
                    disabled={!canJoin}
                    style={{ 
                        ...joinBtnStyle, 
                        background: canJoin ? '#007AFF' : '#2c2c2e',
                        color: canJoin ? 'white' : '#8e8e93',
                        cursor: canJoin ? 'pointer' : 'not-allowed'
                    }}
                >
                    {canJoin ? `Join Game — $${entryFee.toFixed(2)}` : 'Insufficient balance'}
                </button>
            </div>

            {/* Bottom Links */}
            <div style={bottomLinksStyle}>
                Terms of Service  ·  Provably Fair  ·  Support
            </div>
        </div>
    );
}

// --- Styles ---
const topBarStyle = {
    position: 'absolute', top: 0, left: 0, right: 0, height: '80px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 40px', zIndex: 100
};

const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1.5px', fontSize: '1.6rem' };

const avatarPillStyle = {
    display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)',
    padding: '6px 16px 6px 6px', borderRadius: '100px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)'
};

const avatarCircleStyle = {
    width: '32px', height: '32px', background: '#007AFF', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem'
};

const mainContentStyle = {
    width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center'
};

const heroSectionStyle = {
    width: '100%', textAlign: 'center', marginBottom: '40px'
};

const balanceTextStyle = { fontSize: '4rem', fontWeight: '900', margin: 0, letterSpacing: '-2px', fontFamily: 'monospace' };
const balanceSubtextStyle = { margin: '5px 0 0 0', opacity: 0.4, fontSize: '0.9rem', fontWeight: '600' };

const depositPillStyle = {
    flex: 1, padding: '14px', borderRadius: '100px', border: 'none', background: '#34C759',
    color: 'white', fontWeight: '700', fontSize: '1rem', cursor: 'pointer'
};

const withdrawPillStyle = {
    flex: 1, padding: '14px', borderRadius: '100px', background: 'transparent',
    color: 'white', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)'
};

const gameCardStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(40px)',
    borderRadius: '32px', border: '1px solid rgba(255,255,255,0.06)', padding: '30px',
    boxSizing: 'border-box', marginBottom: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
};

const entryFeeBoxStyle = { textAlign: 'center', marginBottom: '25px', paddingBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const entryFeeLabelStyle = { fontSize: '0.75rem', fontWeight: '800', opacity: 0.3, letterSpacing: '2px' };
const entryFeeValueStyle = { margin: '10px 0 0 0', fontSize: '2.5rem', fontWeight: '900' };

const statsBoxStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };
const statRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: '500', opacity: 0.8 };
const monoStyle = { fontFamily: 'monospace', fontWeight: '700' };

const howItWorksContainerStyle = { marginTop: '25px' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', opacity: 0.4, fontSize: '0.85rem', fontWeight: '700' };
const howItWorksTextStyle = { fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.3, marginTop: '15px', textAlign: 'left' };

const inputLabelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '800', opacity: 0.3, letterSpacing: '1px', marginBottom: '10px', marginLeft: '10px' };
const nicknameInputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    padding: '16px 20px', borderRadius: '16px', color: 'white', fontSize: '1.1rem', fontWeight: '600', outline: 'none', boxSizing: 'border-box'
};

const joinBtnStyle = {
    width: '100%', padding: '22px', borderRadius: '20px', border: 'none',
    fontSize: '1.3rem', fontWeight: '900', letterSpacing: '-0.5px'
};

const bottomLinksStyle = { marginTop: '40px', fontSize: '0.8rem', opacity: 0.2, fontWeight: '600', letterSpacing: '0.5px' };

const userMenuContainerStyle = {
    position: 'absolute', top: '55px', right: 0, width: '220px', background: '#1c1c1e',
    borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
};

const userMenuItemStyle = {
    width: '100%', padding: '14px 20px', background: 'none', border: 'none',
    color: 'white', textAlign: 'left', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer'
};

const modalOverlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
};

const modalCardStyle = {
    width: '100%', maxWidth: '400px', background: '#1c1c1e', borderRadius: '32px',
    padding: '40px', position: 'relative', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'
};

const inputWrapperStyle = {
    position: 'relative', display: 'flex', alignItems: 'center', background: 'black',
    borderRadius: '16px', padding: '10px 20px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.1)'
};

const modalInputStyle = {
    width: '100%', background: 'none', border: 'none', color: 'white',
    fontSize: '2rem', fontWeight: '700', outline: 'none', fontFamily: 'monospace'
};

const currencyPrefixStyle = { fontSize: '1.5rem', fontWeight: '700', opacity: 0.3, marginRight: '10px' };
const maxBtnStyle = { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '8px', fontWeight: '800', fontSize: '0.7rem', cursor: 'pointer' };
const modalConfirmBtnStyle = { width: '100%', padding: '18px', borderRadius: '16px', border: 'none', background: '#007AFF', color: 'white', fontWeight: '800', fontSize: '1.1rem', cursor: 'pointer' };
const modalSubtextView = { fontSize: '0.8rem', opacity: 0.3, marginTop: '20px', fontWeight: '600' };
const closeBtnStyle = { position: 'absolute', top: '25px', right: '25px', background: 'none', border: 'none', color: 'white', opacity: 0.3, fontSize: '1.2rem', cursor: 'pointer' };
                    <div 
                        onClick={() => setShowArenaInfo(!showArenaInfo)} 
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            marginBottom: showArenaInfo ? '20px' : '0'
                        }}
                    >
                        <h3 style={{ ...cardTitleStyle, margin: 0, opacity: 0.8, letterSpacing: '1px' }}>ARENA INFORMATION</h3>
                        <span style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.5)' }}>
                            {showArenaInfo ? '▲' : '▼'}
                        </span>
                    </div>
                    
                    {showArenaInfo && (
                        <div>
                            <div style={infoRowStyle}>
                                <span>Entry Fee</span>
                                <span style={{ color: '#FF3B30' }}>$10.00</span>
                            </div>
                            <div style={infoRowStyle}>
                                <span>Starting Stake</span>
                                <span style={{ color: '#34C759' }}>$1.00</span>
                            </div>
                            <div style={infoRowStyle}>
                                <span>Food Reward</span>
                                <span>$0.01 per blob</span>
                            </div>
                            <div style={infoRowStyle}>
                                <span>Player Absorption</span>
                                <span>100% of balance</span>
                            </div>
                            
                            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0, 122, 255, 0.05)', borderRadius: '15px', border: '1px solid rgba(0, 122, 255, 0.1)' }}>
                                <p style={{ margin: '0 0 10px 0', fontWeight: '700', fontSize: '0.8rem', color: '#007AFF' }}>LEADERBOARD BONUSES</p>
                                <div style={infoRowStyle}>
                                    <span style={{ fontSize: '0.8rem' }}>#1 Rank Bonus</span>
                                    <span style={{ fontWeight: '800', color: '#FFD700' }}>+$20.00</span>
                                </div>
                                <div style={infoRowStyle}>
                                    <span style={{ fontSize: '0.8rem' }}>#2-3 Rank Bonus</span>
                                    <span style={{ fontWeight: '800', color: '#C0C0C0' }}>+$10.00</span>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '20px', lineHeight: '1.4' }}>
                                Rules: Map is open world. No shrinking zone. You lose your stake if eaten. Cash out at any time to secure profits.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Styles ---
const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(40px)',
    padding: '30px 40px',
    borderRadius: '32px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
};

const cardTitleStyle = {
    margin: '0 0 25px 0',
    fontSize: '0.9rem',
    letterSpacing: '3px',
    fontWeight: '900',
    opacity: 0.4,
    textTransform: 'uppercase'
};

const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '10px',
    opacity: 0.6
};

const inputStyle = {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '15px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '1.1rem',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box'
};

const infoRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '0.95rem'
};

const startMatchBtnStyle = {
    background: 'linear-gradient(180deg, #007AFF 0%, #005DCB 100%)',
    color: 'white',
    border: 'none',
    padding: '18px 40px',
    borderRadius: '16px',
    fontSize: '1.2rem',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 15px 40px rgba(0, 122, 255, 0.4)',
    transition: '0.3s transform ease'
};

const userPillStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '12px 28px',
    borderRadius: '100px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: '0.2s all ease',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
};

const userMenuContainerStyle = {
    position: 'absolute', 
    top: '65px', 
    right: '0', 
    width: '200px',
    background: 'rgba(28, 28, 30, 0.95)',
    borderRadius: '14px',
    overflow: 'hidden',
    backdropFilter: 'blur(30px)',
    border: '0.5px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
};

const userMenuItemStyle = {
    width: '100%',
    padding: '14px 18px',
    background: 'none',
    border: 'none',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '1rem',
    transition: 'background 0.2s ease',
    '&:hover': {
        background: 'rgba(255,255,255,0.1)'
    }
};

const userMenuItemDangerStyle = {
    color: '#FF3B30'
};

const userMenuItemSuccessStyle = {
    color: '#34C759'
};