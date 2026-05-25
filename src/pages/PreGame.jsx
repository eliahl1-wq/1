import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [nickname, setNickname] = useState(user?.username || '');
    const [showProfileSettings, setShowProfileSettings] = useState(false);

    const handleStartMatch = () => {
        navigate('/game', { state: { nickname } });
    };

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
            <div style={{ position: 'absolute', top: '40px', width: '90%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
                    AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
                </h2>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <button onClick={() => navigate('/lobby')} style={smallBtnStyle}>Back to Main</button>
                    <button onClick={logout} style={{ ...smallBtnStyle, color: '#FF3B30' }}>Logout</button>
                </div>
            </div>

            <div style={{ width: '1000px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px' }}>
                
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

                    <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                        <button onClick={() => alert('Deposit modal would open here')} style={{ ...actionBtnStyle, background: '#34C759' }}>DEPOSIT</button>
                        <button onClick={() => alert('Withdrawal request sent')} style={{ ...actionBtnStyle, background: 'rgba(255,255,255,0.1)' }}>WITHDRAW</button>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '20px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>CURRENT BALANCE</p>
                            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#34C759' }}>${user?.balance?.toFixed(2) || '0.00'}</p>
                        </div>
                        <button onClick={() => setShowProfileSettings(!showProfileSettings)} style={profileBtnStyle}>
                            {showProfileSettings ? 'CLOSE SETTINGS' : 'PROFILE SETTINGS'}
                        </button>
                    </div>

                    {showProfileSettings && (
                        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Account: {user?.username}</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Avatar: Default</p>
                            <button style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: '5px', fontSize: '0.7rem', cursor: 'pointer' }}>Change Password</button>
                        </div>
                    )}
                </div>

                {/* Right Column: Game Info & Rules */}
                <div style={cardStyle}>
                    <h3 style={cardTitleStyle}>ARENA INFORMATION</h3>
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
            </div>

            {/* Final Action */}
            <div style={{ marginTop: '50px', textAlign: 'center' }}>
                <button 
                    onClick={handleStartMatch}
                    style={startMatchBtnStyle}
                >
                    JOIN ARENA MATCH
                </button>
                <p style={{ opacity: 0.3, fontSize: '0.8rem', marginTop: '15px' }}>Sustaining $10 entry fee upon joining.</p>
            </div>
        </div>
    );
}

// --- Styles ---
const cardStyle = {
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(40px)',
    padding: '40px',
    borderRadius: '32px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
};

const cardTitleStyle = {
    margin: '0 0 25px 0',
    fontSize: '0.85rem',
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

const actionBtnStyle = {
    flex: 1,
    border: 'none',
    padding: '15px',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '800',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: '0.2s all ease'
};

const profileBtnStyle = {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer'
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
    padding: '22px 60px',
    borderRadius: '20px',
    fontSize: '1.4rem',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 15px 40px rgba(0, 122, 255, 0.4)',
    transition: '0.3s transform ease'
};

const smallBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.9rem'
};