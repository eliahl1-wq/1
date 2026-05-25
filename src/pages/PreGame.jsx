import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const [nickname, setNickname] = useState(user?.username || '');
    const [showProfileSettings, setShowProfileSettings] = useState(false);

    const handleStartMatch = () => {
        navigate('/game', { state: { nickname } });
    };

    const [showArenaInfo, setShowArenaInfo] = useState(false);

    // Stäng menyn om man klickar utanför
    const handleClickOutside = useCallback((event) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target) &&
            userPillRef.current && !userPillRef.current.contains(event.target)) {
            setShowUserMenu(false);
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
            overflowY: 'auto',
            padding: '40px 0'
        }}>
            {/* Header / Navigation */}
            <div style={{ position: 'absolute', top: '40px', left: '40px', zIndex: 10 }}>
                <h2 style={{ margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
                    AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
                </h2>
            </div>

            {/* iOS Style User Pill */}
            <div style={{ position: 'absolute', top: '40px', right: '40px', zIndex: 100 }}>
                {user && (
                    <div style={{ position: 'relative', fontFamily: 'system-ui' }}>
                        <div 
                            ref={userPillRef}
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                ...userPillStyle,
                                border: showUserMenu ? '1px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.08)'
                            }}
                        >
                            <span style={{ fontWeight: '600', fontSize: '1.1rem', letterSpacing: '-0.3px' }}>{user.username}</span>
                            <span style={{ color: '#34C759', fontWeight: '700', fontSize: '1.1rem' }}>
                                ${user.balance?.toFixed(2) || '0.00'}
                            </span>
                        </div>

                        {showUserMenu && (
                            <div ref={userMenuRef} style={userMenuContainerStyle}>
                                <button onClick={() => alert('Deposit modal would open here')} style={{ ...userMenuItemStyle, ...userMenuItemSuccessStyle }}>
                                    Deposit
                                </button>
                                <button onClick={() => alert('Withdrawal request sent')} style={userMenuItemStyle}>
                                    Withdraw
                                </button>
                                <button onClick={() => { setShowProfileSettings(!showProfileSettings); setShowUserMenu(false); }} style={userMenuItemStyle}>
                                    {showProfileSettings ? 'Close Profile' : 'Profile Settings'}
                                </button>
                                {showProfileSettings && (
                                    <div style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.2)', borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
                                        <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', opacity: 0.7 }}>Account: {user?.username}</p>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', opacity: 0.7 }}>Avatar: Default</p>
                                        <button style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: '5px', fontSize: '0.7rem', cursor: 'pointer' }}>Change Password</button>
                                    </div>
                                )}
                                <button 
                                    onClick={logout}
                                    style={{ ...userMenuItemStyle, ...userMenuItemDangerStyle, borderTop: '0.5px solid rgba(255,255,255,0.1)' }}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', marginTop: '40px', maxWidth: '600px', width: '90%' }}>
                
                {/* Left Column: Match Setup & Profile */}
                <div style={cardStyle}>
                    <h3 style={cardTitleStyle}>MATCH SETUP</h3>
                    
                    <div style={{ marginBottom: '25px' }}>
                        <label style={labelStyle}>MATCH NICKNAME</label>
                        <input 
                            type="text" 
                            value={nickname} 
                            onChange={(e) => setNickname(e.target.value.substring(0, 15))}
                            placeholder="Enter nickname..."
                            style={inputStyle}
                        />
                        <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '5px' }}>This name will be visible in the arena.</p>
                    </div>

                    <button 
                        onClick={handleStartMatch}
                        style={startMatchBtnStyle}
                    >
                        JOIN ARENA MATCH
                    </button>
                    <p style={{ opacity: 0.3, fontSize: '0.8rem', marginTop: '15px' }}>Sustaining $10 entry fee upon joining.</p>
                </div>

                {/* Collapsible Arena Information */}
                <div style={{ ...cardStyle, padding: '20px 30px' }}>
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