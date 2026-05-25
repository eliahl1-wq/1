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
                        type="text" 
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
                    {type === 'deposit' ? 'Network: Solana Devnet' : 'Processing: 1-2 minutes to your wallet'}
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
const backgroundStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    background: '#050505',
    backgroundImage: `
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
    `,
    backgroundSize: '50px 50px',
    filter: 'blur(0.5px)'
};

const topBarStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 24px', zIndex: 1000, background: 'rgba(10, 10, 12, 0.6)',
    backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
};

const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1.2px', fontSize: '1.2rem' };

const avatarPillStyle = {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 4px 4px 12px',
    borderRadius: '100px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)'
};

const avatarCircleStyle = {
    width: '28px', height: '28px', background: '#007AFF', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.75rem'
};

const centerCardStyle = {
    width: '320px', background: 'rgba(20, 20, 22, 0.8)', backdropFilter: 'blur(24px)',
    borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '24px',
    boxShadow: '0 30px 60px rgba(0,0,0,0.4)', zIndex: 10
};

const inputLabelStyle = { display: 'block', fontSize: '0.7rem', fontWeight: '700', opacity: 0.3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' };

const nicknameInputStyle = {
    width: '100%', background: 'transparent', border: 'none', color: 'white',
    fontSize: '1rem', fontWeight: '600', outline: 'none', padding: '4px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)', boxSizing: 'border-box', marginBottom: '20px'
};

const dividerStyle = { height: '1px', background: 'rgba(255, 255, 255, 0.04)', margin: '0 0 20px 0' };

const playBtnStyle = {
    width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
    fontSize: '1rem', fontWeight: '800', letterSpacing: '-0.2px'
};

const howItWorksContainerStyle = { marginTop: '16px', textAlign: 'center' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: 0.3, fontSize: '0.7rem', fontWeight: '700' };
const howItWorksTextStyle = { fontSize: '0.7rem', lineHeight: '1.4', opacity: 0.3, marginTop: '12px', textAlign: 'left', padding: '0 4px' };

const bottomLeftCardStyle = {
    position: 'fixed', bottom: '32px', left: '32px', width: '260px',
    background: 'rgba(20, 20, 22, 0.7)', backdropFilter: 'blur(16px)',
    borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
};

const cardSmallLabelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: '700', opacity: 0.3, textTransform: 'uppercase', marginBottom: '4px' };
const walletBalanceStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '800' };

const walletBtnSmallStyle = { flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#34C759', color: 'white', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' };
const walletBtnGhostStyle = { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'transparent', color: 'white', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' };

const bottomRightCardStyle = {
    position: 'fixed', bottom: '32px', right: '32px', width: '260px',
    background: 'rgba(20, 20, 22, 0.7)', backdropFilter: 'blur(16px)',
    borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px 20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '8px'
};

const statItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '500', opacity: 0.6 };

const footerContainerStyle = {
    position: 'fixed', bottom: '12px', left: 0, right: 0, display: 'flex',
    justifyContent: 'center', gap: '12px', fontSize: '0.65rem', opacity: 0.15, fontWeight: '700'
};

const userMenuContainerStyle = {
    position: 'absolute', top: '48px', right: 0, width: '180px', background: '#1c1c1e',
    borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)'
};

const userMenuItemStyle = {
    width: '100%', padding: '10px 16px', background: 'none', border: 'none',
    color: 'white', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
};

const modalOverlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px'
};

const modalCardStyle = {
    width: '100%', maxWidth: '340px', background: '#141416', borderRadius: '24px',
    padding: '32px', position: 'relative', border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 40px 80px rgba(0,0,0,0.5)'
};

const inputWrapperStyle = {
    position: 'relative', display: 'flex', alignItems: 'center', background: '#0a0a0c',
    borderRadius: '12px', padding: '8px 16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)'
};

const modalInputStyle = {
    width: '100%', background: 'none', border: 'none', color: 'white',
    fontSize: '1.5rem', fontWeight: '700', outline: 'none', fontFamily: 'ui-monospace, monospace'
};

const currencyPrefixStyle = { fontSize: '1.2rem', fontWeight: '700', opacity: 0.2, marginRight: '8px' };
const maxBtnStyle = { background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.6rem', cursor: 'pointer' };
const modalConfirmBtnStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#007AFF', color: 'white', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer' };
const modalSubtextView = { fontSize: '0.7rem', opacity: 0.2, marginTop: '16px', textAlign: 'center', fontWeight: '600' };
const closeBtnStyle = { position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', opacity: 0.2, fontSize: '1rem', cursor: 'pointer' };
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