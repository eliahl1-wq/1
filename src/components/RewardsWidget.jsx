import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RewardsWidget() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);

    if (!user) return null;

    // Only show if there's an active ticket, locked rewards, or incomplete challenges
    const hasUnusedTicket = user.hasFreeTicket && !user.freeTicketUsed;
    const hasBalance = (user.sponsoredRewardsBalance || 0) > 0;
    const isCompleted = user.sponsoredRewardsCompleted || user.sponsoredRewardsUnlocked;
    
    // If they have no ticket, no balance, and already completed, hide widget or show mini version?
    // Let's show it if they have anything related to rewards going on.
    if (!hasUnusedTicket && !hasBalance && isCompleted) return null;

    const normal5Progress = Math.min(3, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(1, user.completedTenDollarNormalGames ?? 0);

    const toggleExpand = (e) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const goToRewards = () => {
        setExpanded(false);
        navigate('/rewards');
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontFamily: 'var(--font-main)'
        }}>
            {/* Expanded Content */}
            <div style={{
                width: '320px',
                background: 'rgba(20, 24, 30, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                marginBottom: '16px',
                transform: expanded ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                opacity: expanded ? 1 : 0,
                pointerEvents: expanded ? 'auto' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'bottom right'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-h)', fontWeight: '700' }}>
                        Sponsored Rewards
                    </h3>
                    <button 
                        onClick={toggleExpand}
                        style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: '4px' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {hasUnusedTicket && (
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <p style={{ margin: 0, color: '#4ade80', fontSize: '0.85rem', fontWeight: '700' }}>✨ 1 Free Ticket Available</p>
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Locked Balance
                    </p>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-h)' }}>
                        ${(user.sponsoredRewardsBalance || 0).toFixed(2)}
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px', color: 'var(--text-2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Challenges
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '0.85rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={normal5Progress >= 3 ? '#4ade80' : 'var(--text-2)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {normal5Progress >= 3 && <polyline points="20 6 9 17 4 12"></polyline>}
                        </svg>
                        <span style={{ color: normal5Progress >= 3 ? '#4ade80' : 'var(--text-h)' }}>{normal5Progress}/3 $5 Games</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={normal10Progress >= 1 ? '#4ade80' : 'var(--text-2)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {normal10Progress >= 1 && <polyline points="20 6 9 17 4 12"></polyline>}
                        </svg>
                        <span style={{ color: normal10Progress >= 1 ? '#4ade80' : 'var(--text-h)' }}>{normal10Progress}/1 $10 Game</span>
                    </div>
                </div>

                <button 
                    onClick={goToRewards}
                    className="gm-btn gm-btn--primary"
                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
                >
                    View Details
                </button>
            </div>

            {/* Floating Button */}
            <button
                onClick={toggleExpand}
                style={{
                    background: 'linear-gradient(135deg, #4ade80 0%, #10b981 100%)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '56px',
                    height: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                    color: '#064e3b',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12v10H4V12" />
                    <path d="M2 7h20v5H2z" />
                    <path d="M12 22V7" />
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
            </button>
        </div>
    );
}
